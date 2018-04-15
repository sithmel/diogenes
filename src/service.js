const promisify = require('es6-promisify').promisify
const getName = require('./lib/get-name')
const DiogenesError = require('./lib/diogenes-error')

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

function extractDocString (f) {
  const str = f.toString()
  const re = /\/\*\*(.+?)\*\*\//
  const match = re.exec(str)
  if (match) {
    return match[1]
  }
}

function Service (nameOrFunc) {
  this._doc = ''
  this._deps = []
  this.name = getName(nameOrFunc)
  if (!this.name) {
    throw new DiogenesError('The service must have a name. Use either a string or a named function')
  }

  if (typeof nameOrFunc === 'function') {
    this._debugInfo = getDebugInfo(nameOrFunc, 3)
    this._provides(nameOrFunc)
    this.doc(extractDocString(nameOrFunc))
  }
}

Service.prototype.doc = function serviceDoc (text) {
  if (typeof text === 'undefined') {
    return this._doc
  }
  this._doc = text.trim()
  return this
}

Service.prototype.deps = function serviceDeps () {
  return this._deps.map(getName)
}

Service.prototype.getMetadata = function serviceGetMetadata () {
  return {
    name: this.name,
    deps: this.deps(),
    doc: this.doc(),
    debugInfo: this._debugInfo
  }
}

Service.prototype.dependsOn = function serviceDependsOn (deps) {
  this._deps = deps
  return this
}

Service.prototype.provides = function serviceProvides (func) {
  this._debugInfo = getDebugInfo(func, 2)
  return this._provides(func)
}

Service.prototype._provides = function serviceProvides (func) {
  if (this._func) {
    throw new DiogenesError(`You already defined a function for ${this.name}`)
  }
  if (typeof func !== 'function') {
    this._func = function () { return Promise.resolve(func) } // plain value
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
  return this._func.call(context, deps)
}

module.exports = Service
