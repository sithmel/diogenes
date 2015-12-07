(function (){
"use strict";

var or = typeof exports === 'object' ? require('occamsrazor') : window.occamsrazor;

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

    adjlist = adjlists[node].deps.filter(function (adj){
      return !(adj in already_visited);
    });

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

var Diogenes = function (){
  this.services = {};
};

Diogenes.prototype.addService = function addService(name) {
  var configValidator = arguments.length > 2 && typeof arguments[1] === "function" ? arguments[1] :  or.validator();
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

  }
  if (typeof service !== "function"){

  }

  if (!(name in this.services)){
    this.services[name] = or();
  }

  this.services[name].add(configValidator, function (){
    return {
      name: name,
      service: service,
      deps: deps
    };
  });
  
  return this;
};

function getDeps(name, deplist, deps){
  var out = {};
  for (var i = 0; i < deplist.length; i++){
    out[deplist[i]] = deps[deplist[i]];
  }
  return out;
}

Diogenes.prototype.getService = function start(name, globalConfig, done) {
  var node, n, config, adjlists = {};

  if (!(name in this.services)){
    return done(new Error("Not found"));
  }

  if (typeof globalConfig === "function"){
    done = globalConfig;
    globalConfig = {};
  }

  for (n in this.services){
    config = globalConfig;
    adjlists[n] = this.services[n](config);
  }
  
  if (!Object.keys(adjlists).length){
    return done(new Error("Not found with this configuration"));
  }
  
  var sorted_services = dfs(adjlists, name);

  var deps = {};

  (function resolve(name, dep){
    if (name){
      deps[name] = dep;
    }
    node = adjlists[sorted_services.shift()];

    node.service(globalConfig, getDeps(node.name, node.deps, deps), function (dep){
      return sorted_services.length ? resolve(node.name, dep) : done(dep);
    });
  }());

  return this;
};

Diogenes.getRegistry = function (){
  return new Diogenes();
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
