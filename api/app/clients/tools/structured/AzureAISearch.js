const { z } = require('zod');
const { Tool } = require('@langchain/core/tools');
const { logger } = require('@librechat/data-schemas');
const { SearchClient, AzureKeyCredential } = require('@azure/search-documents');

class AzureAISearch extends Tool {
  // Constants for default values
  static DEFAULT_API_VERSION = '2023-11-01';
  static DEFAULT_QUERY_TYPE = 'simple';
  static DEFAULT_TOP = 5;

  // Helper function for initializing properties
  _initializeField(field, envVar, defaultValue) {
    return field || process.env[envVar] || defaultValue;
  }

  constructor(fields = {}) {
    super();
    this.name = 'azure-ai-search';
    this.description = `Use 'azure-ai-search' to search and analyze documents in the knowledge base.

IMPORTANT: The index contains document CHUNKS, not whole documents. Each document is split into multiple chunks.

MULTI-CALL STRATEGY FOR COUNTING DOCUMENTS:
1. To count unique documents by category:
   - Use filter to get chunks of that category
   - Fetch multiple pages to get all chunks (5 per call)
   - Count distinct "text_document_id" or "document_title" values
   - Example: filter: "file_category_ai eq 'Usage/Attitude (U&A)'"

2. To list document names:
   - Use filter to get specific category
   - Paginate through results
   - Extract unique "document_title" values

PARAMETERS:
- query: Search term (use "*" for all documents)
- filter: OData filter (e.g., "file_category_ai eq 'Usage/Attitude (U&A)'")
- facets: Array of fields to aggregate (NOTE: counts will be chunks, not documents)
- skip: Number of results to skip for pagination (default: 0)

EXAMPLES:
- Count U&A documents: Filter by category, fetch all chunks, count distinct text_document_id
  { query: "*", filter: "file_category_ai eq 'Usage/Attitude (U&A)'", skip: 0 }
- List document titles: Fetch chunks and extract unique document_title values

FACET WARNING: Facet counts represent CHUNKS not DOCUMENTS. Do not use facet counts as document counts.`;

    /* Used to initialize the Tool without necessary variables. */
    this.override = fields.override ?? false;

    // Define schema
    this.schema = z.object({
      query: z.string().describe('Search word or phrase to Azure AI Search. Use "*" to match all documents'),
      filter: z.string().optional().describe('OData filter expression (e.g., "file_category_ai eq \'U&A\'"'),
      facets: z.array(z.string()).optional().describe('Array of facetable field names to get counts/aggregations'),
      skip: z.number().optional().describe('Number of results to skip for pagination (default: 0)'),
    });

    // Initialize properties using helper function
    this.serviceEndpoint = this._initializeField(
      fields.AZURE_AI_SEARCH_SERVICE_ENDPOINT,
      'AZURE_AI_SEARCH_SERVICE_ENDPOINT',
    );
    this.indexName = this._initializeField(
      fields.AZURE_AI_SEARCH_INDEX_NAME,
      'AZURE_AI_SEARCH_INDEX_NAME',
    );
    this.apiKey = this._initializeField(fields.AZURE_AI_SEARCH_API_KEY, 'AZURE_AI_SEARCH_API_KEY');
    this.apiVersion = this._initializeField(
      fields.AZURE_AI_SEARCH_API_VERSION,
      'AZURE_AI_SEARCH_API_VERSION',
      AzureAISearch.DEFAULT_API_VERSION,
    );
    this.queryType = this._initializeField(
      fields.AZURE_AI_SEARCH_SEARCH_OPTION_QUERY_TYPE,
      'AZURE_AI_SEARCH_SEARCH_OPTION_QUERY_TYPE',
      AzureAISearch.DEFAULT_QUERY_TYPE,
    );
    this.top = this._initializeField(
      fields.AZURE_AI_SEARCH_SEARCH_OPTION_TOP,
      'AZURE_AI_SEARCH_SEARCH_OPTION_TOP',
      AzureAISearch.DEFAULT_TOP,
    );
    this.select = this._initializeField(
      fields.AZURE_AI_SEARCH_SEARCH_OPTION_SELECT,
      'AZURE_AI_SEARCH_SEARCH_OPTION_SELECT',
    );

    // Check for required fields
    if (!this.override && (!this.serviceEndpoint || !this.indexName || !this.apiKey)) {
      throw new Error(
        'Missing AZURE_AI_SEARCH_SERVICE_ENDPOINT, AZURE_AI_SEARCH_INDEX_NAME, or AZURE_AI_SEARCH_API_KEY environment variable.',
      );
    }

    if (this.override) {
      return;
    }

    // Create SearchClient
    this.client = new SearchClient(
      this.serviceEndpoint,
      this.indexName,
      new AzureKeyCredential(this.apiKey),
      { apiVersion: this.apiVersion },
    );
  }

  // Improved error handling and logging
  async _call(data) {
    const { query, filter, facets, skip } = data;
    try {
      const searchOption = {
        queryType: this.queryType,
        top: typeof this.top === 'string' ? Number(this.top) : this.top,
        includeTotalCount: true, // Include total count for pagination info
      };

      // Add optional parameters
      if (this.select) {
        searchOption.select = this.select.split(',');
      }
      if (filter) {
        searchOption.filter = filter;
      }
      if (facets && Array.isArray(facets) && facets.length > 0) {
        searchOption.facets = facets;
      }
      if (skip && typeof skip === 'number') {
        searchOption.skip = skip;
      }

      const searchResults = await this.client.search(query, searchOption);

      // Build enhanced response
      const response = {
        documents: [],
        totalCount: 0,
        returnedCount: 0,
        skip: skip || 0,
        hasMoreResults: false,
      };

      // Extract documents
      for await (const result of searchResults.results) {
        response.documents.push(result.document);
      }
      response.returnedCount = response.documents.length;

      // Calculate distinct document count in current batch
      const uniqueDocIds = new Set();
      const uniqueDocTitles = new Set();
      for (const doc of response.documents) {
        if (doc.text_document_id) {
          uniqueDocIds.add(doc.text_document_id);
        }
        if (doc.document_title) {
          uniqueDocTitles.add(doc.document_title);
        }
      }
      response.uniqueDocumentsInBatch = uniqueDocIds.size || uniqueDocTitles.size;
      response.documentTitles = Array.from(uniqueDocTitles);

      // Get total count if available
      if (searchResults.count !== undefined) {
        response.totalCount = searchResults.count;
        // Check if there are more results
        const currentPosition = (skip || 0) + response.returnedCount;
        response.hasMoreResults = currentPosition < response.totalCount;
      }

      // Extract facets if requested
      if (facets && searchResults.facets) {
        response.facets = {};
        for (const [facetName, facetResults] of Object.entries(searchResults.facets)) {
          response.facets[facetName] = facetResults.map((item) => ({
            value: item.value,
            count: item.count,
            note: 'This count represents chunks, not unique documents. For document count, fetch documents and count distinct text_document_id values.',
          }));
        }
      }

      // Add pagination guidance for the agent
      if (response.hasMoreResults) {
        response.nextSkip = (skip || 0) + response.returnedCount;
        response.remainingChunks = response.totalCount - ((skip || 0) + response.returnedCount);
      }

      // Add important note about chunk vs document counting
      if (response.facets || response.totalCount > 0) {
        response.important_note = 'totalCount and facet counts represent CHUNKS, not documents. To count unique documents, fetch chunks with filter and count distinct text_document_id or document_title values.';
      }

      return JSON.stringify(response, null, 2);
    } catch (error) {
      logger.error('Azure AI Search request failed', error);
      return JSON.stringify({
        error: 'Azure AI Search request failed',
        message: error.message,
        documents: [],
      });
    }
  }
}

module.exports = AzureAISearch;
