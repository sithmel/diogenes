/* eslint-env node, mocha */
const DepsToKey = require('../src/lib/deps-to-key')
const assert = require('chai').assert

describe('deps to key', (done) => {
  let depsToKey
  before(() => {
    depsToKey = new DepsToKey()
  })

  it('getIdFromValues is a function', () => {
    assert.typeOf(depsToKey.getIdFromValues, 'function')
  })

  it('getIdFromValue is a function', () => {
    assert.typeOf(depsToKey.getIdFromValue, 'function')
  })

  describe('getIdFromValue', () => {
    it('returns consistent values: number', () => {
      assert.equal(depsToKey.getIdFromValue(0), depsToKey.getIdFromValue(0))
      assert.equal(depsToKey.getIdFromValue(1), depsToKey.getIdFromValue(1))
      assert.notEqual(depsToKey.getIdFromValue(1), depsToKey.getIdFromValue(0))
    })

    it('returns consistent values: null/undefined', () => {
      assert.equal(depsToKey.getIdFromValue(null), depsToKey.getIdFromValue(null))
      assert.equal(depsToKey.getIdFromValue(), depsToKey.getIdFromValue())
      assert.notEqual(depsToKey.getIdFromValue(null), depsToKey.getIdFromValue())
    })

    it('returns consistent values: strings', () => {
      assert.equal(depsToKey.getIdFromValue('hello'), depsToKey.getIdFromValue('hello'))
      assert.notEqual(depsToKey.getIdFromValue('world'), depsToKey.getIdFromValue('hello'))
    })

    it('returns consistent values: booleans', () => {
      assert.equal(depsToKey.getIdFromValue(true), depsToKey.getIdFromValue(true))
      assert.notEqual(depsToKey.getIdFromValue(true), depsToKey.getIdFromValue(false))
    })

    it('returns consistent values: symbol', () => {
      const symbol1 = Symbol('hello')
      const symbol2 = Symbol('world')
      assert.equal(depsToKey.getIdFromValue(symbol1), depsToKey.getIdFromValue(symbol1))
      assert.notEqual(depsToKey.getIdFromValue(symbol1), depsToKey.getIdFromValue(symbol2))
    })

    it('returns consistent values: objects', () => {
      const a = {}
      const b = {}
      assert.equal(depsToKey.getIdFromValue(a), depsToKey.getIdFromValue(a))
      assert.notEqual(depsToKey.getIdFromValue(a), depsToKey.getIdFromValue(b))
    })

    it('returns consistent values: functions', () => {
      const a = () => {}
      const b = () => {}
      assert.equal(depsToKey.getIdFromValue(a), depsToKey.getIdFromValue(a))
      assert.notEqual(depsToKey.getIdFromValue(a), depsToKey.getIdFromValue(b))
    })
  })

  describe('getIdFromValues', () => {
    it('returns consistent values', () => {
      assert.equal(depsToKey.getIdFromValues({ a: 1, b: 2 }), depsToKey.getIdFromValues({ a: 1, b: 2 }))
      assert.equal(depsToKey.getIdFromValues({ a: 1, b: 2 }), depsToKey.getIdFromValues({ b: 2, a: 1 }))
      assert.notEqual(depsToKey.getIdFromValues({ a: 1, b: 2 }), depsToKey.getIdFromValues({ a: 1, b: 3 }))
    })
    it('return nothing for empty object', () => {
      assert.equal(depsToKey.getIdFromValues({}), '')
    })
  })
})
