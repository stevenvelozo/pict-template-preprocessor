# Implementation Reference

Detailed behavioral documentation for the Pict Template Preprocessor, covering wrapper installation, compilation fidelity, cache management, graph population, entity prefetch mechanics, and edge cases.

## Wrapper Installation

When the preprocessor is instantiated, its constructor calls `_installWrappers()`, which saves references to Pict's original methods and replaces them with wrapper functions.

### Wrapped Methods

| Original Method | Wrapper Behavior |
|----------------|-----------------|
| `parseTemplate` | Compile on first encounter, then use sync or async fast path |
| `parseTemplateByHash` | Resolve template string from TemplateProvider, set source template hint for graph, delegate to `parseTemplate` |
| `parseTemplateSet` | Async path: prefetch entities before iteration. Sync path: fall through to original |
| `parseTemplateSetByHash` | Resolve template string, set source template hint, delegate to `parseTemplateSet` |

### Method Wrapping Pattern

The preprocessor follows the same wrapping pattern established by `Pict-Template-Audit`:

```javascript
// Save reference to original
this._originalParseTemplate = tmpPict.parseTemplate.bind(tmpPict);

// Replace with wrapper
tmpPict.parseTemplate = function _preprocessorParseTemplate(...) { ... };
```

The `.bind(tmpPict)` ensures the original method retains its `this` context when called from the wrapper.

### Unwrapping

Call `unwrapTemplateFunctions()` to restore all four original methods and deactivate the preprocessor. This is useful for testing, benchmarking, or conditionally disabling optimization.

## Compilation Fidelity

The `compile()` method duplicates the MetaTemplate string parser's state machine with one critical difference: where the parser calls `Parse(hash, data, ...)`, the compiler records a segment. The state transitions -- trie node traversal, start pattern completion, content capture, end pattern matching -- are identical to ensure the compiler produces segments that exactly mirror what the parser would have dispatched.

### State Machine States

| State | Variable Flags | Meaning |
|-------|---------------|---------|
| Scanning | `tmpPatternMatch = false` | No active pattern match; characters go to literal buffer |
| Start Match | `tmpPatternMatch = true`, `tmpStartPatternMatchComplete = false` | Walking the trie to match a start pattern |
| Content Capture | `tmpStartPatternMatchComplete = true`, `tmpEndPatternMatchBegan = false` | Start pattern matched; capturing hash content |
| End Match | `tmpEndPatternMatchBegan = true` | Walking the end pattern trie |

### Failed Match Recovery

If a character breaks the trie path during start pattern matching (e.g., `{~X` where `X` is not a valid continuation), the accumulated output buffer is flushed to the literal buffer and scanning restarts from the current character. This matches the original parser's behavior exactly.

### Nested Pattern Handling

Template content captured between start and end delimiters is stored as-is in the segment's `Hash` field. If the content itself contains template expressions (nested templates), those are not recursively compiled at this stage. They will be compiled when `Parse` is called during execution and that Parse function calls `parseTemplate()` recursively, which hits the preprocessor wrapper again.

## Cache Management

### Cache Key

The cache key is the raw template string passed to `parseTemplate()`. Identity is based on strict string equality:

```javascript
// These are TWO separate cache entries:
parseTemplate('Hello {~D:Name~}!', data);
parseTemplate('Hello  {~D:Name~}!', data);  // extra space
```

### Cache Population

Cache entries are populated on first compilation in the `parseTemplate` wrapper. The compiled segment array is stored in a `Map<string, Array<Segment>>`.

### When to Clear

Call `clearCache()` when:
- A new template expression type is registered after preprocessor instantiation
- An existing template expression type is replaced or removed
- Templates in the TemplateProvider are modified (only affects `parseTemplateByHash` flows)

Call `clear()` to clear both cache and graph data.

### Memory Considerations

Each cached segment holds references to trie leaf nodes that already exist in the MetaTemplate parse tree. The segment array itself adds a small overhead per template: one object per literal section and one object per expression. For a typical template with 5 expressions, the segment array contains approximately 11 objects (6 literals + 5 expressions).

## Graph Population

### Source Template Identification

The graph needs a "from" node for each edge. This comes from the `pState._PreprocessorSourceTemplate` property, which is set by the `parseTemplateByHash` and `parseTemplateSetByHash` wrappers:

```javascript
pState._PreprocessorSourceTemplate = pTemplateHash;
```

For direct `parseTemplate()` calls without a named template hash, the graph is not populated (no source template ID to use as the "from" node).

### Deduplication

The graph deduplicates both nodes and edges. Adding a node that already exists returns the existing key. Adding an edge that already exists (same from, to, and type) returns the existing edge index without creating a duplicate.

### Default Edge Classifiers

The preprocessor registers classifiers for all built-in Pict template expression tags:

| Tag(s) | Edge Type | Target Extraction |
|--------|-----------|-------------------|
| `{~T:`, `{~Template:` | `renders` | First `:` separated part = template name |
| `{~TS:`, `{~TemplateSet:` | `renders-set` | First `:` separated part = template name |
| `{~TIf:`, `{~TemplateIf:` | `renders-if` + `reads` | Template name + comparison data addresses |
| `{~TIfE:`, `{~TemplateIfElse:` | `renders-if-else` | First and fourth `:` separated parts = template names |
| `{~D:`, `{~Data:`, formatters | `reads` | First `:` separated part = data address |
| `{~E:`, `{~Entity:` | `reads-entity` + `reads` + `renders` | `^` separated: entity type, ID address, template hash |

### Custom Classifiers

Register custom edge classifiers for application-specific template types:

```javascript
preprocessor.addEdgeClassifier('{~MyCustom:', (pHash) =>
{
    return [{ EdgeType: 'custom-reads', NodeType: 'data', NodeID: pHash.trim() }];
});
```

The classifier function receives the template hash (content between delimiters) and returns an array of edge descriptors.

## Entity Batch Prefetch

### Trigger Conditions

Entity prefetch only runs when ALL of the following are true:

1. `parseTemplateSet()` is called with a callback (async path)
2. `pict.EntityProvider` exists
3. The template string is non-empty
4. The dataset is a non-null object
5. At least one `{~E:~}` or `{~Entity:~}` expression is found in the template or one level of child templates

### Deep Scan

The `_collectEntityExpressionsDeep()` method:

1. Compiles the template string (using cache if available)
2. Collects entity expressions from the compiled segments
3. Follows template references (`{~T:~}`, `{~TIf:~}`, `{~TIfE:~}`, `{~TS:~}`) one level deep
4. For each referenced template, resolves the template string from TemplateProvider, compiles it, and collects entity expressions
5. Uses a visited set to prevent cycles

### ID Resolution

For each entity plan (EntityType + IDAddress), the preprocessor resolves the ID from every record in the dataset:

```javascript
// Entity plan: { EntityType: 'City', IDAddress: 'Record.IDCity' }
// Dataset: [{ IDCity: 5 }, { IDCity: 12 }, { IDCity: 5 }, { IDCity: 8 }]
// Resolved unique IDs: [5, 12, 8]
```

Address resolution supports:
- `Record.X` - Resolves from each dataset record
- `AppData.X` - Resolves from `pict.AppData`
- `Scope.X` - Resolves from the scope parameter
- `Context[N].X` - Resolves from the context array

Values of `null`, empty string, and `0` are excluded from the ID set.

### Cache Check

Before batch-fetching, each resolved ID is checked against the EntityProvider's record cache (CacheTrax). Only uncached IDs are included in the batch request.

### Batch Fetch

For each entity type with uncached IDs, a single request is made:

```
GET /1.0/{EntityType}/FilteredTo/FBL~ID{EntityType}~INN~{comma-separated-ids}
```

This uses Meadow's FilterByList (`FBL`) with the `INN` (IN list) operator. The `getEntitySet()` method handles pagination, count checking, and auto-caches individual records via `cacheIndividualEntityRecords()`.

### Concurrency

Multiple entity types are fetched concurrently using Fable's Anticipate service. Each entity type's batch fetch is an independent step in the Anticipate waterfall.

### Error Handling

Prefetch errors are logged as warnings but do not abort the TemplateSet render. The iteration proceeds normally; individual entity expressions will fall back to their standard per-record fetch behavior.

### Sync Path

The synchronous `parseTemplateSet()` path cannot perform async I/O, so it falls through to the original method without prefetching. Entity prefetch only operates on the async path.

## Interaction with Other Services

### Template Audit

If `pict-template-audit` is also active, both wrap the same Pict methods. The preprocessor should be instantiated first so it is the inner wrapper. The audit wrapper then measures the preprocessor's fast-path execution time rather than the original slow-path time.

### EntityProvider

The preprocessor calls `EntityProvider.getEntitySet()` for batch fetches and reads `EntityProvider.recordCache` to check for cached entities. It calls `EntityProvider.initializeCache()` to ensure cache buckets exist for each entity type before checking them.

### TemplateProvider

The preprocessor calls `TemplateProvider.getTemplate()` to resolve template hash names to template strings during deep entity expression scanning.

## Edge Cases

### Empty Templates

Empty or non-string values passed to `parseTemplate` return an empty string immediately without compilation.

### Templates Without Expressions

A template containing only literal text (no `{~...~}` expressions) compiles to a single Literal segment. The fast path concatenates one string, which is equivalent to returning the original string.

### Modified Parse Tree

If template expression types are added to Pict after the preprocessor compiles templates, cached segments will not include the new expression types. Call `clearCache()` to force recompilation.

### TemplateProvider Changes

If a named template's content is changed in the TemplateProvider after it has been compiled, the cache will serve stale segments because the cache key is the old template string. Since `parseTemplateByHash` resolves the template string fresh from the TemplateProvider on each call, a changed template will automatically get a new cache entry (the old string's entry becomes orphaned but harmless).
