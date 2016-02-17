

function retryDecorator(times, error) {
  var condition;
  times = times || Infinity;
  error = error || Error;
  if (error === Error || Error.isPrototypeOf(error)) {
    condition = function (err, dep) { return err instanceof error; };
  }
  else {
    condition = error;
  }
  return function (func) {
    return function () {
      var counter = 0;
      var context = this;
      var args = Array.prototype.slice.call(arguments, 0);
      var cb = args[args.length - 1];

      var retry = function () {
        counter++;
        func.apply(context, args);
      };

      args[args.length - 1] = function (err, dep) {
        if (condition(err, dep) && counter < times) {
          retry();
        }
        else {
          cb(err, dep);
        }
      };
      retry();
    };
  };
}

module.exports = retryDecorator;
