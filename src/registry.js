var assign = require('object-assign')
var uuid = require('uuid/v1')
var Service = require('./service')
var DiogenesError = require('./lib/diogenes-error')
var DiogenesShutdownError = require('./lib/diogenes-shutdown')

/*
Registry object
*/

function Registry () {
  this.services = {}
  this.running = {}
  this._isShuttingDown = false
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
    this.services[name] = new Service(name)
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

Registry.prototype.getMetadata = function registryGetAdjList () {
  return this.map(function (service) { return service.getMetadata() })
}

Registry.prototype._run = function registryRun (name) {
  var registry = this
  var c = 0
  var runId = uuid()
  var promise

  if (this._isShuttingDown) {
    return Promise.reject(new DiogenesShutdownError('Diogenes: shutting down'))
  }

  function getPromiseFromStr (str) {
    if (c++ > 1000) {
      throw new DiogenesError('Diogenes: circular dependency')
    }
    if (!(str in registry.services)) {
      return Promise.reject(new DiogenesError('Diogenes: missing dependency: ' + str))
    }

    var deps = registry.services[str]._getDeps()

    if (deps.length === 0) {
      return registry.services[str]._run(runId, {})
    }
    return getPromisesFromStrArray(deps)
      .then(registry.services[str]._run.bind(registry.services[str], runId))
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
    promise = getPromiseFromStr(name)
      .then(function (res) {
        delete registry.running[runId]
        return Promise.resolve(res)
      })
      .catch(function (err) {
        delete registry.running[runId]
        return Promise.reject(err)
      })
    registry.running[runId] = promise
    return promise
  } catch (e) {
    delete registry.running[runId]
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

Registry.prototype.shutdown = function registryShutdown (done) {
  var registry = this
  registry._isShuttingDown = true

  var promise = Promise.all(Object.keys(registry.running)
    .map(function (key) {
      return registry.running[key]
        .catch(function () { return Promise.resolve(null) })
    }))

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

module.exports = Registry
