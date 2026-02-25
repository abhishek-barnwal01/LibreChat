"""FastAPI server with LangGraph + Postgres persistence.

Async endpoints allow concurrent request handling — multiple users
can hit the server simultaneously without blocking each other.
Graph nodes remain synchronous and are offloaded to a thread pool
via asyncio.to_thread so the event loop stays free.
"""

import asyncio
import json
import os
import re
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from langchain_core.messages import HumanMessage, AIMessage

from graph import build_graph


# ---------- Build LangGraph Flow (sync, runs once at startup) ----------
graph = build_graph()


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

        formatted_response = result.get("formatted", {}).get("formatted_response", "")
        clarification_msg = result.get("clarification_message", "")
        final_response = formatted_response or clarification_msg or "I couldn't generate a response."

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


# ---------- SSE chunk helpers ----------
def _sse_chunk(chunk_id: str, created_time: int, model: str, *, delta: dict, finish_reason=None) -> str:
    return f"data: {json.dumps({'id': chunk_id, 'object': 'chat.completion.chunk', 'created': created_time, 'model': model, 'choices': [{'index': 0, 'delta': delta, 'finish_reason': finish_reason}]})}\n\n"


# ---------- Streaming generator for LibreChat ----------
async def generate_stream(user_query, langchain_messages, user_id, session_id, model):
    """
    Real-time streaming via graph.astream_events():

    astream_events(version="v2") runs the full LangGraph pipeline and emits
    LangChain callback events as the graph executes.  We intercept
    on_chat_model_stream events from the "rag" node and forward each content
    token straight to SSE — the user sees the first word the moment the
    synthesis LLM starts generating, 5-15 s before the graph would otherwise
    finish and return.

    Tool-calling iterations inside rag_node emit chunks with empty .content
    (they carry tool_call_chunks instead), so filtering on non-empty content
    automatically limits streaming to the final synthesis call only.

    Non-RAG paths (chitchat, clarification questions, history-answered replies)
    produce no rag-node tokens.  For those we collect the state update emitted
    by the relevant node's on_chain_end event and send it as a single chunk.
    """
    chunk_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
    created_time = int(time.time())

    try:
        config = {"configurable": {"thread_id": session_id}}
        inputs = {
            "user_query": user_query,
            "messages": langchain_messages,
            "user_id": user_id,
            "skip_formatter": True,  # prevent formatter from making its own LLM call
        }

        role_sent = False      # have we sent {"role": "assistant"} yet?
        rag_tokens_sent = False  # did we stream any RAG synthesis tokens?
        node_outputs: dict = {}  # last on_chain_end output per graph node

        async for event in graph.astream_events(inputs, config=config, version="v2"):
            kind = event["event"]

            # ── Capture each node's output for the non-RAG fallback ──────────
            if kind == "on_chain_end":
                node = event.get("metadata", {}).get("langgraph_node", "")
                if node:
                    out = event["data"].get("output")
                    if isinstance(out, dict):
                        node_outputs[node] = out

            # ── Stream RAG synthesis tokens ───────────────────────────────────
            if kind != "on_chat_model_stream":
                continue
            if event.get("metadata", {}).get("langgraph_node") != "rag":
                continue

            chunk = event["data"]["chunk"]
            token: str = chunk.content if hasattr(chunk, "content") else ""
            if not token:
                # Tool-call chunk (content is empty); skip silently.
                continue

            if not role_sent:
                yield _sse_chunk(chunk_id, created_time, model, delta={"role": "assistant"})
                role_sent = True

            rag_tokens_sent = True
            yield _sse_chunk(chunk_id, created_time, model, delta={"content": token})

        # ── Non-RAG path: chitchat / clarification / history-answered ─────────
        if not rag_tokens_sent:
            semantic_out = node_outputs.get("semantic", {})
            clarification_out = node_outputs.get("clarification", {})

            semantic_chitchat: bool = semantic_out.get("semantic_chitchat", False)
            awaiting_clarification: bool = (
                clarification_out.get("awaiting_clarification")
                or semantic_out.get("awaiting_clarification", False)
            )
            clarification_msg: str = (
                clarification_out.get("clarification_message")
                or semantic_out.get("clarification_message")
                or ""
            )

            print(f"📄 Non-RAG path — chitchat={semantic_chitchat} "
                  f"awaiting={awaiting_clarification} msg={bool(clarification_msg)}")

            final_response = clarification_msg or "I couldn't generate a response."
            yield _sse_chunk(chunk_id, created_time, model, delta={"role": "assistant"})
            yield _sse_chunk(chunk_id, created_time, model, delta={"content": final_response})

        yield _sse_chunk(chunk_id, created_time, model, delta={}, finish_reason="stop")
        yield "data: [DONE]\n\n"

    except Exception as e:
        import traceback
        traceback.print_exc()

        yield _sse_chunk(chunk_id, created_time, model, delta={"role": "assistant"})

        # Sanitize error message — never echo filter-related keywords back into
        # chat history (they would trigger Azure's content filter on every
        # subsequent request, creating a self-perpetuating loop).
        raw_err = str(e).lower()
        if any(kw in raw_err for kw in ("jailbreak", "content_filter", "content filter", "responsibleai")):
            safe_error = "I wasn't able to format that response due to a content policy check. Please try rephrasing your question."
        else:
            safe_error = "Something went wrong while processing your request. Please try again."

        yield _sse_chunk(chunk_id, created_time, model, delta={"content": safe_error}, finish_reason="stop")
        yield "data: [DONE]\n\n"


# ---------- Run Server ----------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=5001)
