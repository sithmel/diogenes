var Diogenes = require('../src');
var TimeoutError = require('async-deco/errors/timeout-error');
var assert = require('chai').assert;

describe('service timeout', function () {
  var registry;

  beforeEach(function () {
    registry = Diogenes.getRegistry();
    registry
      .service('service')
      .provides(function (cfg, deps, next) {
        setTimeout(function () {
          next(null, 'hello!');
        }, 20);
      });
  });

  it('must set/get timeout', function () {
    var s = registry.service('service');
    assert.isFalse(s.hasTimeout());
    assert.equal(s.timeout(4), s);
    assert.equal(s._timeout, 4);
    assert.equal(s.timeout(Infinity), s);
    assert.isFalse(s.hasTimeout());
  });

  it('must time out', function (done) {
    var s = registry.service('service')
      .timeout(10);
    registry.instance({}).run('service', function (err, dep) {
      assert.instanceOf(err, TimeoutError);
      done();
    });
  });

  it('must not time out', function (done) {
    var s = registry.service('service')
      .timeout(30);
    registry.instance({}).run('service', function (err, dep) {
      assert.isUndefined(err);
      assert.equal(dep, 'hello!');
      done();
    });
  });
});
