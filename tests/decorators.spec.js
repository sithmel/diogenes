var Diogenes = require('../src');
var assert = require('chai').assert;
var fallbackValueDecorator = require('async-deco/callback/fallback-value');
var logDecorator = require('async-deco/callback/log');
var compose = require('async-deco/utils/compose');

describe('diogenes using decorators', function () {

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

  it('must log', function (done) {
    var logs = [];
    var logger = function (name, id, ts, evt, payload) {
      logs.push({name: name, evt: evt});
    };
    var registry = Diogenes.getRegistry();

    registry.service('hello').provides([
      logDecorator(),
      function (config, deps, next) {
        next(new Error('broken'));
      }
    ]);

    registry.service('world')
    .dependsOn(['hello'])
    .provides([
      logDecorator(),
      function (config, deps, next) {
        next(null, 'world');
      }
    ]);

    registry.instance({}, {logger: logger}).run('world', function (err, dep) {
      assert.instanceOf(err, Error);
      assert.equal(err.message, 'broken');
      assert.isUndefined(dep);
      assert.deepEqual(logs, [ { name: 'hello', evt: 'start' },
        { name: 'hello', evt: 'error' },
        { name: 'world', evt: 'start' },
        { name: 'world', evt: 'access denied' },
        { name: 'world', evt: 'error' } ]);
      done();
    });
  });

});
