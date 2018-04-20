const Service = require('./service')
const DiogenesError = require('./lib/diogenes-error')
const uuid = require('uuid/v1')

/*
Registry object
*/

function Registry () {
  this.services = {}
}

Registry.getRegistry = function registryGetRegistry () {
  return new Registry()
}

Registry.prototype.has = function registryHas (name) {
  return name in this.services
}

Registry.prototype.set = function registrySet (name, service) {
  this.services[name] = service
}

Registry.prototype.get = function registryGet (name) {
  return this.services[name]
}

Registry.prototype.init = function registryInit (funcs) {
  for (const func of funcs) {
    func.call(this, this)
  }
}

Registry.prototype.service = function registryService (name) {
  if (typeof name !== 'string') {
    throw new DiogenesError('Diogenes: the service name should be a string')
  }

  if (!this.has(name)) {
    this.set(name, new Service(name))
  }

  return this.get(name)
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

Registry.prototype.getMetadata = function registryGetMetadata (deps) {
  return this.map(function (service) { return service.getMetadata() })
}

Registry.prototype.run = function registryRun (name, runId) {
  runId = runId || uuid()
  const cache = {}
  let c = 0

  const getPromiseFromStr = (name) => {
    if (c++ > 1000) {
      throw new DiogenesError('Diogenes: circular dependency')
    }
    const service = this.get(name)

    if (!service) {
      return Promise.reject(new DiogenesError(`Diogenes: missing dependency: ${name}`))
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
    return promise
  } catch (e) {
    return Promise.reject(e)
  }
}

Registry.prototype.addDeps = function registryAddDeps (deps) {
  Object.keys(deps)
    .forEach((serviceName) => {
      this.service(serviceName).provides(deps[serviceName])
    })
  return this
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

module.exports = Registry
