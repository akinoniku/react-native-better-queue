function SimpleEta() {
  this.count = 0;
  this.done = 0;
  this.startedAt = null;
  this.lastMessage = '';
}

SimpleEta.prototype.start = function () {
  this.done = 0;
  this.startedAt = Date.now();
};

SimpleEta.prototype.iterate = function (message) {
  this.done++;
  if (message) {
    this.lastMessage = message;
  }
};

SimpleEta.prototype.format = function (template) {
  var layout = template || '';
  var elapsedSeconds = this.startedAt ? (Date.now() - this.startedAt) / 1000 : 0;
  var progress = this.count ? (this.done / this.count) : 0;
  var rate = elapsedSeconds > 0 ? (this.done / elapsedSeconds) : 0;
  var estimatedSeconds = (rate > 0 && this.count) ? (this.count / rate) : 0;
  var etaSeconds = estimatedSeconds - elapsedSeconds;
  if (!isFinite(etaSeconds) || etaSeconds < 0) {
    etaSeconds = 0;
  }

  var fields = {
    elapsed: elapsedSeconds,
    rate: rate,
    estimated: estimatedSeconds,
    progress: progress,
    eta: etaSeconds,
    etah: secondsToHuman(etaSeconds),
    last: this.lastMessage
  };

  return layout.replace(/{{(\w+)}}/g, function (_, key) {
    var value = fields[key];
    if (value === undefined || value === null) {
      return '';
    }
    if (typeof value === 'number') {
      return value.toPrecision(4);
    }
    return '' + value;
  });
};

function secondsToHuman(seconds) {
  var remaining = Math.floor(seconds);
  if (remaining <= 0) {
    return 'less than a second';
  }

  var units = [
    { label: 'year', value: 31536000 },
    { label: 'day', value: 86400 },
    { label: 'hour', value: 3600 },
    { label: 'minute', value: 60 },
    { label: 'second', value: 1 }
  ];

  for (var i = 0; i < units.length; i++) {
    var current = units[i];
    var count = Math.floor(remaining / current.value);
    if (count >= 1) {
      return count + ' ' + current.label + (count > 1 ? 's' : '');
    }
  }

  return 'less than a second';
}

module.exports = SimpleEta;
