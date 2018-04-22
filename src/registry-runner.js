const uuid = require('uuid/v1')
const DiogenesShutdownError = require('./lib/diogenes-shutdown')

/*
Registry Runner object
*/

function RegistryRunner () {
  this.running = {}
  this._isShuttingDown = false
}

RegistryRunner.prototype.run = function registryRun (registry, name, deps, done) {
  done = typeof deps === 'function' ? deps : done
  deps = typeof deps === 'object' ? deps : {}
  const runId = uuid()
  let promise

  if (!(typeof name === 'string' || name instanceof RegExp || Array.isArray(name))) {
    throw new Error('Invalid arguments: the name should be a string, a regExp or an array')
  }

  if (this._isShuttingDown) {
    promise = Promise.reject(new DiogenesShutdownError('Diogenes: shutting down'))
  } else {
    const tempreg = registry.clone().addDeps(deps)
    if (typeof name === 'string') {
      promise = tempreg.run(name, runId)
    } else {
      if (name instanceof RegExp) {
        name = Object.keys(registry.services).filter(RegExp.prototype.test.bind(name))
      }
      // if it is not a string and a regexp, it is an array
      tempreg.service(runId).dependsOn(name)
        .provides(function (deps) {
          return Promise.resolve(deps)
        })
      promise = tempreg.run(runId, runId)
    }
  }

  const promiseWithCleanUp = promise
    .then((res) => {
      delete this.running[runId]
      return Promise.resolve(res)
    })
    .catch((err) => {
      delete this.running[runId]
      return Promise.reject(err)
    })

  this.running[runId] = promiseWithCleanUp

  if (done) {
    promiseWithCleanUp
      .then((res) => {
        done(null, res)
      })
      .catch((err) => {
        done(err)
      })
    return this
  } else {
    return promiseWithCleanUp
  }
}

RegistryRunner.prototype.shutdown = function registryShutdown (done) {
  this._isShuttingDown = true

  var promise = Promise.all(Object.keys(this.running)
    .map((key) => this.running[key].catch(() => Promise.resolve(null))))

  if (done) {
    promise
      .then(function (res) {
        done(null, res)
      })
      .catch(function (err) {
        done(err)
      })
    return this
  } else {
    return promise
  }
}

RegistryRunner.prototype.flush = function registryFlush (done) {
  const promise = this.shutdown()
    .then(() => {
      this._isShuttingDown = false
      return Promise.resolve(null)
    })

  if (done) {
    promise
      .then(function (res) {
        done(null, res)
      })
      .catch(function (err) {
        done(err)
      })
    return this
  } else {
    return promise
  }
}

module.exports = RegistryRunner
