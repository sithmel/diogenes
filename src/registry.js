const uuid = require('uuid/v1')
const Service = require('./service')
const DiogenesError = require('./lib/diogenes-error')
const DiogenesShutdownError = require('./lib/diogenes-shutdown')
const getName = require('./lib/get-name')

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

Registry.prototype.has = function registryHas (nameOrFunc) {
  return getName(nameOrFunc) in this.services
}

Registry.prototype.set = function registrySet (nameOrFunc, service) {
  this.services[getName(nameOrFunc)] = service
}

Registry.prototype.get = function registryGet (nameOrFunc) {
  return this.services[getName(nameOrFunc)]
}

Registry.prototype.init = function registryInit (funcs) {
  for (const func of funcs) {
    func.call(this, this)
  }
}

Registry.prototype.service = function registryService (nameOrFunc) {
  if (typeof nameOrFunc !== 'string' && typeof nameOrFunc !== 'function') {
    throw new DiogenesError('Diogenes: the service should be a string or a function')
  }

  if (!this.has(nameOrFunc)) {
    this.set(nameOrFunc, new Service(nameOrFunc))
  }

  return this.get(nameOrFunc)
}

Registry.prototype.map = function registryMap (func) {
  var out = {}
  for (const service of Object.values(this.services)) {
    out[service.name] = func(service)
  }
  return out
}

Registry.prototype.getAdjList = function registryGetAdjList () {
  return this.map((service) => service.deps())
}

Registry.prototype.getMetadata = function registryGetAdjList () {
  return this.map(function (service) { return service.getMetadata() })
}

Registry.prototype._run = function registryRun (name) {
  const cache = {}
  const registry = this
  const runId = uuid()
  let c = 0

  if (this._isShuttingDown) {
    return Promise.reject(new DiogenesShutdownError('Diogenes: shutting down'))
  }

  const getPromiseFromStr = (nameOfFunc) => {
    if (c++ > 1000) {
      throw new DiogenesError('Diogenes: circular dependency')
    }
    const service = this.get(nameOfFunc)

    if (!service) {
      return Promise.reject(new DiogenesError(`Diogenes: missing dependency: ${getName(nameOfFunc)}`))
    }

    if (service.name in cache) {
      return cache[service.name]
    }

    const deps = service.deps()

    if (deps.length === 0) {
      cache[service.name] = service._run(runId, {})
    } else {
      cache[service.name] = getPromisesFromStrArray(deps)
        .then((d) => service._run(runId, d))
    }
    return cache[service.name]
  }

  const getPromisesFromStrArray = (strArray) =>
    Promise.all(strArray.map(getPromiseFromStr))
      .then(function (results) {
        const out = {}
        for (var i = 0; i < strArray.length; i++) {
          out[strArray[i]] = results[i]
        }
        return out
      })

  try {
    const promise = getPromiseFromStr(name)
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
  let promise
  if (typeof name === 'string' || typeof name === 'function') {
    promise = this._run(getName(name), done)
  } else {
    if (name instanceof RegExp) {
      name = Object.keys(this.services).filter(RegExp.prototype.test.bind(name))
    } else if (Array.isArray(name)) {
      name = name.map(getName)
    }

    const tempreg = this.clone()

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

  registry.services = Object.assign.apply(null, services)
  return registry
}

Registry.prototype.shutdown = function registryShutdown (done) {
  this._isShuttingDown = true

  var promise = Promise.all(Object.keys(this.running)
    .map((key) => this.running[key].catch(() => Promise.resolve(null))))

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

Registry.prototype.flush = function registryFlush (done) {
  const promise = this.shutdown()
    .then(() => {
      this._isShuttingDown = false
      return Promise.resolve(null)
    })

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
