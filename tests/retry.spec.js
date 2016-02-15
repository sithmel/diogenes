var Diogenes = require('../src');
var assert = require('chai').assert;

describe('retry', function () {
  var registry;
  beforeEach(function () {
    registry = Diogenes.getRegistry();
  });

  it('must set/get retry', function () {
    var s = registry.service('service');
    assert.isFalse(s.retry());
    assert.equal(s.retry(4), s);
    assert.equal(s.retry(), 4);
    assert.equal(s.retry(Infinity), s);
    assert.equal(s.retry(), Infinity);
  });

});
