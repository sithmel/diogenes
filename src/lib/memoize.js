function memoize(f) {
  var cache = {};
  return function (name) {
    if (!(name in cache)) {
      cache[name] = f(name);
    }
    return cache[name];
  };
}

module.exports = memoize;
