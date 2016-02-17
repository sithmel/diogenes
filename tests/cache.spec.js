var assert = require('chai').assert;
var Cache = require('../src/lib/cache');

describe('cache', function () {
  var cache;

  beforeEach(function () {
    cache = new Cache();
  });

  it('must be on', function () {
    assert.equal(cache.isOn(), false);
    cache.on();
    assert.equal(cache.isOn(), true);
    cache.off();
    assert.equal(cache.isOn(), false);
  });

  it('must configure cache: default key', function () {
    cache.on();
    cache.push({}, 'result');
    var res = cache.query({});
    assert.equal(res.cached, true);
    assert.equal(res.key, '_default');
    assert.equal(res.hit, 'result');
  });

  it('must return a size', function () {
    cache.on();
    cache.push({}, 'result');
    assert.equal(cache.size(true), '234B');
  });

  it('must configure cache: string key', function () {
    cache.on({key: 'test'});
    cache.push({test: '1'}, 'result1');
    cache.push({test: '2'}, 'result2');

    var res1 = cache.query({test: '1'});
    var res2 = cache.query({test: '2'});
    var res3 = cache.query({test: '3'});

    assert.equal(res1.cached, true);
    assert.equal(res1.key, '1');
    assert.equal(res1.hit, 'result1');

    assert.equal(res2.cached, true);
    assert.equal(res2.key, '2');
    assert.equal(res2.hit, 'result2');

    assert.equal(res3.cached, false);
    assert.equal(res3.key, '3');
    assert.isUndefined(res3.hit);
  });

  it('must configure cache: string key/object', function () {
    cache.on({key: 'test'});
    cache.push({test: [1, 2]}, 'result1');
    cache.push({test: [3, 4]}, 'result2');

    var res1 = cache.query({test: [1, 2]});

    assert.equal(res1.cached, true);
    assert.equal(res1.key, '[1,2]');
    assert.equal(res1.hit, 'result1');
  });

  it('must configure cache: array key', function () {
    cache.on({key: ['test', 0]});
    cache.push({test: [1, 2]}, 'result1');

    var res1 = cache.query({test: [1, 'x']});

    assert.equal(res1.cached, true);
    assert.equal(res1.key, '1');
    assert.equal(res1.hit, 'result1');
  });

  it('must configure cache: array key/object', function () {
    cache.on({key: ['test']});
    cache.push({test: [1, 2]}, 'result1');

    var res1 = cache.query({test: [1, 2]});

    assert.equal(res1.cached, true);
    assert.equal(res1.key, '[1,2]');
    assert.equal(res1.hit, 'result1');
  });

  it('must configure cache: func', function () {
    cache.on({key: function (config) {
      return config.test * 2;
    }});
    cache.push({test: 4}, 'result1');

    var res1 = cache.query({test: 4});

    assert.equal(res1.cached, true);
    assert.equal(res1.key, '8');
    assert.equal(res1.hit, 'result1');
  });

  it('must configure cache: maxSize', function () {
    cache.on({key: 'test', maxSize: 2});
    cache.push({test: 1}, 'result1');
    cache.push({test: 2}, 'result2');
    assert.equal(cache.len(), 2);
    cache.push({test: 3}, 'result3');

    assert.equal(cache.len(), 2);

    var res1 = cache.query({test: 1});
    var res2 = cache.query({test: 2});
    var res3 = cache.query({test: 3});

    assert.equal(res1.cached, false);
    assert.equal(res2.cached, true);
    assert.equal(res3.cached, true);

    assert.equal(res2.key, '2');
    assert.equal(res3.key, '3');

    assert.equal(res2.hit, 'result2');
    assert.equal(res3.hit, 'result3');
  });

  it('must configure cache: maxAge', function (done) {
    cache.on({key: 'test', maxAge: 30});
    cache.push({test: 1}, 'result1');

    var res1 = cache.query({test: 1});

    assert.equal(res1.cached, true);
    assert.equal(res1.key, '1');
    assert.equal(res1.hit, 'result1');

    setTimeout(function () {
      res1 = cache.query({test: 1});

      assert.equal(res1.cached, true);
      assert.equal(res1.key, '1');
      assert.equal(res1.hit, 'result1');
      setTimeout(function () {
        res1 = cache.query({test: 1});

        assert.equal(res1.cached, false);
        assert.equal(res1.key, '1');
        assert.isUndefined(res1.hit);
        done();
      }, 40);
    }, 10);
  });

  it('must reset/switch off cache', function () {
    cache.on({key: 'test'});
    cache.push({test: 1}, 'result1');
    cache.reset();
    assert.equal(cache.len(), 0);

    var res1 = cache.query({test: 1});

    assert.equal(res1.cached, false);
    assert.equal(res1.key, '1');
    assert.isUndefined(res1.hit);
  });
});
