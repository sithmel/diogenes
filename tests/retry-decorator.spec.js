var assert = require('chai').assert;
var timeout = require('../src/lib/retry-decorator');

describe('retry decorator', function () {
  var retryTenTimes;
  var retryTwiceOnNull;
  var retryTwiceOnTypeError;
  var retryForever;

  beforeEach(function () {
    retryTenTimes = timeout(10);
    retryTwiceOnNull = timeout(2, function (err, dep) {return dep === null;});
    retryTwiceOnTypeError = timeout(2, TypeError);
    retryForever = timeout();
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

  it('must work on custom condition', function (done) {
    var c = 0;
    var func = retryTwiceOnNull(function (cb) {
      c++;
      cb(null, c === 0 ? null : 'done');
    });

    func(function (err, res) {
      assert.equal(res, 'done');
      assert.equal(c, 1);
      done();
    });
  });

  it('must work on custom error', function (done) {
    var c = 0;
    var func = retryTwiceOnTypeError(function (cb) {
      c++;
      cb(c === 0 ? new TypeError('error') : null, 'done');
    });

    func(function (err, res) {
      assert.equal(res, 'done');
      assert.equal(c, 1);
      done();
    });
  });

  it('must retry forever', function (done) {
    var c = 0;
    var func = retryForever(function (cb) {
      c++;
      cb(c < 100 ? new Error('error') : null, 'done');
    });

    func(function (err, res) {
      assert.equal(res, 'done');
      assert.equal(c, 100);
      done();
    });
  });

});
