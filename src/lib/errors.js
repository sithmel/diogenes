function DiogenesError(message) {
  this.name = 'DiogenesError';
  this.message = message || 'DiogenesError';
  this.stack = (new Error()).stack;
}

DiogenesError.prototype = Object.create(Error.prototype);
DiogenesError.prototype.constructor = DiogenesError;

function DiogenesTimeoutError(message) {
  this.name = 'DiogenesTimeoutError';
  this.message = message || 'DiogenesTimeoutError';
  this.stack = (new DiogenesError()).stack;
}

DiogenesTimeoutError.prototype = Object.create(DiogenesError.prototype);
DiogenesTimeoutError.prototype.constructor = DiogenesTimeoutError;


module.exports = {
  DiogenesError: DiogenesError,
  DiogenesTimeoutError: DiogenesTimeoutError
};
