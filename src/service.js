var or = require('occamsrazor');
var validator = require('occamsrazor-validator');
var Cache = require('memoize-cache').ramCache;
var DiogenesError = require('./lib/diogenes-error');
var callbackifyDecorator = require('async-deco/utils/callbackify');
// var compose = require('async-deco/utils/compose');
// var timeoutDecorator = require('async-deco/callback/timeout');
// var retryDecorator = require('async-deco/callback/retry');
// var fallbackDecorator = require('async-deco/callback/fallback');
// var fallbackCacheDecorator = require('async-deco/callback/fallback-cache');
// var logDecorator = require('async-deco/callback/log');

function depsHasError(deps) {
  var depsList = Object.keys(deps);
  for (var i = 0; i < depsList.length; i++) {
    if (deps[depsList[i]] instanceof Error) {
      return deps[depsList[i]]; // one of the deps is an error
    }
  }
  return false;
}

function getValidator(v) {
  return (typeof v === 'function' && 'score' in v) ? v : validator().match(v);
}

/*

Service object

*/

function Service(name, registry) {
  this.name = name;
  this._registry = registry; // backreference
  this._funcs = or();
  this._deps = or().add(function () {
    return [];
  });
  this._mainCache = undefined; // caching
}

Service.prototype.registry = function service_registry() {
  return this._registry;
};

Service.prototype.dependsOn = function service_dependsOn() {
  var deps = arguments[arguments.length - 1];
  var depsFunc = typeof deps === 'function' ? deps : function () {return deps;};
  if (arguments.length > 1) {
    this._deps.add(getValidator(arguments[0]), depsFunc);
  }
  else {
    this._deps.add(validator(), depsFunc);
  }
  return this;
};

Service.prototype._returns = function service__returns() {
  var func = arguments[arguments.length - 1];
  func = func.length < 3 ? callbackifyDecorator(func) : func;
  var adapter = function () {
    return {func: func};
  };

  if (arguments.length > 2) {
    this._funcs.add(getValidator(arguments[0]),
                    getValidator(arguments[1]), adapter);
  }
  else if (arguments.length > 1) {
    this._funcs.add(getValidator(arguments[0]), adapter);
  }
  else {
    this._funcs.add(validator(), adapter);
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

// Service.prototype._manageError = function service__manageError(err, config, callback) {
//   return callback(this.name, typeof this._fallbackFunction !== 'undefined' ? this._fallbackFunction.call(this, config, err) : err);
// };

Service.prototype._getFunc = function service__getFunc(config, deps, logger, callback) {
  var obj = this._funcs(config, deps);
  var service = this;
  var error = depsHasError(deps);
  var func = obj.func;

  if (error) {
    func = function (config, deps, next) { next(error); }; // propagates the error
  }

  var wrapped_func = function (err, dep) {
    var d = err ? err : dep;
    return callback(service.name, d);
  };

  return function () {
    func.call(service, config, deps, wrapped_func);
  };
};

Service.prototype._getDeps = function service__getDeps(config, noCache, next) {
  var service = this;
  if (this._mainCache && !noCache) { // cache check here !!!
    this._mainCache.query(config, function (err, cacheState) {
      if (cacheState.cached) {
        // cache hit!
        return next(undefined, {
          name: service.name,
          deps: [], // no dependencies needed for cached values
          cached: cacheState.hit
        });
      }
      try {
        return next(undefined, {
          name: service.name,
          deps: service._deps(config)
        });
      }
      catch (e) {
        // this should throw only if this service
        // is part of the execution graph
        return next(undefined, {error: e});
      }
    });
  }
  else {
    try {
      return next(undefined, {
        name: service.name,
        deps: service._deps(config)
      });
    }
    catch (e) {
      // this should throw only if this service
      // is part of the execution graph
      return next(undefined, {error: e});
    }
  }
};

Service.prototype.hasCache = function service_hasCache() {
  return !!this._mainCache;
};

Service.prototype.cache = function service_cache(opts) {
  opts = opts || {};
  if ('push' in opts && 'query' in opts) {
    this._mainCache = opts;
  }
  else {
    this._mainCache = new Cache(opts);
  }
  return this;
};

Service.prototype._cachePush = function service__cachePush(config, output) {
  if (this._mainCache) {
    this._mainCache.push(config, output);
  }
};

Service.prototype.cacheReset = function service_cacheReset() {
  this._mainCache.reset();
  return this;
};

module.exports = Service;
