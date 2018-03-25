var uuid = require('uuid/v1')

/*
Service object
*/
var promisify = require('es6-promisify').promisify

function getDebugInfo (func) {
  try {
    const orig = Error.prepareStackTrace
    Error.prepareStackTrace = function (_, stack) {
      return stack
    }
    const err = new Error()
    const stack = err.stack
    Error.prepareStackTrace = orig
    const stackItem = stack[3]
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

function extractDocString (f) {
  const str = f.toString()
  const re = /\/\*\*(.+?)\*\*\//
  const match = re.exec(str)
  if (match) {
    return match[1].trim()
  }
}

function Service (nameOrFunc) {
  this._doc = ''
  this._deps = function () { return [] }
  this._cache = undefined
  if (typeof nameOrFunc === 'string') {
    this.name = nameOrFunc
    this._provides(function () { return Promise.resolve() })
  } else if (typeof nameOrFunc === 'function') {
    this.name = nameOrFunc.name || uuid()
    this._provides(nameOrFunc)
    this.doc(extractDocString(nameOrFunc))
  }
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
  return this._provides(func)
}

Service.prototype._provides = function serviceProvides (func) {
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
  const context = { id: id, service: this }
  if (this._cache) {
    return this._cache
  }
  this._cache = this._func.call(context, deps)
    .catch((err) => {
      this._cache = undefined
      return Promise.reject(err)
    })
  return this._cache
}

Service.prototype._getDeps = function serviceGetDeps () {
  return this._cache ? [] : this._deps()
}

module.exports = Service
