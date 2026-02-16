# rag_node.py
"""RAG Node - Full prompt with retrieval, synthesis, and citations"""

from typing import Dict, Any, List
from langchain_openai import AzureChatOpenAI
from langchain_core.messages import ToolMessage
from langchain_community.document_compressors import FlashrankRerank
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from tools import azure_ai_search
from models import RAGOutput, PipelineState
import config
import json
from memory_store import store


# ----- Add this helper at the top of rag_node.py -----
def safe_utf8(text: str) -> str:
    if not text:
        return ""
    # Replace invalid UTF-8 characters with '?'
    # Also remove null bytes which PostgreSQL cannot handle in JSON
    cleaned = text.encode("utf-8", errors="replace").decode("utf-8")
    return cleaned.replace("\x00", "")


def filter_sensitive_content(text: str) -> str:
    """Remove or replace content that might trigger Azure content filters"""
    if not text:
        return ""
    
    # Replace potentially problematic patterns
    filtered = text
    
    # Common filter triggers - replace with safe alternatives
    filter_patterns = {
        r'(?i)content.*filter': 'content validation',
        r'(?i)harmful': 'inappropriate',
        r'(?i)violence|violent': 'aggressive',
        r'(?i)hate|hateful': 'prejudiced',
        r'(?i)abuse|abusive': 'harmful behavior',
    }
    
    import re
    for pattern, replacement in filter_patterns.items():
        try:
            filtered = re.sub(pattern, replacement, filtered)
        except:
            pass
    
    return filtered


def rerank_documents(documents: List[Dict[str, Any]], query: str, top_k: int = 10) -> List[Dict[str, Any]]:
    """
    Rerank documents using FlashRank for better relevance ordering.
    Skip reranking for small result sets where Azure Search scores are already good.
    
    Args:
        documents: List of document chunks from search results
        query: The user query to rerank against
        top_k: Number of top reranked documents to return
    
    Returns:
        List of reranked documents sorted by relevance score
    """
    try:
        # Skip reranking for small result sets
        if not documents or not query or len(documents) < 5:
            return documents[:top_k]
        
        # Initialize FlashRank reranker (uses default model)
        reranker = FlashrankRerank()
        
        # Convert search results to LangChain Document format
        docs_to_rerank = [
            Document(
                page_content=doc.get("content_text", doc.get("description", "")),
                metadata={
                    "filename": doc.get("filename", ""),
                    "content_path": doc.get("content_path", ""),
                    "pages": doc.get("pages", ""),
                    "score": doc.get("score", 0),
                }
            )
            for doc in documents if doc.get("content_text") or doc.get("description")
        ]
        
        if not docs_to_rerank:
            return documents
        
        # Rerank documents using FlashRank
        reranked_docs = reranker.compress_documents(docs_to_rerank, query)
        
        # Convert back to original format with FlashRank scores
        reranked_results = [
            {
                **doc.metadata,
                "content_text": doc.page_content,
                "flashrank_score": getattr(doc, 'score', 0),
            }
            for doc in reranked_docs[:top_k]
        ]
        
        return reranked_results
    
    except Exception as e:
        print(f"⚠️ FlashRank reranking failed: {str(e)}")
        # Fallback: return original documents if reranking fails
        return documents[:top_k]


# ------------------------------------------------------
def sanitize_any(obj):
    if obj is None:
        return None
    if isinstance(obj, str):
        return safe_utf8(obj)
    if isinstance(obj, list):
        return [sanitize_any(i) for i in obj]
    if isinstance(obj, dict):
        return {k: sanitize_any(v) for k, v in obj.items()}
    return obj


def create_llm():
    return AzureChatOpenAI(
        azure_deployment=config.AZURE_OPENAI_DEPLOYMENT,
        azure_endpoint=config.AZURE_OPENAI_ENDPOINT,
        api_key=config.AZURE_OPENAI_KEY,
        api_version=config.AZURE_OPENAI_API_VERSION,
        temperature=1,
        timeout=120.0,
        max_retries=3,
    )


def execute_tool_calls(tool_calls: list, tools_map: dict) -> list:
    tool_messages = []
    for tool_call in tool_calls:
        if hasattr(tool_call, "name"):
            tool_name = tool_call.name
            tool_args = tool_call.args
            tool_id = tool_call.id
        else:
            tool_name = tool_call["name"]
            tool_args = tool_call["args"]
            tool_id = tool_call["id"]

        if isinstance(tool_args, str):
            try:
                tool_args = json.loads(tool_args)
            except json.JSONDecodeError:
                tool_messages.append(
                    ToolMessage(
                        content=json.dumps(
                            {"error": f"Invalid JSON in tool args: {tool_args}"}
                        ),
                        tool_call_id=tool_id,
                    )
                )
                continue

        if tool_name in tools_map:
            try:
                result = tools_map[tool_name].invoke(tool_args)
                tool_messages.append(ToolMessage(content=result, tool_call_id=tool_id))
            except Exception as e:
                tool_messages.append(
                    ToolMessage(
                        content=json.dumps({"error": str(e)}), tool_call_id=tool_id
                    )
                )
        else:
            tool_messages.append(
                ToolMessage(
                    content=json.dumps({"error": f"Unknown tool: {tool_name}"}),
                    tool_call_id=tool_id,
                )
            )
    return tool_messages

def rag_node(state: PipelineState) -> Dict[str, Any]:
    """
    Full RAG node with multi-phase document retrieval, page-level extraction, synthesis,
    citations, and quality standards. Uses full enterprise-grade prompt.
    """
    print("\n" + "="*70)
    print("📚 RAG NODE")
    print("RAG MESSAGES:")
    last_msgs = state.messages[-5:]
    for i, msg in enumerate(last_msgs):
        print(f"{i+1}. {msg.type}: {msg.content[:200]}") 

    user_query = state.user_query
    enriched_query = state.enriched_query or ""
    messages = state.messages

    user_memories = store.search(
        ("rag_memory", state.user_id),
        query=None,   # no semantic filtering, just fetch recent
        limit=5
    )

# 🔹 Step 2: Format them for prompt
    if user_memories:
        docs_text = "Previously retrieved documents for reference:\n"
        for i, doc in enumerate(user_memories, start=1):
            filename = doc.value.get("filename", "")
            content_path = doc.value.get("content_path", "")
            description_preview = doc.value.get("description", "")[:300]
            pages = doc.value.get("pages", "")
            docs_text += f"- Doc {i}: {filename} ({content_path}) [Pages: {pages}] {description_preview}\n"
    else:
        docs_text = "No prior retrieved documents."

    llm = create_llm()
    tools = [azure_ai_search]
    tools_map = {"azure_ai_search": azure_ai_search}
    llm_with_tools = llm.bind_tools(tools)

    # Focused RAG prompt - tool description handles "how to use the tool"
    prompt_text = """You are a RAG retrieval and analysis agent. Use the azure_ai_search tool to find documents, then synthesize professional answers with citations.

RETRIEVAL STRATEGY — Pick the right approach for each query type:

1. LISTING/COUNTING ("List all X", "How many X"):
   → Use facets in ONE call. Never loop per document.
   → Include ALL documents from facets in your response — do NOT filter or subset them.

2. CONTENT SEARCH ("What does X say about Y", "Find insights on Z"):
   → Use keyword search with top_k=10-50. No facets needed.
   → Include content_text in select_fields if you need to read the text.

3. PAGE-SPECIFIC ("What's on page 6 of Report.pdf"):
   → Use filter with locationMetadata/pageNumber.

SYNTHESIS RULES:
- Executive Summary (2-3 sentences), then Detailed Analysis with inline citations, then Key Takeaways (3-5 bullets).
- ALWAYS cite with page numbers: 📄 [filename](content_path) (Page N)
- For listing queries: return ALL documents from search, not a filtered subset.
- Evidence-based claims only — do not fabricate information.

OUTPUT — Return valid JSON:
{{
  "retrieved_docs": [
    {{"filename": "string", "content_path": "string", "score": 0.0, "pages": "string", "description": "string"}}
  ],
  "final_answer": "string (markdown with citations)",
  "search_strategy": "string (brief description of approach taken)",
  "reasoning": "string (why this strategy was chosen)",
  "total_searches": 0
}}

CRITICAL:
- For listing queries, retrieved_docs MUST contain ALL documents found (e.g., if facets return 36 documents, include all 36).
- Include page numbers in every citation from locationMetadata/pageNumber.
- Use content_path from search results for links — never reconstruct URLs.
"""

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", prompt_text),
            MessagesPlaceholder("messages"),
            ("human", "Original query: {user_query}\nEnriched query: {enriched_query}"),
        ]
    )

    initial_messages = prompt.format_messages(
        user_query=user_query, enriched_query=enriched_query, messages=messages,memories_text=docs_text
    )

    agent_messages = list(initial_messages)
    all_new_messages = []
    max_iterations = 10
    response = None

    for iteration in range(max_iterations):
        try:
            # 🔹 Filter sensitive content from messages before sending
            filtered_messages = []
            for msg in agent_messages:
                if hasattr(msg, 'content') and isinstance(msg.content, str):
                    msg.content = filter_sensitive_content(msg.content)
                filtered_messages.append(msg)
            
            response = llm_with_tools.invoke(filtered_messages)

        except ValueError as e:
            if "content filter" in str(e).lower():
                print(f"\n⚠️ CONTENT FILTER TRIGGERED (Iteration {iteration})")
                print(f"   Error: {str(e)[:200]}")
                print(f"   Attempting to generate simpler response...")
                
                # Fallback: Try with simplified prompt
                from langchain_core.messages import HumanMessage, AIMessage
                fallback_messages = [
                    ("system", "Generate a professional data analysis response with citations."),
                    ("human", f"User query: {user_query}")
                ]
                fallback_prompt = ChatPromptTemplate.from_messages(fallback_messages)
                fallback_llm = create_llm()
                
                try:
                    response = fallback_llm.invoke(
                        fallback_prompt.format_messages(user_query=user_query)
                    )
                    print(f"   ✓ Fallback response generated successfully")
                    break
                except Exception as fallback_error:
                    print(f"   ✗ Fallback also failed: {str(fallback_error)[:100]}")
                    raise
            else:
                raise

        # 🔹 Sanitize AI message content before saving
        if response.content:
            response.content = safe_utf8(response.content)

        # Append AI message
        agent_messages.append(response)
        all_new_messages.append(response)

        if response.tool_calls:
            tool_messages = execute_tool_calls(response.tool_calls, tools_map)

            # � OPTIMIZATION: Parse JSON once, reuse parsed result
            parsed_results = {}  # Cache parsed JSON to avoid re-parsing
            for tool_msg in tool_messages:
                try:
                    # Only parse once
                    if tool_msg.content not in parsed_results:
                        tool_result = json.loads(tool_msg.content)
                        parsed_results[tool_msg.content] = tool_result
                    else:
                        tool_result = parsed_results[tool_msg.content]
                    
                    if isinstance(tool_result, dict) and "documents" in tool_result:
                        original_docs = tool_result.get("documents", [])
                        if original_docs:
                            # Rerank using the user query
                            reranked = rerank_documents(original_docs, user_query, top_k=len(original_docs))
                            tool_result["documents"] = reranked
                            tool_msg.content = json.dumps(tool_result)
                            print(f"✅ Reranked {len(reranked)} documents using FlashRank")
                except (json.JSONDecodeError, Exception) as e:
                    print(f"⚠️ Document reranking skipped: {str(e)}")

            # 🔹 Sanitize all tool messages
            for tm in tool_messages:
                if tm.content:
                    tm.content = safe_utf8(tm.content)

            agent_messages.extend(tool_messages)
            all_new_messages.extend(tool_messages)
        else:
            break

    raw_output = response.content if response else ""

    # DEBUG: Print raw output before parsing
    print("\n" + "-"*70)
    print("🐛 DEBUG: RAG NODE - Raw LLM Output")
    print("-"*70)
    print(f"Raw Output Length: {len(raw_output)} chars")
    print(f"Raw Output (first 500 chars):\n{raw_output[:500]}")
    print(f"Raw Output (last 500 chars):\n{raw_output[-500:]}")
    print(f"Total docs count in raw output: {raw_output.count('filename')}")
    print("-"*70)

    llm_structured = create_llm().with_structured_output(
        RAGOutput, method="function_calling"
    )
    output: RAGOutput = llm_structured.invoke(raw_output)
    
    # DEBUG: Print structured output before returning
    print("\n" + "-"*70)
    print("🐛 DEBUG: RAG NODE - Structured Output")
    print("-"*70)
    print(f"Output Type: {type(output)}")
    print(f"Output Dict:\n{json.dumps(output.dict(), indent=2, default=str)}")
    print("-"*70)
    if output.retrieved_docs:
        for i, d in enumerate(output.retrieved_docs):
            store.put(
                namespace=("rag_memory", state.user_id),  # tuple namespace
                key=f"doc_{i}_{hash(d.description) % 100000}",  # unique key per doc
                value={
                    "type": "retrieved_doc",
                    "filename": safe_utf8(d.filename),
                    "content_path": safe_utf8(d.content_path),
                    "description": safe_utf8(d.description),
                    "pages": d.pages,
                    "score": d.score,
                }
            )
        print(f"📚 Stored {len(output.retrieved_docs)} RAG docs to PostgresStore")


    return {
        "messages": sanitize_any(all_new_messages),
        "rag_output": sanitize_any(output.dict()),
    }
