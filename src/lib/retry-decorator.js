

function retryDecorator(times, condition) {
  times = times || Infinity;
  condition = condition || function () { return true; };
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
        if (err instanceof Error && condition(err) && counter < times) {
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
