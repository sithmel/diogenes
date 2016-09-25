var buildLogger = require('async-deco/utils/build-logger');
var depSort = require('./lib/dep-sort');
var memoize = require('./lib/memoize');
var DiogenesError = require('./lib/diogenes-error');
/*

RegistryInstance utilities

*/

function getDependencies(currentDeps, requiredDeps) {
  var deps = {};
  for (var i = 0; i < requiredDeps.length; i++) {
    if (!(requiredDeps[i] in currentDeps)) {
      return; // I can't execute this because a deps is missing
    }
    deps[requiredDeps[i]] = currentDeps[requiredDeps[i]];
  }
  return deps;
}

/*

RegistryInstance

*/

function RegistryInstance(registry, config, options) {
  this._registry = registry; // backreference
  this._config = config;
  this._options = options || {};
}

RegistryInstance.prototype.registry = function registryInstance_registry() {
  return this._registry;
};

RegistryInstance.prototype._filterByConfig = function registryInstance__filterByConfig() {
  var registry = this._registry;
  var services = registry.services;
  var config = this._config;
  return memoize(function (name) {
    if (!(name in services)) {
      return null;
    };
    return services[name]._getDeps(config);
  });
};

RegistryInstance.prototype.getExecutionOrder = function registryInstance_getExecutionOrder(name) {
  var getAdjlists = this._filterByConfig();
  return depSort(getAdjlists, name).map(function (item) {return item.name;});
};

RegistryInstance.prototype.getAdjList = function registryInstance_getAdjList() {
  var adjList = {};
  var config = this._config;
  this.registry().forEach(function (service, name) {
    adjList[name] = service._deps(config);
  });
  return adjList;
};

RegistryInstance.prototype._run = function registryInstance__run(name, done) {
  var instance = this;
  var config = this._config;
  var getAdjlists = this._filterByConfig();
  var deps = {}; // all dependencies already resolved
  var registry = this._registry;
  var services = registry.services;
  var numberParallelCallback = 0;
  var limitParallelCallback = 'limit' in this._options ? this._options.limit : Infinity;
  var isOver = false;
  var sorted_services;

  if (!done) {
    done = function (err, dep) {
      if (err) {
        throw err;
      }
    };
  }

  try {
    sorted_services = depSort(getAdjlists, name);
  }
  catch (err) {
    return done.call(registry, err);
  }

  (function resolve(name, dep) {
    var currentService, adj, currentServiceDeps;
    var func, i = 0;

    if (isOver) {
      // the process is over (callback returned too)
      // this may only happen if there is a duplicated callback
      throw new DiogenesError('Diogenes: a callback has been firing more than once');
      return;
    }
    else if (name in deps) {
      // this dependency already solved.
      // Did someone is firing the callback twice ?
      isOver = true;
      return done.call(registry, new DiogenesError('Diogenes: a callback has been firing more than once'));
    }
    else if (name) {
      deps[name] = dep;
      numberParallelCallback--;
      if (!(dep instanceof Error)) {
        services[name]._cachePush(config, dep);
      }
    }

    if (sorted_services.length === 0) {
      isOver = true;
      if (dep instanceof Error) {
        return done.call(registry, dep);
      }
      else {
        return done.call(registry, undefined, dep);
      }
    }

    while (i < sorted_services.length) {
      if (numberParallelCallback >= limitParallelCallback) break;
      currentService = services[sorted_services[i].name];
      adj = sorted_services[i];

      if ('cached' in adj) {
        setImmediate(function () {
          resolve(currentService.name, adj.cached);
        });
        sorted_services.splice(i, 1);
      }
      else {
        currentServiceDeps = getDependencies(deps, adj.deps);
        if (currentServiceDeps) {
          try {
            func = currentService._getFunc(config, currentServiceDeps, currentService, resolve);
          }
          catch (e) {
            isOver = true;
            return done.call(registry, e);
          }
          sorted_services.splice(i, 1);
          numberParallelCallback++;
          setImmediate(func);
        }
        else {
          i++;
        }
      }
    }
  }());
  return this;
};

RegistryInstance.prototype.run = function registryInstance_run(name, done) {
  if (typeof name === 'string') {
    this._run(name, done);
    return this;
  }

  var tempreg = this.registry().clone();

  tempreg.service('__main__').dependsOn(name).provides(function (config, deps, next) {
    next(undefined, deps);
  });

  tempreg.instance(this._config).run('__main__', done);
  return this;
};

module.exports = RegistryInstance;
