const uuid = require('uuid/v1')
const Service = require('./service')
const DiogenesError = require('./lib/diogenes-error')
const DiogenesShutdownError = require('./lib/diogenes-shutdown')

function isStr (s) {
  return typeof s === 'string'
}

function isFunc (f) {
  return typeof f === 'function'
}

// tries to get a name from a string or a function
function getName (nameOrFunc) {
  if (isStr(nameOrFunc)) {
    return nameOrFunc
  }
  if (isFunc(nameOrFunc)) {
    return nameOrFunc.name || 'undefined'
  }
  return 'undefined'
}

/*
Registry object
*/

function Registry () {
  this.services = new Map()
  this.running = {}
  this._isShuttingDown = false
}

Registry.getRegistry = function registryGetRegistry () {
  return new Registry()
}

Registry.prototype.has = function registryHas (nameOrFunc) {
  return this.services.has(nameOrFunc)
}

Registry.prototype.set = function registrySet (nameOrFunc, service) {
  this.services.set(nameOrFunc, service)
}

Registry.prototype.get = function registryGet (nameOrFunc) {
  return this.services.get(nameOrFunc)
}

Registry.prototype.init = function registryInit (funcs) {
  for (const func of funcs) {
    func.call(this, this)
  }
}

Registry.prototype.service = function registryService (nameOrFunc) {
  if (!isStr(nameOrFunc) && !isFunc(nameOrFunc)) {
    throw new DiogenesError('Diogenes: the service should be a string or a function')
  }

  if (!this.has(nameOrFunc)) {
    this.set(nameOrFunc, new Service(nameOrFunc))
  }

  return this.get(nameOrFunc)
}

Registry.prototype.map = function registryMap (func) {
  var out = {}
  for (const service of this.services.values()) {
    out[service.name] = func(service)
  }
  return out
}

Registry.prototype.getAdjList = function registryGetAdjList () {
  return this.map((service) =>
    service._deps()
      .map((dep) => this.has(dep) ? this.service(dep).name : `NOT FOUND: ${getName(dep)}`))
}

Registry.prototype.getMetadata = function registryGetAdjList () {
  return this.map(function (service) { return service.getMetadata() })
}

Registry.prototype._run = function registryRun (name) {
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

    const deps = service._getDeps()

    if (deps.length === 0) {
      return service._run(runId, {})
    }
    return getPromisesFromStrArray(deps)
      .then((d) => service._run(runId, d))
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
  if (typeof name === 'string') {
    promise = this._run(name, done)
  } else {
    if (name instanceof RegExp) {
      name = Array.from(this.services.values()).map(function (service) { return service.name }).filter(RegExp.prototype.test.bind(name))
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
  const registry = new Registry()

  const services = Array.prototype
    .map.call(arguments, function (reg) {
      return Array.from(reg.services.entries())
    })
    .reduce((acc, value) => {
      return acc.concat(value)
    }, [])

  registry.services = new Map(Array.from(this.services.entries()).concat(services))
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

module.exports = Registry
