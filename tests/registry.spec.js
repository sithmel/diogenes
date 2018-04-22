/* eslint-env node, mocha */
const Diogenes = require('../src')
const assert = require('chai').assert
const promisify = require('util').promisify
const DiogenesError = require('../src/lib/diogenes-error')

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

    registry
      .service('A')
      .provides(promisify(function (deps, next) {
        setTimeout(function () {
          str += 'A'
          next(undefined, 'A')
        }, 50)
      }))

    registry
      .service('B')
      .provides(promisify(function (deps, next) {
        setTimeout(function () {
          str += 'B'
          next(undefined, 'B')
        }, 20)
      }))

    registry
      .service('C')
      .dependsOn(['A', 'B'])
      .provides(promisify(function (deps, next) {
        str += 'C'
        next(undefined, deps.A + deps.B + 'C')
      }))
  })

  it('must run service asynchronously', () => {
    registry.run('C')
      .then(function (dep) {
        assert.equal(str, 'BAC')
        assert.equal(dep, 'ABC')
      })
  })
})

describe('addDeps', () => {
  it('must run service asynchronously', () => {
    const registry = Diogenes.getRegistry()
    registry.addDeps({ a: 1, b: 2 })
    return Promise.all([registry.run('a'), registry.run('b')])
      .then(function ([dep1, dep2]) {
        assert.equal(dep1, 1)
        assert.equal(dep2, 2)
      })
  })
})

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
    registry.service('A').provides(function (deps) {
      return Promise.resolve('A')
    })

    registry.service('B').dependsOn(['A']).provides(function (deps) {
      return Promise.resolve(deps['A'] + 'B')
    })

    registry.service('C').dependsOn(['A', 'B']).provides(function (deps) {
      return Promise.resolve(deps['A'] + deps['B'] + 'C')
    })

    registry.service('D').dependsOn(['B', 'C']).provides(function (deps) {
      return Promise.resolve(deps['B'] + deps['C'] + 'D')
    })
  })

  it('must return leftmost service', () => {
    registry.run('A')
      .then(function (dep) {
        assert.deepEqual(dep, 'A')
      })
  })

  it('must return middle service (1)', () => {
    registry.run('B')
      .then(function (dep) {
        assert.deepEqual(dep, 'AB')
      })
  })

  it('must return middle service (2)', () => {
    registry.run('C')
      .then(function (dep) {
        assert.deepEqual(dep, 'AABC')
      })
  })

  it('must return rightmost service', () => {
    registry.run('D')
      .then(function (dep) {
        assert.deepEqual(dep, 'ABAABCD')
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
})

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

  it('must return a service in a simple case (1 function)', () => {
    registry.service('hello').provides(function (deps) {
      assert.deepEqual(deps, {})
      return Promise.resolve('hello')
    })

    return registry.run('hello')
      .then(function (dep) {
        assert.deepEqual(dep, 'hello')
      })
  })

  it('must return undefined (1 function)', () =>
    registry.run('hello')
      .catch(function (err) {
        assert.equal(err.message, 'Diogenes: missing dependency: hello')
        assert.instanceOf(err, DiogenesError)
      }))

  it('must return an exception if the function fails', () => {
    registry.service('hello').provides(function (deps) {
      throw new Error('broken')
    })

    return registry.run('hello')
      .catch(function (err) {
        assert.instanceOf(err, Error)
        assert.equal(err.message, 'broken')
      })
  })

  it('must return a service in a simple case (2 functions)', () => {
    registry.service('hello').provides(function (deps) {
      assert.deepEqual(deps, {})
      return Promise.resolve('hello ')
    })

    registry.service('world').dependsOn(['hello']).provides(function (deps) {
      assert.deepEqual(deps, {hello: 'hello '})
      return Promise.resolve(deps.hello + 'world!')
    })

    return registry.run('world')
      .then(function (dep) {
        assert.deepEqual(dep, 'hello world!')
      })
  })

  it('must return a service in a simple case (2 functions) not using next', () => {
    registry.service('hello').provides(function (deps) {
      assert.deepEqual(deps, {})
      return 'hello '
    })

    registry.service('world').dependsOn(['hello']).provides(function (deps) {
      assert.deepEqual(deps, { hello: 'hello ' })
      return deps.hello + 'world!'
    })

    return registry.run('world')
      .then(function (dep) {
        assert.deepEqual(dep, 'hello world!')
      })
  })

  it('must return a service using return', () => {
    registry.service('hello').provides(function (deps) {
      assert.deepEqual(deps, {})
      return 'hello'
    })

    return registry.run('hello')
      .then(function (dep) {
        assert.deepEqual(dep, 'hello')
      })
  })

  it('must return a service in a simple case (2 functions)', () => {
    registry.service('hello').provides(function (deps) {
      assert.deepEqual(deps, {})
      return Promise.resolve('hello ')
    })

    registry.service('world').dependsOn(['hello']).provides((deps) => {
      assert.deepEqual(deps, {hello: 'hello '})
      return Promise.resolve(deps.hello + 'world!')
    })

    return registry.run('world')
      .then(function (dep) {
        assert.deepEqual(dep, 'hello world!')
      })
  })

  it('can use pass an object to dependsOn', () => {
    registry.service('A').provides(function (deps) {
      return Promise.resolve('hello')
    })

    registry.service('B').provides((deps) => {
      return Promise.resolve('world')
    })

    registry.service('C').dependsOn({ dep1: 'A', dep2: 'B' }).provides((deps) => {
      assert.deepEqual(deps, {dep1: 'hello', dep2: 'world'})
      return deps.dep1 + ' ' + deps.dep2
    })

    return registry.run('C')
      .then(function (dep) {
        assert.deepEqual(dep, 'hello world')
      })
  })

  it('must recognize a circular dependency', () => {
    registry.service('hello').dependsOn(['world']).provides(function (deps) {
      return Promise.resolve('hello ')
    })

    registry.service('world').dependsOn(['hello']).provides(function (deps) {
      return Promise.resolve('world!')
    })

    return registry.run('hello')
      .catch(function (err) {
        assert.instanceOf(err, DiogenesError)
        assert.equal(err.message, 'Diogenes: circular dependency')
      })
  })

  it('must recognize a circular dependency (3 services)', () => {
    registry.service('A').dependsOn(['C']).provides(function (deps) {
      return Promise.resolve()
    })

    registry.service('B').dependsOn(['A']).provides(function (deps) {
      return Promise.resolve()
    })

    registry.service('C').dependsOn(['B']).provides(function (deps) {
      return Promise.resolve()
    })

    return registry.run('C')
      .catch(function (err) {
        assert.instanceOf(err, DiogenesError)
        assert.equal(err.message, 'Diogenes: circular dependency')
      })
  })

  it('must throw an exception when missing dependency', () => {
    registry.service('hello').dependsOn(['world']).provides(function (deps) {
      return Promise.resolve('hello ')
    })

    return registry.run('hello')
      .catch(function (err) {
        assert.instanceOf(err, DiogenesError)
        assert.equal(err.message, 'Diogenes: missing dependency: world')
      })
  })
})

describe('missingDeps', () => {
  it('returns a list of missing deps', () => {
    const registry = Diogenes.getRegistry()
    registry.service('A')
    registry.service('B').dependsOn(['A', 'Z'])
    registry.service('C').dependsOn(['X', 'Y'])
    assert.deepEqual(registry.missingDeps(), ['Z', 'X', 'Y'])
  })
  it('returns no missing deps', () => {
    const registry = Diogenes.getRegistry()
    registry.service('A')
    registry.service('B').dependsOn(['A'])
    registry.service('C').dependsOn(['A', 'B'])
    assert.deepEqual(registry.missingDeps(), [])
  })
})

describe('compose', () => {
  it('decorates with promisify', () => {
    const registry = Diogenes.getRegistry()
    registry.service('A').provides([ promisify, (deps, next) => next(null, 3) ])
    return registry.run('A')
      .then(res => {
        assert.equal(res, 3)
      })
  })

  it('decorates with promisify and a custom decorator', () => {
    const registry = Diogenes.getRegistry()
    const double = (func) => (deps) => func(deps).then((res) => res * 2)

    registry.service('A').provides([ double, promisify, (deps, next) => next(null, 3) ])
    return registry.run('A')
      .then(res => {
        assert.equal(res, 6)
      })
  })
})
