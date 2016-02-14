var Diogenes = require('../src');
var assert = require('chai').assert;

describe('dfs: 4 functions', function (done) {
  var registry;

  beforeEach(function () {
    /*

    A ----> B
    |     / |
    |    /  |
    |   /   |
    |  /    |
    | /     |
    VV      V
    C ----> D

    */
    registry = Diogenes.getRegistry();
    registry.service('A').provides(function (config, deps, next) {
      next(undefined, 'A');
    });

    registry.service('B').dependsOn(['A']).provides(function (config, deps, next) {
      next(undefined, deps['A'] + 'B');
    });

    registry.service('C').dependsOn(['A', 'B']).provides(function (config, deps, next) {
      next(undefined, deps['A'] + deps['B'] + 'C');
    });

    registry.service('D').dependsOn(['B', 'C']).provides(function (config, deps, next) {
      next(undefined, deps['B'] + deps['C'] + 'D');
    });
  });

  it('must return leftmost service', function (done) {
    registry.instance({}).run('A', function (err, dep) {
      assert.deepEqual(dep, 'A');
      done();
    });
  });

  it('must return middle service (1)', function (done) {
    registry.instance({}).run('B', function (err, dep) {
      assert.deepEqual(dep, 'AB');
      done();
    });
  });

  it('must return middle service (2)', function (done) {
    registry.instance({}).run('C', function (err, dep) {
      assert.deepEqual(dep, 'AABC');
      done();
    });
  });

  it('must return rightmost service', function (done) {
    registry.instance({}).run('D', function (err, dep) {
      assert.deepEqual(dep, 'ABAABCD');
      done();
    });
  });

  it('must return execution order', function () {
    var list = registry.instance({}).getExecutionOrder('D');
    assert.deepEqual(list, [ 'A', 'B', 'C', 'D' ]);
  });

  it('must replace node', function () {
    registry.remove('D');
    registry.service('D').dependsOn(['A']).provides(function (config, deps, next) {
      next(undefined, deps['A'] + 'D');
    });

    var list = registry.instance({}).getExecutionOrder('D');
    assert.deepEqual(list, [ 'A', 'D' ]);
  });

  it('must run without config', function (done) {
    registry.instance().run('D', function (err, dep) {
      assert.deepEqual(dep, 'ABAABCD');
      done();
    });
  });

  it('must run without config and callback', function (done) {
    registry.instance().run('D');
    setTimeout(function () {
      done();
    }, 20);
  });

  it('must run more than one service', function (done) {
    registry.instance({}).run(['A', 'D'], function (err, deps) {
      assert.deepEqual(deps.A, 'A');
      assert.deepEqual(deps.D, 'ABAABCD');
      done();
    });
  });

  it('must run more than one service, no config', function (done) {
    registry.instance().run(['A', 'D'], function (err, deps) {
      assert.deepEqual(deps.A, 'A');
      assert.deepEqual(deps.D, 'ABAABCD');
      done();
    });
  });

  it('must run more than one service, no config, no callback', function (done) {
    registry.instance().run(['A', 'D']);
    setTimeout(function () {
      done();
    }, 20);
  });
});
