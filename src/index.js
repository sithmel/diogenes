var or = require('occamsrazor');
var validator = require('occamsrazor-validator');
require('setimmediate');
var Registry = require('./registry');

Registry.validator = validator;

module.exports = Registry;
