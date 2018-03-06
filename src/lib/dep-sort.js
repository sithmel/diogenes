var DiogenesError = require('./diogenes-error')

// depth first search (topological sort)
function depSort (adjlists, startingNode) { // depth first search
  var alreadyVisited = {}
  var alreadyBacktracked = {}
  var adjlist, node
  var adjacencies
  var stack = [startingNode]
  var out = []

  while (stack.length) {
    node = stack[stack.length - 1]
    alreadyVisited[node] = true

    adjacencies = adjlists(node)
    if (!adjacencies) {
      throw new DiogenesError('Diogenes: missing dependency: ' + node)
    }

    adjlist = adjacencies.deps.filter(function (adj) {
      if (adj in alreadyVisited && !(adj in alreadyBacktracked)) {
        throw new DiogenesError('Diogenes: circular dependency: ' + adj)
      }
      return !(adj in alreadyVisited)
    })

    if (adjlist.length) {
      stack.push(adjlist[0])
    } else {
      alreadyBacktracked[node] = true // detecting circular deps
      out.push(adjacencies)
      stack.pop()
    }
  }
  return out
}

module.exports = depSort
