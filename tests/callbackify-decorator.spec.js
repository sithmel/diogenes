var assert = require('chai').assert;
var callbackify = require('../src/lib/callbackify-decorator');

describe('callbackify', function () {
  it('must convert simple function', function (done) {
    var func = callbackify(function () {
      return 'hello';
    });
    func(function (err, out) {
      assert.equal(out, 'hello');
      done();
    });
  });

  it('must pass 1 arg', function (done) {
    var func = callbackify(function (s) {
      return s;
    });
    func('hello', function (err, out) {
      assert.equal(out, 'hello');
      done();
    });
  });

  it('must pass multiple arg', function (done) {
    var func = callbackify(function (a, b) {
      return a + b;
    });

    func('hello ', 'world!', function (err, out) {
      assert.equal(out, 'hello world!');
      done();
    });
  });

  it('must catch exceptions', function (done) {
    var func = callbackify(function (a, b) {
      throw new Error('error');
      return a + b;
    });
    func('hello ', 'world!', function (err, out) {
      assert.isUndefined(out);
      assert.instanceOf(err, Error);
      done();
    });
  });

  it('must work with promises', function (done) {
    var func = callbackify(function (s) {
      return new Promise(function (resolve, reject) {
        resolve(s);
      });
    });

    func('hello', function (err, out) {
      assert.equal(out, 'hello');
      done();
    });
  });

  it('must catch promise exceptions', function (done) {
    var func = callbackify(function (s) {
      return new Promise(function (resolve, reject) {
        reject(new Error('error'));
      });
    });
    func('hello ', function (err, out) {
      assert.isUndefined(out);
      assert.instanceOf(err, Error);
      done();
    });
  });

});
