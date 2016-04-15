var assign = require('object-assign');

var Service = require('./service');
var RegistryInstance = require('./registry-instance');
var DiogenesError = require('./lib/diogenes-error');

/*

Registry object

*/

function Registry() {
  this.services = {};
}

Registry.getRegistry = function registry_getRegistry() {
  return new Registry();
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

  var services = Array.prototype.map.call(arguments, function (reg) {
    return reg.services;
  });

  services.unshift(this.services);
  services.unshift({});

  registry.services = assign.apply(null, services);
  return registry;
};

Registry.prototype.clone = function registry_clone() {
  return this.merge();
};

Registry.prototype.service = function registry_service(name) {
  if (typeof name !== 'string') {
    throw new DiogenesError('Diogenes: the name of the service should be a string');
  }

  if (!(name in this.services)) {
    this.services[name] = new Service(name, this);
  }

  return this.services[name];
};

Registry.prototype.remove = function registry_remove(name) {
  delete this.services[name];
  return this;
};

Registry.prototype.instance = function registry_instance(config, options) {
  return new RegistryInstance(this, config, options);
};

module.exports = Registry;
