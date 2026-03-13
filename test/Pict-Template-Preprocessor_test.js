/*
	Unit tests for Pict Template Preprocessor
*/

const Chai = require('chai');
const Expect = Chai.expect;

const libPict = require('pict');
const libPictTemplatePreprocessor = require('../source/Pict-Template-Preprocessor.js');

/**
 * Helper: create a Pict instance with the preprocessor service type registered and instantiated.
 * @return {{ Pict: Object, Preprocessor: Object }}
 */
function createPictWithPreprocessor()
{
	let tmpPict = new libPict();
	tmpPict.addServiceType('PictTemplatePreprocessor', libPictTemplatePreprocessor);
	let tmpPreprocessor = tmpPict.instantiateServiceProviderWithoutRegistration('PictTemplatePreprocessor');
	return { Pict: tmpPict, Preprocessor: tmpPreprocessor };
}

suite
(
	'Pict Template Preprocessor',
	() =>
	{
		setup(() => { });

		suite
		(
			'Compile',
			() =>
			{
				test
				(
					'Compile a plain string with no expressions',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						let tmpSegments = _Preprocessor.compile('Hello World', _Pict.MetaTemplate.ParseTree);

						Expect(tmpSegments).to.be.an('array');
						Expect(tmpSegments.length).to.equal(1);
						Expect(tmpSegments[0].Type).to.equal('Literal');
						Expect(tmpSegments[0].Value).to.equal('Hello World');

						_Preprocessor.unwrapTemplateFunctions();
						return fDone();
					}
				);

				test
				(
					'Compile a string with a single data expression',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						let tmpSegments = _Preprocessor.compile('Hello {~D:Name~}!', _Pict.MetaTemplate.ParseTree);

						Expect(tmpSegments).to.be.an('array');
						Expect(tmpSegments.length).to.equal(3);

						Expect(tmpSegments[0].Type).to.equal('Literal');
						Expect(tmpSegments[0].Value).to.equal('Hello ');

						Expect(tmpSegments[1].Type).to.equal('Expression');
						Expect(tmpSegments[1].Hash).to.equal('Name');
						Expect(tmpSegments[1].Tag).to.equal('{~D:');

						Expect(tmpSegments[2].Type).to.equal('Literal');
						Expect(tmpSegments[2].Value).to.equal('!');

						_Preprocessor.unwrapTemplateFunctions();
						return fDone();
					}
				);

				test
				(
					'Compile a string with multiple expressions',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						let tmpSegments = _Preprocessor.compile('{~D:First~} and {~D:Second~}', _Pict.MetaTemplate.ParseTree);

						Expect(tmpSegments).to.be.an('array');
						Expect(tmpSegments.length).to.equal(3);

						Expect(tmpSegments[0].Type).to.equal('Expression');
						Expect(tmpSegments[0].Hash).to.equal('First');

						Expect(tmpSegments[1].Type).to.equal('Literal');
						Expect(tmpSegments[1].Value).to.equal(' and ');

						Expect(tmpSegments[2].Type).to.equal('Expression');
						Expect(tmpSegments[2].Hash).to.equal('Second');

						_Preprocessor.unwrapTemplateFunctions();
						return fDone();
					}
				);

				test
				(
					'Compile a string with no content produces empty array',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						let tmpSegments = _Preprocessor.compile('', _Pict.MetaTemplate.ParseTree);
						Expect(tmpSegments).to.be.an('array');
						Expect(tmpSegments.length).to.equal(0);

						_Preprocessor.unwrapTemplateFunctions();
						return fDone();
					}
				);

				test
				(
					'Compile a string with adjacent expressions (no literal between)',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						let tmpSegments = _Preprocessor.compile('{~D:A~}{~D:B~}', _Pict.MetaTemplate.ParseTree);

						Expect(tmpSegments).to.be.an('array');
						Expect(tmpSegments.length).to.equal(2);
						Expect(tmpSegments[0].Type).to.equal('Expression');
						Expect(tmpSegments[0].Hash).to.equal('A');
						Expect(tmpSegments[1].Type).to.equal('Expression');
						Expect(tmpSegments[1].Hash).to.equal('B');

						_Preprocessor.unwrapTemplateFunctions();
						return fDone();
					}
				);
			}
		);

		suite
		(
			'Execute Compiled (Sync)',
			() =>
			{
				test
				(
					'Execute compiled template matches direct parse output',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						let tmpTemplate = 'Hello {~D:Record.Name~}, you are {~D:Record.Age~} years old.';
						let tmpData = { Name: 'Alice', Age: 30 };

						// Get the expected output from the original parser
						let tmpExpected = _Preprocessor._originalParseTemplate(tmpTemplate, tmpData);

						// Get the output from the preprocessor fast path
						let tmpSegments = _Preprocessor.compile(tmpTemplate, _Pict.MetaTemplate.ParseTree);
						let tmpResult = _Preprocessor.executeCompiled(tmpSegments, tmpData, null, null, null);

						Expect(tmpResult).to.equal(tmpExpected);

						_Preprocessor.unwrapTemplateFunctions();
						return fDone();
					}
				);

				test
				(
					'Execute compiled template with default values',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						let tmpTemplate = '{~D:Record.Missing:fallback~}';
						let tmpData = {};

						let tmpExpected = _Preprocessor._originalParseTemplate(tmpTemplate, tmpData);
						let tmpSegments = _Preprocessor.compile(tmpTemplate, _Pict.MetaTemplate.ParseTree);
						let tmpResult = _Preprocessor.executeCompiled(tmpSegments, tmpData, null, null, null);

						Expect(tmpResult).to.equal(tmpExpected);

						_Preprocessor.unwrapTemplateFunctions();
						return fDone();
					}
				);

				test
				(
					'Transparent wrapper produces correct output',
					(fDone) =>
					{
						let _Pict = new libPict();

						// Get expected output BEFORE installing wrapper
						let tmpTemplate = 'Name: {~D:Record.Name~}';
						let tmpData = { Name: 'Bob' };
						let tmpExpected = _Pict.parseTemplate(tmpTemplate, tmpData);

						// Now create preprocessor (installs wrappers)
						_Pict.addServiceType('PictTemplatePreprocessor', libPictTemplatePreprocessor);
						let _Preprocessor = _Pict.instantiateServiceProviderWithoutRegistration('PictTemplatePreprocessor');

						// Parse through the wrapper
						let tmpResult = _Pict.parseTemplate(tmpTemplate, tmpData);

						Expect(tmpResult).to.equal(tmpExpected);

						// Verify the template was cached
						Expect(_Preprocessor.cache.has(tmpTemplate)).to.be.true;

						// Parse again - should hit cache
						let tmpResult2 = _Pict.parseTemplate(tmpTemplate, { Name: 'Charlie' });
						Expect(tmpResult2).to.equal('Name: Charlie');

						// Verify cache was reused (same compiled object)
						let tmpCached = _Preprocessor.cache.get(tmpTemplate);
						Expect(tmpCached).to.be.an('array');

						_Preprocessor.unwrapTemplateFunctions();
						return fDone();
					}
				);

				test
				(
					'Empty string and null handled gracefully',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						Expect(_Pict.parseTemplate('', {})).to.equal('');
						Expect(_Pict.parseTemplate(null, {})).to.equal('');

						_Preprocessor.unwrapTemplateFunctions();
						return fDone();
					}
				);
			}
		);

		suite
		(
			'Execute Compiled (Async)',
			() =>
			{
				test
				(
					'Async execution matches sync output',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						let tmpTemplate = 'Hello {~D:Record.Name~}!';
						let tmpData = { Name: 'Dave' };

						let tmpSyncResult = _Pict.parseTemplate(tmpTemplate, tmpData);

						_Pict.parseTemplate(tmpTemplate, tmpData,
							(pError, pResult) =>
							{
								Expect(pError).to.not.be.ok;
								Expect(pResult).to.equal(tmpSyncResult);

								_Preprocessor.unwrapTemplateFunctions();
								return fDone();
							});
					}
				);
			}
		);

		suite
		(
			'Template By Hash',
			() =>
			{
				test
				(
					'parseTemplateByHash works through preprocessor',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						_Pict.TemplateProvider.addTemplate('Greeting', 'Hello {~D:Record.Name~}!');

						let tmpResult = _Pict.parseTemplateByHash('Greeting', { Name: 'Eve' });
						Expect(tmpResult).to.equal('Hello Eve!');

						_Preprocessor.unwrapTemplateFunctions();
						return fDone();
					}
				);

				test
				(
					'parseTemplateByHash populates graph with source template',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						_Pict.TemplateProvider.addTemplate('UserCard', 'Name: {~D:Record.Name~}, Age: {~D:Record.Age~}');

						_Pict.parseTemplateByHash('UserCard', { Name: 'Frank', Age: 25 });

						let tmpNodes = _Preprocessor.graph.getNodes();
						Expect(tmpNodes['template:UserCard']).to.be.an('object');
						Expect(tmpNodes['data:Record.Name']).to.be.an('object');
						Expect(tmpNodes['data:Record.Age']).to.be.an('object');

						let tmpEdges = _Preprocessor.graph.getEdgesFrom('template:UserCard');
						Expect(tmpEdges.length).to.equal(2);

						_Preprocessor.unwrapTemplateFunctions();
						return fDone();
					}
				);
			}
		);

		suite
		(
			'Graph',
			() =>
			{
				test
				(
					'Graph captures template-to-template edges',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						_Pict.TemplateProvider.addTemplate('Header', '<h1>{~D:Record.Title~}</h1>');
						_Pict.TemplateProvider.addTemplate('Page', '{~T:Header:Record~} <p>{~D:Record.Body~}</p>');

						_Pict.parseTemplateByHash('Page', { Title: 'Test', Body: 'Content' });

						let tmpEdges = _Preprocessor.graph.getEdgesFrom('template:Page');
						let tmpTemplateEdges = tmpEdges.filter((pEdge) => { return pEdge.Type === 'renders'; });
						Expect(tmpTemplateEdges.length).to.equal(1);
						Expect(tmpTemplateEdges[0].To).to.equal('template:Header');

						_Preprocessor.unwrapTemplateFunctions();
						return fDone();
					}
				);

				test
				(
					'Graph captures entity edges',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						let tmpSegments = _Preprocessor.compile('{~E:City^Record.CityID^CityName~}', _Pict.MetaTemplate.ParseTree);
						_Preprocessor.classifyEdges(tmpSegments, 'ItemRow');

						let tmpEdges = _Preprocessor.graph.getEdgesFrom('template:ItemRow');
						Expect(tmpEdges.length).to.equal(3);

						let tmpEntityEdge = tmpEdges.find((pEdge) => { return pEdge.Type === 'reads-entity'; });
						Expect(tmpEntityEdge).to.be.an('object');
						Expect(tmpEntityEdge.To).to.equal('entity:City');

						let tmpDataEdge = tmpEdges.find((pEdge) => { return pEdge.Type === 'reads'; });
						Expect(tmpDataEdge).to.be.an('object');
						Expect(tmpDataEdge.To).to.equal('data:Record.CityID');

						let tmpRenderEdge = tmpEdges.find((pEdge) => { return pEdge.Type === 'renders'; });
						Expect(tmpRenderEdge).to.be.an('object');
						Expect(tmpRenderEdge.To).to.equal('template:CityName');

						_Preprocessor.unwrapTemplateFunctions();
						return fDone();
					}
				);

				test
				(
					'Graph deduplicates edges',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						_Preprocessor.graph.addNode('template', 'A');
						_Preprocessor.graph.addNode('data', 'X');
						_Preprocessor.graph.addEdge('template:A', 'data:X', 'reads');
						_Preprocessor.graph.addEdge('template:A', 'data:X', 'reads');

						Expect(_Preprocessor.graph.getEdges().length).to.equal(1);

						_Preprocessor.unwrapTemplateFunctions();
						return fDone();
					}
				);

				test
				(
					'Graph toJSON returns serializable data',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						_Preprocessor.graph.addNode('template', 'Page');
						_Preprocessor.graph.addNode('data', 'Record.Name');
						_Preprocessor.graph.addEdge('template:Page', 'data:Record.Name', 'reads');

						let tmpJSON = _Preprocessor.graph.toJSON();
						Expect(tmpJSON.Nodes).to.be.an('array');
						Expect(tmpJSON.Nodes.length).to.equal(2);
						Expect(tmpJSON.Edges).to.be.an('array');
						Expect(tmpJSON.Edges.length).to.equal(1);

						// Verify it's serializable
						let tmpSerialized = JSON.stringify(tmpJSON);
						Expect(tmpSerialized).to.be.a('string');

						_Preprocessor.unwrapTemplateFunctions();
						return fDone();
					}
				);

				test
				(
					'Graph toDOT produces valid DOT format',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						_Preprocessor.graph.addNode('template', 'Page');
						_Preprocessor.graph.addNode('data', 'Record.Name');
						_Preprocessor.graph.addEdge('template:Page', 'data:Record.Name', 'reads');

						let tmpDOT = _Preprocessor.graph.toDOT();
						Expect(tmpDOT).to.contain('digraph TemplateGraph');
						Expect(tmpDOT).to.contain('->');
						Expect(tmpDOT).to.contain('reads');

						_Preprocessor.unwrapTemplateFunctions();
						return fDone();
					}
				);

				test
				(
					'Graph getEdgesTo returns incoming edges',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						_Preprocessor.graph.addNode('template', 'A');
						_Preprocessor.graph.addNode('template', 'B');
						_Preprocessor.graph.addNode('template', 'C');
						_Preprocessor.graph.addEdge('template:A', 'template:C', 'renders');
						_Preprocessor.graph.addEdge('template:B', 'template:C', 'renders');

						let tmpIncoming = _Preprocessor.graph.getEdgesTo('template:C');
						Expect(tmpIncoming.length).to.equal(2);

						_Preprocessor.unwrapTemplateFunctions();
						return fDone();
					}
				);
			}
		);

		suite
		(
			'Cache',
			() =>
			{
				test
				(
					'Cache returns same compiled object on second parse',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						let tmpTemplate = 'Hi {~D:Record.Name~}';
						_Pict.parseTemplate(tmpTemplate, { Name: 'A' });

						let tmpCached1 = _Preprocessor.cache.get(tmpTemplate);

						_Pict.parseTemplate(tmpTemplate, { Name: 'B' });

						let tmpCached2 = _Preprocessor.cache.get(tmpTemplate);

						// Same object reference — not recompiled
						Expect(tmpCached1).to.equal(tmpCached2);

						_Preprocessor.unwrapTemplateFunctions();
						return fDone();
					}
				);

				test
				(
					'clearCache empties the cache',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						_Pict.parseTemplate('Hi {~D:Record.Name~}', { Name: 'Test' });
						Expect(_Preprocessor.cache.size).to.equal(1);

						_Preprocessor.clearCache();
						Expect(_Preprocessor.cache.size).to.equal(0);

						_Preprocessor.unwrapTemplateFunctions();
						return fDone();
					}
				);
			}
		);

		suite
		(
			'Unwrap',
			() =>
			{
				test
				(
					'unwrapTemplateFunctions restores original methods',
					(fDone) =>
					{
						let _Pict = new libPict();
						let tmpOriginalParseTemplate = _Pict.parseTemplate;

						_Pict.addServiceType('PictTemplatePreprocessor', libPictTemplatePreprocessor);
						let _Preprocessor = _Pict.instantiateServiceProviderWithoutRegistration('PictTemplatePreprocessor');

						// Methods should be wrapped now
						Expect(_Pict.parseTemplate).to.not.equal(tmpOriginalParseTemplate);

						_Preprocessor.unwrapTemplateFunctions();

						// Methods should be restored
						// Note: the original was bound, so we just verify it works
						let tmpResult = _Pict.parseTemplate('Plain text', {});
						Expect(tmpResult).to.equal('Plain text');

						return fDone();
					}
				);
			}
		);

		suite
		(
			'Custom Classifiers',
			() =>
			{
				test
				(
					'Custom edge classifier is used for custom tags',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						_Preprocessor.addEdgeClassifier('{~Custom:',
							(pHash) =>
							{
								return [{ EdgeType: 'custom-ref', NodeType: 'custom', NodeID: pHash.trim() }];
							});

						// Manually create a segment to test the classifier
						let tmpSegments = [
							{ Type: 'Expression', Hash: 'MyThing', Tag: '{~Custom:', Leaf: {} }
						];

						_Preprocessor.classifyEdges(tmpSegments, 'TestTemplate');

						let tmpEdges = _Preprocessor.graph.getEdgesFrom('template:TestTemplate');
						Expect(tmpEdges.length).to.equal(1);
						Expect(tmpEdges[0].Type).to.equal('custom-ref');
						Expect(tmpEdges[0].To).to.equal('custom:MyThing');

						_Preprocessor.unwrapTemplateFunctions();
						return fDone();
					}
				);
			}
		);

		suite
		(
			'Entity Prefetch',
			() =>
			{
				test
				(
					'Collect entity expressions from compiled segments',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						let tmpSegments = _Preprocessor.compile(
							'{~E:City^Record.IDCity^CityDisplay~} lives in {~E:State^Record.IDState^StateDisplay~}',
							_Pict.MetaTemplate.ParseTree);

						let tmpPlans = _Preprocessor._collectEntityExpressions(tmpSegments);

						Expect(tmpPlans).to.be.an('array');
						Expect(tmpPlans.length).to.equal(2);
						Expect(tmpPlans[0].EntityType).to.equal('City');
						Expect(tmpPlans[0].IDAddress).to.equal('Record.IDCity');
						Expect(tmpPlans[1].EntityType).to.equal('State');
						Expect(tmpPlans[1].IDAddress).to.equal('Record.IDState');

						_Preprocessor.unwrapTemplateFunctions();
						return fDone();
					}
				);

				test
				(
					'Collect entity expressions returns empty for non-entity templates',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						let tmpSegments = _Preprocessor.compile(
							'Name: {~D:Record.Name~}',
							_Pict.MetaTemplate.ParseTree);

						let tmpPlans = _Preprocessor._collectEntityExpressions(tmpSegments);
						Expect(tmpPlans).to.be.an('array');
						Expect(tmpPlans.length).to.equal(0);

						_Preprocessor.unwrapTemplateFunctions();
						return fDone();
					}
				);

				test
				(
					'Collect entity expressions deep through template references',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						// Set up templates: parent references child which has entity expressions
						_Pict.TemplateProvider.addTemplate('ItemRow', '{~D:Record.Name~} - {~T:ItemDetail:Record~}');
						_Pict.TemplateProvider.addTemplate('ItemDetail', 'City: {~E:City^Record.IDCity^CityName~}');

						let tmpTemplateString = _Pict.TemplateProvider.getTemplate('ItemRow');
						let tmpPlans = _Preprocessor._collectEntityExpressionsDeep(tmpTemplateString, 1);

						Expect(tmpPlans).to.be.an('array');
						Expect(tmpPlans.length).to.equal(1);
						Expect(tmpPlans[0].EntityType).to.equal('City');
						Expect(tmpPlans[0].IDAddress).to.equal('Record.IDCity');

						_Preprocessor.unwrapTemplateFunctions();
						return fDone();
					}
				);

				test
				(
					'Deep scan follows TemplateIf branches',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						// Parent uses two TemplateIf expressions referencing child templates with entity lookups
						_Pict.TemplateProvider.addTemplate('ConditionalRow',
							'{~TIf:CityView:Record:Record.Active^EQ^true~}{~TIf:StateView:Record:Record.ShowState^EQ^true~}');
						_Pict.TemplateProvider.addTemplate('CityView', '{~E:City^Record.IDCity^CityInfo~}');
						_Pict.TemplateProvider.addTemplate('StateView', '{~E:State^Record.IDState^StateInfo~}');

						let tmpTemplateString = _Pict.TemplateProvider.getTemplate('ConditionalRow');
						let tmpPlans = _Preprocessor._collectEntityExpressionsDeep(tmpTemplateString, 1);

						// Should find entity expressions from both conditional branches
						Expect(tmpPlans.length).to.equal(2);

						let tmpCityPlan = tmpPlans.find((pPlan) => { return pPlan.EntityType === 'City'; });
						let tmpStatePlan = tmpPlans.find((pPlan) => { return pPlan.EntityType === 'State'; });
						Expect(tmpCityPlan).to.be.an('object');
						Expect(tmpStatePlan).to.be.an('object');

						_Preprocessor.unwrapTemplateFunctions();
						return fDone();
					}
				);

				test
				(
					'Resolve entity ID from Record address',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						let tmpRecord = { IDCity: 42, Nested: { IDState: 7 } };

						Expect(_Preprocessor._resolveEntityID('Record.IDCity', tmpRecord)).to.equal(42);
						Expect(_Preprocessor._resolveEntityID('Record.Nested.IDState', tmpRecord)).to.equal(7);
						Expect(_Preprocessor._resolveEntityID('Record.Missing', tmpRecord)).to.equal(undefined);

						_Preprocessor.unwrapTemplateFunctions();
						return fDone();
					}
				);

				test
				(
					'Resolve entity ID from AppData address',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						_Pict.AppData.CurrentCityID = 99;

						Expect(_Preprocessor._resolveEntityID('AppData.CurrentCityID', {})).to.equal(99);

						_Preprocessor.unwrapTemplateFunctions();
						return fDone();
					}
				);

				test
				(
					'Resolve entity ID from Scope address',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						let tmpScope = { IDCity: 55 };

						Expect(_Preprocessor._resolveEntityID('Scope.IDCity', {}, null, tmpScope)).to.equal(55);

						_Preprocessor.unwrapTemplateFunctions();
						return fDone();
					}
				);

				test
				(
					'Resolve entity ID from Context address',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						let tmpContextArray = [{ IDCity: 77 }, { IDState: 88 }];

						Expect(_Preprocessor._resolveEntityID('Context[0].IDCity', {}, tmpContextArray)).to.equal(77);
						Expect(_Preprocessor._resolveEntityID('Context[1].IDState', {}, tmpContextArray)).to.equal(88);
						Expect(_Preprocessor._resolveEntityID('Context[5].Missing', {}, tmpContextArray)).to.equal(null);

						_Preprocessor.unwrapTemplateFunctions();
						return fDone();
					}
				);

				test
				(
					'Resolve entity ID returns null for invalid inputs',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						Expect(_Preprocessor._resolveEntityID('Scope.X', {}, null, null)).to.equal(null);
						Expect(_Preprocessor._resolveEntityID('Record.X', null)).to.equal(null);

						_Preprocessor.unwrapTemplateFunctions();
						return fDone();
					}
				);

				test
				(
					'prefetchEntitiesForSet calls EntityProvider.getEntitySet with correct filter',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						// Set up a template with entity expression
						_Pict.TemplateProvider.addTemplate('CityName', '{~D:Record.Name~}');

						// Mock the EntityProvider.getEntitySet
						let tmpFetchCalls = [];
						_Pict.EntityProvider.getEntitySet = function(pEntity, pFilter, fCallback)
						{
							tmpFetchCalls.push({ Entity: pEntity, Filter: pFilter });
							// Return fake entity records
							let tmpRecords = [
								{ IDCity: 1, Name: 'New York' },
								{ IDCity: 2, Name: 'Los Angeles' },
								{ IDCity: 3, Name: 'Chicago' }
							];
							// Manually cache them
							_Pict.EntityProvider.cacheIndividualEntityRecords(pEntity, tmpRecords);
							return fCallback(null, tmpRecords);
						};

						let tmpTemplate = 'City: {~E:City^Record.IDCity^CityName~}';
						let tmpDataSet = [
							{ IDCity: 1 },
							{ IDCity: 2 },
							{ IDCity: 3 },
							{ IDCity: 1 }  // duplicate, should not cause duplicate fetch
						];

						_Preprocessor.prefetchEntitiesForSet(tmpTemplate, tmpDataSet,
							(pError) =>
							{
								Expect(pError).to.not.be.ok;
								Expect(tmpFetchCalls.length).to.equal(1);
								Expect(tmpFetchCalls[0].Entity).to.equal('City');
								Expect(tmpFetchCalls[0].Filter).to.contain('FBL~IDCity~INN~');
								// Verify all 3 unique IDs were included
								Expect(tmpFetchCalls[0].Filter).to.contain('1');
								Expect(tmpFetchCalls[0].Filter).to.contain('2');
								Expect(tmpFetchCalls[0].Filter).to.contain('3');

								// Verify cache was populated
								let tmpCached = _Pict.EntityProvider.recordCache['City'].read(1);
								Expect(tmpCached).to.be.an('object');
								Expect(tmpCached.Name).to.equal('New York');

								_Preprocessor.unwrapTemplateFunctions();
								return fDone();
							});
					}
				);

				test
				(
					'prefetchEntitiesForSet handles multiple entity types',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						// Mock EntityProvider.getEntitySet
						let tmpFetchCalls = [];
						_Pict.EntityProvider.getEntitySet = function(pEntity, pFilter, fCallback)
						{
							tmpFetchCalls.push({ Entity: pEntity, Filter: pFilter });
							if (pEntity === 'City')
							{
								let tmpRecords = [{ IDCity: 1, Name: 'NYC' }];
								_Pict.EntityProvider.cacheIndividualEntityRecords(pEntity, tmpRecords);
								return fCallback(null, tmpRecords);
							}
							if (pEntity === 'State')
							{
								let tmpRecords = [{ IDState: 10, Name: 'NY' }];
								_Pict.EntityProvider.cacheIndividualEntityRecords(pEntity, tmpRecords);
								return fCallback(null, tmpRecords);
							}
							return fCallback(null, []);
						};

						let tmpTemplate = '{~E:City^Record.IDCity^CityName~} in {~E:State^Record.IDState^StateName~}';
						let tmpDataSet = [{ IDCity: 1, IDState: 10 }];

						_Preprocessor.prefetchEntitiesForSet(tmpTemplate, tmpDataSet,
							(pError) =>
							{
								Expect(pError).to.not.be.ok;
								Expect(tmpFetchCalls.length).to.equal(2);

								let tmpCityCall = tmpFetchCalls.find((pCall) => { return pCall.Entity === 'City'; });
								let tmpStateCall = tmpFetchCalls.find((pCall) => { return pCall.Entity === 'State'; });
								Expect(tmpCityCall).to.be.an('object');
								Expect(tmpStateCall).to.be.an('object');

								_Preprocessor.unwrapTemplateFunctions();
								return fDone();
							});
					}
				);

				test
				(
					'prefetchEntitiesForSet skips already-cached entities',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						// Pre-populate cache with City ID 1
						_Pict.EntityProvider.cacheIndividualEntityRecords('City',
							[{ IDCity: 1, Name: 'Pre-cached NYC' }]);

						// Mock EntityProvider.getEntitySet
						let tmpFetchCalls = [];
						_Pict.EntityProvider.getEntitySet = function(pEntity, pFilter, fCallback)
						{
							tmpFetchCalls.push({ Entity: pEntity, Filter: pFilter });
							let tmpRecords = [{ IDCity: 2, Name: 'LA' }];
							_Pict.EntityProvider.cacheIndividualEntityRecords(pEntity, tmpRecords);
							return fCallback(null, tmpRecords);
						};

						let tmpTemplate = '{~E:City^Record.IDCity^CityName~}';
						let tmpDataSet = [{ IDCity: 1 }, { IDCity: 2 }];

						_Preprocessor.prefetchEntitiesForSet(tmpTemplate, tmpDataSet,
							(pError) =>
							{
								Expect(pError).to.not.be.ok;
								// Only ID 2 should be fetched; ID 1 was already cached
								Expect(tmpFetchCalls.length).to.equal(1);
								Expect(tmpFetchCalls[0].Filter).to.not.contain(',1,');
								Expect(tmpFetchCalls[0].Filter).to.contain('2');

								_Preprocessor.unwrapTemplateFunctions();
								return fDone();
							});
					}
				);

				test
				(
					'parseTemplateSet async path triggers prefetch',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						// Mock EntityProvider.getEntitySet
						let tmpPrefetchCalled = false;
						_Pict.EntityProvider.getEntitySet = function(pEntity, pFilter, fCallback)
						{
							tmpPrefetchCalled = true;
							let tmpRecords = [
								{ IDCity: 1, Name: 'NYC' },
								{ IDCity: 2, Name: 'LA' }
							];
							_Pict.EntityProvider.cacheIndividualEntityRecords(pEntity, tmpRecords);
							return fCallback(null, tmpRecords);
						};

						let tmpTemplate = 'City: {~E:City^Record.IDCity^CityName~}';
						let tmpDataSet = [{ IDCity: 1 }, { IDCity: 2 }];

						_Pict.parseTemplateSet(tmpTemplate, tmpDataSet,
							(pError, pResult) =>
							{
								Expect(pError).to.not.be.ok;
								Expect(tmpPrefetchCalled).to.be.true;

								_Preprocessor.unwrapTemplateFunctions();
								return fDone();
							});
					}
				);

				test
				(
					'parseTemplateSet sync path works without prefetch',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						let tmpTemplate = 'Name: {~D:Record.Name~}';
						let tmpDataSet = [{ Name: 'Alice' }, { Name: 'Bob' }];

						let tmpResult = _Pict.parseTemplateSet(tmpTemplate, tmpDataSet);
						Expect(tmpResult).to.equal('Name: AliceName: Bob');

						_Preprocessor.unwrapTemplateFunctions();
						return fDone();
					}
				);

				test
				(
					'Prefetch skipped gracefully when no EntityProvider',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						// Temporarily remove EntityProvider
						let tmpSaved = _Pict.EntityProvider;
						_Pict.EntityProvider = null;

						let tmpTemplate = 'City: {~E:City^Record.IDCity^CityName~}';

						_Preprocessor.prefetchEntitiesForSet(tmpTemplate, [{ IDCity: 1 }],
							(pError) =>
							{
								Expect(pError).to.not.be.ok;

								_Pict.EntityProvider = tmpSaved;
								_Preprocessor.unwrapTemplateFunctions();
								return fDone();
							});
					}
				);

				test
				(
					'Prefetch skipped when no entity expressions in template',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						// Mock to detect any calls
						let tmpFetchCalled = false;
						_Pict.EntityProvider.getEntitySet = function(pEntity, pFilter, fCallback)
						{
							tmpFetchCalled = true;
							return fCallback(null, []);
						};

						let tmpTemplate = 'Name: {~D:Record.Name~}';

						_Preprocessor.prefetchEntitiesForSet(tmpTemplate, [{ Name: 'Test' }],
							(pError) =>
							{
								Expect(pError).to.not.be.ok;
								Expect(tmpFetchCalled).to.be.false;

								_Preprocessor.unwrapTemplateFunctions();
								return fDone();
							});
					}
				);

				test
				(
					'parseTemplateSetByHash triggers prefetch with source template hint',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						// Set up templates
						_Pict.TemplateProvider.addTemplate('CityName', '{~D:Record.Name~}');
						_Pict.TemplateProvider.addTemplate('CityRow', 'City: {~E:City^Record.IDCity^CityName~}');

						// Mock EntityProvider.getEntitySet
						let tmpFetchCalls = [];
						_Pict.EntityProvider.getEntitySet = function(pEntity, pFilter, fCallback)
						{
							tmpFetchCalls.push({ Entity: pEntity, Filter: pFilter });
							let tmpRecords = [{ IDCity: 1, Name: 'NYC' }];
							_Pict.EntityProvider.cacheIndividualEntityRecords(pEntity, tmpRecords);
							return fCallback(null, tmpRecords);
						};

						let tmpDataSet = [{ IDCity: 1 }];

						_Pict.parseTemplateSetByHash('CityRow', tmpDataSet,
							(pError, pResult) =>
							{
								Expect(pError).to.not.be.ok;
								Expect(tmpFetchCalls.length).to.equal(1);
								Expect(tmpFetchCalls[0].Entity).to.equal('City');

								_Preprocessor.unwrapTemplateFunctions();
								return fDone();
							});
					}
				);

				test
				(
					'getRecordsFromDataSet handles both Arrays and Objects',
					(fDone) =>
					{
						let { Pict: _Pict, Preprocessor: _Preprocessor } = createPictWithPreprocessor();

						let tmpArray = [{ a: 1 }, { b: 2 }];
						let tmpObject = { key1: { a: 1 }, key2: { b: 2 } };

						let tmpFromArray = _Preprocessor._getRecordsFromDataSet(tmpArray);
						Expect(tmpFromArray).to.be.an('array');
						Expect(tmpFromArray.length).to.equal(2);

						let tmpFromObject = _Preprocessor._getRecordsFromDataSet(tmpObject);
						Expect(tmpFromObject).to.be.an('array');
						Expect(tmpFromObject.length).to.equal(2);

						let tmpFromNull = _Preprocessor._getRecordsFromDataSet(null);
						Expect(tmpFromNull).to.be.an('array');
						Expect(tmpFromNull.length).to.equal(0);

						_Preprocessor.unwrapTemplateFunctions();
						return fDone();
					}
				);
			}
		);
	}
);
