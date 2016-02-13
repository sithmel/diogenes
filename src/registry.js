var assign = require('object-assign');
var or = require('occamsrazor');

var Service = require('./service');
var RegistryInstance = require('./registry-instance');
var simpleMemoize = require('./lib/simple-memoize');

// initialize global registries
var _registries = typeof window == 'undefined' ? global : window;

if (!_registries._diogenes_registries) {
  _registries._diogenes_registries = {};
  _registries._diogenes_event_handlers = {};
}

/*

Registry object

*/

function Registry(regName) {
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

Registry.getRegistry = function registry_getRegistry(regName) {
  return new Registry(regName);
};

Registry.prototype.init = function registry_init(funcs) {
  for (var i = 0; i < funcs.length; i++) {
    funcs[i].apply(this);
  }
};

Registry.prototype.forEach = function registry_forEach(callback) {
  for (var name in this.services) {
    callback.call(this.services[name], this.services[name], name);
  }
};

Registry.prototype.merge = function registry_merge() {
  var registry = new Registry();

  var events = Array.prototype.map.call(arguments, function (reg) {
    return reg.events;
  });

  var services = Array.prototype.map.call(arguments, function (reg) {
    return reg.services;
  });

  services.unshift(this.services);
  services.unshift({});

  registry.events = this.events.merge.apply(null, events);
  registry.services = assign.apply(null, services);
  return registry;
};

Registry.prototype.clone = function registry_clone() {
  return this.merge();
};

Registry.prototype.service = function registry_service(name) {
  if (typeof name !== 'string') {
    throw new Error('Diogenes: the name of the service should be a string');
  }

  if (!(name in this.services)) {
    this.services[name] = new Service(name, this);
  }

  return this.services[name];
};

Registry.prototype._forEachService = function registry__forEachService(method) {
  this.forEach(function () {
    this[method]();
  });
};

Registry.prototype.remove = function registry_remove(name) {
  delete this.services[name];
  return this;
};

Registry.prototype._filterByConfig = function registry__filterByConfig(config, noCache) {
  var registry = this;
  var services = registry.services;
  return simpleMemoize(function (name) {
    if (!(name in services)) return;
    return services[name]._getDeps(config, noCache);
  });
};

Registry.prototype.instance = function registry_instance(config, options) {
  return new RegistryInstance(this, config, options);
};

// events
Registry.prototype.on = function registry_on() {
  var args = Array.prototype.slice.call(arguments);
  this.events.on.apply(this, args);
  return this;
};

Registry.prototype.one = function registry_one() {
  var args = Array.prototype.slice.call(arguments);
  this.events.one.apply(this, args);
  return this;
};

Registry.prototype.off = function registry_off() {
  var args = Array.prototype.slice.call(arguments);
  this.events.off.apply(this, args);
  return this;
};

Registry.prototype.trigger = function registry_trigger() {
  var args = Array.prototype.slice.call(arguments);
  var registry = this;
  setImmediate(function () {
    registry.events.trigger.apply(this, args);
  });
  return this;
};

module.exports = Registry;
