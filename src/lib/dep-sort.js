var DiogenesError = require('./diogenes-error');
var assign = require('object-assign');

// depth first search (topological sort)
function depSort(getAdj, startNode, callback) {
  var already_visited = {};
  var already_backtracked = {};
  var out = [];

  return (function _dfs(node, next) {
    already_visited[node] = true;
    getAdj(node, function (err, adjlist) {
      var i, adj;
      if (err) {
        return next(err);
      }
      if (!adjlist) {
        return next(new DiogenesError('Diogenes: missing dependency: ' + node));
      }
      if ('error' in adjlist) {
        return next(adjlist.error);
      }
      for (i = 0; i < adjlist.deps.length; i++) {
        adj = adjlist.deps[i];
        if (adj in already_visited && !(adj in already_backtracked)) {
          return next(new DiogenesError('Diogenes: circular dependency: ' + adj));
        }
        if (!(adj in already_visited)) {
          return _dfs(adj, function (err, out) {
            if (err) {
              return next(err);
            }
            _dfs(node, next);
          });
        }
      }
      already_backtracked[node] = true; // detecting circular deps
      out.push(assign({name: node}, adjlist));
      return next(undefined, out);
    });
  }(startNode, callback));
};

module.exports = depSort;
