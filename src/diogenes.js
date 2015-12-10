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
  var already_visited = {}, already_backtracked = {};
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
        // if (adj in already_visited && !(adj in already_backtracked)){
        //   console.log("circular")
        // }
        // console.log((adj in already_visited && !(adj in already_backtracked)), adj);
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
      already_backtracked[node];
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
    out[deplist[i]] = deps[deplist[i]];
  }
  return out;
}

function isReady(o, deps){
  var i, deps_array = o.deps;
  for (i = 0 ; i < deps_array.length ; i++){
    if (!(deps_array[i] in deps)) {
      return false;
    }
  }
  return true;
}

Diogenes.prototype.getService = function start(name, globalConfig, done) {
  var sorted_services, n, adjlists = {};

  if (typeof globalConfig === "function"){
    done = globalConfig;
    globalConfig = {};
  }

  for (n in this.services){
    try {
      adjlists[n] = this.services[n](globalConfig);
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

  var deps = {}; // all dependencies already resolved

  (function resolve(name, dep){
    var func, i, node, dependencies, ready = [], not_ready = [];
    
    if (name){
      deps[name] = dep;
    }

    if (sorted_services.length === 0){
      return done(undefined, dep);
    }
 
    for (i = 0; i < sorted_services.length ; i++){
      if (isReady(adjlists[sorted_services[i]], deps)){
        ready.push(sorted_services[i]);
      }
      else {
        not_ready.push(sorted_services[i]);        
      }
    }
    
    sorted_services = not_ready;

    // checkCircularDep(sorted_services, );
    // if (ready.length === 0){
    //   done(new Error("Diogenes: circular dependency: " + not_ready.join(', ')));
    // }

    for (i = 0 ; i < ready.length; i++){
      node = adjlists[ready[i]];
      try{
        dependencies = getDeps(node.name, node.deps, deps);
        func = (function (name){
          return function (err, dep){
            if (err){
              done(err);
            }
            else {
              return resolve(name, dep);
            }
          }
        }(node.name));
        
        node.service(globalConfig, dependencies, func);
      }
      catch (e){
        done(e);
      }
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
