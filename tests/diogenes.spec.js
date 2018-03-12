/* eslint-env node, mocha */
var Diogenes = require('../src')
var assert = require('chai').assert
var DiogenesError = require('../src/lib/diogenes-error')

describe('diogenes merge registries', function () {
  var registry1, registry2, registry3

  beforeEach(function () {
    registry1 = Diogenes.getRegistry()
    registry2 = Diogenes.getRegistry()
    registry1.service('answer').provides(42)
    registry2.service('question').provides('the answer to life the universe and everything')
    registry3 = registry1.merge(registry2)
  })

  it('must be different from previous registries', function () {
    assert.notEqual(registry1, registry3)
    assert.notEqual(registry2, registry3)
  })

  it('must copy the services', function () {
    assert.equal(Object.keys(registry3.services).length, 2)
  })
})

describe('metadata', function () {
  var registry, service1

  beforeEach(function () {
    registry = Diogenes.getRegistry()
    service1 = registry
      .service('answer').provides(42).doc('to all the questions')

    registry.service('question')
      .dependsOn(['answer'])
      .provides(function theanswer () {})
      .doc('the important bit')
  })

  it('must return services metadata', function () {
    assert.deepEqual(service1.getMetadata(), {
      name: 'answer',
      cached: false,
      deps: [],
      doc: 'to all the questions',
      debugInfo: {
        line: 33,
        functionName: null,
        parentFunctionName: null,
        fileName: __filename
      }
    })
  })

  it('must return registry metadata', function () {
    assert.deepEqual(registry.getMetadata(), {
      answer: {
        name: 'answer',
        cached: false,
        deps: [],
        doc: 'to all the questions',
        debugInfo: {
          line: 33,
          functionName: null,
          parentFunctionName: null,
          fileName: __filename
        }
      },
      question: {
        name: 'question',
        cached: false,
        deps: ['answer'],
        doc: 'the important bit',
        debugInfo: {
          line: 37,
          functionName: 'theanswer',
          parentFunctionName: null,
          fileName: __filename
        }
      }
    })
  })
})

describe('registry', function () {
  var registry

  beforeEach(function () {
    registry = Diogenes.getRegistry()
  })

  describe('init', function () {
    it('must run with right context', function () {
      registry.init([function () {
        assert.equal(registry, this)
      }])
    })
  })

  it('must return a service in a simple case (1 function)', function (done) {
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

  it('must return undefined (1 function)', function (done) {
    registry.run('hello', function (err, dep) {
      assert.equal(err.message, 'Diogenes: missing dependency: hello')
      assert.instanceOf(err, DiogenesError)
      done()
    })
  })

  it('must return an exception if the function fails', function (done) {
    registry.service('hello').provides(function (deps) {
      throw new Error('broken')
    })

    registry.run('hello', function (err, dep) {
      assert.instanceOf(err, Error)
      assert.equal(err.message, 'broken')
      done()
    })
  })

  it('must return a service in a simple case (2 functions)', function (done) {
    registry.service('hello').provides(function (deps, next) {
      assert.deepEqual(deps, {})
      next(undefined, 'hello ')
    })

    registry.service('world').dependsOn(['hello']).provides(function (deps, next) {
      assert.deepEqual(deps, {hello: 'hello '})
      next(undefined, deps.hello + 'world!')
    })

    registry.run('world', function (err, dep) {
      if (err) return
      assert.deepEqual(dep, 'hello world!')
      done()
    })
  })

  it('must return a service in a simple case (2 functions) not using next', function (done) {
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

  it('must return a service in a simple case (2 functions), dependencies are a function', function (done) {
    registry.service('hello').provides(function (deps, next) {
      assert.deepEqual(deps, {})
      next(undefined, 'hello ')
    })

    var getDeps = function () {
      return ['hello']
    }

    registry.service('world').dependsOn(getDeps).provides(function (deps, next) {
      assert.deepEqual(deps, {hello: 'hello '})
      next(undefined, deps.hello + 'world!')
    })

    registry.run('world', function (err, dep) {
      if (err) return
      assert.deepEqual(dep, 'hello world!')
      done()
    })
  })

  it('must recognize a circular dependency', function (done) {
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

  it('must recognize a circular dependency (3 services)', function (done) {
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

  it('must throw an exception when missing dependency', function (done) {
    registry.service('hello').dependsOn(['world']).provides(function (deps, next) {
      next(undefined, 'hello ')
    })

    registry.run('hello', function (err, dep) {
      assert.instanceOf(err, DiogenesError)
      assert.equal(err.message, 'Diogenes: missing dependency: world')
      done()
    })
  })
})
