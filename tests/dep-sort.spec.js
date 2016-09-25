var depSort = require('../src/lib/dep-sort');
var DiogenesError = require('../src/lib/diogenes-error');
var assert = require('chai').assert;

var getAdjFactory = function (adjList) {
  return function (node, next) {
    if (node in adjList) {
      return { deps: adjList[node], name: node };
    }
    return null;
  };
};

describe('depSort', function () {
  var getAdj;

  describe('1 node', function () {
    beforeEach(function () {
      /* A */
      getAdj = getAdjFactory({A :[]});
    });

    it('must return 1 node (1 node)', function () {
      var l = depSort(getAdj, 'A');
      assert.deepEqual(l, [{name: 'A', deps: []}]);
    });

    it('must fire exception (1 node)', function () {
      assert.throws(function () { depSort(getAdj, 'B'); }, DiogenesError, 'Diogenes: missing dependency: B');
    });
  });

  describe('2 nodes', function () {
    beforeEach(function () {
      /* A --> B*/
      getAdj = getAdjFactory({A :['B'], B: []});
    });

    it('must return 2 node (2 nodes)', function () {
      var l = depSort(getAdj, 'A');
      assert.deepEqual(l, [{name: 'B', deps: []}, {name: 'A', deps: ['B']}]);
    });

    it('must return 1 nodes (2 nodes)', function () {
      var l = depSort(getAdj, 'B');
      assert.deepEqual(l, [{name: 'B', deps: []}]);
    });

    it('must fire exception (2 nodes)', function () {
      assert.throws(function () { depSort(getAdj, 'C'); }, DiogenesError, 'Diogenes: missing dependency: C');
    });
  });

  describe('3 nodes', function () {
    beforeEach(function () {
      /*
      A --> B
      \     |
       \    |
        \   |
         \  |
          V V
           C
      */
      getAdj = getAdjFactory({A :['B', 'C'], B: ['C'], C: []});
    });

    it('must return 3 node (3 nodes)', function () {
      var l = depSort(getAdj, 'A');
      assert.deepEqual(l, [{name: 'C', deps: []}, {name: 'B', deps: ['C']}, {name: 'A', deps: ['B', 'C']}]);
    });

    it('must return 2 nodes (3 nodes)', function () {
      var l = depSort(getAdj, 'B');
      assert.deepEqual(l, [{name: 'C', deps: []}, {name: 'B', deps: ['C']}]);
    });

    it('must return 1 nodes (3 nodes)', function () {
      var l = depSort(getAdj, 'C');
      assert.deepEqual(l, [{name: 'C', deps: []}]);
    });
  });

  describe('3 nodes (not acyclic)', function () {
    beforeEach(function () {
      /*
      A <-- B
      \     ^
       \    |
        \   |
         \  |
          V |
           C
      */
      getAdj = getAdjFactory({A :['C'], B: ['A'], C: ['B']});
    });

    it('must return error (3 nodes - not acyclic)', function () {
      assert.throws(function () { depSort(getAdj, 'A'); }, DiogenesError, 'Diogenes: circular dependency: A');
    });
  });

  describe('4 nodes', function () {
    beforeEach(function () {
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
      getAdj = getAdjFactory({A :['B', 'C'], B: ['C', 'D'], C: ['D'], D: []});
    });

    it('must return 4 node (4 nodes)', function () {
      var l = depSort(getAdj, 'A');
      assert.deepEqual(l, [{name: 'D', deps: []}, {name: 'C', deps: ['D']}, {name: 'B', deps: ['C', 'D']}, {name: 'A', deps: ['B', 'C']}]);
    });

    it('must return 3 nodes (4 nodes)', function () {
      var l = depSort(getAdj, 'B');
      assert.deepEqual(l, [{name: 'D', deps: []}, {name: 'C', deps: ['D']}, {name: 'B', deps: ['C', 'D']}]);
    });

    it('must return 2 nodes (4 nodes)', function () {
      var l = depSort(getAdj, 'C');
      assert.deepEqual(l, [{name: 'D', deps: []}, {name: 'C', deps: ['D']}]);
    });

    it('must return 1 nodes (4 nodes)', function () {
      var l = depSort(getAdj, 'D');
      assert.deepEqual(l, [{name: 'D', deps: []}]);
    });
  });

});
