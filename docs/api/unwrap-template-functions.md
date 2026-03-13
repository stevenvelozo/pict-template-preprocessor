# unwrapTemplateFunctions

Remove preprocessor wrappers and restore Pict's original template methods.

## Syntax

```javascript
preprocessor.unwrapTemplateFunctions();
```

## Parameters

None.

## Returns

`void`

## Description

Restores the four wrapped methods on the Pict instance to their original implementations:

| Method | Restored To |
|--------|-------------|
| `pict.parseTemplate` | Original MetaTemplate-based parser |
| `pict.parseTemplateByHash` | Original hash lookup + parse |
| `pict.parseTemplateSet` | Original set iteration |
| `pict.parseTemplateSetByHash` | Original hash lookup + set iteration |

After unwrapping, template rendering bypasses the preprocessor entirely. No compilation, caching, graph population, or entity prefetch occurs. The compiled template cache and graph data remain intact and can be queried, but they will not be updated by future renders.

The saved original references are set to `null` after restoration. Calling `unwrapTemplateFunctions()` a second time is a no-op (each method check guards against null).

## Examples

### Disable Preprocessor

```javascript
// Preprocessor active -- fast path
let tmpResult1 = _Pict.parseTemplate('Hello {~D:AppData.Name~}!');

// Restore original behavior
_Preprocessor.unwrapTemplateFunctions();

// Preprocessor inactive -- original MetaTemplate path
let tmpResult2 = _Pict.parseTemplate('Hello {~D:AppData.Name~}!');
// Same output, different execution path
```

### A/B Benchmarking

```javascript
// Measure preprocessor performance
let tmpStart1 = Date.now();
for (let i = 0; i < 10000; i++)
{
    _Pict.parseTemplate(tmpTemplate, tmpData);
}
let tmpPreprocessorTime = Date.now() - tmpStart1;

// Unwrap and measure original performance
_Preprocessor.unwrapTemplateFunctions();

let tmpStart2 = Date.now();
for (let i = 0; i < 10000; i++)
{
    _Pict.parseTemplate(tmpTemplate, tmpData);
}
let tmpOriginalTime = Date.now() - tmpStart2;

console.log(`Preprocessor: ${tmpPreprocessorTime}ms`);
console.log(`Original: ${tmpOriginalTime}ms`);
```

### Cleanup in Tests

```javascript
after(() =>
{
    _Preprocessor.unwrapTemplateFunctions();
    _Preprocessor.clear();
});
```

## Notes

- Unwrapping does not clear the cache or graph. Call `clear()` separately if needed.
- Re-instantiating the preprocessor after unwrapping will re-install the wrappers. However, the new instance will have a fresh cache and graph.
- If another service (e.g., pict-template-audit) wrapped the same methods after the preprocessor, unwrapping the preprocessor will restore the methods to the preprocessor's saved references, which may not be the true originals. Unwrap in reverse order of installation.

## Related

- [clearCache](clear-cache.md) - Clear the compiled template cache
- [clear](clear.md) - Clear cache and graph
