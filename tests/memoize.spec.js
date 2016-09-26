var memoize = require('../src/lib/memoize');
var assert = require('chai').assert;

describe('memoize', function (done) {
  it('memoize a function', function () {
    var f = memoize(function (name) {
      return Math.random();
    });
    assert.equal(f('x'), f('x'));
    assert.equal(f('y'), f('y'));
    assert.notEqual(f('x'), f('y'));
  });
});
