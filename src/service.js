var or = require('occamsrazor');
var validator = require('occamsrazor-validator');
var Cache = require('./lib/cache');
var DiogenesError = require('./lib/diogenes-error');
var callbackifyDecorator = require('async-deco/utils/callbackify');
var proxyDecorator = require('async-deco/callback/proxy');
var decorate = require('async-deco/utils/decorate');

var depsHasError = proxyDecorator(function depsHasError(config, deps, next) {
  var depsList = Object.keys(deps);
  for (var i = 0; i < depsList.length; i++) {
    if (deps[depsList[i]] instanceof Error) {
      return next(deps[depsList[i]]); // one of the deps is an error
    }
  }
  next();
});

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

Service.prototype._returns = function service__returns(isSync) {
  var func = decorate(depsHasError, isSync ? callbackifyDecorator(arguments[arguments.length - 1]) : arguments[arguments.length - 1]);

  var adapter = function () {
    return { func: func };
  };

  if (arguments.length > 3) {
    this._funcs.add(getValidator(arguments[1]),
                    getValidator(arguments[2]), adapter);
  }
  else if (arguments.length > 2) {
    this._funcs.add(getValidator(arguments[1]), adapter);
  }
  else {
    this._funcs.add(validator(), adapter);
  }
  return this;
};

Service.prototype.provides = function service_provides() {
  var args = Array.prototype.slice.call(arguments, 0);
  args.unshift(false); // isSync
  return this._returns.apply(this, args);
};

Service.prototype.returns = function service_returns() {
  var args = Array.prototype.slice.call(arguments, 0);
  args.unshift(true); // isSync
  return this._returns.apply(this, args);
};

Service.prototype.returnsValue = function service_returnsValue() {
  var args = Array.prototype.slice.call(arguments, 0);
  var value = args[args.length - 1];
  args[args.length - 1] = function (conf, deps) {
    return value;
  };
  args.unshift(true); // isSync
  return this._returns.apply(this, args);
};

Service.prototype._getFunc = function service__getFunc(config, deps, context, callback) {
  var obj = this._funcs(config, deps);
  var service = this;
  var func = obj.func;

  return function () {
    func.call(context, config, deps, function (err, dep) {
      var d = err ? err : dep;
      return callback(service.name, d);
    });
  };
};

Service.prototype._getDeps = function service__getDeps(config) {
  var service = this;
  var cacheState = {};
  if (this._mainCache) { // cache check here !!!
    cacheState.cached = this._mainCache.has(config);
    if (cacheState.cached) {
      cacheState.hit = this._mainCache.get(config);
    }
  }
  else {
    cacheState.cached = false;
  }
  if (cacheState.cached) {
    // cache hit!
    return {
      name: service.name,
      deps: [], // no dependencies needed for cached values
      cached: cacheState.hit
    };
  }
  else {
    return {
      name: service.name,
      deps: service._deps(config)
    };
  }
};

Service.prototype.cache = function service_cache(opts) {
  this._mainCache = new Cache(opts);
  return this;
};

Service.prototype._cachePush = function service__cachePush(config, output) {
  if (this._mainCache) {
    this._mainCache.set(config, output);
  }
};

module.exports = Service;
