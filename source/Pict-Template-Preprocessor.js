/**
* Pict Template Preprocessor
* @author      Steven Velozo <steven@velozo.com>
* @description Compiles template strings into cached segment arrays for fast-path execution,
*              and builds an expression dependency graph for visualization and analysis.
*/

const libFableServiceBase = require('fable-serviceproviderbase');
const libTemplateGraph = require('./Pict-Template-Preprocessor-Graph.js');

class PictTemplatePreprocessor extends libFableServiceBase
{
	/**
	 * @param {Object} pFable - The Fable/Pict Framework instance
	 * @param {Object} pOptions - The options for the service
	 * @param {String} pServiceHash - The hash of the service
	 */
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'PictTemplatePreprocessor';

		/** @type {Map<string, Array<Object>>} */
		this.cache = new Map();

		this.graph = new libTemplateGraph();

		// Edge classifiers: map of PatternStartString → function(hash) → array of { type, nodeType, nodeID }
		this._EdgeClassifiers = {};
		this._initializeDefaultClassifiers();

		this._installWrappers();
	}

	// -- Edge Classifiers --

	/**
	 * Register default edge classifiers for built-in template expression types.
	 * @private
	 */
	_initializeDefaultClassifiers()
	{
		// Template references: {~Template:TemplateName:DataAddress~} or {~T:...~}
		let fTemplateClassifier = (pHash) =>
		{
			let tmpParts = pHash.split(':');
			let tmpTemplateName = tmpParts[0].trim();
			if (!tmpTemplateName)
			{
				return [];
			}
			return [{ EdgeType: 'renders', NodeType: 'template', NodeID: tmpTemplateName }];
		};
		this._EdgeClassifiers['{~Template:'] = fTemplateClassifier;
		this._EdgeClassifiers['{~T:'] = fTemplateClassifier;

		// TemplateSet references
		let fTemplateSetClassifier = (pHash) =>
		{
			let tmpParts = pHash.split(':');
			let tmpTemplateName = tmpParts[0].trim();
			if (!tmpTemplateName)
			{
				return [];
			}
			return [{ EdgeType: 'renders-set', NodeType: 'template', NodeID: tmpTemplateName }];
		};
		this._EdgeClassifiers['{~TemplateSet:'] = fTemplateSetClassifier;
		this._EdgeClassifiers['{~TS:'] = fTemplateSetClassifier;

		// TemplateIf references
		let fTemplateIfClassifier = (pHash) =>
		{
			let tmpParts = pHash.split(':');
			let tmpTemplateName = tmpParts[0].trim();
			if (!tmpTemplateName)
			{
				return [];
			}
			let tmpEdges = [{ EdgeType: 'renders-if', NodeType: 'template', NodeID: tmpTemplateName }];
			// Also extract data addresses from comparison (third part)
			if (tmpParts.length >= 3)
			{
				let tmpComparisonParts = tmpParts[2].split('^');
				if (tmpComparisonParts.length >= 3)
				{
					tmpEdges.push({ EdgeType: 'reads', NodeType: 'data', NodeID: tmpComparisonParts[0].trim() });
					tmpEdges.push({ EdgeType: 'reads', NodeType: 'data', NodeID: tmpComparisonParts[2].trim() });
				}
			}
			return tmpEdges;
		};
		this._EdgeClassifiers['{~TemplateIf:'] = fTemplateIfClassifier;
		this._EdgeClassifiers['{~TIf:'] = fTemplateIfClassifier;

		// TemplateIfElse references
		let fTemplateIfElseClassifier = (pHash) =>
		{
			let tmpParts = pHash.split(':');
			let tmpEdges = [];
			if (tmpParts[0])
			{
				tmpEdges.push({ EdgeType: 'renders-if-else', NodeType: 'template', NodeID: tmpParts[0].trim() });
			}
			if (tmpParts.length >= 4 && tmpParts[3])
			{
				tmpEdges.push({ EdgeType: 'renders-if-else', NodeType: 'template', NodeID: tmpParts[3].trim() });
			}
			return tmpEdges;
		};
		this._EdgeClassifiers['{~TemplateIfElse:'] = fTemplateIfElseClassifier;
		this._EdgeClassifiers['{~TIfE:'] = fTemplateIfElseClassifier;

		// Data references
		let fDataClassifier = (pHash) =>
		{
			let tmpAddress = pHash.split(':')[0].trim();
			if (!tmpAddress)
			{
				return [];
			}
			return [{ EdgeType: 'reads', NodeType: 'data', NodeID: tmpAddress }];
		};
		this._EdgeClassifiers['{~Data:'] = fDataClassifier;
		this._EdgeClassifiers['{~D:'] = fDataClassifier;
		this._EdgeClassifiers['{~DataJson:'] = fDataClassifier;
		this._EdgeClassifiers['{~DJ:'] = fDataClassifier;
		this._EdgeClassifiers['{~Dollars:'] = fDataClassifier;
		this._EdgeClassifiers['{~Digits:'] = fDataClassifier;
		this._EdgeClassifiers['{~DateTimeFormat:'] = fDataClassifier;
		this._EdgeClassifiers['{~PascalCaseIdentifier:'] = fDataClassifier;
		this._EdgeClassifiers['{~LogValue:'] = fDataClassifier;
		this._EdgeClassifiers['{~LogValueTree:'] = fDataClassifier;
		this._EdgeClassifiers['{~NotEmpty:'] = fDataClassifier;

		// Entity references: {~Entity:EntityType^IDAddress^TemplateHash~}
		let fEntityClassifier = (pHash) =>
		{
			let tmpParts = pHash.split('^');
			let tmpEdges = [];
			if (tmpParts.length >= 1 && tmpParts[0])
			{
				tmpEdges.push({ EdgeType: 'reads-entity', NodeType: 'entity', NodeID: tmpParts[0].trim() });
			}
			if (tmpParts.length >= 2 && tmpParts[1])
			{
				tmpEdges.push({ EdgeType: 'reads', NodeType: 'data', NodeID: tmpParts[1].trim() });
			}
			if (tmpParts.length >= 3 && tmpParts[2])
			{
				tmpEdges.push({ EdgeType: 'renders', NodeType: 'template', NodeID: tmpParts[2].trim() });
			}
			return tmpEdges;
		};
		this._EdgeClassifiers['{~Entity:'] = fEntityClassifier;
		this._EdgeClassifiers['{~E:'] = fEntityClassifier;
	}

	/**
	 * Register a custom edge classifier for a template expression tag.
	 *
	 * @param {string} pTag - The PatternStartString (e.g., '{~MyCustom:')
	 * @param {function} fClassifier - Function(hash) returning array of { EdgeType, NodeType, NodeID }
	 */
	addEdgeClassifier(pTag, fClassifier)
	{
		this._EdgeClassifiers[pTag] = fClassifier;
	}

	// -- Compile Step --

	/**
	 * Compile a template string into a segment array using the trie parse tree.
	 * Mirrors the parseCharacter state machine from MetaTemplate-StringParser
	 * but records segments instead of executing Parse functions.
	 *
	 * @param {string} pString - The template string to compile
	 * @param {Object} pParseTree - The trie root from MetaTemplate.ParseTree
	 *
	 * @return {Array<Object>} Array of segments: { Type: 'Literal', Value } or { Type: 'Expression', Hash, Leaf, Tag }
	 */
	compile(pString, pParseTree)
	{
		let tmpSegments = [];
		let tmpLiteralBuffer = '';

		// State machine - mirrors StringParser
		let tmpPattern = {};
		let tmpPatternMatch = false;
		let tmpStartPatternMatchComplete = false;
		let tmpEndPatternMatchBegan = false;
		let tmpPatternStartNode = false;
		let tmpOutputBuffer = '';

		let fFlushLiteral = () =>
		{
			if (tmpLiteralBuffer.length > 0)
			{
				tmpSegments.push({ Type: 'Literal', Value: tmpLiteralBuffer });
				tmpLiteralBuffer = '';
			}
		};

		let fRecordExpression = () =>
		{
			// Extract the hash (content between start and end tags)
			let tmpHash = tmpOutputBuffer.substr(
				tmpPattern.PatternStartString.length,
				tmpOutputBuffer.length - (tmpPattern.PatternStartString.length + tmpPattern.PatternEndString.length));

			fFlushLiteral();
			tmpSegments.push({
				Type: 'Expression',
				Hash: tmpHash,
				Leaf: tmpPattern,
				Tag: tmpPattern.PatternStartString
			});
		};

		let fResetState = () =>
		{
			tmpPattern = {};
			tmpPatternMatch = false;
			tmpStartPatternMatchComplete = false;
			tmpEndPatternMatchBegan = false;
			tmpPatternStartNode = false;
			tmpOutputBuffer = '';
		};

		for (let i = 0; i < pString.length; i++)
		{
			let tmpChar = pString[i];

			if (tmpPatternMatch)
			{
				if (!tmpStartPatternMatchComplete && (tmpChar in tmpPattern))
				{
					// Continue matching start pattern
					tmpPattern = tmpPattern[tmpChar];
					tmpOutputBuffer += tmpChar;
				}
				else if (tmpEndPatternMatchBegan)
				{
					if (tmpChar in tmpPattern.PatternEnd)
					{
						tmpPattern = tmpPattern.PatternEnd[tmpChar];
						tmpOutputBuffer += tmpChar;

						// End pattern is complete - record the expression
						fRecordExpression();
						fResetState();
						continue;
					}
					else if (tmpChar in tmpPatternStartNode.PatternEnd)
					{
						// Broke out of end, restart end matching
						tmpPattern = tmpPatternStartNode.PatternEnd[tmpChar];
						tmpOutputBuffer += tmpChar;
					}
					else
					{
						tmpEndPatternMatchBegan = false;
						tmpOutputBuffer += tmpChar;
					}
				}
				else if ('PatternEnd' in tmpPattern)
				{
					if (!tmpStartPatternMatchComplete)
					{
						tmpStartPatternMatchComplete = true;
						tmpPatternStartNode = tmpPattern;
					}

					tmpOutputBuffer += tmpChar;

					if (tmpChar in tmpPattern.PatternEnd)
					{
						tmpEndPatternMatchBegan = true;
						tmpPattern = tmpPattern.PatternEnd[tmpChar];

						// Single-char end pattern completes immediately
						if ('Parse' in tmpPattern)
						{
							fRecordExpression();
							fResetState();
							continue;
						}
					}
				}
				else
				{
					// Start pattern didn't match; flush accumulated chars as literal and retry
					tmpLiteralBuffer += tmpOutputBuffer;
					fResetState();
				}
			}

			if (!tmpPatternMatch)
			{
				if (tmpChar in pParseTree)
				{
					// Potential start of a new pattern
					// Flush any accumulated literal from a failed match
					if (tmpOutputBuffer.length > 0)
					{
						tmpLiteralBuffer += tmpOutputBuffer;
						tmpOutputBuffer = '';
					}
					tmpOutputBuffer = tmpChar;
					tmpPattern = pParseTree[tmpChar];
					tmpPatternMatch = true;
				}
				else
				{
					tmpLiteralBuffer += tmpChar;
				}
			}
		}

		// Flush any remaining content
		if (tmpOutputBuffer.length > 0)
		{
			tmpLiteralBuffer += tmpOutputBuffer;
		}
		fFlushLiteral();

		return tmpSegments;
	}

	// -- Fast-Path Execution --

	/**
	 * Execute a compiled template synchronously.
	 *
	 * @param {Array<Object>} pSegments - The compiled segment array
	 * @param {any} pData - The data for template rendering
	 * @param {Array<any>} pContextArray - Context array
	 * @param {any} pScope - Sticky scope
	 * @param {any} pState - State object
	 *
	 * @return {string} The rendered output
	 */
	executeCompiled(pSegments, pData, pContextArray, pScope, pState)
	{
		let tmpPreviousDataContext = (Array.isArray(pContextArray)) ? pContextArray : [];
		let tmpDataContext = Array.from(tmpPreviousDataContext);
		tmpDataContext.push(pData);

		let tmpOutput = '';

		for (let i = 0; i < pSegments.length; i++)
		{
			let tmpSegment = pSegments[i];
			if (tmpSegment.Type === 'Literal')
			{
				tmpOutput += tmpSegment.Value;
			}
			else
			{
				let tmpLeaf = tmpSegment.Leaf;
				let tmpContext = ('ParserContext' in tmpLeaf) ? tmpLeaf.ParserContext : false;
				let tmpResult;
				if (tmpContext)
				{
					tmpResult = tmpLeaf.Parse.call(tmpContext, tmpSegment.Hash, pData, tmpDataContext, pScope, pState);
				}
				else
				{
					tmpResult = tmpLeaf.Parse(tmpSegment.Hash, pData, tmpDataContext, pScope, pState);
				}
				// Direct concatenation matches original Pict StringParser behavior
				// (e.g., undefined → "undefined", null → "null")
				tmpOutput += tmpResult;
			}
		}

		return tmpOutput;
	}

	/**
	 * Execute a compiled template asynchronously.
	 *
	 * @param {Array<Object>} pSegments - The compiled segment array
	 * @param {any} pData - The data for template rendering
	 * @param {function} fCallback - Callback function (pError, pOutput)
	 * @param {Array<any>} pContextArray - Context array
	 * @param {any} pScope - Sticky scope
	 * @param {any} pState - State object
	 */
	executeCompiledAsync(pSegments, pData, fCallback, pContextArray, pScope, pState)
	{
		let tmpPreviousDataContext = (Array.isArray(pContextArray)) ? pContextArray : [];
		let tmpDataContext = Array.from(tmpPreviousDataContext);
		tmpDataContext.push(pData);

		let tmpAnticipate = this.fable.instantiateServiceProviderWithoutRegistration('Anticipate');
		let tmpOutputParts = new Array(pSegments.length);

		for (let i = 0; i < pSegments.length; i++)
		{
			let tmpIndex = i;
			let tmpSegment = pSegments[tmpIndex];

			if (tmpSegment.Type === 'Literal')
			{
				tmpAnticipate.anticipate(
					(fStepCallback) =>
					{
						tmpOutputParts[tmpIndex] = tmpSegment.Value;
						return fStepCallback();
					});
			}
			else
			{
				tmpAnticipate.anticipate(
					(fStepCallback) =>
					{
						let tmpLeaf = tmpSegment.Leaf;
						let tmpContext = ('ParserContext' in tmpLeaf) ? tmpLeaf.ParserContext : false;

						if (tmpLeaf.isAsync)
						{
							let fAsyncParse = tmpContext ? tmpLeaf.ParseAsync.bind(tmpContext) : tmpLeaf.ParseAsync;
							fAsyncParse(tmpSegment.Hash, pData,
								(pError, pAsyncOutput) =>
								{
									if (pError)
									{
										this.log.info(`Preprocessor ERROR: Async template error parsing ${tmpSegment.Tag}: ${pError}`);
									}
									// Force string coercion to match original Pict concatenation behavior
									// (Array.join swallows undefined/null, but the original parser
									// produces "undefined"/"null" via string concatenation)
									tmpOutputParts[tmpIndex] = '' + pAsyncOutput;
									return fStepCallback();
								}, tmpDataContext, pScope, pState);
						}
						else
						{
							let tmpResult;
							if (tmpContext)
							{
								tmpResult = tmpLeaf.Parse.call(tmpContext, tmpSegment.Hash, pData, tmpDataContext, pScope, pState);
							}
							else
							{
								tmpResult = tmpLeaf.Parse(tmpSegment.Hash, pData, tmpDataContext, pScope, pState);
							}
							// Force string coercion to match original Pict concatenation behavior
							tmpOutputParts[tmpIndex] = '' + tmpResult;
							return fStepCallback();
						}
					});
			}
		}

		tmpAnticipate.wait(
			(pError) =>
			{
				return fCallback(pError, tmpOutputParts.join(''));
			});
	}

	// -- Graph Population --

	/**
	 * Classify expression segments and add edges to the graph.
	 *
	 * @param {Array<Object>} pSegments - The compiled segment array
	 * @param {string} pSourceTemplateID - The source template identifier
	 */
	classifyEdges(pSegments, pSourceTemplateID)
	{
		if (!pSourceTemplateID)
		{
			return;
		}

		let tmpSourceKey = this.graph.addNode('template', pSourceTemplateID);

		for (let i = 0; i < pSegments.length; i++)
		{
			let tmpSegment = pSegments[i];
			if (tmpSegment.Type !== 'Expression')
			{
				continue;
			}

			let tmpClassifier = this._EdgeClassifiers[tmpSegment.Tag];
			if (!tmpClassifier)
			{
				continue;
			}

			let tmpEdges = tmpClassifier(tmpSegment.Hash);
			for (let j = 0; j < tmpEdges.length; j++)
			{
				let tmpEdge = tmpEdges[j];
				let tmpTargetKey = this.graph.addNode(tmpEdge.NodeType, tmpEdge.NodeID);
				this.graph.addEdge(tmpSourceKey, tmpTargetKey, tmpEdge.EdgeType);
			}
		}
	}

	// -- Entity Prefetch --

	/**
	 * Collect entity expressions from compiled segments.
	 *
	 * @param {Array<Object>} pSegments - The compiled segment array
	 *
	 * @return {Array<{EntityType: string, IDAddress: string}>} Array of entity expression descriptors
	 */
	_collectEntityExpressions(pSegments)
	{
		let tmpPlans = [];

		for (let i = 0; i < pSegments.length; i++)
		{
			let tmpSegment = pSegments[i];
			if (tmpSegment.Type !== 'Expression')
			{
				continue;
			}
			if (tmpSegment.Tag !== '{~E:' && tmpSegment.Tag !== '{~Entity:')
			{
				continue;
			}

			let tmpParts = tmpSegment.Hash.split('^');
			if (tmpParts.length < 2)
			{
				continue;
			}

			let tmpEntityType = tmpParts[0].trim();
			let tmpIDAddress = tmpParts[1].trim();

			if (tmpEntityType && tmpIDAddress)
			{
				tmpPlans.push({ EntityType: tmpEntityType, IDAddress: tmpIDAddress });
			}
		}

		return tmpPlans;
	}

	/**
	 * Collect entity expressions from a template and one level of referenced child templates.
	 * Compiles templates on demand if not already cached.
	 *
	 * @param {string} pTemplateString - The template string to scan
	 * @param {number} [pMaxDepth=1] - How many levels of template references to follow
	 *
	 * @return {Array<{EntityType: string, IDAddress: string}>} Array of entity expression descriptors
	 */
	_collectEntityExpressionsDeep(pTemplateString, pMaxDepth)
	{
		if (typeof pMaxDepth !== 'number')
		{
			pMaxDepth = 1;
		}

		let tmpCompiled = this.cache.get(pTemplateString);
		if (!tmpCompiled)
		{
			tmpCompiled = this.compile(pTemplateString, this.fable.MetaTemplate.ParseTree);
			this.cache.set(pTemplateString, tmpCompiled);
		}

		let tmpPlans = this._collectEntityExpressions(tmpCompiled);

		if (pMaxDepth <= 0)
		{
			return tmpPlans;
		}

		let tmpVisited = new Set();
		tmpVisited.add(pTemplateString);

		this._scanTemplateReferencesForEntities(tmpCompiled, tmpPlans, tmpVisited, pMaxDepth - 1);

		return tmpPlans;
	}

	/**
	 * Recursively scan template references in segments for entity expressions.
	 * Handles Template, TemplateIf, TemplateIfElse, and TemplateSet references.
	 *
	 * @param {Array<Object>} pSegments - The compiled segment array to scan
	 * @param {Array<Object>} pPlans - Accumulator for found entity plans
	 * @param {Set<string>} pVisited - Set of already-visited template strings to avoid cycles
	 * @param {number} pRemainingDepth - How many more levels to follow
	 * @private
	 */
	_scanTemplateReferencesForEntities(pSegments, pPlans, pVisited, pRemainingDepth)
	{
		for (let i = 0; i < pSegments.length; i++)
		{
			let tmpSegment = pSegments[i];
			if (tmpSegment.Type !== 'Expression')
			{
				continue;
			}

			let tmpTemplateNames = [];

			if (tmpSegment.Tag === '{~T:' || tmpSegment.Tag === '{~Template:')
			{
				let tmpParts = tmpSegment.Hash.split(':');
				if (tmpParts[0])
				{
					tmpTemplateNames.push(tmpParts[0].trim());
				}
			}
			else if (tmpSegment.Tag === '{~TIf:' || tmpSegment.Tag === '{~TemplateIf:')
			{
				let tmpParts = tmpSegment.Hash.split(':');
				if (tmpParts[0])
				{
					tmpTemplateNames.push(tmpParts[0].trim());
				}
			}
			else if (tmpSegment.Tag === '{~TIfE:' || tmpSegment.Tag === '{~TemplateIfElse:')
			{
				let tmpParts = tmpSegment.Hash.split(':');
				if (tmpParts[0])
				{
					tmpTemplateNames.push(tmpParts[0].trim());
				}
				if (tmpParts.length >= 4 && tmpParts[3])
				{
					tmpTemplateNames.push(tmpParts[3].trim());
				}
			}
			else if (tmpSegment.Tag === '{~TS:' || tmpSegment.Tag === '{~TemplateSet:')
			{
				let tmpParts = tmpSegment.Hash.split(':');
				if (tmpParts[0])
				{
					tmpTemplateNames.push(tmpParts[0].trim());
				}
			}

			for (let j = 0; j < tmpTemplateNames.length; j++)
			{
				let tmpTemplateName = tmpTemplateNames[j];
				let tmpChildTemplateString = this.fable.TemplateProvider.getTemplate(tmpTemplateName);

				if (!tmpChildTemplateString || pVisited.has(tmpChildTemplateString))
				{
					continue;
				}

				pVisited.add(tmpChildTemplateString);

				let tmpChildCompiled = this.cache.get(tmpChildTemplateString);
				if (!tmpChildCompiled)
				{
					tmpChildCompiled = this.compile(tmpChildTemplateString, this.fable.MetaTemplate.ParseTree);
					this.cache.set(tmpChildTemplateString, tmpChildCompiled);
				}

				let tmpChildPlans = this._collectEntityExpressions(tmpChildCompiled);
				for (let k = 0; k < tmpChildPlans.length; k++)
				{
					pPlans.push(tmpChildPlans[k]);
				}

				if (pRemainingDepth > 0)
				{
					this._scanTemplateReferencesForEntities(tmpChildCompiled, pPlans, pVisited, pRemainingDepth - 1);
				}
			}
		}
	}

	/**
	 * Resolve an entity ID address against a record.
	 * Handles common address prefixes: Record., AppData., Scope., Context[N].
	 *
	 * @param {string} pAddress - The address to resolve (e.g., "Record.IDCity")
	 * @param {any} pRecord - The current data record
	 * @param {Array<any>} [pContextArray] - Context array
	 * @param {any} [pScope] - Scope object
	 * @param {any} [pState] - State object
	 *
	 * @return {any} The resolved value, or null if not resolvable
	 */
	_resolveEntityID(pAddress, pRecord, pContextArray, pScope, pState)
	{
		let tmpAddress = pAddress;
		let tmpRoot = pRecord;

		if (tmpAddress.startsWith('Record.'))
		{
			tmpAddress = tmpAddress.substring(7);
			tmpRoot = pRecord;
		}
		else if (tmpAddress.startsWith('AppData.'))
		{
			tmpAddress = tmpAddress.substring(8);
			tmpRoot = this.fable.AppData;
		}
		else if (tmpAddress.startsWith('Scope.'))
		{
			tmpAddress = tmpAddress.substring(6);
			tmpRoot = pScope;
		}
		else if (tmpAddress.startsWith('Context['))
		{
			let tmpMatch = tmpAddress.match(/^Context\[(\d+)\]\.(.+)$/);
			if (tmpMatch && Array.isArray(pContextArray) && pContextArray[parseInt(tmpMatch[1])])
			{
				tmpRoot = pContextArray[parseInt(tmpMatch[1])];
				tmpAddress = tmpMatch[2];
			}
			else
			{
				return null;
			}
		}

		if (tmpRoot == null || typeof tmpRoot !== 'object')
		{
			return null;
		}

		// Walk dot-notation path
		let tmpParts = tmpAddress.split('.');
		let tmpValue = tmpRoot;
		for (let i = 0; i < tmpParts.length; i++)
		{
			if (tmpValue == null || typeof tmpValue !== 'object')
			{
				return null;
			}
			tmpValue = tmpValue[tmpParts[i]];
		}

		return tmpValue;
	}

	/**
	 * Extract an array of records from a dataset (handles both Array and Object datasets).
	 *
	 * @param {Array|Object} pDataSet - The dataset
	 *
	 * @return {Array} Array of records
	 */
	_getRecordsFromDataSet(pDataSet)
	{
		if (Array.isArray(pDataSet))
		{
			return pDataSet;
		}
		if (typeof pDataSet === 'object' && pDataSet !== null)
		{
			return Object.values(pDataSet);
		}
		return [];
	}

	/**
	 * Prefetch entities for a template set before iteration begins.
	 * Scans the template (and one level of child templates) for entity expressions,
	 * resolves IDs across the dataset, and batch-fetches them into the EntityProvider cache.
	 *
	 * @param {string} pTemplateString - The template string that will be iterated
	 * @param {Array|Object} pDataSet - The dataset to iterate
	 * @param {function} fCallback - Called when prefetch is complete (pError)
	 * @param {Array<any>} [pContextArray] - Context array
	 * @param {any} [pScope] - Scope object
	 * @param {any} [pState] - State object
	 */
	prefetchEntitiesForSet(pTemplateString, pDataSet, fCallback, pContextArray, pScope, pState)
	{
		// Guard: EntityProvider must exist
		if (!this.fable.EntityProvider)
		{
			return fCallback();
		}

		// Guard: template string and dataset must be valid
		if (typeof pTemplateString !== 'string' || pTemplateString.length < 1)
		{
			return fCallback();
		}
		if (!pDataSet || (typeof pDataSet !== 'object'))
		{
			return fCallback();
		}

		// Collect entity expressions from the template + one level deep
		let tmpEntityPlans = this._collectEntityExpressionsDeep(pTemplateString, 1);

		if (tmpEntityPlans.length < 1)
		{
			return fCallback();
		}

		// Gather unique IDs per entity type across the dataset
		let tmpRecords = this._getRecordsFromDataSet(pDataSet);
		let tmpEntityBatches = {};  // EntityType → Set of IDs

		for (let i = 0; i < tmpEntityPlans.length; i++)
		{
			let tmpPlan = tmpEntityPlans[i];

			if (!(tmpPlan.EntityType in tmpEntityBatches))
			{
				tmpEntityBatches[tmpPlan.EntityType] = new Set();
				this.fable.EntityProvider.initializeCache(tmpPlan.EntityType);
			}

			for (let j = 0; j < tmpRecords.length; j++)
			{
				let tmpID = this._resolveEntityID(tmpPlan.IDAddress, tmpRecords[j], pContextArray, pScope, pState);
				if (tmpID != null && tmpID !== '' && tmpID !== 0)
				{
					// Only add if not already in EntityProvider cache
					let tmpCached = this.fable.EntityProvider.recordCache[tmpPlan.EntityType].read(tmpID);
					if (!tmpCached)
					{
						tmpEntityBatches[tmpPlan.EntityType].add(tmpID);
					}
				}
			}
		}

		// Batch-fetch each entity type
		let tmpAnticipate = this.fable.instantiateServiceProviderWithoutRegistration('Anticipate');
		let tmpEntityTypes = Object.keys(tmpEntityBatches);

		for (let i = 0; i < tmpEntityTypes.length; i++)
		{
			let tmpEntityType = tmpEntityTypes[i];
			let tmpIDs = tmpEntityBatches[tmpEntityType];

			if (tmpIDs.size < 1)
			{
				continue;
			}

			let tmpIDArray = Array.from(tmpIDs);

			tmpAnticipate.anticipate(
				(fNext) =>
				{
					let tmpFilter = `FBL~ID${tmpEntityType}~INN~${tmpIDArray.join(',')}`;

					this.fable.EntityProvider.getEntitySet(tmpEntityType, tmpFilter,
						(pError, pEntitySet) =>
						{
							if (pError)
							{
								this.log.warn(`Preprocessor: Entity prefetch error for [${tmpEntityType}]: ${pError}`);
							}
							// getEntitySet auto-caches via cacheIndividualEntityRecords
							return fNext();
						});
				});
		}

		tmpAnticipate.wait(
			(pError) =>
			{
				return fCallback(pError);
			});
	}

	// -- Wrapper Installation --

	/**
	 * Install preprocessor wrappers around parseTemplate methods on the Pict instance.
	 * Follows the same pattern as Pict-Template-Audit._installWrappers().
	 * @private
	 */
	_installWrappers()
	{
		let tmpPict = this.fable;
		let tmpPreprocessor = this;

		// Save reference to original methods
		this._originalParseTemplate = tmpPict.parseTemplate.bind(tmpPict);
		this._originalParseTemplateByHash = tmpPict.parseTemplateByHash.bind(tmpPict);

		// -- parseTemplate wrapper (the hot path) --
		tmpPict.parseTemplate = function _preprocessorParseTemplate(pTemplateString, pData, fCallback, pContextArray, pScope, pState)
		{
			if (typeof(pTemplateString) !== 'string' || pTemplateString.length < 1)
			{
				if (typeof(fCallback) === 'function')
				{
					return fCallback(null, '');
				}
				return '';
			}

			let tmpCompiled = tmpPreprocessor.cache.get(pTemplateString);
			if (!tmpCompiled)
			{
				tmpCompiled = tmpPreprocessor.compile(pTemplateString, tmpPict.MetaTemplate.ParseTree);
				tmpPreprocessor.cache.set(pTemplateString, tmpCompiled);

				// Extract graph edges if we know the source template
				let tmpSourceTemplate = (pState && pState._PreprocessorSourceTemplate) ? pState._PreprocessorSourceTemplate : null;
				tmpPreprocessor.classifyEdges(tmpCompiled, tmpSourceTemplate);
			}

			if (typeof(fCallback) === 'function')
			{
				return tmpPreprocessor.executeCompiledAsync(tmpCompiled, pData, fCallback, pContextArray, pScope, pState);
			}
			return tmpPreprocessor.executeCompiled(tmpCompiled, pData, pContextArray, pScope, pState);
		};

		// -- parseTemplateByHash wrapper (sets source node hint for graph) --
		tmpPict.parseTemplateByHash = function _preprocessorParseTemplateByHash(pTemplateHash, pData, fCallback, pContextArray, pScope, pState)
		{
			let tmpTemplateString = tmpPict.TemplateProvider.getTemplate(pTemplateHash);
			if (!tmpTemplateString)
			{
				tmpTemplateString = '';
			}

			if (!pState)
			{
				pState = {};
			}
			pState._PreprocessorSourceTemplate = pTemplateHash;

			return tmpPict.parseTemplate(tmpTemplateString, pData, fCallback, pContextArray, pScope, pState);
		};

		// -- parseTemplateSet wrapper (prefetch entities before iteration) --
		this._originalParseTemplateSet = tmpPict.parseTemplateSet.bind(tmpPict);

		tmpPict.parseTemplateSet = function _preprocessorParseTemplateSet(pTemplateString, pDataSet, fCallback, pContextArray, pScope, pState)
		{
			// Sync path cannot do async prefetch — fall through to original
			if (typeof(fCallback) !== 'function')
			{
				return tmpPreprocessor._originalParseTemplateSet(pTemplateString, pDataSet, null, pContextArray, pScope, pState);
			}

			// Async path: prefetch entities, then proceed with normal iteration
			tmpPreprocessor.prefetchEntitiesForSet(pTemplateString, pDataSet,
				(pPrefetchError) =>
				{
					if (pPrefetchError)
					{
						tmpPreprocessor.log.warn(`Preprocessor: Entity prefetch error during template set: ${pPrefetchError}`);
					}
					return tmpPreprocessor._originalParseTemplateSet(pTemplateString, pDataSet, fCallback, pContextArray, pScope, pState);
				}, pContextArray, pScope, pState);
		};

		// -- parseTemplateSetByHash wrapper (sets source template + prefetch) --
		this._originalParseTemplateSetByHash = tmpPict.parseTemplateSetByHash.bind(tmpPict);

		tmpPict.parseTemplateSetByHash = function _preprocessorParseTemplateSetByHash(pTemplateHash, pDataSet, fCallback, pContextArray, pScope, pState)
		{
			let tmpTemplateString = tmpPict.TemplateProvider.getTemplate(pTemplateHash);
			if (!tmpTemplateString)
			{
				tmpTemplateString = '';
			}

			if (!pState)
			{
				pState = {};
			}
			pState._PreprocessorSourceTemplate = pTemplateHash;

			return tmpPict.parseTemplateSet(tmpTemplateString, pDataSet, fCallback, pContextArray, pScope, pState);
		};
	}

	/**
	 * Remove preprocessor wrappers and restore original methods.
	 */
	unwrapTemplateFunctions()
	{
		let tmpPict = this.fable;

		if (this._originalParseTemplate && typeof(this._originalParseTemplate) === 'function')
		{
			tmpPict.parseTemplate = this._originalParseTemplate;
			this._originalParseTemplate = null;
		}

		if (this._originalParseTemplateByHash && typeof(this._originalParseTemplateByHash) === 'function')
		{
			tmpPict.parseTemplateByHash = this._originalParseTemplateByHash;
			this._originalParseTemplateByHash = null;
		}

		if (this._originalParseTemplateSet && typeof(this._originalParseTemplateSet) === 'function')
		{
			tmpPict.parseTemplateSet = this._originalParseTemplateSet;
			this._originalParseTemplateSet = null;
		}

		if (this._originalParseTemplateSetByHash && typeof(this._originalParseTemplateSetByHash) === 'function')
		{
			tmpPict.parseTemplateSetByHash = this._originalParseTemplateSetByHash;
			this._originalParseTemplateSetByHash = null;
		}
	}

	/**
	 * Clear the compiled template cache.
	 */
	clearCache()
	{
		this.cache.clear();
	}

	/**
	 * Clear everything — cache and graph.
	 */
	clear()
	{
		this.cache.clear();
		this.graph.clear();
	}
}

module.exports = PictTemplatePreprocessor;

/** @type {Record<string, any>} */
PictTemplatePreprocessor.default_configuration = {};
