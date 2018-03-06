/*
Service object
*/

function Service (name, registry) {
  this.name = name
  this._registry = registry // backreference
  this._cached = false
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

  if (service._func.length <= 1) {
    try {
      res = service._func(deps)
      service._cached = true
      service._cache = res
      callback(null, res, service.name)
    } catch (e) {
      callback(e, null, service.name)
    }
  } else {
    this._func(deps, function (err, res) {
      if (!err) {
        service._cached = true
        service._cache = res
      }
      callback(err, res, service.name)
    })
  }
}

Service.prototype._getDeps = function serviceGetDeps () {
  return this._cached ? [] : this._deps()
}

module.exports = Service
