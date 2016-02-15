var assert = require('chai').assert;
var timeout = require('../src/lib/retry-decorator');

describe('retry decorator', function () {
  var retryTenTimes;
  beforeEach(function () {
    retryTenTimes = timeout(10);
  });

  it('must pass simple function', function (done) {
    var c = 0;
    var func = retryTenTimes(function (cb) {
      c++;
      cb(null, 'done');
    });

    func(function (err, res) {
      assert.equal(res, 'done');
      assert.equal(c, 1);
      done();
    });
  });

  it('must throw always', function (done) {
    var c = 0;
    var func = retryTenTimes(function (cb) {
      c++;
      cb(new Error('error'));
    });

    func(function (err, res) {
      assert.isUndefined(res);
      assert.instanceOf(err, Error);
      assert.equal(c, 10);
      done();
    });
  });

  it('must throw and then success', function (done) {
    var c = 0;
    var func = retryTenTimes(function (cb) {
      c++;
      if (c === 5) {
        return cb(null, 'done');
      }
      cb(new Error('error'));
    });

    func(function (err, res) {
      assert.equal(res, 'done');
      assert.equal(c, 5);
      done();
    });
  });

});
