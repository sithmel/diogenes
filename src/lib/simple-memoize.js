// deadly simple memoize using the first arguments as key
function simpleMemoize(func) {
  var cache = {};
  return function () {
    var args = Array.prototype.slice.call(arguments, 0);
    var output;
    if (args[0] in cache) {
      return cache[args[0]];
    }
    else {
      output = func.apply(null, args);
      cache[args[0]] = output;
      return output;
    }
  };
}

module.exports = simpleMemoize;
