/**
* Template Expression Graph
* @author      Steven Velozo <steven@velozo.com>
* @description Directed graph of template-to-template and template-to-data dependencies.
*/

class TemplateGraph
{
	constructor()
	{
		// Nodes keyed by "type:id" (e.g., "template:MainPage", "data:AppData.User.Name")
		this.Nodes = {};

		// Edges as an array of { From, To, Type } objects
		this.Edges = [];

		// Reverse index: target → array of edge indices for getEdgesTo()
		this._ReverseIndex = {};
		// Forward index: source → array of edge indices for getEdgesFrom()
		this._ForwardIndex = {};
	}

	/**
	 * Add a node to the graph.
	 *
	 * @param {string} pType - The node type ("template", "data", "entity")
	 * @param {string} pID - The node identifier
	 *
	 * @return {string} The node key ("type:id")
	 */
	addNode(pType, pID)
	{
		let tmpKey = `${pType}:${pID}`;

		if (!(tmpKey in this.Nodes))
		{
			this.Nodes[tmpKey] = { Type: pType, ID: pID };
		}

		return tmpKey;
	}

	/**
	 * Add a directed edge to the graph.
	 *
	 * @param {string} pFromKey - The source node key ("type:id")
	 * @param {string} pToKey - The target node key ("type:id")
	 * @param {string} pEdgeType - The edge type ("renders", "reads", "reads-entity", etc.)
	 *
	 * @return {number} The edge index
	 */
	addEdge(pFromKey, pToKey, pEdgeType)
	{
		// Check for duplicate edge
		let tmpForwardEdges = this._ForwardIndex[pFromKey];
		if (tmpForwardEdges)
		{
			for (let i = 0; i < tmpForwardEdges.length; i++)
			{
				let tmpEdge = this.Edges[tmpForwardEdges[i]];
				if (tmpEdge.To === pToKey && tmpEdge.Type === pEdgeType)
				{
					return tmpForwardEdges[i];
				}
			}
		}

		let tmpIndex = this.Edges.length;
		this.Edges.push({ From: pFromKey, To: pToKey, Type: pEdgeType });

		// Update forward index
		if (!(pFromKey in this._ForwardIndex))
		{
			this._ForwardIndex[pFromKey] = [];
		}
		this._ForwardIndex[pFromKey].push(tmpIndex);

		// Update reverse index
		if (!(pToKey in this._ReverseIndex))
		{
			this._ReverseIndex[pToKey] = [];
		}
		this._ReverseIndex[pToKey].push(tmpIndex);

		return tmpIndex;
	}

	/**
	 * Get all nodes in the graph.
	 *
	 * @return {Object} Map of node key → { Type, ID }
	 */
	getNodes()
	{
		return this.Nodes;
	}

	/**
	 * Get all edges in the graph.
	 *
	 * @return {Array<Object>} Array of { From, To, Type }
	 */
	getEdges()
	{
		return this.Edges;
	}

	/**
	 * Get all outgoing edges from a node.
	 *
	 * @param {string} pNodeKey - The source node key ("type:id")
	 *
	 * @return {Array<Object>} Array of { From, To, Type }
	 */
	getEdgesFrom(pNodeKey)
	{
		let tmpIndices = this._ForwardIndex[pNodeKey];
		if (!tmpIndices)
		{
			return [];
		}

		let tmpEdges = [];
		for (let i = 0; i < tmpIndices.length; i++)
		{
			tmpEdges.push(this.Edges[tmpIndices[i]]);
		}
		return tmpEdges;
	}

	/**
	 * Get all incoming edges to a node.
	 *
	 * @param {string} pNodeKey - The target node key ("type:id")
	 *
	 * @return {Array<Object>} Array of { From, To, Type }
	 */
	getEdgesTo(pNodeKey)
	{
		let tmpIndices = this._ReverseIndex[pNodeKey];
		if (!tmpIndices)
		{
			return [];
		}

		let tmpEdges = [];
		for (let i = 0; i < tmpIndices.length; i++)
		{
			tmpEdges.push(this.Edges[tmpIndices[i]]);
		}
		return tmpEdges;
	}

	/**
	 * Export the graph as a serializable JSON object.
	 *
	 * @return {Object} { Nodes: [...], Edges: [...] }
	 */
	toJSON()
	{
		let tmpNodes = [];
		let tmpNodeKeys = Object.keys(this.Nodes);
		for (let i = 0; i < tmpNodeKeys.length; i++)
		{
			let tmpNode = this.Nodes[tmpNodeKeys[i]];
			tmpNodes.push({ Key: tmpNodeKeys[i], Type: tmpNode.Type, ID: tmpNode.ID });
		}

		return {
			Nodes: tmpNodes,
			Edges: this.Edges.slice()
		};
	}

	/**
	 * Export the graph in Graphviz DOT format.
	 *
	 * @return {string} DOT format string
	 */
	toDOT()
	{
		let tmpLines = ['digraph TemplateGraph {'];
		tmpLines.push('\trankdir=LR;');
		tmpLines.push('');

		// Node declarations with shapes by type
		let tmpNodeKeys = Object.keys(this.Nodes);
		for (let i = 0; i < tmpNodeKeys.length; i++)
		{
			let tmpNode = this.Nodes[tmpNodeKeys[i]];
			let tmpShape = 'box';
			if (tmpNode.Type === 'data')
			{
				tmpShape = 'ellipse';
			}
			else if (tmpNode.Type === 'entity')
			{
				tmpShape = 'diamond';
			}

			let tmpSafeKey = tmpNodeKeys[i].replace(/[^a-zA-Z0-9_]/g, '_');
			tmpLines.push(`\t${tmpSafeKey} [label="${tmpNode.ID}" shape=${tmpShape}];`);
		}

		tmpLines.push('');

		// Edge declarations
		for (let i = 0; i < this.Edges.length; i++)
		{
			let tmpEdge = this.Edges[i];
			let tmpFromSafe = tmpEdge.From.replace(/[^a-zA-Z0-9_]/g, '_');
			let tmpToSafe = tmpEdge.To.replace(/[^a-zA-Z0-9_]/g, '_');
			tmpLines.push(`\t${tmpFromSafe} -> ${tmpToSafe} [label="${tmpEdge.Type}"];`);
		}

		tmpLines.push('}');
		return tmpLines.join('\n');
	}

	/**
	 * Clear all nodes and edges.
	 */
	clear()
	{
		this.Nodes = {};
		this.Edges = [];
		this._ReverseIndex = {};
		this._ForwardIndex = {};
	}
}

module.exports = TemplateGraph;
