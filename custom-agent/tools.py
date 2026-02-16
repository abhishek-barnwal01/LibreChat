"""Azure AI Search tool with hybrid search, filters, facets, and pagination"""
from langchain.tools import tool
from azure.search.documents import SearchClient
from azure.search.documents.models import VectorizedQuery
from azure.core.credentials import AzureKeyCredential
from openai import AzureOpenAI
import config
import json
from typing import Optional, List
import hashlib

# 🚀 EMBEDDING CACHE - Avoid regenerating embeddings for same queries
_embedding_cache = {}

def get_embedding(text: str) -> list:
    """Get embedding for text using Azure OpenAI with caching"""
    try:
        # Cache key based on text hash
        cache_key = hashlib.md5(text.encode()).hexdigest()
        
        # Return cached embedding if available
        if cache_key in _embedding_cache:
            return _embedding_cache[cache_key]
        
        client = AzureOpenAI(
            api_key=config.AZURE_OPENAI_KEY,
            api_version=config.AZURE_OPENAI_API_VERSION,
            azure_endpoint=config.AZURE_OPENAI_ENDPOINT
        )

        response = client.embeddings.create(
            input=text,
            model=config.AZURE_OPENAI_EMBEDDING_DEPLOYMENT
        )

        embedding = response.data[0].embedding
        _embedding_cache[cache_key] = embedding  # Cache for future use
        return embedding
    except Exception as e:
        print(f"   ⚠️ Embedding error: {e}")
        return None


# Default fields for main_data index (all retrievable fields except content_embedding)
MAIN_DATA_SELECT_FIELDS = [
    "content_id",
    "text_document_id",
    "document_title",
    "image_document_id",
    "content_text",
    "content_path",
    "locationMetadata",
    "file_category_ai",
    "product_category_ai",
    "brand_ai",
    "file_time_period_ai",
    "country_ai",
]

# Default fields for semantic index (keep existing)
SEMANTIC_SELECT_FIELDS = [
    "content_text",
    "document_title",
    "content_path",
    "content_id",
]


@tool
def azure_ai_search(
    query: str,
    index_type: str,
    top_k: int,
    filter: Optional[str] = None,
    facets: Optional[List[str]] = None,
    skip: Optional[int] = None,
    select_fields: Optional[str] = None,
) -> str:
    """Search documents in Azure AI Search. The index stores document CHUNKS, not whole documents.

PARAMETERS:
- query: Search text, or "*" for wildcard (when using filters/facets only)
- index_type: "main_data" (supports all params) or "semantic" (only query, index_type, top_k)
- top_k: Number of results (1-100)
- filter: OData filter (main_data only, CASE-SENSITIVE). ALWAYS add "and text_document_id ne ''" when listing documents to get PDF paths instead of image paths.
- facets: Facetable fields for counting/listing (main_data only). Add ",count:1000" to get up to 1000 values.
  Facetable fields: document_title, text_document_id, content_path, file_category_ai, country_ai
- skip: Pagination offset (main_data only)
- select_fields: Comma-separated fields to return (main_data only).
  VALID fields: document_title, content_path, content_text, content_id, text_document_id, image_document_id, locationMetadata, file_category_ai, product_category_ai, brand_ai, file_time_period_ai, country_ai
  MUST include "content_text" when you need to READ document content. Omit it only for listing/counting.
  NEVER include "content_embedding" (huge float array, useless for analysis) or "blob_id".

EXACT file_category_ai values (case-sensitive):
"Analysis", "Annual presentation", "Brand equity", "Brand Health track", "Concept testing", "Home panel", "Link testing", "Media Optimization", "Miscellaneous", "Needscope", "Post Launch Evaluation", "Product acceptance testing", "Product Performance Evaluation", "Retail audit", "Usage/Attitude (U&A)"

--- FEW-SHOT EXAMPLES ---

Example 1 - Count U&A reports (1 call):
  query="*", index_type="main_data", top_k=1, filter="file_category_ai eq 'Usage/Attitude (U&A)' and text_document_id ne ''", facets=["document_title,count:1000"]
  → Number of facet items = number of unique documents

Example 2 - List all U&A reports with clickable links (1 call):
  query="*", index_type="main_data", top_k=100, filter="file_category_ai eq 'Usage/Attitude (U&A)' and text_document_id ne ''", facets=["document_title,count:1000"], select_fields="document_title,content_path"
  → Facet values = all unique document names; docs array has content_path for links

Example 3 - List brand equity reports with links (1 call):
  query="*", index_type="main_data", top_k=100, filter="file_category_ai eq 'Brand equity' and text_document_id ne ''", facets=["document_title,count:1000"], select_fields="document_title,content_path"

Example 4 - Content search (find insights):
  query="Godrej growth 2022", index_type="main_data", top_k=20
  → Returns full content with page_number for citations. NO facets needed.

Example 5 - Content search with specific fields:
  query="product likability", index_type="main_data", top_k=20, select_fields="content_text,document_title,content_path,locationMetadata"
  → MUST include content_text to read actual text

Example 6 - Specific page of a document:
  query="*", index_type="main_data", top_k=10, filter="locationMetadata/pageNumber eq 6 and document_title eq 'Presentation.pptx'"

Example 7 - List all categories:
  query="*", index_type="main_data", top_k=1, facets=["file_category_ai,count:100"]

--- RULES ---
- USE facets for listing/counting queries (1 call). DO NOT loop per document.
- DO NOT use facets for content/keyword searches.
- ALWAYS add "and text_document_id ne ''" to filter when listing documents.
- WITHOUT ",count:1000" on facets you only get 10 values max.
- DO NOT invent fields (e.g., metadata_storage_last_modified, author, owner do NOT exist).
- For semantic index: ONLY use query, index_type, top_k (no filter/facets/skip/select_fields).
    """

    index_name = (
        config.MAIN_DATA_INDEX_NAME if index_type == "main_data"
        else config.SEMANTIC_INDEX_NAME
    )

    # For semantic index, ignore advanced parameters (they're not supported)
    if index_type != "main_data":
        if filter or facets or skip or select_fields:
            print(f"   ⚠️ Ignoring filter/facets/skip/select_fields for semantic index (not supported)")
        filter = None
        facets = None
        skip = None
        select_fields = None

    print(f"\n🔍 TOOL CALL: azure_ai_search (HYBRID)")
    print(f"   Query: {query}")
    print(f"   Index: {index_type} ({index_name})")
    print(f"   Top K: {top_k}")
    if filter:
        print(f"   Filter: {filter}")
    if facets:
        print(f"   Facets: {facets}")
    if skip:
        print(f"   Skip: {skip}")
    if select_fields:
        print(f"   Select: {select_fields}")

    try:
        client = SearchClient(
            endpoint=config.AZURE_SEARCH_ENDPOINT,
            index_name=index_name,
            credential=AzureKeyCredential(config.AZURE_SEARCH_KEY)
        )

        # Determine select fields
        if select_fields:
            selected = [f.strip() for f in select_fields.split(",")]
        elif index_type == "main_data":
            selected = MAIN_DATA_SELECT_FIELDS
        else:
            selected = SEMANTIC_SELECT_FIELDS

        # Build search parameters
        search_kwargs = {
            "search_text": query,
            "top": min(top_k, 50),
            "select": selected,
        }

        # Add optional filter
        if filter:
            search_kwargs["filter"] = filter

        # Add optional facets
        if facets:
            search_kwargs["facets"] = facets

        # Add optional skip for pagination
        if skip is not None and skip > 0:
            search_kwargs["skip"] = skip

        # Add vector search (skip for wildcard queries)
        is_wildcard = query.strip() == "*"
        if not is_wildcard:
            query_embedding = get_embedding(query)
            if query_embedding:
                vector_query = VectorizedQuery(
                    vector=query_embedding,
                    k_nearest_neighbors=min(top_k, 50),
                    fields="content_embedding"
                )
                search_kwargs["vector_queries"] = [vector_query]
                print(f"   ✓ Using hybrid search (keyword + vector)")
            else:
                print(f"   ⚠️ Using keyword-only search (embedding failed)")
        else:
            print(f"   ✓ Using wildcard search (no vector)")

        # Perform search
        results = client.search(**search_kwargs)

        docs = []
        scores = []
        for result in results:
            content = result.get("content_text", "")
            title = result.get("document_title", "")
            source = result.get("content_path", result.get("document_title", "unknown"))

            if index_type == "main_data":
                # Extract locationMetadata (nested complex type)
                location_metadata = result.get("locationMetadata", {})
                page_number = None
                bounding_polygon = None
                if location_metadata:
                    page_number = location_metadata.get("pageNumber")
                    bounding_polygon = location_metadata.get("boundingPolygon")

                doc = {
                    "id": result.get("content_id"),
                    "text_document_id": result.get("text_document_id", ""),
                    "document_title": title,
                    "image_document_id": result.get("image_document_id", ""),
                    "content": content[:1000],
                    "content_path": source,
                    "page_number": page_number,
                    "bounding_polygon": bounding_polygon,
                    "file_category_ai": result.get("file_category_ai", ""),
                    "product_category_ai": result.get("product_category_ai", ""),
                    "brand_ai": result.get("brand_ai", ""),
                    "file_time_period_ai": result.get("file_time_period_ai", ""),
                    "country_ai": result.get("country_ai", ""),
                    "score": result.get("@search.score", 0.0),
                }
            else:
                # Semantic index - keep existing format
                full_content = f"{title}\n\n{content}" if title else content
                doc = {
                    "id": result.get("content_id"),
                    "content": full_content[:1000],
                    "score": result.get("@search.score", 0.0),
                    "source": source,
                }

            docs.append(doc)
            scores.append(doc["score"])

        avg_score = sum(scores) / len(scores) if scores else 0.0

        print(f"   ✓ Found {len(docs)} docs (avg score: {avg_score:.2f})")
        if docs:
            source_key = "content_path" if index_type == "main_data" else "source"
            print(f"   📄 Top result: {docs[0].get(source_key, '')} (score: {docs[0]['score']:.2f})")
            print(f"   📝 Preview: {docs[0]['content'][:100]}...")

        # Show top 3 results for visibility
        if len(docs) > 1:
            print(f"\n   📋 Top {min(3, len(docs))} Results:")
            for i, doc in enumerate(docs[:3]):
                src = doc.get("content_path", doc.get("source", ""))
                page_info = f" (Page {doc['page_number']})" if doc.get("page_number") else ""
                print(f"      {i+1}. {src}{page_info} (score: {doc['score']:.2f})")
                print(f"         {doc['content'][:80]}...")

        # Build response
        response_data = {
            "docs": docs,
            "metadata": {
                "returned": len(docs),
                "avg_score": round(avg_score, 2),
                "index": index_name,
                "query": query,
                "search_type": "hybrid" if (not is_wildcard and search_kwargs.get("vector_queries")) else "keyword",
            }
        }

        # Add facet results if facets were requested
        if facets:
            try:
                facet_results = results.get_facets()
                if facet_results:
                    formatted_facets = {}
                    for field_name, facet_values in facet_results.items():
                        formatted_facets[field_name] = [
                            {"value": fv["value"], "count": fv["count"]}
                            for fv in facet_values
                        ]
                    response_data["facets"] = formatted_facets
                    print(f"   📊 Facets: {', '.join(f'{k}: {len(v)} values' for k, v in formatted_facets.items())}")

                    # CRITICAL: Create document_list for easy LLM parsing when faceting by document_title
                    if "document_title" in formatted_facets:
                        document_list = []
                        for facet in formatted_facets["document_title"]:
                            doc_title = facet["value"]
                            doc_count = facet["count"]

                            # Find first matching doc to get content_path
                            matching_doc = next((d for d in docs if d.get("document_title") == doc_title), None)
                            if matching_doc:
                                document_list.append({
                                    "title": doc_title,
                                    "url": matching_doc.get("content_path", ""),
                                    "count": doc_count,
                                    "score": matching_doc.get("score", 0.0)
                                })

                        response_data["document_list"] = document_list
                        print(f"   📋 Document List: {len(document_list)} unique documents with URLs")

            except Exception as facet_err:
                print(f"   ⚠️ Facet extraction error: {facet_err}")

        # Add filter/pagination info to metadata
        if filter:
            response_data["metadata"]["filter"] = filter
        if skip:
            response_data["metadata"]["skip"] = skip

        return json.dumps(response_data)

    except Exception as e:
        print(f"   ✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return json.dumps({
            "docs": [],
            "metadata": {
                "error": str(e),
                "index": index_name,
                "query": query
            }
        })
