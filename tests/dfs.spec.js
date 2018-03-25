/* eslint-env node, mocha */
const Diogenes = require('../src')
const assert = require('chai').assert

describe('dfs: 4 functions', (done) => {
  let registry

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
    registry = Diogenes.getRegistry()
    registry.service('A').provides(function (deps, next) {
      next(undefined, 'A')
    })

    registry.service('B').dependsOn(['A']).provides(function (deps, next) {
      next(undefined, deps['A'] + 'B')
    })

    registry.service('C').dependsOn(['A', 'B']).provides(function (deps, next) {
      next(undefined, deps['A'] + deps['B'] + 'C')
    })

    registry.service('D').dependsOn(['B', 'C']).provides(function (deps, next) {
      next(undefined, deps['B'] + deps['C'] + 'D')
    })
  })

  it('must return leftmost service', (done) => {
    registry.run('A', function (err, dep) {
      if (err) return
      assert.deepEqual(dep, 'A')
      done()
    })
  })

  it('must return middle service (1)', (done) => {
    registry.run('B', function (err, dep) {
      if (err) return
      assert.deepEqual(dep, 'AB')
      done()
    })
  })

  it('must return middle service (2)', (done) => {
    registry.run('C', function (err, dep) {
      if (err) return
      assert.deepEqual(dep, 'AABC')
      done()
    })
  })

  it('must return rightmost service', (done) => {
    registry.run('D', function (err, dep) {
      if (err) return
      assert.deepEqual(dep, 'ABAABCD')
      done()
    })
  })

  it('must return adjList', () => {
    assert.deepEqual(registry.getAdjList(),
      {
        'A': [],
        'B': ['A'],
        'C': ['A', 'B'],
        'D': ['B', 'C']
      })
  })

  it('must run without callback', (done) => {
    registry.run('D')
    setTimeout(function () {
      done()
    }, 20)
  })

  it('must run more than one service', (done) => {
    registry.run(['A', 'D'], function (err, deps) {
      if (err) return
      assert.deepEqual(deps.A, 'A')
      assert.deepEqual(deps.D, 'ABAABCD')
      done()
    })
  })

  it('must run more than one service, no config, no callback', (done) => {
    registry.run(['A', 'D'])
    setTimeout(function () {
      done()
    }, 20)
  })

  it('must run more than one service using regexp', (done) => {
    registry.run(/(A|B)/, function (err, deps) {
      if (err) return
      assert.deepEqual(deps.A, 'A')
      assert.deepEqual(deps.B, 'AB')
      done()
    })
  })
})
