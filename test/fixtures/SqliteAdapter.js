var fs = require('fs');
var uuid = require('../../lib/utils/uuid');
var SqliteStore = require('../../lib/sqlite-store');

function MockSqliteStore(opts) {
  opts = opts || {};
  opts.database = opts.database || {};
  opts.database.name = opts.database.name || uuid.v4() + '.sqlite';
  SqliteStore.call(this, opts);
}

MockSqliteStore.prototype = Object.create(SqliteStore.prototype);

MockSqliteStore.prototype.close = function (cb) {
  cb = cb || function () {};
  var after = function () {
    SqliteStore.prototype.close.call(this, cb);
  }.bind(this);
  if (!this.databaseConfig || this.databaseConfig.name === ':memory:') {
    return after();
  }
  fs.unlink(this.databaseConfig.name, function () {
    after();
  });
};

module.exports = MockSqliteStore;
