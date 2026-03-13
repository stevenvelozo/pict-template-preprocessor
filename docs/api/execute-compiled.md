# executeCompiled

Execute a compiled template segment array synchronously, returning the rendered output string.

## Syntax

```javascript
let tmpOutput = preprocessor.executeCompiled(pSegments, pData, pContextArray, pScope, pState);
```

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `pSegments` | Array | The compiled segment array from `compile()` |
| `pData` | any | The data object for template rendering (the Record) |
| `pContextArray` | Array | Context objects accessible via `Context[N]` addresses |
| `pScope` | any | Sticky scope object for carrying state across renders (optional) |
| `pState` | any | Catchall state object for framework plumbing (optional) |

## Returns

`string` - The rendered template output.

## Description

Iterates the compiled segment array. For each Literal segment, its `Value` is concatenated directly to the output. For each Expression segment, the trie leaf's `Parse` function is called with the segment's `Hash`, the data, context array, scope, and state. If the leaf has a `ParserContext`, it is used as the `this` context for the Parse call.

The method also builds the context array by appending `pData` to any existing context entries, matching the behavior of the original MetaTemplate parser.

Null or undefined Parse results are treated as empty strings.

## Examples

### Basic Execution

```javascript
let tmpSegments = _Preprocessor.compile(
    'Hello {~D:Record.Name~}!',
    _Pict.MetaTemplate.ParseTree
);

let tmpOutput = _Preprocessor.executeCompiled(
    tmpSegments,
    { Name: 'World' },
    [],     // pContextArray
    null,   // pScope
    null    // pState
);
// => "Hello World!"
```

### With Context Array

```javascript
let tmpSegments = _Preprocessor.compile(
    '{~D:Context[0].Label~}: {~D:Record.Value~}',
    _Pict.MetaTemplate.ParseTree
);

let tmpOutput = _Preprocessor.executeCompiled(
    tmpSegments,
    { Value: 42 },
    [{ Label: 'Answer' }],
    null,
    null
);
// => "Answer: 42"
```

## Notes

- This method does not modify the segment array; it can be called repeatedly with different data.
- Expression segments whose Parse function returns `null` or `undefined` produce an empty string in the output.
- The method assumes all expressions are synchronous. For async expressions, use `executeCompiledAsync()`.

## Related

- [compile](compile.md) - Compile template strings into segments
- [executeCompiledAsync](execute-compiled-async.md) - Async execution path
