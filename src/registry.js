const Service = require('./service')
const DiogenesError = require('./lib/diogenes-error')
const uuid = require('uuid/v1')
const RegistryRunner = require('./registry-runner')

/*
Registry object
*/

function Registry () {
  this.services = {}
}

Registry.getRegistry = function registryGetRegistry () {
  return new Registry()
}

Registry.getRegistryRunner = function registryGetRegistryRunner () {
  return new RegistryRunner()
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
  return this.map((service) => service.depsArray())
}

Registry.prototype.missingDeps = function registryMissingDeps () {
  const adjList = this.getAdjList()
  const deps = Object.keys(adjList)
    .reduce((accum, key) => {
      return accum.concat(adjList[key])
    }, [])
  return Array.from(new Set(deps))
    .filter((dep) => !(dep in adjList))
}

Registry.prototype.getMetadata = function registryGetMetadata () {
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
    const depsArray = service.depsArray()

    if (depsArray.length === 0) {
      cache[service.name] = service.run(runId, {})
    } else {
      cache[service.name] = getPromisesFromDeps(depsArray, deps)
        .then((d) => service.run(runId, d))
    }
    return cache[service.name]
  }

  const getPromisesFromDeps = (depsArray, depsObj) =>
    Promise.all(depsArray.map(getPromiseFromStr))
      .then(function (results) {
        // map dependencies on an object
        const depMap = {}
        for (let i = 0; i < depsArray.length; i++) {
          depMap[depsArray[i]] = results[i]
        }
        // map object on another object values
        const out = {}
        Object.keys(depsObj).forEach((key) => {
          const value = depMap[depsObj[key]]
          out[key] = value
        })

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
