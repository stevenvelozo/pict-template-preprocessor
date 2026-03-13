# clearCache

Clear the compiled template cache, forcing all templates to be recompiled on next render.

## Syntax

```javascript
preprocessor.clearCache();
```

## Parameters

None.

## Returns

`void`

## Description

Clears the `Map<string, Array<Segment>>` that stores compiled segment arrays. After calling this method, the next `parseTemplate()` call for any template string will trigger a full compilation through the trie state machine.

This method does not clear the dependency graph. To clear both cache and graph, use `clear()`.

## Examples

### Force Recompilation After Adding Template Types

```javascript
// Template was compiled before this expression type existed
let tmpResult1 = _Pict.parseTemplate('Hello {~MyNew:something~}!');
// {~MyNew:something~} was treated as literal text (no matching pattern)

// Register new expression type
_Pict.addTemplate(MyNewTemplateClass);

// Clear cache so the template recompiles with the new pattern
_Preprocessor.clearCache();

// Now the expression is recognized
let tmpResult2 = _Pict.parseTemplate('Hello {~MyNew:something~}!');
```

### Benchmarking

```javascript
// Clear cache to force compilation on next render
_Preprocessor.clearCache();

let tmpStart = Date.now();
_Pict.parseTemplate(tmpLargeTemplate, tmpData);
let tmpCompileAndExecuteTime = Date.now() - tmpStart;

let tmpStart2 = Date.now();
_Pict.parseTemplate(tmpLargeTemplate, tmpData);
let tmpCachedExecuteTime = Date.now() - tmpStart2;

console.log(`Compile + Execute: ${tmpCompileAndExecuteTime}ms`);
console.log(`Cached Execute: ${tmpCachedExecuteTime}ms`);
```

## Notes

- Does not affect the dependency graph. Use `clear()` to clear both.
- Does not remove custom edge classifiers.
- Does not unwrap Pict methods; the preprocessor remains active.
- Cache entries are not reference-counted. Clearing the cache orphans all compiled segments immediately.

## Related

- [clear](clear.md) - Clear cache and graph
- [compile](compile.md) - How templates are compiled
