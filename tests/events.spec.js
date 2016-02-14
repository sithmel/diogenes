var Diogenes = require('../src');
var assert = require('chai').assert;

describe('events', function (done) {
  var registry;

  beforeEach(function () {
    registry = Diogenes.getRegistry();
  });

  it('must listen/fire', function (done) {
    registry.on('test', function (s) {
      assert.equal('test', s);
      done();
    });
    registry.trigger('test');
  });

  it('must fire before and after', function (done) {
    var called = [];

    registry.on('success', 'hello', function (type, name, dep, config) {
      called.push(type);
      assert.equal(called.join('-'), 'before-success');
      done();
    });

    registry.on('before', 'hello', function (type, name, config) {
      called.push(type);
    });

    registry.service('hello').provides(function (config, deps, next) {
      next(undefined, 'hello ');
    });

    registry.instance({test: 1}).run('hello', function (err, dep) {});
  });

  it('must fire on deps', function (done) {
    var called = false;

    registry.on('success', 'world', function (type, name, dep, config) {
      assert.equal(name, 'world');
      assert.equal(dep, 'hello world!');
      assert.deepEqual(config, {test:1});
      assert(called);
      done();
    });

    registry.on('success', 'hello', function (type, name, dep, config) {
      assert.equal(name, 'hello');
      assert.equal(dep, 'hello ');
      assert.deepEqual(config, {test:1});
      called = true;
    });

    registry.service('hello').provides(function (config, deps, next) {
      next(undefined, 'hello ');
    });

    registry.service('world').dependsOn(['hello']).provides(function (config, deps, next) {
      next(undefined, deps.hello + 'world!');
    });

    registry.instance({test: 1}).run('world', function (err, dep) {});
  });

  it('mustn\'t fire success for cached values, but fire cachehit', function (done) {
    var called = 0;
    var cached_called = 0;

    registry.on('success', 'hello', function (type, name, dep, config) {
      assert.equal(name, 'hello');
      assert.equal(dep, 'hello');
      assert.deepEqual(config, {test:1});
      called++;
    });

    registry.on('cachehit', 'hello', function (type, name, dep, config) {
      assert.equal(name, 'hello');
      assert.equal(dep, 'hello');
      assert.deepEqual(config, {test:1});
      cached_called++;
    });

    registry.service('hello').provides(function (config, deps, next) {
      next(undefined, 'hello');
    })
    .cacheOn();

    registry.instance({test: 1}).run('hello', function (err, dep) {
      setTimeout(function () {
        assert.equal(called, 1);
        assert.equal(cached_called, 0);
        registry.instance({test: 1}).run('hello', function (err, dep) {
          setTimeout(function () {
            assert.equal(called, 1);
            assert.equal(cached_called, 1);
            done();
          }, 10);
        });
      }, 10);

    });
  });

  it('must fire error', function (done) {
    registry.on('error', 'hello', function (type, name, err, config) {
      assert.equal(err.message, 'error');
      assert.instanceOf(err, Error);
      assert.deepEqual(config, {test:1});
      done();
    });

    registry.service('hello').provides(function (config, deps, next) {
      next(new Error('error'));
    });

    registry.instance({test: 1}).run('hello', function (err, dep) {});
  });
});
