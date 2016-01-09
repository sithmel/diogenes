(function (){
"use strict";

/*

Imports

*/

if (typeof exports === 'object'){
  require("setimmediate");
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

function getArgs(args){
  var out = {};

  out.deps = args.length > 1 ? args[0] : [];

  if (args.length <= 2 || typeof args[1] === 'undefined'){
    out.validator = or.validator();
  }
  else if (args[1].toString() === 'validator'){
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

function Service(name, registry){
  this.name = name;
  this.desc = '';
  this.registry = registry; // backreference
  this.service = or();
}

Service.prototype.description = function description(desc){
  if (typeof desc === 'undefined'){
    return this.desc;
  }
  this.desc = desc;
  return this;
};

Service.prototype.metadata = function metadata(meta){
  if (typeof meta === 'undefined'){
    return this.meta;
  }
  this.meta = meta;
  return this;
};

Service.prototype._wrap = function (func, deps, isValue){
  var name = this.name;
  var service;

  if (!isValue && typeof func !== "function"){
    throw new Error('Diogenes: expecting a function as last argument');
  }

  if(!isValue){
    service = func;
  }
  else {
    service = function (conf, deps, next){
      return next(undefined, func);
    };
  }

  return function (){
    return {
      name: name,
      service: service,
      deps: deps
    };
  };
};

Service.prototype.add = function (){
  var args = getArgs(arguments);
  this.service.add(args.validator, this._wrap(args.func, args.deps));
  return this;
};

Service.prototype.addValue = function (){
  var args = getArgs(arguments);
  this.service.add(args.validator, this._wrap(args.func, args.deps, true));
  return this;
};

Service.prototype.addOnce = function (){
  var args = getArgs(arguments);
  this.service.one(args.validator, this._wrap(args.func, args.deps));
  return this;
};

Service.prototype.addValueOnce = function (){
  var args = getArgs(arguments);
  this.service.one(args.validator, this._wrap(args.func, args.deps, true));
  return this;
};

Service.prototype.remove = function (){
  this.registry.remove(this.name);
};

Service.prototype.get = function (config){
  var key, hit;
  if (this.cache && !this.pauseCache){ // cache check here !!!
    this.cachePurge(); // purge stale cache entries
    key = this.key(config);
    if (key in this.cache){
      hit = this.cache[key]; // cache hit!
      return {
        name: this.name,
        service: function (config, deps, next){
          next(undefined, hit);
        },
        deps: [], // no dependencies needed for cached values
        cached: true
      };
    }
  }
  try{
    return this.service(config);
  }
  catch (e){
    // this should throw only if this service
    // is part of the execution graph
    return {
      error: e
    };
  }
};

Service.prototype.run = function (globalConfig, done){
  this.registry.run(this.name, globalConfig, done);
  return this;
};

Service.prototype.cacheOn = function (opts){
  opts = opts || {};
  var key = opts.key;

  if (typeof key === "function"){
    this.key = key;
  }
  else if (typeof key === "string"){
    this.key = function (config){
      if (typeof config[key] === "object"){
        return JSON.stringify(config[key]);
      }
      else {
        return config[key];
      }
    };
  }
  else if (Array.isArray(key)){
    this.key = function (config){
      var value = config;
      for (var i = 0; i < key.length; i++){
        value = value[key[i]];
      }
      if (typeof value === "object"){
        return JSON.stringify(value);
      }
      else {
        return value;
      }
    };
  }
  else {
    this.key = function (config){
      return '_default';
    }
  }

  this.cache = {}; // key, value
  this.cacheKeys = []; // sorted by time {ts: xxx, key: xxx} new ones first

  this.maxAge = opts.maxAge || Infinity;
  this.maxSize = opts.maxSize || Infinity;
};

Service.prototype.cachePush = function (config, output){
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

Service.prototype.cachePurge = function (){
  if (!this.cache) return;
  // remove old entries
  var maxAge = this.maxAge;
  var maxSize = this.maxSize;
  var cache = this.cache;

  var now = Date.now();
  this.cacheKeys = this.cacheKeys.filter(function (item){
    if (item.ts + maxAge < now ){
      delete cache[item.key];
      return false;
    }
    return true;
  });

  // trim cache
  var keysToRemove = this.cacheKeys.slice(maxSize, Infinity);
  keysToRemove.forEach(function (item){
    var k = item.key;
    delete cache[k];
  });
  this.cacheKeys = this.cacheKeys.slice(0, maxSize);
};

Service.prototype.cacheOff = function (){
  this.cache = undefined;
  this.cacheKeys = undefined;
};

Service.prototype.cachePause = function (){
  this.pauseCache = true;
};

Service.prototype.cacheResume = function (){
  this.pauseCache = undefined;
};

Service.prototype.cacheReset = function (){
  this.cache = {}; // key, value
  this.cacheKeys = []; // sorted by time {ts: xxx, key: xxx}
};

// on error
Service.prototype.onErrorReturn = function (value){
  this.onError = function (config) {
    return value;
  };
};

Service.prototype.onErrorExecute = function (func){
  this.onError = func;
};

Service.prototype.onErrorThrow = function (){
  this.onError = undefined;
};

// events
Service.prototype.on = function on() {
  var args = Array.prototype.slice.call(arguments);
  args.unshift(this.name);
  this.registry.on.apply(this.registry, args);
  return this;
};

Service.prototype.one = function one() {
  var args = Array.prototype.slice.call(arguments);
  args.unshift(this.name);
  this.registry.one.apply(this.registry, args);
  return this;
};

Service.prototype.off = function off() {
  var args = Array.prototype.slice.call(arguments);
  this.registry.off.apply(this.registry, args);
  return this;
};

/*

Registry utilities

*/
// depth first search
function dfs (adjlists, startingNode){
  var already_visited = {};
  var already_backtracked = {};
  var adjlist, node;
  var stack = [startingNode];
  var out = [];

  while (stack.length){
    node = stack[stack.length - 1];
    already_visited[node] = true;

    if (!adjlists(node)){
      throw new Error("Diogenes: missing dependency: " + node);
    }

    if (adjlists(node).error) throw adjlists(node).error;
    adjlist = adjlists(node).deps.filter(function (adj){
      if (adj in already_visited && !(adj in already_backtracked)){
        throw new Error("Diogenes: circular dependency: " + adj);
      }
      return !(adj in already_visited);
    });

    if (adjlist.length){
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

function getFunc(registry, node, onError, dependencies, globalConfig, callback){
  var deps = {};
  var error = false;
  for (var i = 0; i < node.deps.length; i++){
    if (!(node.deps[i] in dependencies)) {
      return; // I can't execute this because a deps is missing
    }
    deps[node.deps[i]] = dependencies[node.deps[i]];
    if (dependencies[node.deps[i]] instanceof Error){
      error = dependencies[node.deps[i]]; // one of the deps is an error
    }
  }

  if (error) {
    return function(){
      return callback(node.name, typeof onError !== "undefined" ? onError(globalConfig) : error, node.cached);
    }
  }

  return function (){
    var result;
    var wrapped_func = function (err, dep){
      if (err){
        return callback(node.name, typeof onError !== "undefined" ? onError(globalConfig) : err, node.cached);
      }
      else {
        return callback(node.name, dep, node.cached);
      }
    };

    try {
      if (node.service.length < 3){ // no callback
        result = node.service.call(registry, globalConfig, deps);
        wrapped_func(undefined, result);
      }
      else { // callback
        node.service.call(registry, globalConfig, deps, wrapped_func);
      }
    }
    catch (err){
      return callback(node.name, typeof onError !== "undefined" ? onError(globalConfig) : err, node.cached);
    }
  };
}

// initialize global registries
var _registries = typeof window == "undefined" ? global : window;

if(!_registries._diogenes_registries){
  _registries._diogenes_registries = {};
  _registries._diogenes_event_handlers = {};
}

/*

Registry object

*/

function Diogenes (regName){
  // if regName exists I'll use a global registry
  if (regName){
    if (!(regName in _registries._diogenes_registries)){
      _registries._diogenes_registries[regName] = {};
    }
    if (!(regName in _registries._diogenes_event_handlers)){
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

Diogenes.getRegistry = function getRegistry (regName){
  return new Diogenes(regName);
};

Diogenes.prototype.init = function init(funcs) {
  for (var i = 0; i < funcs.length; i++){
    funcs[i].apply(this);
  }
};

Diogenes.prototype.forEach = function forEach(callback) {
  for (var name in this.services){
    callback.apply(this.services[name], this.services[name], name);
  }
};

Diogenes.prototype.merge = function merge() {
  var registry = new Diogenes();

  var events = Array.prototype.map.call(arguments, function (reg){
    return reg.events;
  });

  var services = Array.prototype.map.call(arguments, function (reg){
    return reg.services;
  });

  services.unshift(this.services);
  services.unshift({});

  registry.events = this.events.merge.apply(null, events);
  registry.services = Object.assign.apply(null, services);
  return registry;
};

Diogenes.prototype.service = function service(name) {
  if (typeof name !== "string"){
    throw new Error('Diogenes: the name of the service should be a string');
  }

  if (!(name in this.services)){
    this.services[name] = new Service(name, this);
  }

  return this.services[name];
};

Diogenes.prototype.add = function add(name) {
  var s = this.service(name);
  s.add.apply(s, Array.prototype.slice.call(arguments, 1));
  return this;
};

Diogenes.prototype.addValue = function addValue(name) {
  var s = this.service(name);
  s.addValue.apply(s, Array.prototype.slice.call(arguments, 1));
  return this;
};

Diogenes.prototype.addOnce = function addOnce(name) {
  var s = this.service(name);
  s.addOnce.apply(s, Array.prototype.slice.call(arguments, 1));
  return this;
};

Diogenes.prototype.addValueOnce = function addValueOnce(name) {
  var s = this.service(name);
  s.addValueOnce.apply(s, Array.prototype.slice.call(arguments, 1));
  return this;
};

Diogenes.prototype._forEachService = function _forEachService(method) {
  this.forEach(function (){
    this[method]();
  })
};

Diogenes.prototype.cacheReset = function cacheReset() {
  this._forEachService("cacheReset");
};

Diogenes.prototype.cacheOff = function cacheOff() {
  this._forEachService("cacheOff");
};

Diogenes.prototype.cachePause = function cachePause() {
  this._forEachService("cachePause");
};

Diogenes.prototype.cacheResume = function cacheResume() {
  this._forEachService("cacheResume");
};

Diogenes.prototype._filterByConfig = function _filterByConfig(globalConfig) {
  var cache = {};
  var services = this.services;
  return function (name){
    if (!(name in cache)){
      if (!(name in services)) return;
      cache[name] = services[name].get(globalConfig);
    }
    return cache[name];
  };
};

Diogenes.prototype.remove = function remove(name) {
  delete this.services[name];
  return this;
};

Diogenes.prototype.getExecutionOrder = function getExecutionOrder(name, globalConfig) {
  var adjlists = this._filterByConfig(globalConfig);
  var sorted_services = dfs(adjlists, name);
  return sorted_services;
};

Diogenes.prototype.run = function run(name, globalConfig, done) {
  var adjlists, sorted_services;
  var deps = {}; // all dependencies already resolved
  var that = this;
  var services = this.services;

  if (typeof globalConfig === "function"){
    done = globalConfig;
    globalConfig = {};
  }

  if (typeof globalConfig === "undefined"){
    done = function (){};
    globalConfig = {};
  }

  try {
    adjlists = this._filterByConfig(globalConfig);
    sorted_services = dfs(adjlists, name);
  }
  catch (e){
    return done.call(that, e);
  }

  (function resolve(name, dep, cached){
    var func, i = 0;

    if (name){
      deps[name] = dep;
      if (!(dep instanceof Error)){
        services[name].cachePush(globalConfig, dep);

        if (!cached) {
          setImmediate(function (){
            that.trigger(name, dep, globalConfig);
          });
        }
      }
    }

    if (sorted_services.length === 0){
      if (dep instanceof Error){
        return done.call(that, dep);
      }
      else {
        return done.call(that, undefined, dep);
      }
    }

    while (i < sorted_services.length){
      func = getFunc(that, adjlists(sorted_services[i]), services[sorted_services[i]].onError, deps, globalConfig, resolve)
      if (func){
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

Diogenes.prototype.runAll = function run(name, globalConfig, done) {
  var newreg = new Diogenes();

  if (typeof name === "string"){
    name = [name];
  }

  newreg.add("__main__", name, function (config, deps, next){
    next(undefined, deps);
  });

  var tempreg = newreg.merge(this);
  tempreg.run("__main__", globalConfig, done);
  return this;
};

// events
Diogenes.prototype.on = function on() {
  var args = Array.prototype.slice.call(arguments);
  this.events.on.apply(this, args);
  return this;
};

Diogenes.prototype.one = function one() {
  var args = Array.prototype.slice.call(arguments);
  this.events.one.apply(this, args);
  return this;
};

Diogenes.prototype.off = function off() {
  var args = Array.prototype.slice.call(arguments);
  this.events.off.apply(this, args);
  return this;
};

Diogenes.prototype.trigger = function trigger() {
  var args = Array.prototype.slice.call(arguments);
  this.events.trigger.apply(this, args);
  return this;
};

/*

Exports

*/

Diogenes.validator = or.validator;

if (typeof exports === 'object'){
  module.exports = Diogenes;
}
else if (typeof window === 'object'){
  // Expose Diogenes to the browser global object
  window.Diogenes = Diogenes;
}

}());
