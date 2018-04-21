/* eslint-env node, mocha */
const Diogenes = require('../src')
const assert = require('chai').assert

function sleep (ms) {
  return new Promise(function (resolve, reject) {
    setTimeout(() => { resolve(null) }, ms)
  })
}

describe('registry-runner', () => {
  let registry, executed, runner

  beforeEach(function () {
    executed = ''
    registry = Diogenes.getRegistry()
    runner = Diogenes.getRegistryRunner()
    registry.service('A').provides(async function (deps) {
      await sleep(20)
      executed += 'A'
      return Promise.resolve('A')
    })

    registry.service('B').dependsOn(['A']).provides(async function (deps) {
      await sleep(20)
      executed += 'B'
      return Promise.resolve(deps['A'] + 'B')
    })

    registry.service('C').dependsOn(['A', 'B']).provides(async function (deps) {
      await sleep(20)
      executed += 'C'
      return Promise.resolve(deps['A'] + deps['B'] + 'C')
    })
  })

  it('must run with callback', (done) => {
    runner.run(registry, 'A', function (err, a) {
      if (err) return
      assert.equal(a, 'A')
      done()
    })
  })

  it('must run more than one service (callback)', (done) => {
    runner.run(registry, ['A', 'B'], function (err, deps) {
      if (err) return
      assert.equal(deps.A, 'A')
      assert.equal(deps.B, 'AB')
      assert.equal(executed, 'AB')
      done()
    })
  })

  it('must run more than one service (promise)', () => {
    return runner.run(registry, ['A', 'B'])
      .then(function (deps) {
        assert.equal(deps.A, 'A')
        assert.equal(deps.B, 'AB')
        assert.equal(executed, 'AB')
      })
  })

  it('must run more than one service using regexp', () => {
    return runner.run(registry, /(A|B)/)
      .then(function (deps) {
        assert.equal(deps.A, 'A')
        assert.equal(deps.B, 'AB')
        assert.equal(executed, 'AB')
      })
  })

  describe('shutdown', () => {
    it('must wait to shutdown', (done) => {
      runner.run(registry, 'B') // AB
      runner.run(registry, 'C') // ABC
      runner.shutdown(function () {
        runner.run(registry, 'B', function (err) {
          assert.equal(err.message, 'Diogenes: shutting down')
        })
        assert.equal(executed, 'AABBC')
        done()
      })
    })

    it('must wait to shutdown (promise)', () => {
      runner.run(registry, 'B') // AB
      runner.run(registry, 'C') // ABC
      return runner.shutdown()
        .then(function () {
          runner.run(registry, 'B', function (err) {
            assert.equal(err.message, 'Diogenes: shutting down')
          })
          assert.equal(executed, 'AABBC')
        })
    })

    it('must wait to shutdown, also failing methods', (done) => {
      registry.service('D').provides(function (deps) {
        executed += 'D'
        return Promise.reject(new Error('broken'))
      })

      runner.run(registry, 'A') // A
      runner.run(registry, 'D') // D

      runner.shutdown(function () {
        registry.run('B', function (err) {
          assert.equal(err.message, 'Diogenes: shutting down')
        })
        assert.equal(executed, 'DA')
        done()
      })
    })
  })

  describe('adding additional deps while running', () => {
    it('add deps on the fly', () => {
      return runner.run(registry, 'Z', { Z: 3 })
        .then((z) => {
          assert.equal(z, 3)
        })
    })

    it('add deps on the fly (callback)', (done) => {
      return runner.run(registry, 'Z', { Z: 3 }, function (err, z) {
        if (err) return
        assert.equal(z, 3)
        done()
      })
    })
  })
})
