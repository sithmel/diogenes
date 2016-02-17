function isPromise(obj) {
  return typeof obj === 'object' && 'then' in obj;
}

function callbackify(func) {
  return function () {
    // get arguments
    var context = this;
    var args = Array.prototype.slice.call(arguments, 0, -1);
    var cb = arguments[arguments.length - 1];
    try {
      var output = func.apply(context, args);
    }
    catch (e) {
      return cb(e);
    }

    if (isPromise(output)) {
      output.then(function (res) { // onfulfilled
        cb(undefined, res);
      },
      function (error) { // onrejected
        cb(error);
      });
    }
    else {
      cb(undefined, output);
    }
  };
}

module.exports = callbackify;
