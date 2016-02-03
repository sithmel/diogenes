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

  Service utilities

  */

  function getArgs(args) {
    var out = {};

    out.deps = args.length > 1 ? args[0] : [];

    if (args.length <= 2 || typeof args[1] === 'undefined') {
      out.validator = or.validator();
    }
    else if (args[1].toString() === 'validator') {
      out.validator = args[1];
    }
    else {
      out.validator = or.validator().match(args[1]);
    }

    out.func = args[args.length - 1];
    return out;
  }

  /*

  Service object

  */

  function Service(name, registry) {
    this.name = name;
    this.desc = '';
    this.registry = registry; // backreference
    this.service = or();
  }

  Service.prototype.description = function service_description(desc) {
    if (typeof desc === 'undefined') {
      return this.desc;
    }
    this.desc = desc;
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
    out.dependencies = this.get(config, true).deps;

    try {
      out.executionOrder = this.registry
      .getExecutionOrder(this.name, config, true)
      .slice(0, -1);
    }
    catch (e) {
      out.inactive = true;
      out.dependencies = [];
    }

    out.cached = !!this.cache;
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

  Service.prototype._wrap = function service__wrap(func, deps, isValue) {
    var name = this.name;
    var service;

    if (!isValue && typeof func !== 'function') {
      throw new Error('Diogenes: expecting a function as last argument');
    }

    if (!isValue) {
      service = func;
    }
    else {
      service = function (conf, deps, next) {
        return next(undefined, func);
      };
    }

    return function () {
      return {
        name: name,
        service: service,
        deps: deps
      };
    };
  };

  Service.prototype.add = function service_add() {
    var args = getArgs(arguments);
    this.service.add(args.validator, this._wrap(args.func, args.deps));
    return this;
  };

  Service.prototype.addValue = function service_addValue() {
    var args = getArgs(arguments);
    this.service.add(args.validator, this._wrap(args.func, args.deps, true));
    return this;
  };

  Service.prototype.addOnce = function service_addOnce() {
    var args = getArgs(arguments);
    this.service.one(args.validator, this._wrap(args.func, args.deps));
    return this;
  };

  Service.prototype.addValueOnce = function service_addValueOnce() {
    var args = getArgs(arguments);
    this.service.one(args.validator, this._wrap(args.func, args.deps, true));
    return this;
  };

  Service.prototype.remove = function service_remove() {
    this.registry.remove(this.name);
  };

  Service.prototype.get = function service_get(config, noCache) {
    var key, hit;
    if (this.cache && !this.pauseCache && !noCache) { // cache check here !!!
      this.cachePurge(); // purge stale cache entries
      key = this.key(config);
      if (key in this.cache) {
        hit = this.cache[key]; // cache hit!
        return {
          name: this.name,
          service: function (config, deps, next) {
            next(undefined, hit);
          },
          deps: [], // no dependencies needed for cached values
          cached: true
        };
      }
    }
    try {
      return this.service(config);
    }
    catch (e) {
      // this should throw only if this service
      // is part of the execution graph
      return {
        error: e
      };
    }
  };

  Service.prototype.run = function service_run(globalConfig, done) {
    this.registry.run(this.name, globalConfig, done);
    return this;
  };

  Service.prototype.cacheOn = function service_cacheOn(opts) {
    opts = opts || {};
    var key = opts.key;

    if (typeof key === 'function') {
      this.key = key;
    }
    else if (typeof key === 'string') {
      this.key = function (config) {
        if (typeof config[key] === 'object') {
          return JSON.stringify(config[key]);
        }
        else {
          return config[key];
        }
      };
    }
    else if (Array.isArray(key)) {
      this.key = function (config) {
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
      this.key = function (config) {
        return '_default';
      };
    }

    this.cache = {}; // key, value
    this.cacheKeys = []; // sorted by time {ts: xxx, key: xxx} new ones first

    this.maxAge = opts.maxAge || Infinity;
    this.maxSize = opts.maxSize || Infinity;
  };

  Service.prototype.cachePush = function service_cachePush(config, output) {
    if (!this.cache) return;
    var k = this.key(config);
    if (k in this.cache) return;
    this.cache[k] = output;
    this.cacheKeys.unshift({
      key: k,
      ts: Date.now()
    });
    this.cachePurge();
  };

  Service.prototype.cachePurge = function service_cachePurge() {
    if (!this.cache) return;
    // remove old entries
    var maxAge = this.maxAge;
    var maxSize = this.maxSize;
    var cache = this.cache;

    var now = Date.now();
    this.cacheKeys = this.cacheKeys.filter(function (item) {
      if (item.ts + maxAge < now ) {
        delete cache[item.key];
        return false;
      }
      return true;
    });

    // trim cache
    var keysToRemove = this.cacheKeys.slice(maxSize, Infinity);
    keysToRemove.forEach(function (item) {
      var k = item.key;
      delete cache[k];
    });
    this.cacheKeys = this.cacheKeys.slice(0, maxSize);
  };

  Service.prototype.cacheOff = function service_cacheOff() {
    this.cache = undefined;
    this.cacheKeys = undefined;
  };

  Service.prototype.cachePause = function service_cachePause() {
    this.pauseCache = true;
  };

  Service.prototype.cacheResume = function service_cacheResume() {
    this.pauseCache = undefined;
  };

  Service.prototype.cacheReset = function service_cacheReset() {
    this.cache = {}; // key, value
    this.cacheKeys = []; // sorted by time {ts: xxx, key: xxx}
  };

  // on error
  Service.prototype.onErrorReturn = function service_onErrorReturn(value) {
    this.onError = function (config) {
      return value;
    };
  };

  Service.prototype.onErrorExecute = function service_onErrorExecute(func) {
    this.onError = func;
  };

  Service.prototype.onErrorThrow = function service_onErrorThrow() {
    this.onError = undefined;
  };

  // events
  Service.prototype.on = function service_on() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift(this.name);
    this.registry.on.apply(this.registry, args);
    return this;
  };

  Service.prototype.one = function service_one() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift(this.name);
    this.registry.one.apply(this.registry, args);
    return this;
  };

  Service.prototype.off = function service_off() {
    var args = Array.prototype.slice.call(arguments);
    this.registry.off.apply(this.registry, args);
    return this;
  };

  /*

  Registry utilities

  */
  // depth first search
  function dfs(adjlists, startingNode) {
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

  function getFunc(registry, node, onError, dependencies, globalConfig, callback) {
    var deps = {};
    var error = false;
    for (var i = 0; i < node.deps.length; i++) {
      if (!(node.deps[i] in dependencies)) {
        return; // I can't execute this because a deps is missing
      }
      deps[node.deps[i]] = dependencies[node.deps[i]];
      if (dependencies[node.deps[i]] instanceof Error) {
        error = dependencies[node.deps[i]]; // one of the deps is an error
      }
    }

    if (error) {
      return function () {
        return callback(node.name, typeof onError !== 'undefined' ? onError(globalConfig) : error, node.cached);
      };
    }

    return function () {
      var result;
      var wrapped_func = function (err, dep) {
        if (err) {
          return callback(node.name, typeof onError !== 'undefined' ? onError(globalConfig) : err, node.cached);
        }
        else {
          return callback(node.name, dep, node.cached);
        }
      };

      try {
        if (node.service.length < 3) { // no callback
          result = node.service.call(registry, globalConfig, deps);
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
          node.service.call(registry, globalConfig, deps, wrapped_func);
        }
      }
      catch (err) {
        return callback(node.name, typeof onError !== 'undefined' ? onError(globalConfig) : err, node.cached);
      }
    };
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

  // initialize global registries
  var _registries = typeof window == 'undefined' ? global : window;

  if (!_registries._diogenes_registries) {
    _registries._diogenes_registries = {};
    _registries._diogenes_event_handlers = {};
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

  Diogenes.prototype.infoObj = function registry_infoObj(config) {
    var out = {};
    this.forEach(function (service, name) {
      out[name] = this.infoObj(config);
    });
    return out;
  };

  Diogenes.prototype.info = function registry_info(config) {
    var out = [];
    this.forEach(function (service) {
      out.push(this.info(config));
    });
    return out.join('\n\n');
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

  Diogenes.prototype.add = function registry_add(name) {
    var s = this.service(name);
    s.add.apply(s, Array.prototype.slice.call(arguments, 1));
    return this;
  };

  Diogenes.prototype.addValue = function registry_addValue(name) {
    var s = this.service(name);
    s.addValue.apply(s, Array.prototype.slice.call(arguments, 1));
    return this;
  };

  Diogenes.prototype.addOnce = function registry_addOnce(name) {
    var s = this.service(name);
    s.addOnce.apply(s, Array.prototype.slice.call(arguments, 1));
    return this;
  };

  Diogenes.prototype.addValueOnce = function registry_addValueOnce(name) {
    var s = this.service(name);
    s.addValueOnce.apply(s, Array.prototype.slice.call(arguments, 1));
    return this;
  };

  Diogenes.prototype._forEachService = function registry__forEachService(method) {
    this.forEach(function () {
      this[method]();
    });
  };

  Diogenes.prototype.cacheReset = function registry_cacheReset() {
    this._forEachService('cacheReset');
  };

  Diogenes.prototype.cacheOff = function registry_cacheOff() {
    this._forEachService('cacheOff');
  };

  Diogenes.prototype.cachePause = function registry_cachePause() {
    this._forEachService('cachePause');
  };

  Diogenes.prototype.cacheResume = function registry_cacheResume() {
    this._forEachService('cacheResume');
  };

  Diogenes.prototype._filterByConfig = function registry__filterByConfig(globalConfig, noCache) {
    var cache = {};
    var services = this.services;
    return function (name) {
      if (!(name in cache)) {
        if (!(name in services)) return;
        cache[name] = services[name].get(globalConfig, noCache);
      }
      return cache[name];
    };
  };

  Diogenes.prototype.remove = function registry_remove(name) {
    delete this.services[name];
    return this;
  };

  Diogenes.prototype.getExecutionOrder = function registry_getExecutionOrder(name, globalConfig, noCache) {
    var adjlists = this._filterByConfig(globalConfig, noCache);
    var sorted_services = dfs(adjlists, name);
    return sorted_services;
  };

  Diogenes.prototype._run = function registry__run(name, globalConfig, done) {
    var adjlists, sorted_services;
    var deps = {}; // all dependencies already resolved
    var debugInfo = {}; // profiling
    var that = this;
    var services = this.services;

    try {
      adjlists = this._filterByConfig(globalConfig);
      sorted_services = dfs(adjlists, name);
    }
    catch (e) {
      return done.call(that, e);
    }

    debugStart('__all__', debugInfo);
    (function resolve(name, dep, cached) {
      var func, i = 0;

      if (name) {
        deps[name] = dep;
        debugEnd(name, debugInfo);
        if (!(dep instanceof Error)) {
          services[name].cachePush(globalConfig, dep);

          if (!cached) {
            setImmediate(function () {
              that.trigger(name, dep, globalConfig);
            });
          }
        }
      }

      if (sorted_services.length === 0) {
        debugEnd('__all__', debugInfo);
        if (dep instanceof Error) {
          return done.call(that, dep, deps, debugInfo);
        }
        else {
          return done.call(that, undefined, dep, deps, debugInfo);
        }
      }

      while (i < sorted_services.length) {
        func = getFunc(that, adjlists(sorted_services[i]), services[sorted_services[i]].onError, deps, globalConfig, resolve);
        if (func) {
          debugStart(sorted_services[i], debugInfo);
          sorted_services.splice(i, 1);
          setImmediate(func);
        }
        else {
          i++;
        }
      }
    }());

    return this;
  };

  Diogenes.prototype.run = function registry_run(name, globalConfig, done) {
    var newreg = new Diogenes();

    if (typeof globalConfig === 'function') {
      done = globalConfig;
      globalConfig = {};
    }

    if (typeof globalConfig === 'undefined') {
      done = function () {};
      globalConfig = {};
    }

    if (typeof name === 'string') {
      this._run(name, globalConfig, done);
      return this;
    }

    newreg.add('__main__', name, function (config, deps, next) {
      next(undefined, deps);
    });

    var tempreg = newreg.merge(this);
    tempreg.run('__main__', globalConfig, done);
    return this;
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
    this.events.trigger.apply(this, args);
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
