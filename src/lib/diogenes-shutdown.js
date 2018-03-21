function DiogenesShutdownError (message) {
  this.name = 'DiogenesShutdownError'
  this.message = message || 'DiogenesShutdownError'
  this.stack = (new Error()).stack
}

DiogenesShutdownError.prototype = Object.create(Error.prototype)
DiogenesShutdownError.prototype.constructor = DiogenesShutdownError

module.exports = DiogenesShutdownError
