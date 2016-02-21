var dfs = require('./lib/dfs');
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

RegistryInstance.prototype.getExecutionOrder = function registryInstance_getExecutionOrder(name, noCache) {
  var adjlists = this._registry._filterByConfig(this._config, noCache);
  var sorted_services = dfs(adjlists, name);
  return sorted_services;
};

RegistryInstance.prototype._run = function registryInstance__run(name, done) {
  var adjlists, sorted_services;
  var config = this._config;
  var deps = {}; // all dependencies already resolved
  var registry = this._registry;
  var services = registry.services;
  var numberParallelCallback = 0;
  var limitParallelCallback = 'limit' in this._options ? this._options.limit : Infinity;
  var isOver = false;
  var logger = this._options.logger || function () {};

  if (!done) {
    done = function (err, dep) {
      if (err) {
        throw err;
      }
    };
  }

  try {
    adjlists = this._registry._filterByConfig(config);
    sorted_services = dfs(adjlists, name);
  }
  catch (e) {
    isOver = true;
    return done.call(registry, e);
  }

  (function resolve(name, dep, cached) {
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
        if (!cached) {
          registry.trigger('success', name, dep, config);
        }
        else {
          registry.trigger('cachehit', name, dep, config);
        }
      }
      else {
        registry.trigger('error', name, dep, config);
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
      currentService = services[sorted_services[i]];
      adj = adjlists(currentService.name);
      if ('cached' in adj) {
        setImmediate(function () {
          resolve(currentService.name, adj.cached, true);
        });
        sorted_services.splice(i, 1);
      }
      else {
        currentServiceDeps = getDependencies(deps, adj.deps);
        if (currentServiceDeps) {
          try {
            func = currentService._getFunc(config, currentServiceDeps, logger, resolve);
          }
          catch (e) {
            isOver = true;
            return done.call(registry, e);
          }
          sorted_services.splice(i, 1);
          numberParallelCallback++;
          registry.trigger('before', currentService.name, config);
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
