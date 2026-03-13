# executeCompiledAsync

Execute a compiled template segment array asynchronously, delivering the rendered output string to a callback function.

## Syntax

```javascript
preprocessor.executeCompiledAsync(pSegments, pData, fCallback, pContextArray, pScope, pState);
```

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `pSegments` | Array | The compiled segment array from `compile()` |
| `pData` | any | The data object for template rendering (the Record) |
| `fCallback` | function | Callback: `(pError, pRenderedOutput)` |
| `pContextArray` | Array | Context objects accessible via `Context[N]` addresses |
| `pScope` | any | Sticky scope for carrying state across renders (optional) |
| `pState` | any | Catchall state object for framework plumbing (optional) |

## Returns

`void` - The result is delivered to `fCallback`.

## Description

Creates a Fable Anticipate instance and schedules one step per segment. For Literal segments, the value is stored directly. For Expression segments, the method checks the trie leaf's `isAsync` flag:

- **Async expressions** (`isAsync = true`): Calls `leaf.ParseAsync(hash, data, callback, contextArray, scope, state)` and stores the result when the callback fires.
- **Sync expressions** (`isAsync = false`): Calls `leaf.Parse(hash, data, contextArray, scope, state)` synchronously and stores the result immediately.

After all steps complete, the output parts are joined into a single string and delivered to `fCallback`.

This is significantly more efficient than the original async parser, which creates one Anticipate step per character. The compiled path creates only N steps (one per segment).

## Examples

### Basic Async Execution

```javascript
let tmpSegments = _Preprocessor.compile(
    'Hello {~D:Record.Name~}!',
    _Pict.MetaTemplate.ParseTree
);

_Preprocessor.executeCompiledAsync(
    tmpSegments,
    { Name: 'World' },
    (pError, pOutput) =>
    {
        console.log(pOutput);
        // => "Hello World!"
    },
    [],
    null,
    null
);
```

### With Async Template Expressions

```javascript
// Entity expressions are async (they fetch from an API)
let tmpSegments = _Preprocessor.compile(
    'Author: {~E:Author^42^AuthorName~}',
    _Pict.MetaTemplate.ParseTree
);

_Preprocessor.executeCompiledAsync(
    tmpSegments,
    {},
    (pError, pOutput) =>
    {
        // The Entity expression fetched Author 42 asynchronously
        console.log(pOutput);
    },
    [],
    null,
    null
);
```

## Notes

- Errors from individual async expressions are logged but do not abort execution. The errored segment produces an empty string.
- If `ParserContext` exists on the leaf, it is used as the `this` context for both sync and async calls via `.bind()`.
- The Anticipate steps run sequentially (concurrency = 1), preserving template order.

## Related

- [compile](compile.md) - Compile template strings into segments
- [executeCompiled](execute-compiled.md) - Sync execution path
