var Diogenes = require('../src');
var assert = require('chai').assert;
var fallbackValueDecorator = require('async-deco/callback/fallback-value');
var compose = require('async-deco/utils/compose');

describe('diogenes using decorators', function () {

  beforeEach(function () {
  });

  it('must fallback if fail', function (done) {
    var registry = Diogenes.getRegistry();

    registry.service('hello').provides([
      fallbackValueDecorator('giving up', Error),
      function (config, deps, next) {
        next(new Error('broken'));
      }
    ]);

    registry.instance({}).run('hello', function (err, dep) {
      assert.isUndefined(err);
      assert.equal(dep, 'giving up');
      done();
    });
  });

  it('must fallback if propagation fail', function (done) {
    var registry = Diogenes.getRegistry();

    registry.service('hello').provides(function (config, deps, next) {
      next(new Error('broken'));
    });

    registry.service('world')
    .dependsOn(['hello'])
    .provides([
      fallbackValueDecorator('maybe hello', Error),
      function (config, deps, next) {
        next(null, 'world');
      }
    ]);

    registry.instance({}).run('world', function (err, dep) {
      assert.isUndefined(err);
      assert.equal(dep, 'maybe hello');
      done();
    });
  });

  it('must fail', function (done) {
    var registry = Diogenes.getRegistry();

    registry.service('hello').provides([
      function (config, deps, next) {
        next(new Error('broken'));
      }
    ]);

    registry.instance({}).run('hello', function (err, dep) {
      assert.instanceOf(err, Error);
      assert.equal(err.message, 'broken');
      assert.isUndefined(dep);
      done();
    });
  });

  it('must propagate error (implicit proxy decorator)', function (done) {
    var registry = Diogenes.getRegistry();

    registry.service('hello').provides(function (config, deps, next) {
      next(new Error('broken'));
    });

    registry.service('world')
    .dependsOn(['hello'])
    .provides([
      function (config, deps, next) {
        next(null, 'world');
      }
    ]);

    registry.instance({}).run('world', function (err, dep) {
      assert.instanceOf(err, Error);
      assert.equal(err.message, 'broken');
      assert.isUndefined(dep);
      done();
    });
  });

});
