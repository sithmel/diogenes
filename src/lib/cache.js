var LRUCache = require('little-ds-toolkit/lib/lru-cache');

function getDefaultKey() {
  return '_default';
}

function getKeyFromProp(prop) {
  return function (cfg) {
    return cfg[prop];
  };
}

function Cache(opts) {
  opts = opts || {};
  var cacheOpts = {};
  this.data = new LRUCache({ maxLen: opts.maxLen, defaultTTL: opts.maxAge });
  if (typeof opts.key === 'function') {
    this.getKey = opts.key;
  }
  else if (typeof opts.key === 'string') {
    this.getKey = getKeyFromProp(opts.key);
  }
  else if (typeof opts.key === 'undefined') {
    this.getKey = getDefaultKey;
  }
  else {
    throw new Error('cache key can be either a function, a string or undefined');
  }
}

Cache.prototype.has = function (config) {
  var key = this.getKey(config);
  return this.data.has(key);
};

Cache.prototype.get = function (config) {
  var key = this.getKey(config);
  return this.data.get(key);
};

Cache.prototype.set = function (config, value) {
  var key = this.getKey(config);
  this.data.set(key, value);
  return this.data.set(key, value);
};

module.exports = Cache;
