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

⚡ EFFICIENT DOCUMENT COUNTING (NEW - Use This First!):
The index now has document_title and text_document_id as FACETABLE fields.
To count or list unique documents:
1. Use facets: ["document_title,count:1000"] or facets: ["text_document_id,count:1000"]
   - IMPORTANT: Add ",count:1000" to get up to 1000 unique documents (default is only 10!)
2. Get results in 1 call instead of 20-30 calls
3. Count of facet items = number of unique documents

Example for "How many U&A reports?":
{ query: "*", filter: "file_category_ai eq 'Usage/Attitude (U&A)' and text_document_id ne ''", facets: ["document_title,count:1000"] }
→ Returns facet with all unique document names + their chunk counts
→ Number of facet items = number of unique documents

Example for "List all U&A reports" (with clickable links):
{ query: "*", filter: "file_category_ai eq 'Usage/Attitude (U&A)' and text_document_id ne ''", facets: ["document_title,count:1000"], selectFields: "document_title,content_path" }
→ Extract all facet values = complete list of document names
→ For each facet name, find matching document in documents array
→ Use that document's content_path for creating clickable links: 📄 [filename](content_path)
→ DO NOT reconstruct URLs from document titles - content_path has SAS tokens already appended

CRITICAL FOR LISTING QUERIES:
1. Always include selectFields: "document_title,content_path" to get URLs for clickable links
2. Always add "and text_document_id ne ''" to filter to exclude image chunks and get original PDF paths
3. NEVER reconstruct URLs from document titles - ALWAYS use content_path from documents array (it has SAS tokens)

WITHOUT ",count:1000" you'll only get 10 documents maximum!

WHEN TO USE FACETS:
1. Counting documents: facets: ["document_title"] or ["text_document_id"]
2. Listing document names: facets: ["document_title"]
3. Listing categories: facets: ["file_category_ai"]
4. Counting by any facetable field

WHEN NOT TO USE FACETS:
- Searching for specific content/keywords
- Finding documents by name/topic
- Answering questions about document content
Example: "Find Godrej growth reports" → Use query only, NO facets

PARAMETERS:
- query: Search term for content (use "*" when using filters/facets only)
- filter: OData filter expressions (CASE-SENSITIVE! Use exact values below):
  * By category: "file_category_ai eq 'Usage/Attitude (U&A)'"
  * By page: "locationMetadata/pageNumber eq 6"
  * By document + page: "document_title eq 'Report.pdf' and locationMetadata/pageNumber eq 6"
  * By path: "content_path eq '/reports/2023/'"
  * Combine with "and" or "or"
- facets: Array of facetable fields ["document_title", "text_document_id", "file_category_ai", "content_path", etc.]
- skip: Number of results to skip for pagination (default: 0)
- selectFields: Comma-separated fields to return (e.g., "document_title,text_document_id")

EXACT CATEGORY VALUES (file_category_ai) - Use these EXACT strings (case-sensitive):
- "Brand equity" (lowercase 'e')
- "Concept testing" (lowercase 't')
- "Dipstick" (capital 'D')
- "Household Penetration" (capital 'H' and 'P')
- "Product testing" (lowercase 't')
- "Sales data" (lowercase 'd')
- "Usage/Attitude (U&A)" (capital 'U' and 'A')

CRITICAL FILTER RULES:
1. Filters are CASE-SENSITIVE! Always use exact values above.
   Wrong: "file_category_ai eq 'Concept Testing'" ❌
   Right: "file_category_ai eq 'Concept testing'" ✅

2. When listing documents with content_path, ALWAYS add "and text_document_id ne ''" to filter!
   Why: Index has both text chunks (original PDFs) and image chunks (extracted images).
   Without this filter, you may get image paths instead of PDF paths.
   Wrong: "file_category_ai eq 'Brand equity'" → Returns image paths ❌
   Right: "file_category_ai eq 'Brand equity' and text_document_id ne ''" → Returns PDF paths ✅

3. ALWAYS include page numbers in document citations!
   Each search result contains locationMetadata.pageNumber - use it in your citations.
   Format: 📄 [filename](content_path) (Page X)
   Example: 📄 [Soaps UA 2024.pdf](https://...) (Page 15)
   Multiple pages: 📄 [Report.pdf](https://...) (Pages 12, 15, 18)

PAGE-SPECIFIC SEARCHES:
- The index has pageNumber field under locationMetadata
- To filter by page: use "locationMetadata/pageNumber eq [number]"
- For specific document + page: combine filters with AND
Example: "locationMetadata/pageNumber eq 6 and document_title eq 'Presentation.pptx'"

CRITICAL: ALWAYS INCLUDE PAGE NUMBERS IN CITATIONS
- Each document in results contains locationMetadata.pageNumber
- When citing documents, format as: 📄 [filename](content_path) (Page X)
- Page numbers provide precise source attribution
- Example: 📄 [Soaps Report 2024.pdf](https://...) (Page 15)
- If a document has multiple relevant pages, list them: (Pages 12, 15, 18)

EXAMPLES:
✓ Count U&A reports (EFFICIENT - 1 call):
  { query: "*", filter: "file_category_ai eq 'Usage/Attitude (U&A)' and text_document_id ne ''", facets: ["document_title,count:1000"] }
  → Count facet items = number of documents

✓ List all U&A reports with links (EFFICIENT - 1 call):
  { query: "*", filter: "file_category_ai eq 'Usage/Attitude (U&A)' and text_document_id ne ''", facets: ["document_title,count:1000"], selectFields: "document_title,content_path" }

  CRITICAL - How to extract URLs correctly:
  → facets.document_title gives you unique document names (for counting/listing titles)
  → documents array contains actual content_path URLs (with SAS tokens already appended)
  → For each facet value, find matching document in documents array and use its content_path
  → DO NOT reconstruct URLs from document titles - ALWAYS use content_path from documents array
  → Example flow:
    1. facets.document_title[0].value = "Report.pdf" (title only, no URL)
    2. Find in documents: documents.find(d => d.document_title === "Report.pdf")
    3. Use: documents[X].content_path (this has the SAS token)
    4. Output: 📄 [Report.pdf](documents[X].content_path)

✓ List concept testing reports with links:
  { query: "*", filter: "file_category_ai eq 'Concept testing' and text_document_id ne ''", facets: ["document_title,count:1000"], selectFields: "document_title,content_path" }

✓ List brand equity reports with links:
  { query: "*", filter: "file_category_ai eq 'Brand equity' and text_document_id ne ''", facets: ["document_title,count:1000"], selectFields: "document_title,content_path" }

✓ Content search with page attribution:
  { query: "product likability drivers" }
  → Results include locationMetadata.pageNumber for each chunk
  → In your answer, cite as: 📄 [Soaps UA 2024.pdf](https://...) (Page 23)
  → ALWAYS extract and include the page number from locationMetadata!

✓ Page 6 of doc: { query: "*", filter: "locationMetadata/pageNumber eq 6 and document_title eq 'Presentation.pptx'" }

✗ Wrong (gets image paths): { query: "*", filter: "file_category_ai eq 'Brand equity'", selectFields: "document_title,content_path" }
✓ Right (gets PDF paths): { query: "*", filter: "file_category_ai eq 'Brand equity' and text_document_id ne ''", selectFields: "document_title,content_path" }

✗ Wrong: { query: "Godrej", facets: ["file_category_ai"] } - Don't use facets for content search`;




    /* Used to initialize the Tool without necessary variables. */
    this.override = fields.override ?? false;

    // Define schema
    this.schema = z.object({
      query: z.string().describe('Search word or phrase to Azure AI Search. Use "*" to match all documents'),
      filter: z.string().optional().describe('OData filter expression (e.g., "file_category_ai eq \'U&A\'"'),
      facets: z.array(z.string()).optional().describe('Array of facetable field names to get counts/aggregations'),
      skip: z.number().optional().describe('Number of results to skip for pagination (default: 0)'),
      selectFields: z.string().optional().describe('Comma-separated fields to return (e.g., "document_title,text_document_id") - CRITICAL for reducing tokens when listing documents'),
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

    // Initialize SAS token for blob storage URLs (optional)
    this.blobSasToken = this._initializeField(
      fields.AZURE_BLOB_SAS_TOKEN,
      'AZURE_BLOB_SAS_TOKEN',
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

    // Bind the SAS token appender method
    if (this.blobSasToken) {
      this.appendSasToken = this._appendSasTokenToUrl.bind(this);
    } else {
      this.appendSasToken = null;
    }
  }

  /**
   * Appends SAS token to Azure Blob Storage URLs
   * Strips any existing SAS tokens first to ensure fresh authentication
   * @param {string} url - The blob storage URL
   * @returns {string} URL with fresh SAS token appended
   */
  _appendSasTokenToUrl(url) {
    if (!url || !this.blobSasToken) {
      return url;
    }

    // Check if it's a blob storage URL
    if (!url.includes('.blob.core.windows.net')) {
      return url;
    }

    // Strip any existing query string (which may contain old SAS tokens)
    // This ensures we always use the fresh SAS token from environment
    const baseUrl = url.split('?')[0];

    // Append fresh SAS token
    return `${baseUrl}?${this.blobSasToken}`;
  }

  // Improved error handling and logging
  async _call(data) {
    const { query, filter, facets, skip, selectFields } = data;
    try {
      const searchOption = {
        queryType: this.queryType,
        top: typeof this.top === 'string' ? Number(this.top) : this.top,
        includeTotalCount: true, // Include total count for pagination info
      };

      // Add optional parameters
      // selectFields from tool call takes precedence over environment variable
      if (selectFields) {
        searchOption.select = selectFields.split(',').map(f => f.trim());
      } else if (this.select) {
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

      // Extract documents and append SAS tokens to blob URLs
      for await (const result of searchResults.results) {
        const doc = result.document;

        // Append SAS token to content_path if it's a blob URL
        if (doc.content_path && this.appendSasToken) {
          doc.content_path = this.appendSasToken(doc.content_path);
        }

        response.documents.push(doc);
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
          // Check if this is a document-identifying facet
          const isDocumentFacet = facetName === 'document_title' || facetName === 'text_document_id';

          response.facets[facetName] = facetResults.map((item) => ({
            value: item.value,
            count: item.count,
          }));

          // Add appropriate guidance based on facet type
          if (isDocumentFacet) {
            response.facets[`${facetName}_note`] = `Number of items in this facet (${facetResults.length}) = number of unique documents. The 'count' field shows how many chunks belong to each document.`;
            response.uniqueDocumentCount = facetResults.length;
          } else {
            response.facets[`${facetName}_note`] = `This facet shows categories/values. The 'count' field represents chunks, not unique documents.`;
          }
        }
      }

      // Add pagination guidance for the agent
      if (response.hasMoreResults) {
        response.nextSkip = (skip || 0) + response.returnedCount;
        response.remainingChunks = response.totalCount - ((skip || 0) + response.returnedCount);
      }

      // Add important note about chunk vs document counting
      if (response.totalCount > 0 && !response.uniqueDocumentCount) {
        response.important_note = 'totalCount represents CHUNKS, not documents. To count unique documents, use facets: ["document_title"] or ["text_document_id"].';
      }

      // Add summary if we have unique document count
      if (response.uniqueDocumentCount) {
        response.summary = `Found ${response.uniqueDocumentCount} unique documents (out of ${response.totalCount} total chunks).`;
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
