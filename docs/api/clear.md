# clear

Clear the compiled template cache and the dependency graph.

## Syntax

```javascript
preprocessor.clear();
```

## Parameters

None.

## Returns

`void`

## Description

Clears both the compiled template cache (`Map` of template strings to segment arrays) and the dependency graph (all nodes, edges, forward index, and reverse index). After calling this method:

- All templates will be recompiled on next render
- The graph will start empty and repopulate as templates are compiled

## Examples

### Full Reset

```javascript
// Clear everything
_Preprocessor.clear();

// Graph is now empty
console.log(_Preprocessor.graph.getNodes());
// => {}
console.log(_Preprocessor.graph.getEdges());
// => []

// Next render recompiles and repopulates the graph
_Pict.parseTemplateByHash('Page', { Title: 'Hello' });
```

### Between Test Runs

```javascript
// Reset state between test cases
beforeEach(() =>
{
    _Preprocessor.clear();
});
```

## Notes

- Does not remove custom edge classifiers. They persist for the lifetime of the preprocessor.
- Does not unwrap Pict methods; the preprocessor remains active.
- Equivalent to calling `clearCache()` followed by `graph.clear()`.

## Related

- [clearCache](clear-cache.md) - Clear cache only (preserve graph)
- [TemplateGraph](template-graph.md) - Graph data structure
