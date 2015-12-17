(function (){
"use strict";

if (typeof exports === 'object'){
  require("setimmediate");
}

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

Diogenes.prototype.addService = function addService(name) {
  var deps = arguments.length > 2 ? arguments[1] : [];
  var thirdArg = arguments.length > 3 ? arguments[2] : undefined;
  var configValidator;

  if (or){
    if (typeof thirdArg === 'undefined'){
      configValidator = or.validator();
    }
    else if (thirdArg.toString() === 'validator'){
      configValidator = thirdArg;
    }
    else {
      configValidator = or.validator().match(thirdArg);
    }
  }
  else {
    configValidator = undefined;
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

  if (or) {
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
    adjlists[n] = this.services[n](globalConfig);
  }
  return adjlists;
};

Diogenes.prototype.removeService = function removeService(name) {
  delete this.services[name];
  return this;
};

Diogenes.prototype.getExecutionOrder = function getExecutionOrder(name, globalConfig) {
  var adjlists = this._filterByConfig(globalConfig);
  return dfs(adjlists, name);
};

Diogenes.prototype.getService = function getService(name, globalConfig, done) {
  var sorted_services, adjlists;
  var deps = {}; // all dependencies already resolved

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
