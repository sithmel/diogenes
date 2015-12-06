var Diogenes = require('../src/diogenes');
var assert = require('chai').assert;

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
      next("hello");
    });

    registry.getService("hello", {}, function (dep){
      assert.deepEqual(dep, "hello");
      done();
    });
  });

  it("must return undefined (1 function)", function (done) {
    registry.getService("hello", {}, function (dep){
      assert.instanceOf(dep, Error);
      done();
    });
  });

  it("must return a service in a simple case (2 functions)", function (done) {
    registry.addService("hello", isAnything, function (config, deps, next){
      assert.deepEqual(deps, {});
      next("hello ");
    });

    registry.addService("world", isAnything, ["hello"], function (config, deps, next){
      assert.deepEqual(deps, {hello: "hello "});
      next(deps.hello + "world!") ;
    });

    registry.getService("world", {}, function (dep){
      assert.deepEqual(dep, "hello world!");
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
        next("A");
      });

      registry.addService("B", isAnything, ["A"], function (config, deps, next){
        next(deps["A"] + "B") ;
      });

      registry.addService("C", isAnything, ["A", "B"], function (config, deps, next){
        next(deps["A"] + deps["B"] + "C") ;
      });

      registry.addService("D", isAnything, ["B", "C"], function (config, deps, next){
        next(deps["B"] + deps["C"] + "D") ;
      });
    });

    it("must return leftmost service", function (done) {
      registry.getService("A", {}, function (dep){
        assert.deepEqual(dep, "A");
        done();
      });
    });

    it("must return middle service (1)", function (done) {
      registry.getService("B", {}, function (dep){
        assert.deepEqual(dep, "AB");
        done();
      });
    });

    it("must return middle service (2)", function (done) {
      registry.getService("C", {}, function (dep){
        assert.deepEqual(dep, "AABC");
        done();
      });
    });

    it("must return rightmost service", function (done) {
      registry.getService("D", {}, function (dep){
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

      registry.addService("hello", isAnything, function (config, deps, next){
        next("hello ");
      });

      registry.addService("world", isAnything, ["hello"], function (config, deps, next){
        next(deps.hello + "world!") ;
      });

      registry.addService("hello", isReversed, ["world"], function (config, deps, next){
        next(deps.world + "hello!");
      });

      registry.addService("world", isReversed, function (config, deps, next){
        next("world ") ;
      });
    });

    it("must extract the rightmost service", function (done) {
      registry.getService("world", {}, function (dep){
        assert.deepEqual(dep, "hello world!");
        done();
      });
    });

    it("must extract the leftmost service", function (done) {
      registry.getService("hello", {}, function (dep){
        assert.deepEqual(dep, "hello ");
        done();
      });
    });

    it("must extract the rightmost inverted service", function (done) {
      registry.getService("hello", {reverse: true}, function (dep){
        assert.deepEqual(dep, "world hello!");
        done();
      });
    });

    it("must extract the leftmost inverted service", function (done) {
      registry.getService("world", {reverse: true}, function (dep){
        assert.deepEqual(dep, "world ");
        done();
      });
    });

  });
  
});
