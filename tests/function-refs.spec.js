/* eslint-env node, mocha */
const Diogenes = require('../src')
const assert = require('chai').assert

describe('registry (func ref)', () => {
  let registry

  beforeEach(() => {
    registry = Diogenes.getRegistry()
  })

  it('must return a service in a simple case (2 functions)', (done) => {
    const hello = (deps, next) => {
      assert.deepEqual(deps, {})
      next(undefined, 'hello ')
    }
    const world = (deps, next) => {
      assert.deepEqual(deps, { hello: 'hello ' })
      next(undefined, deps.hello + 'world!')
    }

    registry.service(hello)

    registry.service(world).dependsOn([hello])

    registry.run(world, function (err, dep) {
      if (err) return
      assert.deepEqual(dep, 'hello world!')
      done()
    })
  })
})
