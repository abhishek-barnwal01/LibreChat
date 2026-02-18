# from langgraph.graph import StateGraph, END
# from models import PipelineState
# from semantic_node import semantic_node
# from persistence import checkpointer
# from clarification_node import clarification_node
# from rag_node import rag_node
# from memory_store import store
# from evaluator_node import evaluator_node
# from formatter_node import formatter_node


# def build_graph():

#     builder = StateGraph(PipelineState)

#     builder.add_node("semantic", semantic_node)
#     builder.add_node("clarification", clarification_node)
#     builder.add_node("rag", rag_node)
#     builder.add_node("evaluator", evaluator_node)
#     builder.add_node("formatter", formatter_node)

#     builder.set_entry_point("semantic")
#     builder.add_edge("semantic", "clarification")
#     builder.add_edge("clarification", "rag")
#     #builder.add_edge("semantic", "rag")
#     #builder.add_edge("rag", END)
#     builder.add_edge("rag", "evaluator")
#     builder.add_edge("evaluator", "formatter")
#     builder.add_edge("formatter", END)

#     app = builder.compile(checkpointer=checkpointer,store=store )
# #     return app

#     return app

    
from langgraph.graph import StateGraph, END
from models import PipelineState
from semantic_node import semantic_node
from clarification_node import clarification_node
from rag_node import rag_node
from evaluator_node import evaluator_node
from formatter_node import formatter_node
from persistence import checkpointer
from memory_store import store


def semantic_router(state: PipelineState):
    """Route from semantic node:
    - If chitchat response generated → END
    - Otherwise → clarification node
    """
    # Check if semantic_chitchat flag is set (chitchat response already generated)
    if hasattr(state, 'semantic_chitchat') and state.semantic_chitchat:
        return END
    
    if state.clarification_message and (not state.ambiguity_detected or not state.ambiguity_detected.ambiguous):
        return "formatter"

    return "clarification"


def clarification_router(state: PipelineState):
    """Route from clarification node:
    - If ambiguity detected → clarification_message set → END
    - Otherwise → continue to RAG
    """
    if state.clarification_message:
        return END
    return "rag"


def build_graph():

    builder = StateGraph(PipelineState)

    builder.add_node("semantic", semantic_node)
    builder.add_node("clarification", clarification_node)
    builder.add_node("rag", rag_node)
    # builder.add_node("evaluator", evaluator_node)
    builder.add_node("formatter", formatter_node)

    builder.set_entry_point("semantic")
    
    # From semantic: route to END if chitchat, else to clarification
    builder.add_conditional_edges(
        "semantic",
        semantic_router,
        {
            "clarification": "clarification",
            "formatter": "formatter",
        },
    )

    # From clarification: route to END if clarification needed, else to RAG
    builder.add_conditional_edges(
        "clarification",
        clarification_router,
        {
            "rag": "rag",
            END: END,
        },
    )

    # builder.add_edge("rag", "evaluator")
    # builder.add_edge("evaluator", "formatter")
    builder.add_edge("rag", "formatter")
    builder.add_edge("formatter", END)

    return builder.compile(
        checkpointer=checkpointer,
        store=store,
    )


# ---------- Streaming Support ----------
import contextvars
import inspect

# ContextVar for passing a progress queue into sync nodes during streaming.
# Set by generate_stream() before launching the graph in a background thread.
# asyncio.to_thread() copies the current context, so nodes running in that
# thread can read this variable even though they are synchronous.
streaming_progress_queue = contextvars.ContextVar(
    'streaming_progress_queue', default=None
)


def _make_progress_node(node_fn, node_name):
    """Wrap a sync node function so it pushes start/end events to the queue."""
    sig = inspect.signature(node_fn)
    accepts_config = 'config' in sig.parameters

    def wrapper(state, config=None):
        q = streaming_progress_queue.get(None)
        if q is not None:
            q.put(("start", node_name))
        try:
            if accepts_config:
                result = node_fn(state, config)
            else:
                result = node_fn(state)
        except Exception:
            if q is not None:
                q.put(("error", node_name))
            raise
        if q is not None:
            q.put(("end", node_name))
        return result

    wrapper.__name__ = f"{node_name}_with_progress"
    return wrapper


def streaming_semantic_router(state: PipelineState):
    """Route from semantic node in streaming mode.

    In streaming mode, chitchat and direct answers go to END
    (the formatter runs externally with token-by-token streaming).
    """
    if hasattr(state, 'semantic_chitchat') and state.semantic_chitchat:
        return END
    if state.clarification_message and (not state.ambiguity_detected or not state.ambiguity_detected.ambiguous):
        return END
    return "clarification"


def build_streaming_graph():
    """Build graph without formatter for streaming mode.

    The formatter LLM is streamed token-by-token externally in generate_stream()
    rather than being run as a graph node. This enables real-time token streaming
    to the client while maintaining node-level progress events.
    """
    builder = StateGraph(PipelineState)

    builder.add_node("semantic", _make_progress_node(semantic_node, "semantic"))
    builder.add_node("clarification", _make_progress_node(clarification_node, "clarification"))
    builder.add_node("rag", _make_progress_node(rag_node, "rag"))

    builder.set_entry_point("semantic")

    builder.add_conditional_edges(
        "semantic",
        streaming_semantic_router,
        {
            "clarification": "clarification",
            END: END,
        },
    )

    builder.add_conditional_edges(
        "clarification",
        clarification_router,
        {
            "rag": "rag",
            END: END,
        },
    )

    builder.add_edge("rag", END)

    return builder.compile(
        checkpointer=checkpointer,
        store=store,
    )

