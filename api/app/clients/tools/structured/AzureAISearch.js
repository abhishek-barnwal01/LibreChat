const { z } = require('zod');
const { Tool } = require('@langchain/core/tools');
const { logger } = require('@librechat/data-schemas');
const { SearchClient, AzureKeyCredential } = require('@azure/search-documents');

class AzureAISearch extends Tool {
  // Constants for default values
  static DEFAULT_API_VERSION = '2025-11-01-preview';
  static DEFAULT_QUERY_TYPE = 'full';
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
→ Use "uniqueDocumentLinks" array from response (NOT raw documents array) to get clean PDF links
→ Each entry has { title, url } - use these directly: [title](url)

CRITICAL FOR LISTING QUERIES:
1. Always include selectFields: "document_title,content_path" to get URLs for clickable links
2. Always add "and text_document_id ne ''" to filter to exclude image chunks and get original PDF paths
3. ALWAYS use the "uniqueDocumentLinks" array from the response for building clickable links - it has deduplicated, non-image URLs
4. Do NOT use raw content_path from the documents array for listing - some chunks may have image paths
5. Do NOT include source document citations or "[Source: ...]" references when listing documents - just show the document name with its link

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
  IMPORTANT: When you need to READ/ANALYZE the actual page content, you MUST include "content_text" and "content_embedding" in selectFields (e.g., "content_text,content_embedding,document_title,content_path,locationMetadata/pageNumber").
  If you omit "content_text", you will only get metadata (titles, paths, page numbers) but NOT the actual text content of the document.
  - For LISTING documents: selectFields: "document_title,content_path" (no content_text needed)

EXACT CATEGORY VALUES (file_category_ai) - Use these EXACT strings (case-sensitive):
"Analysis", "Annual presentation", "Brand equity", "Brand Health track", "Concept testing", "Home panel", "Link testing", "Media Optimization", "Miscellaneous", "Needscope", "Post Launch Evaluation", "Product acceptance testing", "Product Performance Evaluation", "Retail audit", "Usage/Attitude (U&A)"

CRITICAL FILTER RULES:
1. Filters are CASE-SENSITIVE! Always use exact values above.
   Wrong: "file_category_ai eq 'Concept Testing'" ❌
   Right: "file_category_ai eq 'Concept testing'" ✅

2. When listing documents with content_path, ALWAYS add "and text_document_id ne ''" to filter!
   Why: Index has both text chunks (original PDFs) and image chunks (extracted images).
   Without this filter, you may get image paths instead of PDF paths.
   Wrong: "file_category_ai eq 'Brand equity'" → Returns image paths ❌
   Right: "file_category_ai eq 'Brand equity' and text_document_id ne ''" → Returns PDF paths ✅

PAGE-SPECIFIC SEARCHES:
- The index has pageNumber field under locationMetadata
- To filter by page: use "locationMetadata/pageNumber eq [number]"
- For specific document + page: combine filters with AND
Example: "locationMetadata/pageNumber eq 6 and document_title eq 'Presentation.pptx'"

EXAMPLES:
✓ Count U&A reports (EFFICIENT - 1 call):
  { query: "*", filter: "file_category_ai eq 'Usage/Attitude (U&A)' and text_document_id ne ''", facets: ["document_title,count:1000"] }
  → Count facet items = number of documents

✓ List all U&A reports with links (EFFICIENT - 1 call):
  { query: "*", filter: "file_category_ai eq 'Usage/Attitude (U&A)' and text_document_id ne ''", facets: ["document_title,count:1000"], selectFields: "document_title,content_path" }
  → Use "uniqueDocumentLinks" array from response - each entry has { title, url }
  → Format as: [title](url) for clickable links
  → DO NOT use raw documents array content_path (may contain image links)
  → DO NOT include source citations or "[Source: ...]" when listing - just show document names with links

✓ List concept testing reports with links:
  { query: "*", filter: "file_category_ai eq 'Concept testing' and text_document_id ne ''", facets: ["document_title,count:1000"], selectFields: "document_title,content_path" }

✓ List brand equity reports with links:
  { query: "*", filter: "file_category_ai eq 'Brand equity' and text_document_id ne ''", facets: ["document_title,count:1000"], selectFields: "document_title,content_path" }

✓ Content search: { query: "Godrej growth 2022" } - NO facets (returns all fields including content_text)

✓ Content search with selectFields: { query: "Godrej growth 2022", selectFields: "content_text,content_embedding,document_title,content_path,locationMetadata/pageNumber" }
  → MUST include "content_text" to get actual text content

✗ Wrong (missing content text): { query: "recommend", filter: "document_title eq 'Report.pdf'", selectFields: "document_title,content_path,content_embedding,locationMetadata/pageNumber" }
  → Returns page numbers but NO text content - cannot analyze what the page says!

✓ Page 6 of doc: { query: "*", filter: "locationMetadata/pageNumber eq 6 and document_title eq 'Presentation.pptx'" }

✓ Documents in specific path: Documents in specific path: { query: "*", filter: "content_path eq '/reports/2023/'", facets: ["document_title,count:1000"], selectFields: "document_title,content_path" }

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
      selectFields: z.string().optional().describe('Comma-separated fields to return. MUST include "content_text" and "content_embedding" when reading content (e.g., "content_text,,document_title,content_path,locationMetadata/pageNumber"). Omit "content_text" and "content_embedding" only for listing/counting queries.'),
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
   * Checks if a URL points to an image file (extracted image chunk, not original document)
   * @param {string} url - The URL to check
   * @returns {boolean} True if the URL is an image path
   */
  _isImageUrl(url) {
    if (!url) {
      return false;
    }
    const lowerUrl = url.toLowerCase();
    // Check for image file extensions
    if (/\.(jpg|jpeg|png|gif|bmp|tiff|webp)(\?|$)/i.test(lowerUrl)) {
      return true;
    }
    // Check for known image proxy paths
    if (lowerUrl.includes('image-output') || lowerUrl.includes('normalized_images')) {
      return true;
    }
    return false;
  }

  /**
   * Normalizes Azure Blob Storage URLs by fixing known hostname issues
   * @param {string} url - The blob storage URL
   * @returns {string} URL with corrected hostname
   */
  _normalizeUrl(url) {
    if (!url) {
      return url;
    }
    // Fix known hostname typo: gcpllcmiadls001 (double 'll') → gcplcmiadls001 (single 'l')
    url = url.replace(/gcpllcmiadls001/g, 'gcplcmiadls001');
    return url;
  }

  /**
   * Appends SAS token to Azure Blob Storage URLs
   * Strips any existing SAS tokens first to ensure fresh authentication
   * Also normalizes the URL to fix known hostname issues
   * @param {string} url - The blob storage URL
   * @returns {string} URL with fresh SAS token appended
   */
  _appendSasTokenToUrl(url) {
    if (!url || !this.blobSasToken) {
      return url;
    }

    // Normalize URL first (fix hostname typos etc.)
    url = this._normalizeUrl(url);

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

      // Extract documents and process URLs
      for await (const result of searchResults.results) {
        const doc = result.document;

        // Normalize URL first (fix hostname typos etc.)
        if (doc.content_path) {
          doc.content_path = this._normalizeUrl(doc.content_path);
        }

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

      // Build unique document links map: for each document_title, find the best (non-image) content_path
      // This helps listing queries get clean PDF links instead of image links
      if (selectFields && selectFields.includes('content_path')) {
        const docLinkMap = {};
        for (const doc of response.documents) {
          const title = doc.document_title;
          if (!title || !doc.content_path) {
            continue;
          }
          const isImage = this._isImageUrl(doc.content_path);
          // Prefer non-image URLs; only use image URL if no better option exists
          if (!docLinkMap[title] || (docLinkMap[title].isImage && !isImage)) {
            docLinkMap[title] = { url: doc.content_path, isImage };
          }
        }
        // Build clean array of { title, url } for agent to use directly
        response.uniqueDocumentLinks = Object.entries(docLinkMap)
          .filter(([, info]) => !info.isImage) // exclude documents that only have image links
          .map(([title, info]) => ({ title, url: info.url }));

        // Documents that only have image links (no PDF path found)
        const imageOnlyDocs = Object.entries(docLinkMap)
          .filter(([, info]) => info.isImage)
          .map(([title]) => title);
        if (imageOnlyDocs.length > 0) {
          response.imageOnlyDocuments = imageOnlyDocs;
          response.imageOnlyNote = 'These documents only have image chunk paths in the index. Their original PDF links are not available in the current results.';
        }
      }

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
