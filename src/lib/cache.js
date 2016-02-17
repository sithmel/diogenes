var sizeof = require('sizeof');

/*

Cache object

*/

function Cache() {
  this._cache = undefined;
  this._cacheKeys = undefined;
}

Cache.prototype.on = function cache_on(opts) {
  opts = opts || {};
  var key = opts.key;

  if (typeof key === 'function') {
    this._getCacheKey = key;
  }
  else if (typeof key === 'string') {
    this._getCacheKey = function (config) {
      if (typeof config[key] === 'object') {
        return JSON.stringify(config[key]);
      }
      else {
        return config[key];
      }
    };
  }
  else if (Array.isArray(key)) {
    this._getCacheKey = function (config) {
      var value = config;
      for (var i = 0; i < key.length; i++) {
        value = value[key[i]];
      }
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      else {
        return value;
      }
    };
  }
  else {
    this._getCacheKey = function (config) {
      return '_default';
    };
  }

  this._cache = {}; // key, value
  this._cacheKeys = []; // sorted by time {ts: xxx, key: xxx} new ones first

  this._maxAge = opts.maxAge || Infinity;
  this._maxSize = opts.maxSize || Infinity;
};

Cache.prototype.push = function cache_push(config, output) {
  if (!this._cache) return;
  var k = this._getCacheKey(config);
  if (k in this._cache) return;
  this._cache[k] = output;
  this._cacheKeys.unshift({
    key: k,
    ts: Date.now()
  });
  this.purge();
};

Cache.prototype.purge = function cache_purge() {
  if (!this._cache) return;
  // remove old entries
  var maxAge = this._maxAge;
  var maxSize = this._maxSize;
  var cache = this._cache;

  var now = Date.now();
  this._cacheKeys = this._cacheKeys.filter(function (item) {
    if (item.ts + maxAge < now ) {
      delete cache[item.key];
      return false;
    }
    return true;
  });

  // trim cache
  var keysToRemove = this._cacheKeys.slice(maxSize, Infinity);
  keysToRemove.forEach(function (item) {
    var k = item.key;
    delete cache[k];
  });
  this._cacheKeys = this._cacheKeys.slice(0, maxSize);
};

Cache.prototype.off = function cache_off() {
  this._cache = undefined;
  this._cacheKeys = undefined;
};

Cache.prototype.reset = function cache_reset() {
  if (this._cache) {
    this._cache = {}; // key, value
    this._cacheKeys = []; // sorted by time {ts: xxx, key: xxx}
  }
};

Cache.prototype.isOn = function cache_isOn(config) {
  return !!this._cache;
};

Cache.prototype.query = function cache_query(config) {
  var hit,
    cached = false,
    key = this._getCacheKey(config);

  this.purge(); // purge stale cache entries

  if (key in this._cache) {
    cached = true;
    hit = this._cache[key]; // cache hit!
  }
  return {
    cached: cached,
    key: key,
    hit: hit
  };
};

Cache.prototype.size = function cache_size(pretty) {
  return sizeof.sizeof(this, pretty);
};

Cache.prototype.len = function cache_len() {
  return this._cacheKeys.length;
};

module.exports = Cache;
