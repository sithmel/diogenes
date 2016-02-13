var or = require('occamsrazor');
require('setimmediate');
var Registry = require('./registry');

Registry.validator = or.validator;

module.exports = Registry;
