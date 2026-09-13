"""Tests for the multi-agent orchestrator."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tools.orchestrator import run_orchestrator

fails = []
def check(l, c, d=""):
    print(("PASS  " if c else "FAIL  ") + l + (f"  -> {d}" if d and not c else ""))
    if not c: fails.append(l)

def scripted(*turns):
    """Returns a chat_fn that replays canned assistant messages in order."""
    state = {"i": 0, "seen": []}
    def fn(model, messages, tools=None, images=None, num_ctx=None, **kw):
        state["seen"].append(len(tools or []))
        i = state["i"]; state["i"] += 1
        return turns[i] if i < len(turns) else {"role": "assistant", "content": "done"}
    fn.state = state
    return fn

def tc(name, args):
    return {"role": "assistant", "tool_calls": [{"function": {"name": name, "arguments": args}}]}

# Since run_orchestrator directly imports run from agent, we must mock the chat_fn inside tools.agent.
# A simpler way is to monkeypatch tools.agent.chat for the duration of the test.
import tools.agent

# --- Test 1: Full Orchestration Flow ---
# Planner plan -> Researcher calls list_files -> Writer calls generate_docx
original_chat = tools.agent.chat

try:
    # We need a scripted function that handles all 3 phases.
    # Phase 1 Planner (0 tools):
    planner_turn = {"role": "assistant", "content": "1. Find files\n2. Summarize"}
    
    # Phase 2 Researcher (6 tools allowed):
    researcher_turn_1 = tc("list_files", {})
    researcher_turn_2 = {"role": "assistant", "content": "Found report.pdf"}
    
    # Phase 3 Writer (3 tools allowed):
    writer_turn_1 = tc("generate_docx", {"filename": "report.docx", "title": "Report", "blocks": [{"type": "paragraph", "text": "Content"}]})
    writer_turn_2 = {"role": "assistant", "content": "Drafted"}
    
    # We will just yield these sequentially
    turns = [
        planner_turn,       # planner gets this
        researcher_turn_1,  # researcher gets this
        researcher_turn_2,  # researcher gets this
        writer_turn_1,      # writer gets this
        writer_turn_2       # writer gets this
    ]
    
    mock_chat = scripted(*turns)
    
    result = run_orchestrator("do the task", verbose=False, chat_fn=mock_chat)
    
    check("planner produced a plan", "1. Find files" in result["plan"])
    check("researcher produced evidence", "Found report.pdf" in result["evidence"])
    
    # Assert tools were filtered correctly by looking at the lengths of `tools` passed to chat_fn
    seen_tool_counts = mock_chat.state["seen"]
    # Planner: 0 tools
    # Researcher step 1: 6 tools
    # Researcher step 2: 6 tools
    # Writer step 1: 3 tools
    # Writer step 2: 3 tools
    
    check("planner saw 0 tools", seen_tool_counts[0] == 0, f"saw {seen_tool_counts[0]}")
    check("researcher saw restricted toolset", seen_tool_counts[1] == 6, f"saw {seen_tool_counts[1]}")
    check("writer saw restricted toolset", seen_tool_counts[3] == 3, f"saw {seen_tool_counts[3]}")
    
finally:
    pass

print()
print(f"{len(fails)} failure(s)" if fails else "ALL CHECKS PASSED")
if __name__ == '__main__':
    sys.exit(1 if fails else 0)
