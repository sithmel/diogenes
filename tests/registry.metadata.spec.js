/* eslint-env node, mocha */
const Diogenes = require('../src')
const assert = require('chai').assert

describe('metadata', () => {
  let registry, service1

  beforeEach(() => {
    registry = Diogenes.getRegistry()
    service1 = registry
      .service('answer').provides(42).doc('to all the questions')

    registry.service('question')
      .dependsOn(['answer'])
      .provides(function theanswer () {})
      .doc('the important bit')
  })

  it('must return services metadata', () => {
    assert.deepEqual(service1.getMetadata(), {
      name: 'answer',
      deps: [],
      doc: 'to all the questions',
      debugInfo: {
        line: 11,
        functionName: null,
        parentFunctionName: 'beforeEach',
        fileName: __filename
      }
    })
  })

  it('must return registry metadata', () => {
    assert.deepEqual(registry.getMetadata(), {
      answer: {
        name: 'answer',
        deps: [],
        doc: 'to all the questions',
        debugInfo: {
          line: 11,
          functionName: null,
          parentFunctionName: 'beforeEach',
          fileName: __filename
        }
      },
      question: {
        name: 'question',
        deps: ['answer'],
        doc: 'the important bit',
        debugInfo: {
          line: 15,
          functionName: 'theanswer',
          parentFunctionName: 'beforeEach',
          fileName: __filename
        }
      }
    })
  })
})
