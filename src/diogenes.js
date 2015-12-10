(function (){
"use strict";

var or;

try {
  or = typeof exports === 'object' ? require('occamsrazor') : window.occamsrazor;
}
catch (e){
  or = undefined;
}

// depth first search
function dfs (adjlists, startingNode){
  var already_visited = {};
  var adjlist, node;
  var stack = [startingNode];
  var out = [];

  while (stack.length){
    node = stack[stack.length - 1];
    if (!(node in already_visited)){
      already_visited[node] = true;
    }
    
    try {
      adjlist = adjlists[node].deps.filter(function (adj){
        return !(adj in already_visited);
      });      
    }
    catch (e){
      throw new Error("Diogenes: missing dependency: " + node);
    }

    if (adjlist.length){
      stack.push(adjlist[0]);
    }
    else {
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

// constructor
var Diogenes = function (regName){
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
};

Diogenes.prototype.addService = function addService(name) {
  var configValidator = arguments.length > 2 && typeof arguments[1] === "function" ? 
    arguments[1] : 
    or ? or.validator() : undefined;

  var deps;

  if (arguments.length > 2){
    if (Array.isArray(arguments[1])){
      deps = arguments[1];
    }
    else {
      if (Array.isArray(arguments[2])){
        deps = arguments[2]
      }
      else {
        deps = [];
      }
    }
  }
  else {
    deps = [];
  }

  var service = arguments[arguments.length - 1];

  if (typeof name !== "string"){
    throw new Error('Diogenes: the first argument should be the name of the service (string)');
  }
  if (typeof service !== "function"){
    throw new Error('Diogenes: the last argument should be the service (function)');
  }

  var func = function (){
    return {
      name: name,
      service: service,
      deps: deps
    };
  };

  if (configValidator) {
    if (!(name in this.services)){
      this.services[name] = or();
    }

    this.services[name].add(configValidator, func);
  }
  else {
    this.services[name] = func;    
  }

  return this;
};

function getDeps(name, deplist, deps){
  var out = {};
  for (var i = 0; i < deplist.length; i++){
    if (! (deplist[i] in deps)) {
      throw new Error("Diogenes: circular dependency: " + name + " requires " + deplist[i]);
    }
    out[deplist[i]] = deps[deplist[i]];
  }
  return out;
}

Diogenes.prototype.getService = function start(name, globalConfig, done) {
  var sorted_services, n, config, adjlists = {};

  if (typeof globalConfig === "function"){
    done = globalConfig;
    globalConfig = {};
  }

  for (n in this.services){
    config = globalConfig;
    try {
      adjlists[n] = this.services[n](config);
    }
    catch (e){
      return done(e);
    }
  }

  try {
    sorted_services = dfs(adjlists, name);
  }
  catch (e){
    return done(e);
  }

  var deps = {};

  (function resolve(name, dep){
    var node, dependencies;
    if (name){
      deps[name] = dep;
    }
    node = adjlists[sorted_services.shift()];

    try{
      dependencies = getDeps(node.name, node.deps, deps);
      node.service(globalConfig, dependencies, function (err, dep){
        if (err){
          done(err);
        }
        else {
          return sorted_services.length ? resolve(node.name, dep) : done(undefined, dep);
        }
      });
    }
    catch (e){
      done(e);
    }

  }());

  return this;
};

Diogenes.getRegistry = function (regName){
  return new Diogenes(regName);
}
Diogenes.validator = or.validator;

if (typeof exports === 'object'){
  module.exports = Diogenes;
}
else if (typeof window === 'object'){
  // Expose Diogenes to the browser global object
  window.Diogenes = Diogenes;
}

}());
