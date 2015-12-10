var Diogenes = require('../src/diogenes');
var assert = require('chai').assert;

describe("diogenes local/global registry", function () {

  it("must be different if local", function () {
    var registry1 = Diogenes.getRegistry();
    var registry2 = Diogenes.getRegistry();

    assert.notEqual(registry1.services, registry2.services);
  });

  it("must be equal if global", function () {
    var registry1 = Diogenes.getRegistry("default");
    var registry2 = Diogenes.getRegistry("default");

    assert.equal(registry1.services, registry2.services);
  });

});

describe("diogenes", function () {
  var registry,
      isAnything;

  beforeEach(function (){
    registry = Diogenes.getRegistry();
    isAnything = Diogenes.validator();
  });

  it("must return a service in a simple case (1 function)", function (done) {
    registry.addService("hello", isAnything, function (config, deps, next){
      assert.deepEqual(deps, {});
      next(undefined, "hello");
    });

    registry.getService("hello", {}, function (err, dep){
      assert.deepEqual(dep, "hello");
      done();
    });
  });

  it("must return undefined (1 function)", function (done) {
    registry.getService("hello", {}, function (err, dep){
      assert.equal(err.message, 'Diogenes: missing dependency: hello');
      assert.instanceOf(err, Error);
      done();
    });
  });

  it("must return an exception if the function fails", function (done) {
    registry.addService("hello", function (config, deps, next){
      throw new Error('broken');
      next(undefined, "hello");
    });

    registry.getService("hello", {}, function (err, dep){
      assert.instanceOf(err, Error);
      assert.equal(err.message, 'broken');
      done();
    });
  });

  it("must return a service in a simple case (2 functions)", function (done) {
    registry.addService("hello", isAnything, function (config, deps, next){
      assert.deepEqual(deps, {});
      next(undefined, "hello ");
    });

    registry.addService("world", isAnything, ["hello"], function (config, deps, next){
      assert.deepEqual(deps, {hello: "hello "});
      next(undefined, deps.hello + "world!") ;
    });

    registry.getService("world", {}, function (err, dep){
      assert.deepEqual(dep, "hello world!");
      done();
    });
  });

  it("must recognize a circular dependency", function (done) {
    registry.addService("hello", ["world"], function (config, deps, next){
      next(undefined, "hello ");
    });

    registry.addService("world", ["hello"], function (config, deps, next){
      next(undefined, "world!") ;
    });

    registry.getService("hello", {}, function (err, dep){
      assert.instanceOf(err, Error);
      assert.equal(err.message, 'Diogenes: circular dependency: world requires hello');
      done();
    });
  });

  it("must throw an exception when missing dependency", function (done) {
    registry.addService("hello", ["world"], function (config, deps, next){
      next(undefined, "hello ");
    });

    registry.getService("hello", {}, function (err, dep){
      assert.instanceOf(err, Error);
      assert.equal(err.message, 'Diogenes: missing dependency: world');
      done();
    });
  });

  it("must throw an exception when more than one plugin matches", function (done) {
    registry.addService("hello", function (config, deps, next){
      next(undefined, "hello1");
    });

    registry.addService("hello", function (config, deps, next){
      next(undefined, "hello2");
    });

    registry.getService("hello", {}, function (err, dep){
      assert.instanceOf(err, Error);
      assert.equal(err.message, 'More than one adapter fits');
      done();
    });
  });

  describe("dfs: 4 functions", function (done) {

    beforeEach(function (){
      registry = Diogenes.getRegistry();
      isAnything = Diogenes.validator();
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
      registry.addService("A", isAnything, function (config, deps, next){
        next(undefined, "A");
      });

      registry.addService("B", isAnything, ["A"], function (config, deps, next){
        next(undefined, deps["A"] + "B") ;
      });

      registry.addService("C", isAnything, ["A", "B"], function (config, deps, next){
        next(undefined, deps["A"] + deps["B"] + "C") ;
      });

      registry.addService("D", isAnything, ["B", "C"], function (config, deps, next){
        next(undefined, deps["B"] + deps["C"] + "D") ;
      });
    });

    it("must return leftmost service", function (done) {
      registry.getService("A", {}, function (err, dep){
        assert.deepEqual(dep, "A");
        done();
      });
    });

    it("must return middle service (1)", function (done) {
      registry.getService("B", {}, function (err, dep){
        assert.deepEqual(dep, "AB");
        done();
      });
    });

    it("must return middle service (2)", function (done) {
      registry.getService("C", {}, function (err, dep){
        assert.deepEqual(dep, "AABC");
        done();
      });
    });

    it("must return rightmost service", function (done) {
      registry.getService("D", {}, function (err, dep){
        assert.deepEqual(dep, "ABAABCD");
        done();
      });
    });

  });

  describe("correct services in the correct order (using the config/plugin)", function () {
    var isReversed;

    beforeEach(function (){
      registry = Diogenes.getRegistry();
      isAnything = Diogenes.validator();
      isReversed = isAnything.has("reverse");

      registry
      .addService("hello", isAnything, function (config, deps, next){
        next(undefined, "hello ");
      })
      .addService("world", isAnything, ["hello"], function (config, deps, next){
        next(undefined, deps.hello + "world!") ;
      })
      .addService("hello", isReversed, ["world"], function (config, deps, next){
        next(undefined, deps.world + "hello!");
      })
      .addService("world", isReversed, function (config, deps, next){
        next(undefined, "world ") ;
      });
    });

    it("must extract the rightmost service", function (done) {
      registry.getService("world", {}, function (err, dep){
        assert.deepEqual(dep, "hello world!");
        done();
      });
    });

    it("must extract the leftmost service", function (done) {
      registry.getService("hello", {}, function (err, dep){
        assert.deepEqual(dep, "hello ");
        done();
      });
    });

    it("must extract the rightmost inverted service", function (done) {
      registry.getService("hello", {reverse: true}, function (err, dep){
        assert.deepEqual(dep, "world hello!");
        done();
      });
    });

    it("must extract the leftmost inverted service", function (done) {
      registry.getService("world", {reverse: true}, function (err, dep){
        assert.deepEqual(dep, "world ");
        done();
      });
    });

  });

});
