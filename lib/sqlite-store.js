var uuid = require('./utils/uuid');

var DEFAULT_TABLE = 'tasks';
var DEFAULT_NAME = 'better-queue.db';

function tryRequireSqlite() {
  try {
    return require('react-native-sqlite-storage');
  } catch (err) {
    return null;
  }
}

function toNumber(value) {
  var parsed = parseInt(value, 10);
  return isNaN(parsed) ? 0 : parsed;
}

function parsePayload(payload) {
  if (typeof payload !== 'string') return payload;
  try {
    return JSON.parse(payload);
  } catch (err) {
    return payload;
  }
}

function SqliteStore(opts) {
  opts = opts || {};
  this.sqlite = opts.sqlite || tryRequireSqlite();
  if (!this.sqlite) {
    throw new Error('You must install `react-native-sqlite-storage` to use the sqlite store. Use the `memory` store instead if persistence is not required.');
  }
  this.table = opts.table || DEFAULT_TABLE;
  this._lockPrefix = uuid.v4().slice(0, 8);
  this._lockSeed = 0;
  this._db = null;
  this._pendingConnects = [];
  this._connecting = false;
  this.databaseConfig = opts.database || {
    name: opts.name || DEFAULT_NAME,
    location: opts.location || 'default'
  };
}

SqliteStore.prototype._getDb = function (cb) {
  var self = this;
  if (self._db) {
    return cb(null, self._db);
  }
  if (self._connecting) {
    self._pendingConnects.push(cb);
    return;
  }
  self._connecting = true;
  self._pendingConnects.push(cb);

  var onSuccess = function (db) {
    if (!db) {
      return onError(new Error('failed_to_open_database'));
    }
    self._db = db;
    self._initialize(function (err, count) {
      self._connecting = false;
      var queue = self._pendingConnects.slice();
      self._pendingConnects.length = 0;
      queue.forEach(function (callback) {
        callback(err, self._db, count);
      });
    });
  };

  var onError = function (err) {
    self._connecting = false;
    var error = err instanceof Error ? err : new Error('failed_to_open_database');
    var queue = self._pendingConnects.slice();
    self._pendingConnects.length = 0;
    queue.forEach(function (callback) {
      callback(error);
    });
  };

  var opened = false;
  var openResult;
  var handleSuccess = function (connection) {
    if (opened) return;
    opened = true;
    onSuccess(connection);
  };
  var handleError = function (err) {
    if (opened) return;
    opened = true;
    onError(err);
  };

  if (typeof this.sqlite.openDatabase !== 'function') {
    handleError(new Error('invalid_sqlite_driver'));
    return;
  }

  try {
    openResult = this.sqlite.openDatabase(
      this.databaseConfig,
      function (db) { handleSuccess(db || openResult); },
      handleError
    );
  } catch (err) {
    handleError(err);
    return;
  }

  if (openResult && typeof openResult.then === 'function') {
    openResult.then(function (connection) {
      handleSuccess(connection);
    }).catch(handleError);
  } else if (openResult && typeof openResult.transaction === 'function') {
    handleSuccess(openResult);
  }
};

SqliteStore.prototype._initialize = function (cb) {
  var self = this;
  self._db.transaction(function (tx) {
    tx.executeSql(
      'CREATE TABLE IF NOT EXISTS ' + self.table + ' (\n        id TEXT PRIMARY KEY NOT NULL,\n        payload TEXT NOT NULL,\n        priority INTEGER DEFAULT 0,\n        lock_id TEXT,\n        created_at TEXT NOT NULL\n      )',
      [],
      function () {},
      function (transaction, error) {
        cb(error);
        return false;
      }
    );
  }, function (error) {
    cb(error);
  }, function () {
    self._countQueued(cb);
  });
};

SqliteStore.prototype._countQueued = function (cb) {
  var self = this;
  var count = 0;
  self._db.readTransaction(function (tx) {
    tx.executeSql(
      'SELECT COUNT(*) as count FROM ' + self.table + ' WHERE lock_id IS NULL',
      [],
      function (transaction, resultSet) {
        if (resultSet.rows && resultSet.rows.length) {
          count = toNumber(resultSet.rows.item(0).count);
        }
      }
    );
  }, function (error) {
    cb(error);
  }, function () {
    cb(null, count);
  });
};

SqliteStore.prototype.connect = function (cb) {
  cb = cb || function () {};
  this._getDb(function (err, db, count) {
    if (err) return cb(err);
    if (typeof count === 'number') {
      return cb(null, count);
    }
    // If count missing (already connected), compute it again
    if (!db) return cb(new Error('database_not_available'));
    var store = this;
    store._countQueued(cb);
  }.bind(this));
};

SqliteStore.prototype._nextLockId = function () {
  this._lockSeed += 1;
  return this._lockPrefix + '-' + this._lockSeed + '-' + uuid.v4();
};

SqliteStore.prototype._ensureReady = function (cb) {
  var self = this;
  if (self._db) {
    return cb(null, self._db);
  }
  self._getDb(function (err, db) {
    if (err) return cb(err);
    cb(null, db);
  });
};

SqliteStore.prototype.getTask = function (taskId, cb) {
  var self = this;
  self._ensureReady(function (err, db) {
    if (err) return cb(err);
    var payload;
    db.readTransaction(function (tx) {
      tx.executeSql(
        'SELECT payload FROM ' + self.table + ' WHERE id = ? LIMIT 1',
        [taskId],
        function (transaction, resultSet) {
          if (resultSet.rows && resultSet.rows.length) {
            payload = parsePayload(resultSet.rows.item(0).payload);
          }
        }
      );
    }, function (error) {
      cb(error);
    }, function () {
      cb(null, payload);
    });
  });
};

SqliteStore.prototype.deleteTask = function (taskId, cb) {
  cb = cb || function () {};
  var self = this;
  self._ensureReady(function (err, db) {
    if (err) return cb(err);
    var error = null;
    db.transaction(function (tx) {
      tx.executeSql(
        'DELETE FROM ' + self.table + ' WHERE id = ?',
        [taskId],
        function () {},
        function (transaction, err) {
          error = err;
          return false;
        }
      );
    }, function (txError) {
      cb(error || txError);
    }, function () {
      cb(error);
    });
  });
};

SqliteStore.prototype.putTask = function (taskId, task, priority, cb) {
  cb = cb || function () {};
  var self = this;
  self._ensureReady(function (err, db) {
    if (err) return cb(err);
    var error = null;
    var payload = JSON.stringify(task);
    var now = new Date().toISOString();
    var normalizedPriority = priority;
    if (normalizedPriority === undefined || normalizedPriority === null) {
      normalizedPriority = 0;
    }
    db.transaction(function (tx) {
      tx.executeSql(
        'UPDATE ' + self.table + ' SET payload = ?, priority = ?, lock_id = NULL WHERE id = ?',
        [payload, normalizedPriority, taskId],
        function (transaction, result) {
          if (!result.rowsAffected) {
            tx.executeSql(
              'INSERT INTO ' + self.table + ' (id, payload, priority, lock_id, created_at) VALUES (?, ?, ?, NULL, ?)',
              [taskId, payload, normalizedPriority, now],
              function () {},
              function (transaction, err) {
                error = err;
                return false;
              }
            );
          }
        },
        function (transaction, err) {
          error = err;
          return false;
        }
      );
    }, function (txError) {
      cb(error || txError);
    }, function () {
      cb(error);
    });
  });
};

SqliteStore.prototype._takeN = function (n, cb, orderClause) {
  var self = this;
  self._ensureReady(function (err, db) {
    if (err) return cb(err);
    var lockId = self._nextLockId();
    var error = null;
    var ids = [];
    var placeholders;
    var params;

    db.transaction(function (tx) {
      tx.executeSql(
        'SELECT id FROM ' + self.table + ' WHERE lock_id IS NULL ORDER BY priority DESC, created_at ' + orderClause + ' LIMIT ?',
        [n],
        function (transaction, resultSet) {
          var length = resultSet.rows ? resultSet.rows.length : 0;
          for (var i = 0; i < length; i++) {
            ids.push(resultSet.rows.item(i).id);
          }
          if (!ids.length) {
            return;
          }
          placeholders = ids.map(function () { return '?'; }).join(',');
          params = [lockId].concat(ids);
          tx.executeSql(
            'UPDATE ' + self.table + ' SET lock_id = ? WHERE id IN (' + placeholders + ')',
            params,
            function () {},
            function (transaction, err) {
              error = err;
              return false;
            }
          );
        },
        function (transaction, err) {
          error = err;
          return false;
        }
      );
    }, function (txError) {
      cb(error || txError);
    }, function () {
      cb(error, lockId);
    });
  });
};

SqliteStore.prototype.takeFirstN = function (n, cb) {
  this._takeN(n, cb, 'ASC');
};

SqliteStore.prototype.takeLastN = function (n, cb) {
  this._takeN(n, cb, 'DESC');
};

SqliteStore.prototype._mapLockRows = function (rows) {
  var tasks = {};
  var length = rows ? rows.length : 0;
  for (var i = 0; i < length; i++) {
    var row = rows.item(i);
    tasks[row.id] = parsePayload(row.payload);
  }
  return tasks;
};

SqliteStore.prototype.getLock = function (lockId, cb) {
  var self = this;
  self._ensureReady(function (err, db) {
    if (err) return cb(err);
    var error = null;
    var tasks;
    var runQuery = function (tx) {
      tx.executeSql(
        'SELECT id, payload FROM ' + self.table + ' WHERE lock_id = ?',
        [lockId],
        function (transaction, resultSet) {
          tasks = self._mapLockRows(resultSet.rows);
        },
        function (transaction, err) {
          error = err;
          return false;
        }
      );
    };

    if (typeof db.readTransaction === 'function') {
      db.readTransaction(runQuery, function (txError) {
        cb(error || txError);
      }, function () {
        cb(error, tasks && Object.keys(tasks).length ? tasks : undefined);
      });
    } else {
      db.transaction(runQuery, function (txError) {
        cb(error || txError);
      }, function () {
        cb(error, tasks && Object.keys(tasks).length ? tasks : undefined);
      });
    }
  });
};

SqliteStore.prototype.getRunningTasks = function (cb) {
  var self = this;
  self._ensureReady(function (err, db) {
    if (err) return cb(err);
    var error = null;
    var running = {};
    db.transaction(function (tx) {
      tx.executeSql(
        'SELECT lock_id, id, payload FROM ' + self.table + ' WHERE lock_id IS NOT NULL',
        [],
        function (transaction, resultSet) {
          var length = resultSet.rows ? resultSet.rows.length : 0;
          for (var i = 0; i < length; i++) {
            var row = resultSet.rows.item(i);
            if (!running[row.lock_id]) {
              running[row.lock_id] = {};
            }
            running[row.lock_id][row.id] = parsePayload(row.payload);
          }
        },
        function (transaction, err) {
          error = err;
          return false;
        }
      );
      tx.executeSql(
        'UPDATE ' + self.table + ' SET lock_id = NULL WHERE lock_id IS NOT NULL',
        [],
        function () {},
        function (transaction, err) {
          error = err;
          return false;
        }
      );
    }, function (txError) {
      cb(error || txError);
    }, function () {
      cb(error, running);
    });
  });
};

SqliteStore.prototype.releaseLock = function (lockId, cb) {
  cb = cb || function () {};
  var self = this;
  self._ensureReady(function (err, db) {
    if (err) return cb(err);
    var error = null;
    db.transaction(function (tx) {
      tx.executeSql(
        'DELETE FROM ' + self.table + ' WHERE lock_id = ?',
        [lockId],
        function () {},
        function (transaction, err) {
          error = err;
          return false;
        }
      );
    }, function (txError) {
      cb(error || txError);
    }, function () {
      cb(error);
    });
  });
};

SqliteStore.prototype.close = function (cb) {
  cb = cb || function () {};
  if (!this._db || typeof this._db.close !== 'function') {
    return cb();
  }
  var db = this._db;
  this._db = null;
  db.close(function () {
    cb();
  }, function (err) {
    cb(err);
  });
};

module.exports = SqliteStore;
