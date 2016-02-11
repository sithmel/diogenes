(function () {
  'use strict';

  /*

  Imports

  */

  if (typeof exports === 'object') {
    require('setimmediate');
  }

  var or = typeof exports === 'object' ? require('occamsrazor') : window.occamsrazor;

  /*

  polyfills

  */
  if (typeof Object.assign != 'function') {
    (function () {
      Object.assign = function (target) {
        'use strict';
        if (target === undefined || target === null) {
          throw new TypeError('Cannot convert undefined or null to object');
        }

        var output = Object(target);
        for (var index = 1; index < arguments.length; index++) {
          var source = arguments[index];
          if (source !== undefined && source !== null) {
            for (var nextKey in source) {
              if (source.hasOwnProperty(nextKey)) {
                output[nextKey] = source[nextKey];
              }
            }
          }
        }
        return output;
      };
    })();
  }

  /*

  Cache object

  */

  function Cache() {
    this._cache = undefined;
    this._cacheKeys = undefined;
  }

  Cache.prototype.on = function cache_on(opts) {
    opts = opts || {};
    var key = opts.key;

    if (typeof key === 'function') {
      this._getCacheKey = key;
    }
    else if (typeof key === 'string') {
      this._getCacheKey = function (config) {
        if (typeof config[key] === 'object') {
          return JSON.stringify(config[key]);
        }
        else {
          return config[key];
        }
      };
    }
    else if (Array.isArray(key)) {
      this._getCacheKey = function (config) {
        var value = config;
        for (var i = 0; i < key.length; i++) {
          value = value[key[i]];
        }
        if (typeof value === 'object') {
          return JSON.stringify(value);
        }
        else {
          return value;
        }
      };
    }
    else {
      this._getCacheKey = function (config) {
        return '_default';
      };
    }

    this._cache = {}; // key, value
    this._cacheKeys = []; // sorted by time {ts: xxx, key: xxx} new ones first

    this._maxAge = opts.maxAge || Infinity;
    this._maxSize = opts.maxSize || Infinity;
  };

  Cache.prototype.push = function cache_push(config, output) {
    if (!this._cache) return;
    var k = this._getCacheKey(config);
    if (k in this._cache) return;
    this._cache[k] = output;
    this._cacheKeys.unshift({
      key: k,
      ts: Date.now()
    });
    this.purge();
  };

  Cache.prototype.purge = function cache_purge() {
    if (!this._cache) return;
    // remove old entries
    var maxAge = this._maxAge;
    var maxSize = this._maxSize;
    var cache = this._cache;

    var now = Date.now();
    this._cacheKeys = this._cacheKeys.filter(function (item) {
      if (item.ts + maxAge < now ) {
        delete cache[item.key];
        return false;
      }
      return true;
    });

    // trim cache
    var keysToRemove = this._cacheKeys.slice(maxSize, Infinity);
    keysToRemove.forEach(function (item) {
      var k = item.key;
      delete cache[k];
    });
    this._cacheKeys = this._cacheKeys.slice(0, maxSize);
  };

  Cache.prototype.off = function cache_off() {
    this._cache = undefined;
    this._cacheKeys = undefined;
  };

  Cache.prototype.reset = function cache_reset() {
    this._cache = {}; // key, value
    this._cacheKeys = []; // sorted by time {ts: xxx, key: xxx}
  };

  Cache.prototype.isOn = function cache_isOn(config) {
    return !!this._cache;
  };

  Cache.prototype.query = function cache_query(config) {
    var hit,
      cached = false,
      key = this._getCacheKey(config);
    if (key in this._cache) {
      cached = true;
      hit = this._cache[key]; // cache hit!
    }
    return {
      cached: cached,
      key: key,
      hit: hit
    };
  };

  /*

  Service object

  */

  function Service(name, registry) {
    this.name = name;
    this._registry = registry; // backreference
    this._desc = '';
    this._funcs = or();
    this._deps = or().notFound(function () {
      return [];
    });
    this._mainCache = new Cache(); // used for caching
    this._secondaryCache = new Cache(); // used for exceptions
  }

  Service.prototype.registry = function service_registry() {
    return this._registry;
  };

  Service.prototype.description = function service_description(desc) {
    if (typeof desc === 'undefined') {
      return this._desc;
    }
    this._desc = desc;
    return this;
  };

  Service.prototype.metadata = function service_metadata(meta) {
    if (typeof meta === 'undefined') {
      return this.meta;
    }
    this.meta = meta;
    return this;
  };

  Service.prototype.infoObj = function service_infoObj(config) {
    var out = {};
    out.name = this.name;
    out.description = this.description();
    out.dependencies = this._getDeps(config, true).deps;

    try {
      out.executionOrder = this._registry
      .instance(config)
      .getExecutionOrder(this.name, true)
      .slice(0, -1);
    }
    catch (e) {
      out.inactive = true;
      out.dependencies = [];
    }

    out.cached = this._mainCache.isOn();
    out.manageError = !!this.onError;

    out.metadata = this.metadata();
    return out;
  };

  Service.prototype.info = function service_info(config) {
    var infoObj = this.infoObj(config);
    var rows = [infoObj.name];
    rows.push(infoObj.name.split('').map(function () {return '=';}).join(''));
    rows.push(infoObj.description);

    if (infoObj.inactive) {
      rows.push('Not available with this configuration.');
    }

    if (infoObj.executionOrder.length > 0) {
      rows.push('');
      rows.push('Execution order:');
      infoObj.executionOrder.forEach(function (d) {
        rows.push('* ' + d);
      });
    }

    if (infoObj.dependencies.length > 0) {
      rows.push('');
      rows.push('Dependencies:');
      infoObj.dependencies.forEach(function (d) {
        rows.push('* ' + d);
      });
    }

    if (infoObj.metadata) {
      rows.push('');
      rows.push('Metadata:');
      rows.push('```js');
      rows.push(JSON.stringify(infoObj.metadata, null, '  '));
      rows.push('```');
    }

    rows.push('');
    if (infoObj.cached) {
      rows.push('* Cached');
    }
    if (infoObj.manageError) {
      rows.push('* it doesn\'t throw exceptions');
    }

    return rows.join('\n');
  };

  Service.prototype.dependsOn = function service_dependsOn() {
    var deps = arguments[arguments.length - 1];
    var depsFunc = typeof deps === 'function' ? deps : function () {return deps;};
    if (arguments.length > 1) {
      this._deps.add(or.validator().match(arguments[0]), depsFunc);
    }
    else {
      this._deps.add(or.validator(), depsFunc);
    }
    return this;
  };

  Service.prototype._returns = function service__returns() {
    var func = arguments[arguments.length - 1];
    var arity = func.length;
    var adapter = function () {
      return {func: func, arity: arity};
    };

    if (arguments.length > 2) {
      this._funcs.add(or.validator().match(arguments[0]),
                      or.validator().match(arguments[1]), adapter);
    }
    else if (arguments.length > 1) {
      this._funcs.add(or.validator().match(arguments[0]), adapter);
    }
    else {
      this._funcs.add(or.validator(), adapter);
    }
    return this;
  };

  Service.prototype.provides = function service_provides() {
    var args = Array.prototype.slice.call(arguments, 0);
    return this._returns.apply(this, args);
  };

  Service.prototype.returns = function service_returns() {
    var args = Array.prototype.slice.call(arguments, 0);
    var value = args[args.length - 1];
    args[args.length - 1] = function (conf, deps) {
      return value;
    };
    return this._returns.apply(this, args);
  };

  Service.prototype._manageError = function service__manageError(err, config, callback) {
    return callback(this.name, typeof this.onError !== 'undefined' ? this.onError.call(this, config, err) : err);
  };

  Service.prototype._getFunc = function service__getFunc(config, deps, callback) {
    var obj = this._funcs(config, deps);
    var func = obj.func;
    var arity = obj.arity;
    var service = this;
    var error = depsHasError(deps);

    if (error) {
      return function () {
        service._manageError(error, config, callback);
      };
    }

    var wrapped_func = function (err, dep) {
      var d;
      if (err) {
        d = typeof service.onError !== 'undefined' ? service.onError.call(service, config, err) : err;
      }
      else {
        d = dep;
      }
      return callback(service.name, d);
    };

    return function () {
      var result;
      try {
        if (arity < 3) { // no callback
          result = func.call(service, config, deps);
          if (typeof result == 'object' && isPromise(result)) {
            result.then(function (res) { // onfulfilled
              wrapped_func(undefined, res);
            },
            function (error) { // onrejected
              wrapped_func(error);
            });
          }
          else {
            wrapped_func(undefined, result);
          }
        }
        else { // callback
          func.call(service, config, deps, wrapped_func);
        }
      }
      catch (err) {
        service._manageError(err, config, callback);
      }
    };

  };

  Service.prototype._getDeps = function service__getDeps(config, noCache) {
    var cacheState;
    if (this._mainCache.isOn() && !this.pauseCache && !noCache) { // cache check here !!!
      this._mainCache.purge(); // purge stale cache entries
      cacheState = this._mainCache.query(config);
      if (cacheState.cached) {
        // cache hit!
        return {
          name: this.name,
          deps: [], // no dependencies needed for cached values
          cached: cacheState.hit
        };
      }
    }
    try {
      return {
        name: this.name,
        deps: this._deps(config)
      };
    }
    catch (e) {
      // this should throw only if this service
      // is part of the execution graph
      return {
        error: e
      };
    }
  };

  Service.prototype.cacheOn = function service_cacheOn(opts) {
    return this._mainCache.on(opts);
    return this;
  };

  Service.prototype._cachePush = function service__cachePush(config, output) {
    this._mainCache.push(config, output);
    this._secondaryCache.push(config, output);
  };

  Service.prototype.cacheOff = function service_cacheOff() {
    this._mainCache.off();
    return this;
  };

  Service.prototype.cachePause = function service_cachePause() {
    this.pauseCache = true;
    return this;
  };

  Service.prototype.cacheResume = function service_cacheResume() {
    this.pauseCache = undefined;
    return this;
  };

  Service.prototype.cacheReset = function service_cacheReset() {
    this._mainCache.reset();
    return this;
  };

  // on error
  Service.prototype.onErrorReturn = function service_onErrorReturn(value) {
    this._secondaryCache.off();
    this.onError = function (config, err) {
      return value;
    };
    return this;
  };

  Service.prototype.onErrorExecute = function service_onErrorExecute(func) {
    this._secondaryCache.off();
    this.onError = func;
    return this;
  };

  Service.prototype.onErrorUseCache = function service_onErrorUseCache(opts) {
    this._secondaryCache.on(opts);
    this.onError = function (config, err) {
      var cacheState;
      this._secondaryCache.purge(); // purge stale cache entries
      cacheState = this._secondaryCache.query(config);
      if (cacheState.cached) {
        return cacheState.hit;
      }
      return err;
    };
    return this;
  };

  // default
  Service.prototype.onErrorThrow = function service_onErrorThrow() {
    this._secondaryCache.off();
    this.onError = undefined;
    return this;
  };

  // initialize global registries
  var _registries = typeof window == 'undefined' ? global : window;

  if (!_registries._diogenes_registries) {
    _registries._diogenes_registries = {};
    _registries._diogenes_event_handlers = {};
  }

  // deadly simple memoize using the first arguments as key
  function simpleMemoize(func) {
    var cache = {};
    return function () {
      var args = Array.prototype.slice.call(arguments, 0);
      var output;
      if (args[0] in cache) {
        return cache[args[0]];
      }
      else {
        output = func.apply(null, args);
        cache[args[0]] = output;
        return output;
      }
    };
  }

  /*

  Registry object

  */

  function Diogenes(regName) {
    // if regName exists I'll use a global registry
    if (regName) {
      if (!(regName in _registries._diogenes_registries)) {
        _registries._diogenes_registries[regName] = {};
      }
      if (!(regName in _registries._diogenes_event_handlers)) {
        _registries._diogenes_event_handlers[regName] = {};
      }
      this.services = _registries._diogenes_registries[regName];
      this.events = _registries._diogenes_event_handlers[regName];
    }
    else {
      this.services = {};
      this.events = or();
    }
  }

  Diogenes.getRegistry = function registry_getRegistry(regName) {
    return new Diogenes(regName);
  };

  Diogenes.prototype.init = function registry_init(funcs) {
    for (var i = 0; i < funcs.length; i++) {
      funcs[i].apply(this);
    }
  };

  Diogenes.prototype.forEach = function registry_forEach(callback) {
    for (var name in this.services) {
      callback.call(this.services[name], this.services[name], name);
    }
  };

  Diogenes.prototype.merge = function registry_merge() {
    var registry = new Diogenes();

    var events = Array.prototype.map.call(arguments, function (reg) {
      return reg.events;
    });

    var services = Array.prototype.map.call(arguments, function (reg) {
      return reg.services;
    });

    services.unshift(this.services);
    services.unshift({});

    registry.events = this.events.merge.apply(null, events);
    registry.services = Object.assign.apply(null, services);
    return registry;
  };

  Diogenes.prototype.service = function registry_service(name) {
    if (typeof name !== 'string') {
      throw new Error('Diogenes: the name of the service should be a string');
    }

    if (!(name in this.services)) {
      this.services[name] = new Service(name, this);
    }

    return this.services[name];
  };

  Diogenes.prototype._forEachService = function registry__forEachService(method) {
    this.forEach(function () {
      this[method]();
    });
  };

  Diogenes.prototype.remove = function registry_remove(name) {
    delete this.services[name];
    return this;
  };

  Diogenes.prototype._filterByConfig = function registry__filterByConfig(config, noCache) {
    var registry = this;
    var services = registry.services;
    return simpleMemoize(function (name) {
      if (!(name in services)) return;
      return services[name]._getDeps(config, noCache);
    });
  };

  Diogenes.prototype.instance = function registry_instance(config, options) {
    return new RegistryInstance(this, config, options);
  };

  // events
  Diogenes.prototype.on = function registry_on() {
    var args = Array.prototype.slice.call(arguments);
    this.events.on.apply(this, args);
    return this;
  };

  Diogenes.prototype.one = function registry_one() {
    var args = Array.prototype.slice.call(arguments);
    this.events.one.apply(this, args);
    return this;
  };

  Diogenes.prototype.off = function registry_off() {
    var args = Array.prototype.slice.call(arguments);
    this.events.off.apply(this, args);
    return this;
  };

  Diogenes.prototype.trigger = function registry_trigger() {
    var args = Array.prototype.slice.call(arguments);
    var registry = this;
    setImmediate(function () {
      registry.events.trigger.apply(this, args);
    });
    return this;
  };

  /*

  RegistryInstance utilities

  */

  function dfs(adjlists, startingNode) { // depth first search
    var already_visited = {};
    var already_backtracked = {};
    var adjlist, node;
    var stack = [startingNode];
    var out = [];

    while (stack.length) {
      node = stack[stack.length - 1];
      already_visited[node] = true;

      if (!adjlists(node)) {
        throw new Error('Diogenes: missing dependency: ' + node);
      }

      if (adjlists(node).error) throw adjlists(node).error;
      adjlist = adjlists(node).deps.filter(function (adj) {
        if (adj in already_visited && !(adj in already_backtracked)) {
          throw new Error('Diogenes: circular dependency: ' + adj);
        }
        return !(adj in already_visited);
      });

      if (adjlist.length) {
        stack.push(adjlist[0]);
      }
      else {
        already_backtracked[node] = true; // detecting circular deps
        out.push(node);
        stack.pop();
      }
    }
    return out;
  }

  function isPromise(obj) {
    return 'then' in obj;
  }

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

  function depsHasError(deps) {
    var depsList = Object.keys(deps);
    for (var i = 0; i < depsList.length; i++) {
      if (deps[depsList[i]] instanceof Error) {
        return deps[depsList[i]]; // one of the deps is an error
      }
    }
    return false;
  }

  function debugStart(name, debugInfo) {
    if (!(name in debugInfo)) {
      debugInfo[name] = {};
    }
    debugInfo[name].start = Date.now();
  }

  function debugEnd(name, debugInfo) {
    if (!(name in debugInfo)) {
      debugInfo[name] = {};
    }
    debugInfo[name].end = Date.now();
    debugInfo[name].delta = debugInfo[name].end - debugInfo[name].start;
  }

  /*

  function graph

  */

  function RegistryInstance(registry, config, options) {
    this._registry = registry; // backreference
    this._config = config;
    this._options = options || {};
  }

  RegistryInstance.prototype.registry = function registryInstance_registry() {
    return this._registry;
  };

  RegistryInstance.prototype.infoObj = function registryInstance_infoObj() {
    var config = this._config;
    var registry = this._registry;

    var out = {};
    registry.forEach(function (service, name) {
      out[name] = this.infoObj(config);
    });
    return out;
  };

  RegistryInstance.prototype.info = function registryInstance_info() {
    var config = this._config;
    var registry = this._registry;
    var out = [];
    registry.forEach(function (service) {
      out.push(this.info(config));
    });
    return out.join('\n\n');
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
    var debugInfo = {}; // profiling
    var registry = this._registry;
    var services = registry.services;
    var numberParallelCallback = 0;
    var limitParallelCallback = 'limit' in this._options ? this._options.limit : Infinity;
    var isOver = false;
    var debug = 'debug' in this._options ? this._options.debug : false;

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

    if (debug) { debugStart('__all__', debugInfo); }
    (function resolve(name, dep, cached) {
      var currentService, adj, currentServiceDeps;
      var func, i = 0;

      if (isOver) {
        // the process is over (callback returned too)
        // this may only happen if there is a duplicated callback
        throw new Error('Diogenes: a callback has been firing more than once');
        return;
      }
      else if (name in deps) {
        // this dependency already solved.
        // Did someone is firing the callback twice ?
        isOver = true;
        return done.call(registry, new Error('Diogenes: a callback has been firing more than once'));
      }
      else if (name) {
        deps[name] = dep;
        numberParallelCallback--;
        if (debug) { debugEnd(name, debugInfo); }
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
        if (debug) { debugEnd('__all__', debugInfo); }
        if (dep instanceof Error) {
          return done.call(registry, dep, debug ? deps : undefined, debug ? debugInfo : undefined);
        }
        else {
          return done.call(registry, undefined, dep, debug ? deps : undefined, debug ? debugInfo : undefined);
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
              func = currentService._getFunc(config, currentServiceDeps, resolve);
            }
            catch (e) {
              isOver = true;
              return done.call(registry, e, deps, debugInfo);
            }
            if (debug) { debugStart(currentService.name, debugInfo); }
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
    var newreg = new Diogenes();

    if (typeof name === 'string') {
      this._run(name, done);
      return this;
    }

    newreg.service('__main__').dependsOn(name).provides(function (config, deps, next) {
      next(undefined, deps);
    });

    var tempreg = newreg.merge(this.registry());
    tempreg.instance(this._config).run('__main__', done);
    return this;
  };

  /*

  Exports

  */

  Diogenes.validator = or.validator;

  if (typeof exports === 'object') {
    module.exports = Diogenes;
  }
  else if (typeof window === 'object') {
    // Expose Diogenes to the browser global object
    window.Diogenes = Diogenes;
  }

}());
