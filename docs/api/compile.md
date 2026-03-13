# compile

Compile a template string into a segment array using the trie parse tree. Walks the string character-by-character through the same state machine as MetaTemplate's `parseCharacter`, but records segments instead of executing Parse functions.

## Syntax

```javascript
let tmpSegments = preprocessor.compile(pString, pParseTree);
```

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `pString` | string | The template string to compile |
| `pParseTree` | Object | The trie root from `pict.MetaTemplate.ParseTree` |

## Returns

`Array<Object>` - An array of segment objects. Each segment is one of:

**Literal segment:**
```javascript
{ Type: 'Literal', Value: 'some text' }
```

**Expression segment:**
```javascript
{
    Type: 'Expression',
    Hash: 'AppData.Name',           // Content between start/end delimiters
    Leaf: <trie leaf node>,         // Direct reference to trie leaf (contains Parse, ParseAsync, etc.)
    Tag: '{~Data:'                  // PatternStartString for classification
}
```

## Description

The `compile` method mirrors the MetaTemplate string parser's state machine. It processes each character through the trie, tracking pattern start matching, content capture, and pattern end matching. When a complete expression is found (start pattern + content + end pattern), it flushes any accumulated literal text as a Literal segment and pushes an Expression segment with the extracted hash, a direct reference to the trie leaf node, and the start pattern tag.

Characters that do not match any pattern are accumulated into a literal buffer and flushed as Literal segments between expressions or at the end of the string.

The resulting segment array is suitable for direct execution via `executeCompiled()` or `executeCompiledAsync()`.

## Examples

### Basic Compilation

```javascript
const libPict = require('pict');
const libPreprocessor = require('pict-template-preprocessor');

let _Pict = new libPict();
_Pict.addServiceType('PictTemplatePreprocessor', libPreprocessor);
let _Preprocessor = _Pict.instantiateServiceProvider('PictTemplatePreprocessor');

let tmpSegments = _Preprocessor.compile(
    'Hello {~D:Name~}, welcome!',
    _Pict.MetaTemplate.ParseTree
);

// tmpSegments:
// [
//     { Type: 'Literal', Value: 'Hello ' },
//     { Type: 'Expression', Hash: 'Name', Leaf: {...}, Tag: '{~D:' },
//     { Type: 'Literal', Value: ', welcome!' }
// ]
```

### Template With Multiple Expressions

```javascript
let tmpSegments = _Preprocessor.compile(
    '{~D:Record.First~} {~D:Record.Last~} ({~D:Record.Email~})',
    _Pict.MetaTemplate.ParseTree
);

// 5 segments: Literal(''), Expr(First), Literal(' '), Expr(Last), Literal(' ('), Expr(Email), Literal(')')
```

### Pure Literal Template

```javascript
let tmpSegments = _Preprocessor.compile(
    'No expressions here, just text.',
    _Pict.MetaTemplate.ParseTree
);

// 1 segment: [{ Type: 'Literal', Value: 'No expressions here, just text.' }]
```

### Empty String

```javascript
let tmpSegments = _Preprocessor.compile('', _Pict.MetaTemplate.ParseTree);
// 0 segments: []
```

## Notes

- This method does not cache the result. Caching happens in the `parseTemplate` wrapper.
- Failed pattern matches (e.g., `{~X` where X does not continue a valid trie path) are flushed as literal text.
- The Leaf reference points into the live trie. If the trie is modified after compilation, cached segments may reference stale leaves.
- Compilation cost is O(n) in the template string length, same as the original parser.

## Related

- [executeCompiled](execute-compiled.md) - Execute compiled segments synchronously
- [executeCompiledAsync](execute-compiled-async.md) - Execute compiled segments asynchronously
- [classifyEdges](classify-edges.md) - Build graph edges from compiled segments
