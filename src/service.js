/*
Service object
*/
var promisify = require('es6-promisify').promisify

function Service (name, registry) {
  this.name = name
  this._registry = registry // backreference
  this._deps = function () { return [] }
  this._func = function () { return Promise.resolve() }
  this._cache = undefined
}

Service.prototype.registry = function serviceRegistry () {
  return this._registry
}

Service.prototype.dependsOn = function serviceDependsOn (deps) {
  this._deps = typeof deps === 'function' ? deps : function () { return deps }
  return this
}

Service.prototype.provides = function serviceProvides (func) {
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

Service.prototype._run = function serviceRun (deps) {
  var service = this
  if (service._cache) {
    return service._cache
  }
  service._cache = service._func(deps)
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
