var UUID_V4_TEMPLATE = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
var VARIANT_CHARS = ['8', '9', 'a', 'b'];

var uuidLib;
try {
  uuidLib = require('react-native-uuid');
} catch (err) {
  uuidLib = null;
}

function toString(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join('');
  if (typeof value.toString === 'function') return value.toString();
  return String(value);
}

function fromRandomValues(randomValues) {
  var hex = [];
  for (var i = 0; i < randomValues.length; i++) {
    var h = randomValues[i].toString(16);
    if (h.length === 1) h = '0' + h;
    hex.push(h);
  }
  var chars = hex.join('').slice(0, 32).split('');
  var templateIndex = 0;
  return UUID_V4_TEMPLATE.replace(/[xy]/g, function (char) {
    var c = chars[templateIndex];
    templateIndex++;
    if (!c) {
      c = ((Math.random() * 16) | 0).toString(16);
    }
    if (char === 'x') return c;
    var idx = parseInt(c, 16) % VARIANT_CHARS.length;
    return VARIANT_CHARS[idx];
  });
}

function fallback() {
  return UUID_V4_TEMPLATE.replace(/[xy]/g, function (char) {
    var rand = (Math.random() * 16) | 0;
    if (char === 'x') {
      return rand.toString(16);
    }
    return VARIANT_CHARS[rand % VARIANT_CHARS.length];
  });
}

function v4() {
  if (uuidLib && typeof uuidLib.v4 === 'function') {
    var value = uuidLib.v4();
    var str = toString(value);
    if (str) return str;
  }

  var globalObj = (typeof globalThis !== 'undefined') ? globalThis : (typeof window !== 'undefined' ? window : null);
  if (globalObj) {
    var cryptoObj = globalObj.crypto || globalObj.msCrypto;
    if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
      var generated = cryptoObj.randomUUID();
      if (generated) return generated;
    }
    if (cryptoObj && typeof cryptoObj.getRandomValues === 'function' && typeof globalObj.Uint8Array === 'function') {
      var bytes = new globalObj.Uint8Array(32);
      cryptoObj.getRandomValues(bytes);
      return fromRandomValues(bytes);
    }
  }

  return fallback();
}

module.exports = {
  v4: v4
};
