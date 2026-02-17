"""Flask API with LangGraph + Postgres persistence"""

from flask import Flask, request, jsonify, Response, stream_with_context
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from graph import build_graph
import threading
import uuid
import time
import json
import os

app = Flask(__name__)

# ---------- Build LangGraph Flow ----------
graph = build_graph()  # this must return COMPILED graph


# ---------- Chat Endpoint ----------
@app.route("/chat", methods=["POST"])

# chat completion 
# username, 
def chat():
    """
    Body:
    {
        "question": "What is market share?",
        "session_id": "user123"
    }
    """
    data = request.json or {}
    user_query = data.get("question")
    thread_id = data.get("session_id", "default")

    if not user_query:
        return jsonify({"error": "Question required"}), 400

    try:
        # Only pass new input - let checkpoint restore the rest
        result = graph.invoke(
            {"user_query": user_query, "user_id": "abhishek"},
            config={"configurable": {"thread_id": thread_id}},
        )

        clarification_msg = result.get("clarification_message")
        if clarification_msg:
            # Return clarification to user without running RAG
            return jsonify({
                "response": clarification_msg,
                "needs_clarification": True,
                "session_id": thread_id
            })

        # return jsonify(
        #     {
        #         # "response": result["rag_output"]["final_answer"],
        #         "response": result["formatted"]["formatted_response"],
        #         "rag_output": result["rag_output"],
        #         "evaluation": result.get("evaluation"),
        #         "session_id": thread_id,
        #     }
        # )

        # Prepare pieces safely
        formatter_result = result.get("formatted", {})
        eval_result = result.get("evaluation", {})
        rag_result = result.get("rag_output", {})
        semantic_result = result  # contains enriched_query etc.
        iteration = result.get("iteration", 0)  # optional, if you track iterations

        return jsonify({
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
                "enriched_query": semantic_result.get("enriched_query", ""),
                "evaluator_reasoning": eval_result.get("reasoning", ""),
            },
            "session_id": thread_id,
        })


    except Exception as e:
        import traceback

        traceback.print_exc()
        return jsonify({"error": str(e), "session_id": thread_id}), 500

# ---------- History Endpoint ----------
@app.route("/history/<thread_id>", methods=["GET"])
def get_history(thread_id):
    from persistence import checkpointer

    config = {"configurable": {"thread_id": thread_id}}
    checkpoint = checkpointer.get(config)

    if not checkpoint:
        return jsonify({"session_id": thread_id, "messages": []})

    # ✅ Messages are stored in channel_values["messages"]
    channel_values = checkpoint.get("channel_values", {})
    messages = channel_values.get("messages", [])

    serialized_messages = []
    for msg in messages:
        # msg can be a dict or LangChain message object
        if hasattr(msg, "type") and hasattr(msg, "content"):
            serialized_messages.append({"role": msg.type, "content": msg.content})
        elif isinstance(msg, dict):
            serialized_messages.append({
                "role": msg.get("type", "unknown"),
                "content": msg.get("content", "")
            })
        else:
            serialized_messages.append({"role": "unknown", "content": str(msg)})

    return jsonify({"session_id": thread_id, "messages": serialized_messages})


# ---------- OpenAI-Compatible Endpoint ----------
@app.route("/v1/chat/completions", methods=["POST"])
def chat_completions():
    """
    LibreChat/OpenAI-compatible endpoint.
    Converts OpenAI format to LangGraph pipeline format.
    """
    data = request.json or {}
    print(data)
    messages = data.get("messages", [])
    stream = data.get("stream", False)
    model = data.get("model", "rag-pipeline")

    # Extract user/session info from headers (LibreChat sends these)
    user_id = request.headers.get("X-User-Id", "anonymous")
    session_id = request.headers.get("X-Conversation-Id", str(uuid.uuid4()))
    print(request)

    if not messages:
        return jsonify({
            "error": {"message": "No messages provided", "type": "invalid_request_error"}
        }), 400

    # Extract user_query from last user message (skip system messages)
    user_query = None
    for msg in reversed(messages):
        role = msg.get("role", "").lower()
        if role == "user":
            user_query = msg.get("content", "")
            break
    
    if not user_query:
        return jsonify({
            "error": {"message": "No user message found", "type": "invalid_request_error"}
        }), 400

    # Convert OpenAI format (role: user/assistant/system) to LangChain format
    # Filter out system messages as they are handled by the LLM prompts
    langchain_messages = []
    for msg in messages[:-1]:  # Exclude last user message (it's now user_query)
        role = msg.get("role", "").lower()
        content = msg.get("content", "")
        
        # Skip system messages - they shouldn't be part of chat history
        if role == "system":
            continue
        elif role == "user":
            langchain_messages.append(HumanMessage(content=content))
        elif role == "assistant":
            langchain_messages.append(AIMessage(content=content))

    # For clarification, don't stream - return immediately
    # Check if this will result in clarification by doing a quick graph check
    # Actually, we should just handle streaming but check for clarification in generate_stream
    
    # For clarification, don't stream - return immediately
    # Check if this will result in clarification by doing a quick graph check
    # Actually, we should just handle streaming but check for clarification in generate_stream
    
    # Streaming version
    if stream:
        return Response(
            stream_with_context(generate_stream(user_query, langchain_messages, user_id, session_id, model)),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'X-Accel-Buffering': 'no',
                'Connection': 'keep-alive'
            }
        )

    # Non-streaming version
    try:
        result = graph.invoke(
            {
                "user_query": user_query,
                "messages": langchain_messages,
                "user_id": user_id
            },
            config={"configurable": {"thread_id": session_id}}
        )

        # Handle clarification if needed
        clarification_msg = result.get("clarification_message")
        if clarification_msg:
            final_response = clarification_msg
        else:
            final_response = result.get("formatted", {}).get("formatted_response", "I couldn't generate a response.")

        response = {
            "id": f"chatcmpl-{uuid.uuid4().hex[:12]}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": model,
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": final_response},
                    "finish_reason": "stop"
                }
            ],
            "usage": {
                "prompt_tokens": sum(len(m.get("content", "").split()) for m in messages),
                "completion_tokens": len(final_response.split()),
                "total_tokens": sum(len(m.get("content", "").split()) for m in messages) + len(final_response.split())
            }
        }

        # Return with explicit charset to handle markdown rendering
        resp = jsonify(response)
        resp.headers['Content-Type'] = 'application/json; charset=utf-8'
        return resp

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": {
                "message": str(e),
                "type": "internal_error",
                "code": "internal_error"
            }
        }), 500

import re

def append_sas_to_blob_urls(markdown_text: str) -> str:
    """
    Finds all Azure Blob Storage URLs in markdown and appends SAS token.
    """
    sas_token = os.getenv('AZURE_BLOB_SAS_TOKEN', '')
    
    if not sas_token:
        print("⚠️ WARNING: AZURE_BLOB_SAS_TOKEN not set")
        return markdown_text
    
    # Pattern to match blob URLs
    blob_pattern = re.compile(
        r'(https://[a-zA-Z0-9]+\.blob\.core\.windows\.net/[^\s\)]+?)(?=[\s\)\]]|$)'
    )
    
    def add_sas(match):
        url = match.group(1)
        
        # Skip if SAS already present
        if 'sv=' in url or 'sig=' in url:
            return url
        
        # Append SAS token
        separator = '&' if '?' in url else '?'
        return f"{url}{separator}{sas_token}"
    
    return blob_pattern.sub(add_sas, markdown_text)

# ---------- Streaming generator for LibreChat ----------
def _make_chunk(chunk_id, created_time, model, content=None, role=None, finish_reason=None):
    """Helper to build an OpenAI SSE chunk."""
    delta = {}
    if role:
        delta["role"] = role
    if content is not None:
        delta["content"] = content
    return {
        "id": chunk_id,
        "object": "chat.completion.chunk",
        "created": created_time,
        "model": model,
        "choices": [{"index": 0, "delta": delta, "finish_reason": finish_reason}],
    }


class CancelledError(Exception):
    """Raised inside graph nodes when the client disconnects."""
    pass


def check_cancelled(config):
    """Call at the top of every node to bail out early on cancellation."""
    cancel_event = config.get("configurable", {}).get("cancel_event")
    if cancel_event is not None and cancel_event.is_set():
        raise CancelledError("Client disconnected")


def generate_stream(user_query, langchain_messages, user_id, session_id, model):
    """
    Streams the response with tool call markers for LibreChat's frontend.

    Runs graph.invoke() in a background thread so the generator can detect
    client disconnects (stop button / chat switch) via SSE heartbeats.
    When the client disconnects, cancel_event is set, which causes the
    currently executing node to raise CancelledError and stop the graph.

    Flow:
    1. Run graph in background thread with cancel_event in config
    2. Send heartbeats while waiting (detects client disconnect)
    3. On disconnect -> set cancel_event -> graph nodes bail out
    4. On success -> stream role, tool call markers, and final text
    """
    result_container = {}
    error_container = {}
    done_event = threading.Event()
    cancel_event = threading.Event()

    def run_graph():
        try:
            result_container['result'] = graph.invoke(
                {
                    "user_query": user_query,
                    "messages": langchain_messages,
                    "user_id": user_id,
                },
                config={
                    "configurable": {
                        "thread_id": session_id,
                        "cancel_event": cancel_event,
                    }
                },
            )
        except CancelledError:
            print(f"[run_graph] Graph cancelled for session {session_id}")
        except Exception as e:
            if not cancel_event.is_set():
                error_container['error'] = e
        finally:
            done_event.set()

    thread = threading.Thread(target=run_graph, daemon=True)
    thread.start()

    chunk_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
    created_time = int(time.time())

    # Wait for graph completion, sending SSE comments as heartbeats.
    # If client disconnects, the yield raises GeneratorExit (or the
    # WSGI server closes the generator), stopping this function.
    try:
        while not done_event.wait(timeout=2.0):
            yield ": heartbeat\n\n"
    except GeneratorExit:
        print(f"[generate_stream] Client disconnected for session {session_id}, cancelling graph")
        cancel_event.set()
        return

    if cancel_event.is_set():
        return

    if 'error' in error_container:
        import traceback
        traceback.print_exc()

        yield f"data: {json.dumps(_make_chunk(chunk_id, created_time, model, role='assistant'))}\n\n"
        yield f"data: {json.dumps(_make_chunk(chunk_id, created_time, model, content=f'\\n\\n Error: {str(error_container[\"error\"])}', finish_reason='stop'))}\n\n"
        yield "data: [DONE]\n\n"
        return

    result = result_container['result']

    try:
        # 1. Send role first (critical for markdown rendering)
        yield f"data: {json.dumps(_make_chunk(chunk_id, created_time, model, role='assistant'))}\n\n"

        # 2. Extract tool calls from messages and send as markers
        messages = result.get("messages", [])
        tool_call_map = {}  # track id -> {name, args} for pairing with results
        step_index = 0

        for msg in messages:
            # AI message with tool_calls
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    tc_id = tc.get("id", f"call_{uuid.uuid4().hex[:8]}")
                    tc_name = tc.get("name", "unknown")
                    tc_args = tc.get("args", {})
                    tool_call_map[tc_id] = {"name": tc_name, "args": tc_args, "step_index": step_index}

                    marker = f'<!-- TOOL_CALL:{json.dumps({"id": tc_id, "name": tc_name, "args": tc_args, "step_index": step_index})} -->'
                    yield f"data: {json.dumps(_make_chunk(chunk_id, created_time, model, content=marker))}\n\n"
                    step_index += 1

            # ToolMessage with result
            elif hasattr(msg, "tool_call_id") and msg.tool_call_id:
                tc_id = msg.tool_call_id
                tc_info = tool_call_map.get(tc_id, {})
                output = (msg.content or "")[:2000]
                if len(msg.content or "") > 2000:
                    output += "...(truncated)"

                marker = f'<!-- TOOL_RESULT:{json.dumps({"id": tc_id, "name": tc_info.get("name", ""), "args": json.dumps(tc_info.get("args", {})), "output": output, "step_index": tc_info.get("step_index", 0)})} -->'
                yield f"data: {json.dumps(_make_chunk(chunk_id, created_time, model, content=marker))}\n\n"

        # 3. Stream final text response
        clarification_msg = result.get("clarification_message")
        if clarification_msg:
            final_response = clarification_msg
        else:
            final_response = result.get("formatted", {}).get("formatted_response", "")
            final_response = append_sas_to_blob_urls(final_response)

        # Send text in one chunk (preserves markdown formatting)
        if final_response:
            yield f"data: {json.dumps(_make_chunk(chunk_id, created_time, model, content=final_response))}\n\n"

        # 4. Done
        yield f"data: {json.dumps(_make_chunk(chunk_id, created_time, model, finish_reason='stop'))}\n\n"
        yield "data: [DONE]\n\n"

    except GeneratorExit:
        print(f"[generate_stream] Client disconnected during response for session {session_id}")
        cancel_event.set()
        return

# ---------- Search Tool Endpoint (for LibreChat Agent OpenAPI Action) ----------
@app.route("/v1/tools/search", methods=["POST"])
def tool_search():
    """
    Exposes azure_ai_search as a REST endpoint for LibreChat Agent OpenAPI Actions.
    This allows a LibreChat Agent to call this tool natively with tool call UI.
    """
    from tools import azure_ai_search

    data = request.json or {}

    query = data.get("query", "*")
    index_type = data.get("index_type", "main_data")
    top_k = data.get("top_k", 10)
    filter_str = data.get("filter", None)
    facets = data.get("facets", None)
    skip = data.get("skip", None)
    select_fields = data.get("select_fields", None)

    try:
        result = azure_ai_search.invoke({
            "query": query,
            "index_type": index_type,
            "top_k": top_k,
            "filter": filter_str,
            "facets": facets,
            "skip": skip,
            "select_fields": select_fields,
        })
        return Response(result, mimetype="application/json")
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ---------- Run Flask ----------
if __name__ == "__main__":
    print("\n🚀 Starting LangGraph RAG Server...")
    print("💡 POST → http://localhost:5001/chat")
    print('   {"question": "your question", "session_id": "user123"}')
    print("\n💡 POST → http://localhost:5001/v1/chat/completions (LibreChat)")
    print('   OpenAI-compatible endpoint')
    print("\n💡 POST → http://localhost:5001/v1/tools/search (Agent Tool)")
    print('   OpenAPI Action endpoint for LibreChat Agents\n')
    app.run(debug=False, port=5001, host='0.0.0.0')
