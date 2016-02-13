var errors = require('./errors');

function dfs(adjlists, startingNode) { // depth first search
  var already_visited = {};
  var already_backtracked = {};
  var adjlist, node;
  var stack = [startingNode];
  var out = [];

  while (stack.length) {
    node = stack[stack.length - 1];
    already_visited[node] = true;

    if (!adjlists(node)) {
      throw new errors.DiogenesError('Diogenes: missing dependency: ' + node);
    }

    if (adjlists(node).error) throw adjlists(node).error;
    adjlist = adjlists(node).deps.filter(function (adj) {
      if (adj in already_visited && !(adj in already_backtracked)) {
        throw new errors.DiogenesError('Diogenes: circular dependency: ' + adj);
      }
      return !(adj in already_visited);
    });

    if (adjlist.length) {
      stack.push(adjlist[0]);
    }
    else {
      already_backtracked[node] = true; // detecting circular deps
      out.push(node);
      stack.pop();
    }
  }
  return out;
}

module.exports = dfs;
