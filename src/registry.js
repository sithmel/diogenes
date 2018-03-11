var assign = require('object-assign')
var Service = require('./service')
var DiogenesError = require('./lib/diogenes-error')

/*
Registry object
*/

function Registry () {
  this.services = {}
}

Registry.getRegistry = function registryGetRegistry () {
  return new Registry()
}

Registry.prototype.init = function registryInit (funcs) {
  for (var i = 0; i < funcs.length; i++) {
    funcs[i].call(this, this)
  }
}

Registry.prototype.service = function registryService (name) {
  if (typeof name !== 'string') {
    throw new DiogenesError('Diogenes: the name of the service should be a string')
  }

  if (!(name in this.services)) {
    this.services[name] = new Service(name, this)
  }

  return this.services[name]
}

Registry.prototype.map = function registryMap (func) {
  var out = {}
  Object.keys(this.services)
    .map(this.service.bind(this))
    .forEach(function (service) {
      out[service.name] = func(service)
    })
  return out
}

Registry.prototype.getAdjList = function registryGetAdjList () {
  return this.map(function (service) { return service._deps() })
}

Registry.prototype._run = function registryRun (name) {
  var registry = this
  var c = 0

  function getPromiseFromStr (str) {
    if (c++ > 1000) {
      throw new DiogenesError('Diogenes: circular dependency')
    }
    if (!(str in registry.services)) {
      return Promise.reject(new DiogenesError('Diogenes: missing dependency: ' + str))
    }

    var deps = registry.services[str]._getDeps()

    if (deps.length === 0) {
      return registry.services[str]._run({})
    }
    return getPromisesFromStrArray(deps)
      .then(registry.services[str]._run.bind(registry.services[str]))
  }

  function getPromisesFromStrArray (strArray) {
    return Promise.all(strArray.map(getPromiseFromStr))
      .then(function (results) {
        var out = {}
        for (var i = 0; i < strArray.length; i++) {
          out[strArray[i]] = results[i]
        }
        return out
      })
  }

  try {
    return getPromiseFromStr(name)
  } catch (e) {
    return Promise.reject(e)
  }
}

Registry.prototype.run = function registryRun (name, done) {
  var promise
  if (typeof name === 'string') {
    promise = this._run(name, done)
  } else {
    if (name instanceof RegExp) {
      name = Object.keys(this.services).filter(RegExp.prototype.test.bind(name))
    }

    var tempreg = this.clone()

    tempreg.service('__temp__').dependsOn(name)
      .provides(function (deps) {
        return Promise.resolve(deps)
      })
    promise = tempreg.run('__temp__')
  }

  if (done) {
    promise
      .then(function (res) {
        done(null, res)
      })
      .catch(function (err) {
        done(err)
      })
    return this
  } else {
    return promise
  }
}

Registry.prototype.merge = Registry.prototype.clone = function registryMerge () {
  var registry = new Registry()

  var services = Array.prototype.map.call(arguments, function (reg) {
    return reg.services
  })

  services.unshift(this.services)
  services.unshift({})

  registry.services = assign.apply(null, services)
  return registry
}

module.exports = Registry
