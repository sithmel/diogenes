require('setimmediate')
/*
Service object
*/

function defer (func) {
  var args = Array.prototype.slice.call(arguments, 1)
  setImmediate(function () {
    func.apply(null, args)
  })
}

function Service (name, registry) {
  this.name = name
  this._registry = registry // backreference
  this._cached = false
  this._deps = function () { return [] }
}

Service.prototype.registry = function serviceRegistry () {
  return this._registry
}

Service.prototype.dependsOn = function serviceDependsOn (deps) {
  this._deps = typeof deps === 'function' ? deps : function () { return deps }
  return this
}

Service.prototype.provides = function serviceProvides (func) {
  this._func = func
  return this
}

Service.prototype._run = function serviceRun (deps, callback) {
  var service = this
  var res
  if (service._cached) {
    return callback(null, service._cache, service.name)
  }

  if (service._func.length <= 1) { // no callback. It should return
    try {
      res = service._func(deps)
    } catch (e) { // erroring
      defer(callback, e, null, service.name)
    }
    if (res instanceof Object && 'then' in res) { // it is a promise
      res
        .then(function (out) {
          service._cached = true
          service._cache = out
          callback(null, out, service.name)
        })
        .catch(function (err) {
          callback(err, null, service.name)
        })
    } else { // just a plain sync function
      service._cached = true
      service._cache = res
      defer(callback, null, res, service.name)
    }
  } else { // we have a callback
    this._func(deps, function (err, res) {
      if (!err) {
        service._cached = true
        service._cache = res
      }
      defer(callback, err, res, service.name)
    })
  }
}

Service.prototype._getDeps = function serviceGetDeps () {
  return this._cached ? [] : this._deps()
}

module.exports = Service
