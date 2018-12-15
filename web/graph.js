
$.getJSON('/data/nodes-1000.json', nodes_ => {
  $.getJSON('/data/links-1000.json', links_ => {
    let baseNodes = nodes_
    let baseLinks = links_

    var nodes = [...baseNodes]
    var links = [...baseLinks]

    function clustering(alpha) {
      nodes.forEach((d) => {
        const cluster = clusters[d.cluster];
        if (cluster === d) return;
        let x = d.x - cluster.x;
        let y = d.y - cluster.y;
        let l = Math.sqrt((x * x) + (y * y));
        const r = d.r + cluster.r;
        if (l !== r) {
          l = ((l - r) / l) * alpha;
          d.x -= x *= l;
          d.y -= y *= l;
          cluster.x += x;
          cluster.y += y;
        }
      });
    }

    function getNeighbors(node) {
      return baseLinks.reduce(function (neighbors, link) {
          if (link.target.id === node.id) {
            neighbors.push(link.source.id)
          } else if (link.source.id === node.id) {
            neighbors.push(link.target.id)
          }
          return neighbors
        },
        [node.id]
      )
    }

    function isNeighborLink(node, link) {
      return link.target.id === node.id || link.source.id === node.id
    }

    function hexToRGB(hex, alpha) {
      var r = parseInt(hex.slice(1, 3), 16),
          g = parseInt(hex.slice(3, 5), 16),
          b = parseInt(hex.slice(5, 7), 16);
    
        if (alpha) {
            return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
        } else {
            return "rgb(" + r + ", " + g + ", " + b + ")";
        }
    }

    // Standard Normal variate using Box-Muller transform.
    function randomStdNormal() {
      var u = 0, v = 0;
      while(u === 0) u = Math.random(); //Converting [0,1) to (0,1)
      while(v === 0) v = Math.random();
      return Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
    }
  
    function getNodeColor(node, neighbors) {
      if (Array.isArray(neighbors) && neighbors.indexOf(node.id) > -1) {
        return node.level === 1 ? 'blue' : 'green'
      }
      return node.level === 1 ? 'red' : 'gray'
    }

    function getLinkColor(node, link) {
      return isNeighborLink(node, link) ? 'green' : '#E5E5E5'
    }

    function getTextColor(node, neighbors) {
      return Array.isArray(neighbors) && neighbors.indexOf(node.id) > -1 ? 'green' : 'black'
    }

    let colorChoices = ['5e90af', '5387aa', '3c749d', 'bcd2df']
    function U(color) {

      // return hexToRGB(color.split('#')[1], (randomStdNormal() + 5) * 2)
      var hex_color = parseInt(colorChoices[Math.round(Math.random() * (colorChoices.length-1))], 16)

      hex_color += (Math.random() - 0.5) * 10

      let a = hex_color.toString(16).split('.')[0]

      return '#' + a
      // return hexToRGB(a, 0.8)
    }

    var width = window.innerWidth
    var height = window.innerHeight

    /**
     * Construct our svg image with d3 DOM manipulations through d3 selections.
     */
    var svg = d3.select('svg')

    svg
      .attr('width', width)
      .attr('height', height)

    // we use svg groups to logically group the elements together
    // append('g') adds a g element to the svg element
    var linkGroup = svg.append('g').attr('class', 'links')
    var nodeGroup = svg.append('g').attr('class', 'nodes')
    var textGroup = svg.append('g').attr('class', 'texts')

    var linkElements,
      nodeElements
      // textElements

    // we use this reference to select/deselect
    // after clicking the same element twice
    var selectedId

    /**
     * Create a Force Simulation with links, charge, and center.
     */
    var linkForce = d3
      .forceLink()
      .id(link => link.id)
      .strength(link => link.strength)

    var simulation = d3
      .forceSimulation()
      .force('link', linkForce)
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(width / 2, height / 2))

    /**
     * d3-drag: Create new drag behaviors
     */
    var dragDrop = d3.drag().on('start', node => {
      // User clicked a node
      node.fx = node.x
      node.fy = node.y
    }).on('drag', node => {
      // User is dragging a node
      simulation.alphaTarget(0.7).restart()
      node.fx = d3.event.x
      node.fy = d3.event.y
    }).on('end', function (node) {
      // User stopped dragging a node
      if (!d3.event.active) {
        simulation.alphaTarget(0)
      }
      node.fx = null
      node.fy = null
    })

    // select node is called on every click
    // we either update the data according to the selection
    // or reset the data if the same node is clicked twice
    function selectNode(selectedNode) {
      if (selectedId === selectedNode.id) {
        selectedId = undefined
        resetData()
        updateSimulation()
      } else {
        selectedId = selectedNode.id
        updateData(selectedNode)
        updateSimulation()
      }

      var neighbors = getNeighbors(selectedNode)
      // we modify the styles to highlight selected nodes
      nodeElements.attr('fill', node => getNodeColor(node, neighbors))
      // textElements.attr('fill', node => getTextColor(node, neighbors))
      linkElements.attr('stroke', link => getLinkColor(selectedNode, link))
    }

    // this helper simple adds all nodes and links
    // that are missing, to recreate the initial state
    function resetData() {
      let nodeIds = nodes.map(node => node.id)

      baseNodes.forEach(node => {
        if (nodeIds.indexOf(node.id) === -1) {
          nodes.push(node)
        }
      })

      links = baseLinks
    }

    // diffing and mutating the data
    function updateData(selectedNode) {
      var neighbors = getNeighbors(selectedNode)
      var newNodes = baseNodes.filter(function (node) {
        return neighbors.indexOf(node.id) > -1 || node.level === 1
      })
      var diff = {
        removed: nodes.filter(function (node) { return newNodes.indexOf(node) === -1 }),
        added: newNodes.filter(function (node) { return nodes.indexOf(node) === -1 })
      }
      diff.removed.forEach(function (node) { nodes.splice(nodes.indexOf(node), 1) })
      diff.added.forEach(function (node) { nodes.push(node) })
      links = baseLinks.filter(function (link) {
        return link.target.id === selectedNode.id || link.source.id === selectedNode.id
      })
    }

    function updateGraph() {
      
      // UPDATE LINKS

      // Bind links data to line elements in the link group
      linkElements = linkGroup.selectAll('line')
        .data(links, link => link.target.id + link.source.id)

      // Remove DOM elements not bound to any data
      linkElements.exit().remove()

      // Add DOM elements for data that do not have a bound DOM element
      var linkEnter = linkElements
        .enter().append('line')
        .attr('stroke-width', link => link.strength * 3)
        // .attr('stroke-width', 1)
        .attr('stroke', link => '#739fbb')

      linkElements = linkEnter.merge(linkElements)

      // UPDATE NODES

      nodeElements = nodeGroup.selectAll('circle')
        .data(nodes, node => node.id)

      nodeElements.exit().remove()

      var nodeEnter = nodeElements
        .enter()
        .append('circle')
        // .attr('r', node => Math.log1p(node.numConnections * 10000))
        .attr('r', node => Math.pow((node.numConnections * 4) + 3, 1.5))
        // .attr('r', 10)
        .attr('fill', node => U('#5387aa'))
        .attr('stroke', node => 'black')
        .attr('stroke-width', node => 0.25)
        .call(dragDrop) // calls the dragDrop method with current selection as its argument.
        // we link the selectNode method here
        // to update the graph on every click
        .on('click', selectNode)
      nodeElements = nodeEnter.merge(nodeElements)


      // UPDATE TEXTS
    
      // textElements = textGroup.selectAll('text')
      //   .data(nodes, node => node.id)

      // textElements.exit().remove()

      // var textEnter = textElements
      //   .enter()
      //   .append('text')
      //   .text(function (node) { return node.label })
      //   .attr('font-size', 15)
      //   .attr('dx', 15)
      //   .attr('dy', 4)
      // textElements = textEnter.merge(textElements)
    }

    function updateSimulation() {
      updateGraph()

      simulation.nodes(nodes).on('tick', () => {
        nodeElements
          .attr('cx', node => node.x)
          .attr('cy', node => node.y)
        // textElements
        //   .attr('x', node => node.x) 
        //   .attr('y', node => node.y)
        linkElements
          .attr('x1', link => link.source.x)
          .attr('y1', link => link.source.y)
          .attr('x2', link => link.target.x)
          .attr('y2', link => link.target.y)
      })

      simulation.force('link').links(links)
      simulation.alphaTarget(0.7).restart()
    }

    // last but not least, we call updateSimulation
    // to trigger the initial render
    updateSimulation()
  })
})
