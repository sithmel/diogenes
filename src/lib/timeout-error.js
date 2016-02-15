function TimeoutError(message) {
  this.name = 'TimeoutError';
  this.message = message || 'TimeoutError';
  this.stack = (new Error()).stack;
}

TimeoutError.prototype = Object.create(Error.prototype);
TimeoutError.prototype.constructor = TimeoutError;

module.exports = TimeoutError;
