# prefetchEntitiesForSet

Batch-prefetch entities for a template set before iteration begins. Scans the template (and one level of child templates) for entity expressions, resolves IDs across the dataset, and fetches uncached entities using Meadow's filter endpoint.

## Syntax

```javascript
preprocessor.prefetchEntitiesForSet(pTemplateString, pDataSet, fCallback, pContextArray, pScope, pState);
```

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `pTemplateString` | string | The template string that will be iterated over the dataset |
| `pDataSet` | Array or Object | The dataset to iterate (array of records or object whose values are records) |
| `fCallback` | function | Called when prefetch is complete: `(pError)` |
| `pContextArray` | Array | Context objects (optional) |
| `pScope` | any | Scope object for address resolution (optional) |
| `pState` | any | State object (optional) |

## Returns

`void` - The result is delivered to `fCallback`.

## Description

This method orchestrates the entity batch prefetch pipeline:

1. **Guard checks** - Returns immediately (calling `fCallback()`) if EntityProvider is missing, the template is empty, or the dataset is invalid
2. **Deep scan** - Calls `_collectEntityExpressionsDeep()` to discover all `{~E:~}` / `{~Entity:~}` expressions in the template and one level of referenced child templates
3. **ID resolution** - For each entity plan, resolves the ID address against every record in the dataset, collecting unique IDs per entity type
4. **Cache filtering** - Checks each resolved ID against `EntityProvider.recordCache`; only uncached IDs are included in the batch
5. **Batch fetch** - For each entity type with uncached IDs, calls `EntityProvider.getEntitySet()` with a Meadow filter: `FBL~ID{EntityType}~INN~{comma-separated-ids}`
6. **Completion** - After all fetches complete (or if no fetches were needed), calls `fCallback()`

The `getEntitySet()` method handles pagination and auto-caches individual records via `cacheIndividualEntityRecords()`, so subsequent `getEntity()` calls during template iteration hit the cache.

## Examples

### Basic Prefetch

```javascript
_Pict.TemplateProvider.addTemplate('AuthorRow', '{~E:Author^Record.IDAuthor^AuthorName~}');

let tmpDataSet = [
    { IDAuthor: 1 },
    { IDAuthor: 2 },
    { IDAuthor: 3 },
    { IDAuthor: 1 }   // duplicate, deduplicated
];

_Preprocessor.prefetchEntitiesForSet(
    '{~E:Author^Record.IDAuthor^AuthorName~}',
    tmpDataSet,
    (pError) =>
    {
        // One batch request was made:
        // GET /1.0/Authors/FilteredTo/FBL~IDAuthor~INN~1,2,3
        // Authors 1, 2, 3 are now in the EntityProvider cache
    }
);
```

### Multiple Entity Types

```javascript
let tmpTemplate = '{~E:Author^Record.IDAuthor^AuthorView~} from {~E:City^Record.IDCity^CityView~}';

_Preprocessor.prefetchEntitiesForSet(
    tmpTemplate,
    records,
    (pError) =>
    {
        // Two batch requests were made concurrently:
        // 1. GET /1.0/Authors/FilteredTo/FBL~IDAuthor~INN~...
        // 2. GET /1.0/Citys/FilteredTo/FBL~IDCity~INN~...
    }
);
```

### Skip Already-Cached Entities

```javascript
// If Author 1 is already cached, only 2 and 3 are fetched
// GET /1.0/Authors/FilteredTo/FBL~IDAuthor~INN~2,3
```

### No EntityProvider

```javascript
// If EntityProvider is not configured, fCallback is called immediately
// No error, no fetch -- the method is a no-op
```

## Error Handling

- Prefetch errors are passed to `fCallback` but are also logged as warnings
- The `parseTemplateSet` wrapper treats prefetch errors as non-fatal: it logs a warning and proceeds with normal iteration
- Individual entity expressions will fall back to per-record fetching if the batch fetch failed

## Notes

- This method is called automatically by the `parseTemplateSet` wrapper on the async path. You only need to call it directly for custom prefetch scenarios.
- The deep scan follows `{~T:~}`, `{~TIf:~}`, `{~TIfE:~}`, and `{~TS:~}` references one level deep.
- IDs of `null`, empty string, and `0` are excluded from the batch.
- Concurrent fetches for different entity types use Fable's Anticipate service.
- The sync `parseTemplateSet` path does not call this method (async I/O is not possible in sync context).

## Related

- [compile](compile.md) - Templates are compiled on demand during the deep scan
- [TemplateGraph](template-graph.md) - Entity edges are also captured in the graph
