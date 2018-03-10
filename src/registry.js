var assign = require('object-assign')
var Service = require('./service')
var memoize = require('./lib/memoize')
var depSort = require('./lib/dep-sort')
var DiogenesError = require('./lib/diogenes-error')

/*
Registry utilities
*/

function getDependencies (currentDeps, requiredDeps) {
  var deps = {}
  for (var i = 0; i < requiredDeps.length; i++) {
    if (!(requiredDeps[i] in currentDeps)) {
      return // I can't execute this because a deps is missing
    }
    deps[requiredDeps[i]] = currentDeps[requiredDeps[i]]
  }
  return deps
}

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
    funcs[i].apply(this)
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

Registry.prototype._filterByConfig = function registryFilterByConfig () {
  var services = this.services
  return memoize(function (name) {
    if (!(name in services)) {
      return null
    };
    return services[name]._getDeps()
  })
}

Registry.prototype.getExecutionOrder = function registryGetExecutionOrder (name) {
  var getAdjlists = this._filterByConfig()
  return depSort(getAdjlists, name)
}

Registry.prototype.getAdjList = function registryInstanceGetAdjList () {
  var adjList = {}
  Object.keys(this.services)
    .map(this.service.bind(this))
    .forEach(function (service) {
      adjList[service.name] = service._deps()
    })
  return adjList
}

Registry.prototype._run = function registryRun (name, done) {
  var getAdjlists = this._filterByConfig()
  var deps = {} // all dependencies already resolved
  var registry = this
  var services = registry.services
  var isOver = false
  var sortedServices

  if (!done) {
    done = function (err, dep) {
      if (err) {
        throw err
      }
    }
  }

  try {
    sortedServices = depSort(getAdjlists, name)
  } catch (err) {
    return done(err)
  }

  (function resolve (err, dep, name) {
    var currentService, adj, currentServiceDeps
    var i = 0

    if (err) {
      isOver = true
      return done(err)
    }

    if (isOver) {
      // the process is over (callback returned too)
      // this may happen when a service gets an error
      // and some other service was still running
      return
    }

    if (name in deps) {
      // this dependency already solved.
      // Did someone is firing the callback twice ?
      isOver = true
      return done(new DiogenesError('Diogenes: a callback has been firing more than once'))
    } else if (name) {
      deps[name] = dep
    }

    if (sortedServices.length === 0) {
      isOver = true
      if (err) {
        return done(err)
      } else {
        return done(null, dep)
      }
    }

    while (i < sortedServices.length) {
      currentService = services[sortedServices[i]]
      adj = getAdjlists(sortedServices[i])

      currentServiceDeps = getDependencies(deps, adj)
      if (currentServiceDeps) {
        sortedServices.splice(i, 1)
        currentService._run(currentServiceDeps, resolve)
      } else {
        i++
      }
    }
  }())
  return this
}

Registry.prototype.run = function registryRun (name, done) {
  if (typeof name === 'string') {
    this._run(name, done)
    return this
  }

  if (name instanceof RegExp) {
    name = Object.keys(this.services).filter(RegExp.prototype.test.bind(name))
  }

  var tempreg = this.clone()

  tempreg.service('__temp__').dependsOn(name).provides(function (deps, next) {
    next(undefined, deps)
  })

  tempreg.run('__temp__', done)
  return this
}

Registry.prototype.merge = function registryMerge () {
  var registry = new Registry()

  var services = Array.prototype.map.call(arguments, function (reg) {
    return reg.services
  })

  services.unshift(this.services)
  services.unshift({})

  registry.services = assign.apply(null, services)
  return registry
}

Registry.prototype.clone = function registryClone () {
  return this.merge()
}

module.exports = Registry
