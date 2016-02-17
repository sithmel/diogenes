var Diogenes = require('../src');
var assert = require('chai').assert;

describe('onError', function (done) {
  var registry;
  beforeEach(function () {
    registry = Diogenes.getRegistry();
  });

  it('must fallback on error', function (done) {
    registry.service('hello').provides(function (config, deps, next) {
      next(new Error('error'));
    })
    .fallbackValue(42);

    registry.instance({test: 1}).run('hello', function (err, dep) {
      assert.isUndefined(err);
      assert.equal(dep, 42);
      done();
    });
  });

  it('must fallback on error (undefined)', function (done) {
    registry.service('hello').provides(function (config, deps, next) {
      next(new Error('error'));
    })
    .fallbackValue(undefined);

    registry.instance({test: 1}).run('hello', function (err, dep) {
      assert.isUndefined(err);
      assert.isUndefined(dep);
      done();
    });
  });

  it('must fallback on error (func)', function (done) {
    registry.service('hello').provides(function (config, deps, next) {
      next(new Error('error'));
    })
    .fallbackFunction(function (config) {return config.test;});

    registry.instance({test: 1}).run('hello', function (err, dep) {
      assert.isUndefined(err);
      assert.equal(dep, 1);
      done();
    });
  });

  it('must keep propagating the error', function (done) {
    registry.service('hello').provides(function (config, deps, next) {
      next(new Error('error'));
    })
    .fallbackFunction(function (config, err) {
      return err;
    });

    registry.instance({test: 1}).run('hello', function (err, dep) {
      assert.instanceOf(err, Error);
      assert.equal(err.message, 'error');
      done();
    });
  });

  it('must fallback on propagated error', function (done) {
    registry.service('hello').provides(function (config, deps, next) {
      next(new Error('error'));
    });

    registry.service('world').dependsOn(['hello']).provides(function (config, deps, next) {
      next(undefined, 'world');
    })
    .fallbackValue(42);

    registry.instance({test: 1}).run('world', function (err, dep) {
      assert.isUndefined(err);
      assert.equal(dep, 42);
      done();
    });
  });

  it('must fallback on last cached value', function (done) {
    registry.service('hello').provides(function (config, deps, next) {
      if ('error' in config) {
        next(new Error('error'));
      }
      else {
        next(null, 'ok');
      }
    }).fallbackUseCache();


    registry.instance({}).run('hello', function (err, dep) {
      assert.isUndefined(err);
      assert.equal(dep, 'ok');
      registry.instance({'error': true}).run('hello', function (err, dep) {
        assert.isUndefined(err);
        assert.equal(dep, 'ok');
        done();
      });
    });
  });

  it('must fallback on last cached value, cache empty', function (done) {
    registry.service('hello').provides(function (config, deps, next) {
      if ('error' in config) {
        next(new Error('error'));
      }
      else {
        next(null, 'ok');
      }
    }).fallbackUseCache();

    assert.equal(registry.service('hello1').hasFallback(), false);
    assert.equal(registry.service('hello').hasFallback(), true);

    registry.instance({'error': true}).run('hello', function (err, dep) {
      assert.instanceOf(err, Error);
      assert.equal(err.message, 'error');
      assert.equal(this.service('hello').fallbackCacheSize(), 172);
      done();
    });
  });
});
