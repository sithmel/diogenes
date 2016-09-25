var Diogenes = require('../src');
var assert = require('chai').assert;

describe('diogenes using decorators', function () {

  it('must fail', function (done) {
    var registry = Diogenes.getRegistry();

    registry.service('hello').provides(
      function (config, deps, next) {
        next(new Error('broken'));
      });

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
