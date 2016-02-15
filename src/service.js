var or = require('occamsrazor');
var Cache = require('./lib/cache');
var DiogenesError = require('./lib/diogenes-error');
var timeoutDecorator = require('./lib/timeout-decorator');
var callbackifyDecorator = require('./lib/callbackify-decorator');

function isPromise(obj) {
  return 'then' in obj;
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
  this._timeout = null;
  this._retry = 0;
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
  func = func.length < 3 ? callbackifyDecorator(func) : func;
  var adapter = function () {
    return {func: func};
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

Service.prototype.timeout = function service_timeout(time) {
  if (typeof time === 'undefined') {
    if (this._timeout && this._timeout > 0 && this._timeout < Infinity) {
      return this._timeout;
    }
    else {
      return false;
    }
  }
  this._timeout = time;
  return this;
};

Service.prototype.retry = function service_retry(times) {
  if (typeof times === 'undefined') {
    if (this._retry) {
      return this._retry;
    }
    else {
      return false;
    }
  }
  this._retry = times;
  return this;
};

Service.prototype._manageError = function service__manageError(err, config, callback) {
  return callback(this.name, typeof this.onError !== 'undefined' ? this.onError.call(this, config, err) : err);
};

Service.prototype._getFunc = function service__getFunc(config, deps, callback) {
  var obj = this._funcs(config, deps);
  var func = obj.func;
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
    func = service.timeout() ? timeoutDecorator(service.timeout())(func) : func;
    func.call(service, config, deps, wrapped_func);
  };

};

Service.prototype._getDeps = function service__getDeps(config, noCache) {
  var cacheState;
  if (this._mainCache.isOn() && !noCache) { // cache check here !!!
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

module.exports = Service;
