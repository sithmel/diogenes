/* eslint-env node, mocha */
const Diogenes = require('../src')
const assert = require('chai').assert
const DiogenesError = require('../src/lib/diogenes-error')

describe('diogenes merge registries', () => {
  let registry1, registry2, registry3

  beforeEach(function () {
    registry1 = Diogenes.getRegistry()
    registry2 = Diogenes.getRegistry()
    registry1.service('answer').provides(42)
    registry2.service('question').provides('the answer to life the universe and everything')
    registry3 = registry1.merge(registry2)
  })

  it('must be different from previous registries', () => {
    assert.notEqual(registry1, registry3)
    assert.notEqual(registry2, registry3)
  })

  it('must copy the services', function () {
    assert.equal(Object.keys(registry3.services).length, 2)
  })
})

describe('registry', () => {
  let registry

  beforeEach(() => {
    registry = Diogenes.getRegistry()
  })

  describe('init', () => {
    it('must run with right context', () => {
      registry.init([function () {
        assert.equal(registry, this)
      }])
    })
  })

  it('must return a service in a simple case (1 function)', (done) => {
    registry.service('hello').provides(function (deps, next) {
      assert.deepEqual(deps, {})
      next(undefined, 'hello')
    })

    registry.run('hello', function (err, dep) {
      if (err) return
      assert.deepEqual(dep, 'hello')
      done()
    })
  })

  it('must return undefined (1 function)', (done) => {
    registry.run('hello', function (err, dep) {
      assert.equal(err.message, 'Diogenes: missing dependency: hello')
      assert.instanceOf(err, DiogenesError)
      done()
    })
  })

  it('must return an exception if the function fails', (done) => {
    registry.service('hello').provides(function (deps) {
      throw new Error('broken')
    })

    registry.run('hello', function (err, dep) {
      assert.instanceOf(err, Error)
      assert.equal(err.message, 'broken')
      done()
    })
  })

  it('must return a service in a simple case (2 functions)', (done) => {
    registry.service('hello').provides(function (deps, next) {
      assert.typeOf(this.id, 'string')
      assert.isDefined(this.service)
      assert.deepEqual(deps, {})
      next(undefined, 'hello ')
    })

    registry.service('world').dependsOn(['hello']).provides(function (deps, next) {
      assert.typeOf(this.id, 'string')
      assert.isDefined(this.service)
      assert.deepEqual(deps, {hello: 'hello '})
      next(undefined, deps.hello + 'world!')
    })

    registry.run('world', function (err, dep) {
      if (err) return
      assert.deepEqual(dep, 'hello world!')
      done()
    })
  })

  it('must return a service in a simple case (2 functions) not using next', (done) => {
    registry.service('hello').provides(function (deps) {
      assert.deepEqual(deps, {})
      return 'hello '
    })

    registry.service('world').dependsOn(['hello']).provides(function (deps) {
      assert.deepEqual(deps, { hello: 'hello ' })
      return deps.hello + 'world!'
    })

    registry.run('world', function (err, dep) {
      if (err) return
      assert.deepEqual(dep, 'hello world!')
      done()
    })
  })

  it('must return a service in a simple case (2 functions), dependencies are a function', (done) => {
    registry.service('hello').provides(function (deps, next) {
      assert.deepEqual(deps, {})
      next(undefined, 'hello ')
    })

    var getDeps = function () {
      return ['hello']
    }

    registry.service('world').dependsOn(getDeps).provides((deps, next) => {
      assert.deepEqual(deps, {hello: 'hello '})
      next(undefined, deps.hello + 'world!')
    })

    registry.run('world', function (err, dep) {
      if (err) return
      assert.deepEqual(dep, 'hello world!')
      done()
    })
  })

  it('must recognize a circular dependency', (done) => {
    registry.service('hello').dependsOn(['world']).provides(function (deps, next) {
      next(undefined, 'hello ')
    })

    registry.service('world').dependsOn(['hello']).provides(function (deps, next) {
      next(undefined, 'world!')
    })

    registry.run('hello', function (err, dep) {
      assert.instanceOf(err, DiogenesError)
      assert.equal(err.message, 'Diogenes: circular dependency')
      done()
    })
  })

  it('must recognize a circular dependency (3 services)', (done) => {
    registry.service('A').dependsOn(['C']).provides(function (deps, next) {
      next(undefined, undefined)
    })

    registry.service('B').dependsOn(['A']).provides(function (deps, next) {
      next(undefined, undefined)
    })

    registry.service('C').dependsOn(['B']).provides(function (deps, next) {
      next(undefined, undefined)
    })

    registry.run('C', function (err, dep) {
      assert.instanceOf(err, DiogenesError)
      assert.equal(err.message, 'Diogenes: circular dependency')
      done()
    })
  })

  it('must throw an exception when missing dependency', (done) => {
    registry.service('hello').dependsOn(['world']).provides(function (deps, next) {
      next(undefined, 'hello ')
    })

    registry.run('hello', function (err, dep) {
      assert.instanceOf(err, DiogenesError)
      assert.equal(err.message, 'Diogenes: missing dependency: world')
      done()
    })
  })

  describe('shutdown', () => {
    it('must wait to shutdown', (done) => {
      let services = ''

      registry.service('A').provides(function (deps, next) {
        setTimeout(function () {
          services += 'A'
          next(undefined, undefined)
        }, 100)
      })

      registry.service('B').dependsOn(['A']).provides(function (deps, next) {
        setTimeout(function () {
          services += 'B'
          next(undefined, undefined)
        }, 100)
      })

      registry.service('C').dependsOn(['A', 'B']).provides(function (deps, next) {
        setTimeout(function () {
          services += 'C'
          next(undefined, undefined)
        }, 100)
      })

      registry.run('B') // AB
      registry.run('C') // ABC
      registry.shutdown(function () {
        registry.run('B', function (err) {
          assert.equal(err.message, 'Diogenes: shutting down')
        })
        assert.equal(services, 'AABBC')
        done()
      })
    })

    it('must wait to shutdown, also failing methods', (done) => {
      var services = ''

      registry.service('A').provides(function (deps, next) {
        services += 'A'
        next(new Error('broken'), undefined)
      })

      registry.service('B').provides(function (deps, next) {
        setTimeout(function () {
          services += 'B'
          next(undefined, undefined)
        }, 100)
      })

      registry.service('C').dependsOn(['B']).provides(function (deps, next) {
        setTimeout(function () {
          services += 'C'
          next(undefined, undefined)
        }, 100)
      })

      registry.run('A')
      registry.run('C')
      registry.shutdown(function () {
        registry.run('B', function (err) {
          assert.equal(err.message, 'Diogenes: shutting down')
        })
        assert.equal(services, 'ABC')
        done()
      })
    })
  })
})
