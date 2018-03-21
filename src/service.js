/*
Service object
*/
var promisify = require('es6-promisify').promisify

function getDebugInfo (func) {
  try {
    var orig = Error.prepareStackTrace
    Error.prepareStackTrace = function (_, stack) {
      return stack
    }
    var err = new Error()
    var stack = err.stack
    Error.prepareStackTrace = orig
    var stackItem = stack[2]
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
  this.name = name
  this._deps = function () { return [] }
  this._func = function () { return Promise.resolve() }
  this._cache = undefined
  this._doc = ''
}

Service.prototype.doc = function serviceDoc (text) {
  if (typeof text === 'undefined') {
    return this._doc
  }
  this._doc = text
  return this
}

Service.prototype.getMetadata = function serviceGetMetadata () {
  return {
    name: this.name,
    deps: this._deps(),
    doc: this.doc(),
    cached: !!this._cache,
    debugInfo: this._debugInfo
  }
}

Service.prototype.dependsOn = function serviceDependsOn (deps) {
  this._deps = typeof deps === 'function' ? deps : function () { return deps }
  return this
}

Service.prototype.provides = function serviceProvides (func) {
  this._debugInfo = getDebugInfo(func)
  if (typeof func !== 'function') {
    this._func = function () { Promise.resolve(func) } // plain value
  } else if (func.length > 1) {
    this._func = promisify(func) // callback function
  } else {
    this._func = function (deps) { // sync function or return promise
      try {
        var res = func(deps)
      } catch (e) {
        return Promise.reject(e)
      }
      if (res instanceof Object && 'then' in res) {
        return res
      } else {
        return Promise.resolve(res)
      }
    }
  }
  return this
}

Service.prototype._run = function serviceRun (id, deps) {
  var service = this
  var context = { id: id, service: service }
  if (service._cache) {
    return service._cache
  }
  service._cache = service._func.call(context, deps)
    .catch(function (err) {
      service._cache = undefined
      return Promise.reject(err)
    })
  return service._cache
}

Service.prototype._getDeps = function serviceGetDeps () {
  return this._cache ? [] : this._deps()
}

module.exports = Service
