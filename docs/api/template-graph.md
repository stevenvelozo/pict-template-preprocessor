# TemplateGraph

The dependency graph data structure that captures template-to-template, template-to-data, and template-to-entity relationships. Accessible via `preprocessor.graph`.

## Class: TemplateGraph

### Constructor

```javascript
let tmpGraph = new TemplateGraph();
```

Creates an empty graph with no nodes or edges. The preprocessor creates this instance automatically; you access it via `preprocessor.graph`.

---

## Properties

### Nodes

Map of node key to node descriptor. Keys follow the format `"type:id"`.

**Type:** `Object<string, { Type: string, ID: string }>`

```javascript
preprocessor.graph.Nodes
// {
//   'template:MainPage': { Type: 'template', ID: 'MainPage' },
//   'data:Record.Name': { Type: 'data', ID: 'Record.Name' },
//   'entity:Author': { Type: 'entity', ID: 'Author' }
// }
```

### Edges

Array of directed edge objects.

**Type:** `Array<{ From: string, To: string, Type: string }>`

```javascript
preprocessor.graph.Edges
// [
//   { From: 'template:MainPage', To: 'template:Header', Type: 'renders' },
//   { From: 'template:MainPage', To: 'data:Record.Name', Type: 'reads' }
// ]
```

---

## Methods

### addNode(pType, pID)

Add a node to the graph. If the node already exists, returns the existing key without creating a duplicate.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pType` | string | Node type: `'template'`, `'data'`, `'entity'`, or custom |
| `pID` | string | Node identifier (e.g., template hash, data address, entity type) |

**Returns:** `string` - The node key (`"type:id"`)

```javascript
let tmpKey = preprocessor.graph.addNode('template', 'MainPage');
// => 'template:MainPage'
```

---

### addEdge(pFromKey, pToKey, pEdgeType)

Add a directed edge between two nodes. Deduplicates edges with the same from, to, and type.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pFromKey` | string | Source node key |
| `pToKey` | string | Target node key |
| `pEdgeType` | string | Edge type: `'renders'`, `'reads'`, `'reads-entity'`, etc. |

**Returns:** `number` - The edge index

```javascript
let tmpIdx = preprocessor.graph.addEdge('template:Page', 'template:Header', 'renders');
```

---

### getNodes()

Get all nodes in the graph.

**Returns:** `Object` - Map of node key to `{ Type, ID }`

```javascript
let tmpNodes = preprocessor.graph.getNodes();
// { 'template:Page': { Type: 'template', ID: 'Page' }, ... }
```

---

### getEdges()

Get all edges in the graph.

**Returns:** `Array<Object>` - Array of `{ From, To, Type }`

```javascript
let tmpEdges = preprocessor.graph.getEdges();
// [{ From: 'template:Page', To: 'template:Header', Type: 'renders' }, ...]
```

---

### getEdgesFrom(pNodeKey)

Get all outgoing edges from a node.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pNodeKey` | string | Source node key (e.g., `'template:MainPage'`) |

**Returns:** `Array<Object>` - Array of `{ From, To, Type }` edges originating from this node

```javascript
let tmpOutgoing = preprocessor.graph.getEdgesFrom('template:MainPage');
// [
//   { From: 'template:MainPage', To: 'template:Header', Type: 'renders' },
//   { From: 'template:MainPage', To: 'data:Record.Title', Type: 'reads' }
// ]
```

---

### getEdgesTo(pNodeKey)

Get all incoming edges to a node.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pNodeKey` | string | Target node key (e.g., `'template:Header'`) |

**Returns:** `Array<Object>` - Array of `{ From, To, Type }` edges pointing to this node

```javascript
let tmpIncoming = preprocessor.graph.getEdgesTo('template:Header');
// [{ From: 'template:MainPage', To: 'template:Header', Type: 'renders' }]
```

---

### toJSON()

Export the graph as a serializable JSON object suitable for visualization tools.

**Returns:** `Object` - `{ Nodes: Array<{ Key, Type, ID }>, Edges: Array<{ From, To, Type }> }`

```javascript
let tmpJSON = preprocessor.graph.toJSON();
console.log(JSON.stringify(tmpJSON, null, 2));
// {
//   "Nodes": [
//     { "Key": "template:MainPage", "Type": "template", "ID": "MainPage" },
//     { "Key": "template:Header", "Type": "template", "ID": "Header" }
//   ],
//   "Edges": [
//     { "From": "template:MainPage", "To": "template:Header", "Type": "renders" }
//   ]
// }
```

---

### toDOT()

Export the graph in Graphviz DOT format. Nodes are shaped by type: boxes for templates, ellipses for data, diamonds for entities. Edges are labeled by type.

**Returns:** `string` - DOT format string

```javascript
let tmpDOT = preprocessor.graph.toDOT();
console.log(tmpDOT);
// digraph TemplateGraph {
//     rankdir=LR;
//
//     template_MainPage [label="MainPage" shape=box];
//     template_Header [label="Header" shape=box];
//     data_Record_Title [label="Record.Title" shape=ellipse];
//
//     template_MainPage -> template_Header [label="renders"];
//     template_MainPage -> data_Record_Title [label="reads"];
// }
```

Render to an image with Graphviz:

```bash
echo "$DOT_OUTPUT" | dot -Tpng -o graph.png
```

---

### clear()

Clear all nodes, edges, and indices.

```javascript
preprocessor.graph.clear();

// Graph is now empty
preprocessor.graph.getNodes();  // => {}
preprocessor.graph.getEdges();  // => []
```

---

## Node Types

| Type | Description | DOT Shape |
|------|-------------|-----------|
| `template` | A named template hash | box |
| `data` | A data address path | ellipse |
| `entity` | An entity type name | diamond |

Custom node types are supported; they render as boxes in DOT output.

## Edge Types

| Type | Meaning |
|------|---------|
| `renders` | Source template renders target template |
| `renders-set` | Source renders target as a set iteration |
| `renders-if` | Source conditionally renders target |
| `renders-if-else` | Source conditionally renders one of two targets |
| `reads` | Source reads a data address |
| `reads-entity` | Source fetches an entity by type |

Custom edge types are supported and rendered as labels in DOT output.

## Examples

### Walk the Dependency Tree

```javascript
function walkDependencies(pGraph, pNodeKey, pDepth)
{
    let tmpIndent = '  '.repeat(pDepth);
    let tmpNode = pGraph.Nodes[pNodeKey];
    console.log(`${tmpIndent}${tmpNode.Type}: ${tmpNode.ID}`);

    let tmpEdges = pGraph.getEdgesFrom(pNodeKey);
    for (let i = 0; i < tmpEdges.length; i++)
    {
        console.log(`${tmpIndent}  --[${tmpEdges[i].Type}]-->`);
        walkDependencies(pGraph, tmpEdges[i].To, pDepth + 1);
    }
}

walkDependencies(preprocessor.graph, 'template:MainPage', 0);
```

### Find All Data Dependencies for a Template

```javascript
let tmpDataEdges = preprocessor.graph.getEdgesFrom('template:UserProfile')
    .filter((pEdge) => pEdge.Type === 'reads');

let tmpDataAddresses = tmpDataEdges.map((pEdge) =>
{
    return preprocessor.graph.Nodes[pEdge.To].ID;
});

console.log('Data dependencies:', tmpDataAddresses);
// => ['Record.Name', 'Record.Email', 'AppData.Theme']
```

### Find All Templates That Reference an Entity

```javascript
let tmpEntityEdges = preprocessor.graph.getEdgesTo('entity:Author');

let tmpTemplates = tmpEntityEdges.map((pEdge) =>
{
    return preprocessor.graph.Nodes[pEdge.From].ID;
});

console.log('Templates using Author entity:', tmpTemplates);
// => ['BookRow', 'AuthorCard']
```

## Related

- [classifyEdges](classify-edges.md) - How the graph is populated
- [addEdgeClassifier](add-edge-classifier.md) - Register custom classifiers
- [clear](clear.md) - Clear cache and graph
