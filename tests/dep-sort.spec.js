var depSort = require('../src/lib/dep-sort');
var DiogenesError = require('../src/lib/diogenes-error');
var assert = require('chai').assert;

var getAdjFactory = function (adjList) {
  return function (node, next) {
    if (node in adjList) {
      return next(null, {deps: adjList[node]});
    }
    next(null, null);
  };
};

describe('depSort', function (done) {
  var getAdj;

  describe('1 node', function (done) {
    beforeEach(function () {
      /* A */
      getAdj = getAdjFactory({A :[]});
    });

    it('must return 1 node (1 node)', function (done) {
      depSort(getAdj, 'A', function (err, l) {
        assert.deepEqual(l, [{name: 'A', deps: []}]);
        done();
      });
    });

    it('must fire exception (1 node)', function (done) {
      depSort(getAdj, 'B', function (err, l) {
        assert.instanceOf(err, DiogenesError);
        assert.equal(err.message, 'Diogenes: missing dependency: B');
        done();
      });
    });
  });

  describe('2 nodes', function (done) {
    beforeEach(function () {
      /* A --> B*/
      getAdj = getAdjFactory({A :['B'], B: []});
    });

    it('must return 2 node (2 nodes)', function (done) {
      depSort(getAdj, 'A', function (err, l) {
        assert.deepEqual(l, [{name: 'B', deps: []}, {name: 'A', deps: ['B']}]);
        done();
      });
    });

    it('must return 1 nodes (2 nodes)', function (done) {
      depSort(getAdj, 'B', function (err, l) {
        assert.deepEqual(l, [{name: 'B', deps: []}]);
        done();
      });
    });

    it('must fire exception (2 nodes)', function (done) {
      depSort(getAdj, 'C', function (err, l) {
        assert.instanceOf(err, DiogenesError);
        assert.equal(err.message, 'Diogenes: missing dependency: C');
        done();
      });
    });
  });

  describe('3 nodes', function (done) {
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

    it('must return 3 node (3 nodes)', function (done) {
      depSort(getAdj, 'A', function (err, l) {
        assert.deepEqual(l, [{name: 'C', deps: []}, {name: 'B', deps: ['C']}, {name: 'A', deps: ['B', 'C']}]);
        done();
      });
    });

    it('must return 2 nodes (3 nodes)', function (done) {
      depSort(getAdj, 'B', function (err, l) {
        assert.deepEqual(l, [{name: 'C', deps: []}, {name: 'B', deps: ['C']}]);
        done();
      });
    });

    it('must return 1 nodes (3 nodes)', function (done) {
      depSort(getAdj, 'C', function (err, l) {
        assert.deepEqual(l, [{name: 'C', deps: []}]);
        done();
      });
    });
  });

  describe('3 nodes (not acyclic)', function (done) {
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

    it('must return error (3 nodes - not acyclic)', function (done) {
      depSort(getAdj, 'A', function (err, l) {
        assert.instanceOf(err, DiogenesError);
        assert.equal(err.message, 'Diogenes: circular dependency: A');
        done();
      });
    });
  });

  describe('4 nodes', function (done) {
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

    it('must return 4 node (4 nodes)', function (done) {
      depSort(getAdj, 'A', function (err, l) {
        assert.deepEqual(l, [{name: 'D', deps: []}, {name: 'C', deps: ['D']}, {name: 'B', deps: ['C', 'D']}, {name: 'A', deps: ['B', 'C']}]);
        done();
      });
    });

    it('must return 3 nodes (4 nodes)', function (done) {
      depSort(getAdj, 'B', function (err, l) {
        assert.deepEqual(l, [{name: 'D', deps: []}, {name: 'C', deps: ['D']}, {name: 'B', deps: ['C', 'D']}]);
        done();
      });
    });

    it('must return 2 nodes (4 nodes)', function (done) {
      depSort(getAdj, 'C', function (err, l) {
        assert.deepEqual(l, [{name: 'D', deps: []}, {name: 'C', deps: ['D']}]);
        done();
      });
    });

    it('must return 1 nodes (4 nodes)', function (done) {
      depSort(getAdj, 'D', function (err, l) {
        assert.deepEqual(l, [{name: 'D', deps: []}]);
        done();
      });
    });
  });

});
