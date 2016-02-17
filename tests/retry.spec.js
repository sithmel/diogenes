var Diogenes = require('../src');
var assert = require('chai').assert;

describe('service retry', function () {
  var registry;
  beforeEach(function () {
    registry = Diogenes.getRegistry();
  });

  it('must set/get retry', function () {
    var s = registry.service('service');
    assert.isFalse(s.hasRetry());
    assert.equal(s.retry(4), s);
    assert.equal(s._retryTimes, 4);
    assert.equal(s.retry(Infinity), s);
    assert.equal(s._retryTimes, Infinity);
  });

  it('must retry twice', function (done) {
    var c = 0;
    registry.service('hello')
    .provides(function (config, deps) {
      c++;
      if (c == 2) {
        return 'hello';
      }
      throw new Error('broken');
    })
    .retry();

    registry.instance().run('hello', function (err, deps) {
      assert.equal(deps, 'hello');
      assert.equal(c, 2);
      done();
    });
  });
});
