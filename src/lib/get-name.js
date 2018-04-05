// tries to get a name from a string or a function
function getName (nameOrFunc) {
  if (typeof nameOrFunc === 'string') {
    return nameOrFunc
  }
  if (typeof nameOrFunc === 'function') {
    return nameOrFunc.name
  }
}

module.exports = getName
