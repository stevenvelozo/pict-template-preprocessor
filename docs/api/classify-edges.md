# classifyEdges

Classify expression segments and populate the dependency graph with typed edges.

## Syntax

```javascript
preprocessor.classifyEdges(pSegments, pSourceTemplateID);
```

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `pSegments` | Array | The compiled segment array from `compile()` |
| `pSourceTemplateID` | string | The source template name (used as the "from" node in the graph) |

## Returns

`void`

## Description

Iterates the compiled segment array and applies registered edge classifiers to each Expression segment. For each segment:

1. Looks up a classifier function by the segment's `Tag` (PatternStartString)
2. Calls the classifier with the segment's `Hash`
3. The classifier returns an array of edge descriptors: `{ EdgeType, NodeType, NodeID }`
4. For each descriptor, adds the target node to the graph and creates a directed edge from the source template node to the target node

If `pSourceTemplateID` is falsy, the method returns immediately without populating the graph. This prevents graph pollution from anonymous template strings rendered via `parseTemplate()` directly (without a named hash).

## Examples

### Basic Graph Population

```javascript
_Pict.TemplateProvider.addTemplate('Page', '<h1>{~D:Record.Title~}</h1>{~T:Footer:Record~}');

// Compile and classify
let tmpSegments = _Preprocessor.compile(
    '<h1>{~D:Record.Title~}</h1>{~T:Footer:Record~}',
    _Pict.MetaTemplate.ParseTree
);

_Preprocessor.classifyEdges(tmpSegments, 'Page');

let tmpEdges = _Preprocessor.graph.getEdgesFrom('template:Page');
// [
//   { From: 'template:Page', To: 'data:Record.Title', Type: 'reads' },
//   { From: 'template:Page', To: 'template:Footer', Type: 'renders' }
// ]
```

### With Entity Expressions

```javascript
let tmpSegments = _Preprocessor.compile(
    '{~E:Author^Record.IDAuthor^AuthorName~}',
    _Pict.MetaTemplate.ParseTree
);

_Preprocessor.classifyEdges(tmpSegments, 'BookRow');

let tmpEdges = _Preprocessor.graph.getEdgesFrom('template:BookRow');
// [
//   { From: 'template:BookRow', To: 'entity:Author', Type: 'reads-entity' },
//   { From: 'template:BookRow', To: 'data:Record.IDAuthor', Type: 'reads' },
//   { From: 'template:BookRow', To: 'template:AuthorName', Type: 'renders' }
// ]
```

### No Source Template

```javascript
// No graph edges are added when source template ID is not provided
_Preprocessor.classifyEdges(tmpSegments, null);
_Preprocessor.classifyEdges(tmpSegments, '');
```

## Notes

- Classification happens automatically during the `parseTemplate` wrapper on first compilation. You only need to call this directly if compiling templates outside the wrapper.
- Duplicate edges (same from, to, and type) are deduplicated by the graph.
- Segments with tags that have no registered classifier are silently skipped.

## Related

- [compile](compile.md) - Compile template strings into segments
- [addEdgeClassifier](add-edge-classifier.md) - Register custom classifiers
- [TemplateGraph](template-graph.md) - Graph data structure
