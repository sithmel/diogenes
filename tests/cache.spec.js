var Cache = require('../src/lib/cache');
var assert = require('chai').assert;

describe('cache', function (done) {
  var defaultCache, cache;

  beforeEach(function () {
    defaultCache = new Cache();
    cache = new Cache({ maxLen: 2, defaultTTL: 10, key: 'key'});
  });

  it('caches a single value', function () {
    defaultCache.set({key: '1'}, 10);
    assert.isTrue(defaultCache.has({key: '1'}));
    assert.isTrue(defaultCache.has({key: '2'}));

    assert.equal(defaultCache.get({key: '1'}), 10);
    defaultCache.set({key: '2'}, 100);
    assert.equal(defaultCache.get({key: '2'}), 100);
  });

  it('caches many values', function () {
    cache.set({key: '1'}, 10);
    assert.isTrue(cache.has({key: '1'}));
    assert.equal(cache.get({key: '1'}), 10);
    cache.set({key: '2'}, 100);
    assert.isTrue(cache.has({key: '2'}));
    assert.equal(cache.get({key: '2'}), 100);

    cache.set({key: '3'}, 1000);
    assert.isTrue(cache.has({key: '3'}));
    assert.isFalse(cache.has({key: '1'}));
  });
});
