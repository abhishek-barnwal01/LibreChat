"""FastAPI server with LangGraph + Postgres persistence.

Async endpoints allow concurrent request handling — multiple users
can hit the server simultaneously without blocking each other.
Graph nodes remain synchronous and are offloaded to a thread pool
via asyncio.to_thread so the event loop stays free.
"""

import asyncio
import json
import os
import queue as queue_module
import re
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from langchain_core.messages import HumanMessage, AIMessage

from graph import build_graph, build_streaming_graph, streaming_progress_queue


# ---------- Build LangGraph Flows (sync, runs once at startup) ----------
graph = build_graph()
graph_streaming = build_streaming_graph()


# ---------- Lifespan ----------
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("\n🚀 Starting LangGraph RAG Server (FastAPI + async)...")
    print("💡 POST → http://localhost:5001/chat")
    print('   {"question": "your question", "session_id": "user123"}')
    print("\n💡 POST → http://localhost:5001/v1/chat/completions (LibreChat)")
    print("   OpenAI-compatible endpoint\n")
    yield
    print("Shutting down...")


app = FastAPI(title="LangGraph RAG Server", lifespan=lifespan)


# ---------- Helpers ----------
def append_sas_to_blob_urls(markdown_text: str) -> str:
    """Finds all Azure Blob Storage URLs in markdown and appends SAS token."""
    sas_token = os.getenv("AZURE_BLOB_SAS_TOKEN", "")

    if not sas_token:
        print("⚠️ WARNING: AZURE_BLOB_SAS_TOKEN not set")
        return markdown_text

    blob_pattern = re.compile(
        r"(https://[a-zA-Z0-9]+\.blob\.core\.windows\.net/[^\s\)]+?)(?=[\s\)\]]|$)"
    )

    def add_sas(match):
        url = match.group(1)
        if "sv=" in url or "sig=" in url:
            return url
        separator = "&" if "?" in url else "?"
        return f"{url}{separator}{sas_token}"

    return blob_pattern.sub(add_sas, markdown_text)


# ---------- Chat Endpoint ----------
@app.post("/chat")
async def chat(request: Request):
    """
    Simple chat endpoint.
    Body: {"question": "What is market share?", "session_id": "user123"}
    """
    data = await request.json()
    user_query = data.get("question")
    thread_id = data.get("session_id", "default")

    if not user_query:
        return JSONResponse({"error": "Question required"}, status_code=400)

    try:
        result = await asyncio.to_thread(
            graph.invoke,
            {"user_query": user_query, "user_id": "abhishek"},
            config={"configurable": {"thread_id": thread_id}},
        )

        clarification_msg = result.get("clarification_message")
        if clarification_msg:
            return {
                "response": clarification_msg,
                "needs_clarification": True,
                "session_id": thread_id,
            }

        formatter_result = result.get("formatted", {})
        eval_result = result.get("evaluation", {})
        rag_result = result.get("rag_output", {})
        iteration = result.get("iteration", 0)

        return {
            "response": formatter_result.get("formatted_response", ""),
            "metadata": {
                "confidence": eval_result.get("confidence_score", 0.0),
                "confidence_breakdown": {
                    "relevance": eval_result.get("confidence_breakdown", {}).get("relevance", 0.0),
                    "completeness": eval_result.get("confidence_breakdown", {}).get("completeness", 0.0),
                    "context_match": eval_result.get("confidence_breakdown", {}).get("context_match", 0.0),
                },
                "sources": len(rag_result.get("retrieved_docs", [])),
                "iterations": iteration + 1,
                "enriched_query": result.get("enriched_query", ""),
                "evaluator_reasoning": eval_result.get("reasoning", ""),
            },
            "session_id": thread_id,
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse({"error": str(e), "session_id": thread_id}, status_code=500)


# ---------- History Endpoint ----------
@app.get("/history/{thread_id}")
async def get_history(thread_id: str):
    from persistence import checkpointer

    config = {"configurable": {"thread_id": thread_id}}
    checkpoint = await asyncio.to_thread(checkpointer.get, config)

    if not checkpoint:
        return {"session_id": thread_id, "messages": []}

    channel_values = checkpoint.get("channel_values", {})
    messages = channel_values.get("messages", [])

    serialized_messages = []
    for msg in messages:
        if hasattr(msg, "type") and hasattr(msg, "content"):
            serialized_messages.append({"role": msg.type, "content": msg.content})
        elif isinstance(msg, dict):
            serialized_messages.append({
                "role": msg.get("type", "unknown"),
                "content": msg.get("content", ""),
            })
        else:
            serialized_messages.append({"role": "unknown", "content": str(msg)})

    return {"session_id": thread_id, "messages": serialized_messages}


# ---------- OpenAI-Compatible Endpoint ----------
@app.post("/v1/chat/completions")
async def chat_completions(request: Request):
    """
    LibreChat / OpenAI-compatible endpoint.
    Converts OpenAI message format to LangGraph pipeline format.
    """
    data = await request.json()
    print(data)
    messages = data.get("messages", [])
    stream = data.get("stream", False)
    model = data.get("model", "rag-pipeline")

    # Extract user/session info from headers (LibreChat sends these)
    user_id = request.headers.get("X-User-Id", "anonymous")
    session_id = request.headers.get("X-Conversation-Id", str(uuid.uuid4()))

    if not messages:
        return JSONResponse(
            {"error": {"message": "No messages provided", "type": "invalid_request_error"}},
            status_code=400,
        )

    # Extract user_query from last user message (skip system messages)
    user_query = None
    for msg in reversed(messages):
        if msg.get("role", "").lower() == "user":
            user_query = msg.get("content", "")
            break

    if not user_query:
        return JSONResponse(
            {"error": {"message": "No user message found", "type": "invalid_request_error"}},
            status_code=400,
        )

    # Convert OpenAI format to LangChain format (exclude last user message)
    langchain_messages = []
    for msg in messages[:-1]:
        role = msg.get("role", "").lower()
        content = msg.get("content", "")
        if role == "system":
            continue
        elif role == "user":
            langchain_messages.append(HumanMessage(content=content))
        elif role == "assistant":
            langchain_messages.append(AIMessage(content=content))

    # Streaming
    if stream:
        return StreamingResponse(
            generate_stream(user_query, langchain_messages, user_id, session_id, model),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
                "Connection": "keep-alive",
            },
        )

    # Non-streaming
    try:
        result = await asyncio.to_thread(
            graph.invoke,
            {"user_query": user_query, "messages": langchain_messages, "user_id": user_id},
            config={"configurable": {"thread_id": session_id}},
        )

        clarification_msg = result.get("clarification_message")
        if clarification_msg:
            final_response = clarification_msg
        else:
            final_response = result.get("formatted", {}).get(
                "formatted_response", "I couldn't generate a response."
            )

        response = {
            "id": f"chatcmpl-{uuid.uuid4().hex[:12]}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": model,
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": final_response},
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": sum(len(m.get("content", "").split()) for m in messages),
                "completion_tokens": len(final_response.split()),
                "total_tokens": sum(len(m.get("content", "").split()) for m in messages)
                + len(final_response.split()),
            },
        }

        return JSONResponse(
            response,
            headers={"Content-Type": "application/json; charset=utf-8"},
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(
            {"error": {"message": str(e), "type": "internal_error", "code": "internal_error"}},
            status_code=500,
        )


# ---------- Streaming generator for LibreChat ----------
async def generate_stream(user_query, langchain_messages, user_id, session_id, model):
    """
    Async generator that streams the response as OpenAI SSE chunks.

    Two-phase live streaming:
      Phase 1 — Node-level progress: The streaming graph (no formatter) runs in a
        background thread via asyncio.to_thread(). Each node wrapper pushes
        start/end events to a thread-safe queue.Queue. The async polling loop
        reads these events and yields progress SSE chunks in real-time.
      Phase 2 — Token-level streaming: After the graph completes, the formatter
        LLM is invoked with streaming=True. Tokens are yielded one-by-one as
        SSE content-delta chunks via llm.astream().
    """
    chunk_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
    created_time = int(time.time())

    def make_chunk(delta, finish_reason=None):
        """Build one OpenAI-compatible SSE chunk."""
        return (
            "data: "
            + json.dumps(
                {
                    "id": chunk_id,
                    "object": "chat.completion.chunk",
                    "created": created_time,
                    "model": model,
                    "choices": [
                        {
                            "index": 0,
                            "delta": delta,
                            "finish_reason": finish_reason,
                        }
                    ],
                }
            )
            + "\n\n"
        )

    try:
        # CRITICAL: Send role first — LibreChat needs this for markdown rendering
        yield make_chunk({"role": "assistant"})

        # Node progress labels
        NODE_PROGRESS = {
            "semantic": "🧠 Analyzing your query...",
            "clarification": "🔍 Resolving context...",
            "rag": "📚 Searching and retrieving documents...",
        }

        input_data = {
            "user_query": user_query,
            "messages": langchain_messages,
            "user_id": user_id,
        }
        config = {"configurable": {"thread_id": session_id}}

        # ── Phase 1: Run streaming graph with node-level progress ─────────
        progress_q = queue_module.Queue()
        streaming_progress_queue.set(progress_q)

        print(f"\n📡 STREAMING: Starting for query: {user_query[:100]}")

        # Launch graph in a background thread (sync nodes stay sync)
        graph_task = asyncio.create_task(
            asyncio.to_thread(graph_streaming.invoke, input_data, config)
        )

        # Poll the progress queue while the graph is running
        while not graph_task.done():
            try:
                event_type, node_name = progress_q.get_nowait()
                if event_type == "start":
                    label = NODE_PROGRESS.get(node_name)
                    if label:
                        print(f"📡 STREAMING: Node '{node_name}' started")
                        yield make_chunk({"content": f"*{label}*\n"})
            except queue_module.Empty:
                pass
            await asyncio.sleep(0.1)

        # Drain any events that arrived after the last poll
        while not progress_q.empty():
            try:
                event_type, node_name = progress_q.get_nowait()
                if event_type == "start":
                    label = NODE_PROGRESS.get(node_name)
                    if label:
                        yield make_chunk({"content": f"*{label}*\n"})
            except queue_module.Empty:
                break

        # Retrieve the graph result (raises if the graph failed)
        result = graph_task.result()

        print(f"📡 STREAMING: Graph complete — keys: {list(result.keys())}")

        # ── Phase 2: Determine response type and stream accordingly ───────
        is_chitchat = result.get("semantic_chitchat", False)
        clarification_msg = result.get("clarification_message")
        awaiting = result.get("awaiting_clarification", False)
        rag_output = result.get("rag_output")

        print(
            f"📡 STREAMING: chitchat={is_chitchat}, "
            f"clarification={bool(clarification_msg)}, "
            f"awaiting={awaiting}, rag={bool(rag_output)}"
        )

        if is_chitchat:
            # Chitchat — send the friendly response directly
            response = clarification_msg or "Hello! How can I help?"
            yield make_chunk({"content": "\n" + response})

        elif clarification_msg and awaiting:
            # Clarification question — send directly (no formatting needed)
            yield make_chunk({"content": "\n" + clarification_msg})

        elif clarification_msg and not awaiting and not rag_output:
            # Direct answer from history — format with token streaming
            answer = append_sas_to_blob_urls(clarification_msg)
            yield make_chunk({"content": "*✨ Formatting response...*\n\n"})
            print("📡 STREAMING: Formatter token streaming started (direct answer)")
            async for token in stream_formatter_llm(user_query, answer, 1.0):
                yield make_chunk({"content": token})

        elif rag_output:
            # Normal RAG flow — format the RAG answer with token streaming
            rag_answer = (
                rag_output.get("final_answer", "")
                if isinstance(rag_output, dict)
                else ""
            )
            rag_answer = append_sas_to_blob_urls(rag_answer)
            yield make_chunk({"content": "*✨ Formatting response...*\n\n"})
            print("📡 STREAMING: Formatter token streaming started (RAG answer)")
            async for token in stream_formatter_llm(user_query, rag_answer, 0.8):
                yield make_chunk({"content": token})

        else:
            yield make_chunk({"content": "\nI couldn't generate a response."})

        # ── Finish ────────────────────────────────────────────────────────
        yield make_chunk({}, finish_reason="stop")
        yield "data: [DONE]\n\n"
        print("📡 STREAMING: Complete")

    except Exception as e:
        import traceback

        traceback.print_exc()

        error_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
        error_time = int(time.time())

        def make_error_chunk(delta, finish_reason=None):
            return (
                "data: "
                + json.dumps(
                    {
                        "id": error_id,
                        "object": "chat.completion.chunk",
                        "created": error_time,
                        "model": model,
                        "choices": [
                            {
                                "index": 0,
                                "delta": delta,
                                "finish_reason": finish_reason,
                            }
                        ],
                    }
                )
                + "\n\n"
            )

        yield make_error_chunk({"role": "assistant"})
        yield make_error_chunk(
            {"content": f"\n\n❌ Error: {str(e)}"}, finish_reason="stop"
        )
        yield "data: [DONE]\n\n"


# ---------- Token-by-token formatter streaming ----------
async def stream_formatter_llm(user_query, rag_answer, confidence):
    """Stream the formatter LLM output token-by-token.

    Uses the same formatting instructions as formatter_node but invokes the
    LLM with streaming=True and yields individual tokens as they arrive.

    SAS tokens must be applied to rag_answer BEFORE calling this function
    so that URLs in the streamed output already contain valid SAS tokens.
    """
    import config as agent_config
    from langchain_openai import AzureChatOpenAI

    prompt = f"""You are a professional content formatter for an enterprise RAG system.

Your mission: Transform the RAG answer into a PRODUCTION-GRADE, beautifully formatted response using MARKDOWN.

==================================================
USER'S QUESTION
==================================================
{user_query}

==================================================
RAG'S RAW ANSWER (Unformatted)
==================================================
{rag_answer}

==================================================
CONFIDENCE SCORE: {confidence:.2f} / 1.00
==================================================

==================================================
FORMATTING INSTRUCTIONS
==================================================

Transform the RAW answer above into a POLISHED, PROFESSIONAL response:

1. STRUCTURE & SECTIONS
   - Start with a brief, direct answer to the question (1-2 sentences)
   - Use clear section headers with ### for different topics
   - Separate distinct concepts into logical sections
   - Add blank lines between sections for readability

2. KEY INFORMATION FORMATTING
   - Use **bold** for important numbers, metrics, and key findings
   - Use bullet points (-) for lists of items
   - Use numbered lists (1.) for sequential information or steps
   - Use *italics* for source names, document titles, and time periods

3. DATA PRESENTATION
   - Format percentages clearly: **+16.6% YoY** or **41.6% penetration**
   - Format comparisons: **Brand A** vs **Brand B**
   - Create markdown tables when comparing multiple data points
   - Highlight trends with clear language

4. CITATIONS & SOURCES
   - At the end, add a "### Sources" section
   - Format: 📄 [filename](content_path) (Page N)
   - Always include page numbers when available
   - For LISTING queries: do NOT add separate Sources — the document list IS the answer

5. CLARITY & READABILITY
   - Use short paragraphs (2-4 sentences max)
   - Break up long walls of text
   - Make it scannable — readers should quickly find what they need

6. CONFIDENCE DISCLAIMERS
   - If confidence < 0.85: Add > Note: moderate confidence disclaimer
   - If confidence < 0.65: Add > Disclaimer: low confidence notice

7. ACCURACY
   - Keep ALL numbers, dates, and facts EXACTLY as provided
   - Never fabricate information beyond the raw answer

CRITICAL RULES:
- Output pure markdown directly — NO JSON wrapping, NO code fences around the response
- Do NOT start with "Here is the formatted response" or similar preamble
- Start directly with the answer content
- Preserve all citations and URLs from the raw answer exactly as-is
"""

    llm = AzureChatOpenAI(
        azure_deployment=agent_config.AZURE_OPENAI_DEPLOYMENT,
        azure_endpoint=agent_config.AZURE_OPENAI_ENDPOINT,
        api_key=agent_config.AZURE_OPENAI_KEY,
        api_version=agent_config.AZURE_OPENAI_API_VERSION,
        temperature=1,
        streaming=True,
        timeout=120.0,
        max_retries=2,
    )

    try:
        async for chunk in llm.astream(prompt):
            if chunk.content:
                yield chunk.content
    except Exception as e:
        error_msg = str(e).lower()
        if "jailbreak" in error_msg or "content_filter" in error_msg:
            # Fallback: yield the raw answer without LLM formatting
            print(f"⚠️ Formatter content filter triggered, using raw answer fallback")
            yield f"\n\n## Answer\n\n{rag_answer}\n\n### Sources\nRefer to original documents."
        else:
            raise


# ---------- Run Server ----------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=5001)
