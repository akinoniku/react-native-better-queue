var uuidCounter = 0;

function stableSort(arr, compare) {
  var wrapper = arr.map(function (item, idx) {
    return { item: item, idx: idx };
  });

  wrapper.sort(function (a, b) {
    var compared = compare(a.item, b.item);
    if (compared !== 0) {
      return compared;
    }
    return a.idx - b.idx;
  });

  return wrapper.map(function (w) { return w.item; });
}

function MemoryStore() {
  this._queue = [];
  this._tasks = {};
  this._priorities = {};
  this._running = {};
}

MemoryStore.prototype.connect = function (cb) {
  cb(null, this._queue.length);
};

MemoryStore.prototype.getTask = function (taskId, cb) {
  cb(null, this._tasks[taskId]);
};

MemoryStore.prototype.deleteTask = function (taskId, cb) {
  var hadTask = this._tasks[taskId];
  delete this._tasks[taskId];
  delete this._priorities[taskId];
  if (hadTask) {
    var index = this._queue.indexOf(taskId);
    if (index !== -1) {
      this._queue.splice(index, 1);
    }
  }
  cb();
};

MemoryStore.prototype.putTask = function (taskId, task, priority, cb) {
  var hadTask = this._tasks[taskId];
  this._tasks[taskId] = task;
  if (!hadTask) {
    this._queue.push(taskId);
  }
  if (priority !== undefined) {
    this._priorities[taskId] = priority;
    var self = this;
    this._queue = stableSort(this._queue, function (a, b) {
      if (self._priorities[a] < self._priorities[b]) return 1;
      if (self._priorities[a] > self._priorities[b]) return -1;
      return 0;
    });
  }
  cb();
};

MemoryStore.prototype._takeN = function (n, cb, fromStart) {
  var lockId = uuidCounter++;
  var taskIds;
  if (fromStart) {
    taskIds = this._queue.splice(0, n);
  } else {
    taskIds = this._queue.splice(-n).reverse();
  }
  var tasks = {};
  for (var i = 0; i < taskIds.length; i++) {
    var taskId = taskIds[i];
    tasks[taskId] = this._tasks[taskId];
    delete this._tasks[taskId];
  }
  if (taskIds.length > 0) {
    this._running[lockId] = tasks;
  }
  cb(null, lockId);
};

MemoryStore.prototype.takeFirstN = function (n, cb) {
  this._takeN(n, cb, true);
};

MemoryStore.prototype.takeLastN = function (n, cb) {
  this._takeN(n, cb, false);
};

MemoryStore.prototype.getLock = function (lockId, cb) {
  cb(null, this._running[lockId]);
};

MemoryStore.prototype.getRunningTasks = function (cb) {
  cb(null, this._running);
};

MemoryStore.prototype.releaseLock = function (lockId, cb) {
  delete this._running[lockId];
  cb();
};

module.exports = MemoryStore;
