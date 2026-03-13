# addEdgeClassifier

Register a custom edge classifier for a template expression tag. Classifiers are called during `classifyEdges()` to extract graph edges from compiled expression segments.

## Syntax

```javascript
preprocessor.addEdgeClassifier(pTag, fClassifier);
```

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `pTag` | string | The `PatternStartString` to match (e.g., `'{~MyCustom:'`) |
| `fClassifier` | function | Classifier function: `(pHash) => Array<{ EdgeType, NodeType, NodeID }>` |

## Returns

`void`

## Description

Registers a function that extracts graph edge information from expression segments with the given start tag. When `classifyEdges()` encounters an Expression segment whose `Tag` matches `pTag`, it calls `fClassifier(segment.Hash)` to determine what edges to add to the graph.

The classifier function receives the template hash (content between start and end delimiters) and must return an array of edge descriptor objects:

```javascript
{
    EdgeType: string,   // e.g., 'renders', 'reads', 'reads-entity', or any custom type
    NodeType: string,   // e.g., 'template', 'data', 'entity', or any custom type
    NodeID: string      // The identifier for the target node
}
```

If the classifier returns an empty array, no edges are added for that segment.

## Examples

### Custom Read Classifier

```javascript
// Register a classifier for a custom {~Config:key~} expression
preprocessor.addEdgeClassifier('{~Config:', (pHash) =>
{
    return [{ EdgeType: 'reads-config', NodeType: 'config', NodeID: pHash.trim() }];
});
```

### Multi-Edge Classifier

```javascript
// A classifier that extracts both a template reference and a data address
preprocessor.addEdgeClassifier('{~CustomComposite:', (pHash) =>
{
    let tmpParts = pHash.split(':');
    let tmpEdges = [];

    if (tmpParts[0])
    {
        tmpEdges.push({ EdgeType: 'renders', NodeType: 'template', NodeID: tmpParts[0].trim() });
    }
    if (tmpParts[1])
    {
        tmpEdges.push({ EdgeType: 'reads', NodeType: 'data', NodeID: tmpParts[1].trim() });
    }

    return tmpEdges;
});
```

### Override a Built-in Classifier

```javascript
// Replace the default Data classifier with a custom one
preprocessor.addEdgeClassifier('{~D:', (pHash) =>
{
    let tmpAddress = pHash.split(':')[0].trim();
    return tmpAddress ? [{ EdgeType: 'reads-custom', NodeType: 'custom-data', NodeID: tmpAddress }] : [];
});
```

## Built-in Classifiers

The preprocessor registers default classifiers for these tags:

| Tag(s) | Edge Type |
|--------|-----------|
| `{~T:`, `{~Template:` | `renders` |
| `{~TS:`, `{~TemplateSet:` | `renders-set` |
| `{~TIf:`, `{~TemplateIf:` | `renders-if`, `reads` |
| `{~TIfE:`, `{~TemplateIfElse:` | `renders-if-else` |
| `{~D:`, `{~Data:`, `{~DJ:`, `{~DataJson:`, `{~Dollars:`, `{~Digits:`, `{~DateTimeFormat:`, `{~PascalCaseIdentifier:`, `{~LogValue:`, `{~LogValueTree:`, `{~NotEmpty:` | `reads` |
| `{~E:`, `{~Entity:` | `reads-entity`, `reads`, `renders` |

## Notes

- Calling `addEdgeClassifier` with a tag that already has a classifier will overwrite the existing one.
- Classifiers are called once per expression segment during classification. They should be pure functions with no side effects.
- Custom classifiers are preserved across `clearCache()` and `clear()` calls; they persist for the lifetime of the preprocessor instance.

## Related

- [classifyEdges](classify-edges.md) - Uses classifiers to populate the graph
- [TemplateGraph](template-graph.md) - Graph data structure
