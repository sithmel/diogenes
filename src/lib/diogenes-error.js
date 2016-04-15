function DiogenesError(message) {
  this.name = 'DiogenesError';
  this.message = message || 'DiogenesError';
  this.stack = (new Error()).stack;
}

DiogenesError.prototype = Object.create(Error.prototype);
DiogenesError.prototype.constructor = DiogenesError;

module.exports =  DiogenesError;
