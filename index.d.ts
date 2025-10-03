// Type definitions for react-native-better-queue
// Project: https://github.com/akinoniku/react-native-better-queue
// Definitions by: Project maintainers

import EventEmitter = require('eventemitter3');

declare class BetterQueue<T = any, R = any> extends EventEmitter {
  constructor(options: BetterQueue.QueueOptions<T, R>);
  constructor(process: BetterQueue.ProcessFunction<T, R>, options?: Partial<BetterQueue.QueueOptions<T, R>>);

  push(task: T, cb?: (err: any, result: R) => void): BetterQueue.Ticket;

  cancel(taskId: any, cb?: () => void): void;

  pause(): void;

  resume(): void;

  destroy(cb: () => void): void;

  use(store: BetterQueue.Store<T> | string | BetterQueue.StoreOptions): void;

  getStats(): BetterQueue.QueueStats;

  resetStats(): void;

  on(event: 'task_queued', listener: (taskId: any, task: T) => void): this;
  on(event: 'task_accepted', listener: (taskId: any, task: T) => void): this;
  on(event: 'task_started', listener: (taskId: any, task: T) => void): this;
  on(event: 'task_finish', listener: (taskId: any, result: R, stats: BetterQueue.TaskStats) => void): this;
  on(event: 'task_failed', listener: (taskId: any, errorMessage: any, stats: BetterQueue.TaskStats) => void): this;
  on(event: 'task_progress', listener: (taskId: any, progress: BetterQueue.TicketProgress) => void): this;
  on(event: 'task_retry', listener: (taskId: any, retries: number) => void): this;
  on(event: 'batch_finish', listener: (result: any) => void): this;
  on(event: 'batch_failed', listener: (error: any) => void): this;
  on(event: 'batch_progress', listener: (progress: BetterQueue.BatchProgress) => void): this;
  on(event: 'drain', listener: () => void): this;
  on(event: 'empty', listener: () => void): this;
  on(event: 'error', listener: (err: any) => void): this;
  on(event: BetterQueue.QueueEvent, listener: (...args: any[]) => void): this;
}

declare namespace BetterQueue {
  interface QueueOptions<T, R> {
    process: ProcessFunction<T, R>;
    filter?(task: T, cb: (error: any, task: T | false | null | undefined) => void): void;
    merge?(oldTask: T, newTask: T, cb: (error: any, mergedTask: T) => void): void;
    priority?(task: T, cb: (error: any, priority: number) => void): void;
    precondition?(cb: (error: any, passOrFail: boolean) => void): void;
    id?: keyof T | ((task: T, cb: (error: any, id: any) => void) => void);
    cancelIfRunning?: boolean;
    autoResume?: boolean;
    failTaskOnProcessException?: boolean;
    filo?: boolean;
    batchSize?: number;
    batchDelay?: number;
    batchDelayTimeout?: number;
    concurrent?: number;
    maxTimeout?: number;
    afterProcessDelay?: number;
    maxRetries?: number;
    retryDelay?: number;
    storeMaxRetries?: number;
    storeRetryTimeout?: number;
    preconditionRetryTimeout?: number;
    store?: string | StoreOptions | Store<T>;
    setImmediate?: (fn: (...args: any[]) => void) => any;
  }

  // Note: when batchSize > 1, task will be an array of T.
  type ProcessFunction<T, R> = (task: T | T[], cb: ProcessFunctionCb<R>) => void;

  type ProcessFunctionCb<R> = (error?: any, result?: R) => void;

  type QueueEvent =
    | 'task_queued'
    | 'task_accepted'
    | 'task_started'
    | 'task_finish'
    | 'task_failed'
    | 'task_progress'
    | 'task_retry'
    | 'batch_finish'
    | 'batch_failed'
    | 'batch_progress'
    | 'drain'
    | 'empty'
    | 'error';

  type TicketEvent =
    | 'accepted'
    | 'queued'
    | 'unqueued'
    | 'started'
    | 'progress'
    | 'finish'
    | 'failed'
    | 'stopped';

  interface Store<T> {
    connect(cb: (error: any, length: number) => void): void;

    getTask(taskId: any, cb: (error: any, task: T | undefined) => void): void;

    deleteTask(taskId: any, cb: () => void): void;

    putTask(taskId: any, task: T, priority: number | undefined, cb: (error: any) => void): void;

    takeFirstN(n: number, cb: (error: any, lockId: string | number) => void): void;

    takeLastN(n: number, cb: (error: any, lockId: string | number) => void): void;

    getLock(lockId: string | number, cb: (error: any, tasks: { [taskId: string]: T } | undefined) => void): void;

    releaseLock(lockId: string | number, cb: (error: any) => void): void;

    getRunningTasks?(cb: (error: any, running: { [lockId: string]: { [taskId: string]: T } }) => void): void;

    close?(cb: (error?: any) => void): void;
  }

  interface StoreOptions {
    type: string;
    [key: string]: any;
  }

  class Ticket extends EventEmitter {
    on(event: TicketEvent, listener: (...args: any[]) => void): this;
  }

  interface TicketProgress {
    eta: string;
    pct: number;
    complete: number;
    total: number;
    message?: string;
  }

  interface BatchProgress {
    tasks: { [id: string]: TicketProgress };
    complete: number;
    total: number;
    eta: string;
    message?: string;
  }

  interface QueueStats {
    total: number;
    average: number;
    successRate: number;
    peak: number;
  }

  interface TaskStats {
    elapsed?: number;
  }
}

export = BetterQueue;
