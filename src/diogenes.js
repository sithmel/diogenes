(function (){
"use strict";

if (typeof exports === 'object'){
  require("setimmediate");
}

var or = typeof exports === 'object' ? require('occamsrazor') : window.occamsrazor;

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

    if (!(node in adjlists)){
      throw new Error("Diogenes: missing dependency: " + node);
    }

    adjlist = adjlists[node].deps.filter(function (adj){
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

// initialize global registries
var _registries = typeof window == "undefined" ? global : window;

if(!_registries._diogenes_registries){
  _registries._diogenes_registries = {};
}

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

function Service(name, registry){
  this.name = name;
  this.registry = registry; // backreference
  this.service = or();
}

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
  if (this.cache){ // cache check here !!!
    this.cachePurge(); // purge stale cache entries
    key = this.key(config);
    if (key in this.cache){
      hit = this.cache[key]; // cache hit!
      return {
        name: this.name,
        service: function (config, deps, next){
          next(undefined, hit);
        },
        deps: [] // no dependencies needed for cached values
      };      
    }
  }
  
  return this.service(config);
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
      return JSON.stringify(config[key]);
    };
  }
  else if (Array.isArray(key)){
    this.key = function (config){
      var value = config;
      for (var i = 0; i < key.length; i++){
        value = config[key[i]];
      }
      return JSON.stringify(value);
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
  this.cachePurge();
  var k = this.key(config);
  if (k in this.cache) return;
  this.cache[k] = output;
  this.cacheKeys.unshift({
    key: k,
    ts: Date.now()
  });
};

Service.prototype.cachePurge = function (){
  if (!this.cache) return;
  // remove old entries
  var now = Date.now();
  this.cacheKeys = this.cacheKeys.filter(function (item){
    if (item.ts + this.maxAge < now ){
      delete this.cache[item.key];
      return false;
    }
    return true;
  });
  
  // trim cache
  var keysToRemove = this.cacheKeys.slice(this.maxSize, Infinity);
  keysToRemove.forEach(function (item){
    var k = item.key;
    delete this.cache[k];
  });
  this.cacheKeys = this.cacheKeys.slice(0, this.maxSize);
};

Service.prototype.cacheOff = function (){
  this.cache = undefined;
  this.cacheKeys = undefined;
};

Service.prototype.cacheReset = function (){
  this.cache = {}; // key, value
  this.cacheKeys = []; // sorted by time {ts: xxx, key: xxx}
};

// constructor
function Diogenes (regName){
  // if regName exists I'll use a global registry
  if (regName){
    if (!(regName in _registries._diogenes_registries)){
      _registries._diogenes_registries[regName] = {};
    }
    this.services = _registries._diogenes_registries[regName];
  }
  else {
    this.services = {};
  }
}

Diogenes.getRegistry = function (regName){
  return new Diogenes(regName);
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

function getFunc(node, dependencies, globalConfig, ok, ko){
  var deps = {};
  for (var i = 0; i < node.deps.length; i++){
    if (!(node.deps[i] in dependencies)) {
      return;
    }
    deps[node.deps[i]] = dependencies[node.deps[i]];
  }

  return function (){
    try {
      node.service(globalConfig, deps, function (err, dep){
        if (err){
          return ko(err);
        }
        else {
          return ok(node.name, dep);
        }
      });
    }
    catch (e){
      ko(e);
    }
  };
}

Diogenes.prototype._filterByConfig = function _filterByConfig(globalConfig) {
  var n, adjlists = {}
  for (n in this.services){
    adjlists[n] = this.services[n].get(globalConfig);
  }
  return adjlists;
};

Diogenes.prototype.remove = function removeService(name) {
  delete this.services[name];
  return this;
};

Diogenes.prototype.getExecutionOrder = function getExecutionOrder(name, globalConfig) {
  var adjlists = this._filterByConfig(globalConfig);
  return dfs(adjlists, name);
};

Diogenes.prototype.run = function run(name, globalConfig, done) {
  var sorted_services, adjlists;
  var deps = {}; // all dependencies already resolved
  var services = this.services;
  
  if (typeof globalConfig === "function"){
    done = globalConfig;
    globalConfig = {};
  }

  try {
    adjlists = this._filterByConfig(globalConfig);
    sorted_services = dfs(adjlists, name);
  }
  catch (e){
    return done(e);
  }

  (function resolve(name, dep){
    var func, i = 0;
    if (name){
      deps[name] = dep;
      services[name].cachePush(globalConfig, dep);
    }

    if (sorted_services.length === 0){
      return done(undefined, dep);
    }

    while (i < sorted_services.length){
      func = getFunc(adjlists[sorted_services[i]], deps, globalConfig, resolve, done)
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

if (or){
  Diogenes.validator = or.validator;
}

if (typeof exports === 'object'){
  module.exports = Diogenes;
}
else if (typeof window === 'object'){
  // Expose Diogenes to the browser global object
  window.Diogenes = Diogenes;
}

}());
