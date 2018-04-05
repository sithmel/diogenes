/* eslint-env node, mocha */
const Diogenes = require('../src')
const assert = require('chai').assert

describe('async parallel execution', (done) => {
  let str, registry

  beforeEach(function () {
    /*

    A      B
    |     /
    |    /
    |   /
    |  /
    | /
    VV
    C

    */

    registry = Diogenes.getRegistry()

    str = ''

    registry.service('A').provides(function (deps, next) {
      setTimeout(function () {
        str += 'A'
        next(undefined, 'A')
      }, 50)
    })

    registry.service('B').provides(function (deps, next) {
      setTimeout(function () {
        str += 'B'
        next(undefined, 'B')
      }, 20)
    })

    registry.service('C').dependsOn(['A', 'B']).provides(function (deps, next) {
      str += 'C'
      next(undefined, deps.A + deps.B + 'C')
    })
  })

  it('must run service asynchronously', (done) => {
    registry.run('C', function (err, dep) {
      if (err) return
      assert.equal(str, 'BAC')
      assert.equal(dep, 'ABC')
      done()
    })
  })
})
