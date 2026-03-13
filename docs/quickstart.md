# Quickstart

This guide walks through installing the preprocessor, activating it on a Pict instance, and using its three primary capabilities: compiled template caching, dependency graph inspection, and entity batch prefetch.

## Step 1: Install

```bash
npm install pict-template-preprocessor
```

The preprocessor has a single runtime dependency (`fable-serviceproviderbase`) and expects Pict to be available in the consuming project.

## Step 2: Register and Instantiate

The preprocessor follows the Fable service provider pattern. Register the service type, then instantiate it. The constructor automatically wraps Pict's template methods.

```javascript
const libPict = require('pict');
const libPreprocessor = require('pict-template-preprocessor');

// Create Pict
let _Pict = new libPict({
	Product: 'MyApp',
	ProductVersion: '1.0.0'
});

// Register and instantiate -- wrappers install automatically
_Pict.addServiceType('PictTemplatePreprocessor', libPreprocessor);
let _Preprocessor = _Pict.instantiateServiceProvider('PictTemplatePreprocessor');
```

From this point forward, every call to `_Pict.parseTemplate()`, `_Pict.parseTemplateByHash()`, `_Pict.parseTemplateSet()`, and `_Pict.parseTemplateSetByHash()` goes through the preprocessor's compiled fast path.

## Step 3: Use Templates Normally

No changes to template usage are required. The preprocessor is transparent:

```javascript
// First render: compiles template into segments, caches, then executes
_Pict.AppData.UserName = 'Alice';
let tmpResult = _Pict.parseTemplate('Hello {~D:AppData.UserName~}!');
// => "Hello Alice!"

// Second render: cache hit, executes segments directly (no trie walk)
_Pict.AppData.UserName = 'Bob';
let tmpResult2 = _Pict.parseTemplate('Hello {~D:AppData.UserName~}!');
// => "Hello Bob!"
```

## Step 4: Inspect the Dependency Graph

As templates are compiled, the preprocessor builds a directed graph of their dependencies. This is useful for understanding template hierarchies, finding unused data paths, and visualizing application structure.

```javascript
// Register some named templates
_Pict.TemplateProvider.addTemplate('Header', '<h1>{~D:Record.Title~}</h1>');
_Pict.TemplateProvider.addTemplate('Page', '{~T:Header:Record~}<p>{~D:Record.Body~}</p>');

// Render through parseTemplateByHash to populate graph edges
_Pict.parseTemplateByHash('Page', { Title: 'Hello', Body: 'World' });

// Query the graph
let tmpGraph = _Preprocessor.graph;
let tmpJSON = tmpGraph.toJSON();
console.log(JSON.stringify(tmpJSON, null, 2));
// {
//   "Nodes": [
//     { "Key": "template:Page", "Type": "template", "ID": "Page" },
//     { "Key": "template:Header", "Type": "template", "ID": "Header" },
//     { "Key": "data:Record", "Type": "data", "ID": "Record" },
//     { "Key": "data:Record.Title", "Type": "data", "ID": "Record.Title" },
//     { "Key": "data:Record.Body", "Type": "data", "ID": "Record.Body" }
//   ],
//   "Edges": [
//     { "From": "template:Page", "To": "template:Header", "Type": "renders" },
//     { "From": "template:Page", "To": "data:Record", "Type": "reads" },
//     ...
//   ]
// }

// Export as Graphviz DOT for rendering with `dot -Tpng graph.dot -o graph.png`
let tmpDOT = tmpGraph.toDOT();
console.log(tmpDOT);
```

## Step 5: Entity Batch Prefetch

If your templates use `{~Entity:~}` expressions inside TemplateSet iterations, the preprocessor automatically batch-fetches entities before the loop runs. This requires:

1. Pict's EntityProvider to be configured with REST endpoints
2. Async rendering (the sync path cannot perform async I/O)

```javascript
// Register a template that fetches entities per-record
_Pict.TemplateProvider.addTemplate('BookRow',
	'<tr><td>{~D:Record.Title~}</td><td>{~E:Author^Record.IDAuthor^AuthorName~}</td></tr>');

// Async TemplateSet rendering triggers prefetch
let tmpBooks = [
	{ Title: 'Book A', IDAuthor: 1 },
	{ Title: 'Book B', IDAuthor: 2 },
	{ Title: 'Book C', IDAuthor: 1 },
	{ Title: 'Book D', IDAuthor: 3 }
];

_Pict.parseTemplateSetByHash('BookRow', tmpBooks,
	(pError, pOutput) =>
	{
		// Before iteration, the preprocessor fetched Authors 1, 2, 3
		// in a single batch request: /1.0/Authors/FilteredTo/FBL~IDAuthor~INN~1,2,3
		// Individual {~E:~} renders now hit the cache instead of making HTTP calls
		console.log(pOutput);
	});
```

## Step 6: Clean Up (Optional)

If you need to remove the preprocessor wrappers and restore original Pict behavior:

```javascript
// Clear cached compilations and graph data
_Preprocessor.clear();

// Remove wrappers, restore original parseTemplate methods
_Preprocessor.unwrapTemplateFunctions();
```

## Next Steps

- [Architecture & Design](architecture.md) - How the trie state machine, segment compilation, and graph population work internally
- [Implementation Reference](implementation-reference.md) - Behavioral details, edge cases, and interaction with Pict-Template-Audit
- [API Reference](api/compile.md) - Per-function documentation with parameters, return values, and examples
