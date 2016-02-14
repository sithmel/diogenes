var simpleMemoize = require('../src/lib/simple-memoize');
var assert = require('chai').assert;

describe('simpleMemoize', function () {
  var c = 0, f;
  beforeEach(function () {
    f = simpleMemoize(function (x) {
      return c + x;
    });
  });

  it('must depend on first arg', function () {
    assert.equal(f(1), 1);
    assert.equal(f(2), 2);
  });

  it('must memoize', function () {
    assert.equal(f(1), 1);
    c = 10;
    assert.equal(f(1), 1);
    assert.equal(f(2), 12);
  });


});
