var Diogenes = require('../src');
var assert = require('chai').assert;

describe('async parallel execution', function (done) {
  var str, registry;

  beforeEach(function () {
    /*

    A      B
    |     /
    |    /
    |   /
    |  /
    | /
    VV
    C

    */

    registry = Diogenes.getRegistry();

    str = '';

    registry.service('A').provides(function (config, deps, next) {
      setTimeout(function () {
        str += 'A';
        next(undefined, 'A');
      }, 50);
    });

    registry.service('B').provides(function (config, deps, next) {
      setTimeout(function () {
        str += 'B';
        next(undefined, 'B');
      }, 20);
    });

    registry.service('C').dependsOn(['A', 'B']).provides(function (config, deps, next) {
      str += 'C';
      next(undefined, deps.A + deps.B + 'C');
    });

  });

  it('must run service asynchronously', function (done) {
    registry.instance({}).run('C', function (err, dep) {
      assert.equal(str, 'BAC');
      assert.equal(dep, 'ABC');
      done();
    });
  });

  it('must run service synchronously', function (done) {
    registry.instance({}, {limit: 1}).run('C', function (err, dep) {
      assert.equal(str, 'ABC');
      assert.equal(dep, 'ABC');
      done();
    });
  });

  it('must profile the execution', function (done) {
    registry.instance({}, {debug: true}).run('C', function (err, dep, deps, profile) {
      assert.equal(str, 'BAC');
      assert.equal(dep, 'ABC');
      assert(profile.A.delta > 48 && profile.A.delta < 52 );
      assert(profile.B.delta > 18 && profile.B.delta < 22 );
      assert(profile.C.delta >= 0 && profile.C.delta < 2 );

      assert.equal(deps.A, 'A');
      assert.equal(deps.B, 'B');
      assert.equal(deps.C, 'ABC');

      assert(profile.__all__.delta > 48 && profile.A.delta < 52 );
      done();
    });
  });

});
