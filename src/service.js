const DiogenesError = require('./lib/diogenes-error')
const compose = require('./lib/compose')

/*
Service object
*/

function getDebugInfo (func, stackLevel) {
  try {
    const orig = Error.prepareStackTrace
    Error.prepareStackTrace = function (_, stack) {
      return stack
    }
    const err = new Error()
    const stack = err.stack
    Error.prepareStackTrace = orig
    const stackItem = stack[stackLevel]
    return {
      line: stackItem.getLineNumber(),
      fileName: stackItem.getFileName(),
      parentFunctionName: stackItem.getFunctionName(),
      functionName: typeof func === 'function' ? func.name : null
    }
  } catch (e) {
    return {}
  }
}

function Service (name) {
  this._doc = ''
  this._deps = {}
  this.name = name
}

Service.prototype.doc = function serviceDoc (text) {
  if (typeof text === 'undefined') {
    return this._doc
  }
  this._doc = text.trim()
  return this
}

Service.prototype.deps = function serviceDeps () {
  return this._deps
}

Service.prototype.depsArray = function serviceDepsArray () {
  return Array.from(new Set(Object.values(this._deps)))
}

Service.prototype.getMetadata = function serviceGetMetadata () {
  return {
    name: this.name,
    deps: this.depsArray(),
    doc: this.doc(),
    debugInfo: this._debugInfo
  }
}

Service.prototype.dependsOn = function serviceDependsOn (deps) {
  if (Array.isArray(deps)) {
    this._deps = deps.reduce((acc, value) => {
      acc[value] = value
      return acc
    }, {})
  } else if (typeof deps === 'object') {
    this._deps = deps
  } else if (typeof deps === 'undefined') {
    this._deps = {}
  } else {
    throw new DiogenesError('Dependency can be an array, an object or undefined')
  }
  return this
}

Service.prototype.provides = function serviceProvides (func) {
  let originalFunction, resultingFunction
  if (Array.isArray(func)) {
    originalFunction = func[func.length - 1]
    resultingFunction = compose(func.slice(0, -1))(originalFunction)
  } else {
    originalFunction = func
    resultingFunction = func
  }
  this._debugInfo = getDebugInfo(originalFunction, 2)
  if (typeof resultingFunction !== 'function') {
    this._func = function () { return Promise.resolve(func) } // plain value
  } else {
    this._func = resultingFunction
  }
  return this
}

Service.prototype.run = function serviceRun (id, deps) {
  const context = { id: id, service: this }
  return Promise.resolve()
    .then(() => this._func.call(context, deps))
}

module.exports = Service
