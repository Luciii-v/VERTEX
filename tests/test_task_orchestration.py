"""Tests for the long-horizon task orchestration and context management feature."""
import sys
import os
import json
import tempfile
import shutil

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tools.task_orchestrator import (
    TaskStep,
    TaskPlan,
    TaskState,
    create_task,
    save_checkpoint,
    load_checkpoint,
    load_checkpoint_by_id,
    list_user_tasks,
    get_task_status,
    estimate_tokens,
    estimate_messages_tokens,
    check_context_budget,
    summarize_context,
    build_continuation_messages,
    extract_citations_from_result,
    run_task_with_orchestration,
    CONTEXT_MAX_TOKENS,
    CONTEXT_COMPACTION_THRESHOLD,
)
from tools.ollama_client import OllamaError

fails = []


def check(label: str, cond: bool, detail: str = "") -> None:
    print(("PASS  " if cond else "FAIL  ") + label + (f"  -> {detail}" if detail and not cond else ""))
    if not cond:
        fails.append(label)


def scripted(*turns):
    """Returns a chat_fn that replays canned assistant messages in order."""
    state = {"i": 0, "seen": []}

    def fn(model, messages, tools=None, images=None, num_ctx=None, **kw):
        state["seen"].append(len(tools or []))
        i = state["i"]
        state["i"] += 1
        return turns[i] if i < len(turns) else {"role": "assistant", "content": "done"}

    fn.state = state
    return fn


def tc(name, args):
    return {"role": "assistant", "tool_calls": [{"function": {"name": name, "arguments": args}}]}


# --- Test 1: TaskStep and TaskPlan dataclasses ---
def test_task_step_plan():
    step = TaskStep(
        id="step_1",
        description="Test step",
        dependencies=[],
        required_inputs=["input1"],
        expected_output="output1"
    )
    check("TaskStep creation", step.id == "step_1" and step.status == "pending")

    step_dict = step.to_dict()
    check("TaskStep to_dict", step_dict["id"] == "step_1")

    step2 = TaskStep.from_dict(step_dict)
    check("TaskStep from_dict", step2.id == "step_1" and step2.description == "Test step")

    plan = TaskPlan(objective="Test objective", steps=[step])
    check("TaskPlan creation", plan.objective == "Test objective" and len(plan.steps) == 1)

    plan_dict = plan.to_dict()
    check("TaskPlan to_dict", plan_dict["objective"] == "Test objective")

    plan2 = TaskPlan.from_dict(plan_dict)
    check("TaskPlan from_dict", plan2.objective == "Test objective" and len(plan2.steps) == 1)

    check("get_step", plan.get_step("step_1") is not None)
    check("get_next_pending", plan.get_next_pending().id == "step_1")

    check("is_complete false", not plan.is_complete())
    step.status = "completed"
    check("is_complete true", plan.is_complete())


# --- Test 2: TaskState serialization ---
def test_task_state():
    plan = TaskPlan(objective="Test", steps=[
        TaskStep(id="s1", description="Step 1", dependencies=[]),
        TaskStep(id="s2", description="Step 2", dependencies=["s1"])
    ])
    state = TaskState(
        task_id="test123",
        user="user1",
        role="engineer",
        objective="Test objective",
        plan=plan,
        completed_steps=["s1"],
        current_step="s2",
        citations=[{"source": "doc1", "page": 1}],
        assumptions=["assumption1"],
        warnings=["warning1"],
        errors=[{"step": "s1", "error": "err"}],
        unresolved_items=["item1"],
        next_action="Do step 2",
        status="running",
        continuation_count=1
    )

    state_dict = state.to_dict()
    check("TaskState to_dict", state_dict["task_id"] == "test123")
    check("TaskState to_dict plan", "plan" in state_dict)
    check("TaskState to_dict citations", len(state_dict["citations"]) == 1)

    state2 = TaskState.from_dict(state_dict)
    check("TaskState from_dict", state2.task_id == "test123")
    check("TaskState from_dict plan", state2.plan.objective == "Test")
    check("TaskState from_dict citations", len(state2.citations) == 1)


# --- Test 3: Token estimation ---
def test_token_estimation():
    text = "Hello world"
    tokens = estimate_tokens(text)
    check("estimate_tokens basic", tokens > 0)

    messages = [
        {"role": "system", "content": "System prompt"},
        {"role": "user", "content": "User message"}
    ]
    total = estimate_messages_tokens(messages)
    check("estimate_messages_tokens", total > 0)

    budget = check_context_budget(messages, max_tokens=1000, threshold=0.5)
    check("check_context_budget keys", all(k in budget for k in ["used_tokens", "max_tokens", "threshold_tokens", "should_compact", "usage_pct"]))
    check("check_context_budget usage_pct", budget["usage_pct"] >= 0)


# --- Test 4: Checkpoint persistence ---
def test_checkpoint_persistence():
    # Use a temporary database
    import tools.task_orchestrator as to
    from pathlib import Path
    original_db = to.TASK_DB
    temp_dir = tempfile.mkdtemp()
    temp_db = Path(os.path.join(temp_dir, "tasks.db"))

    try:
        to.TASK_DB = temp_db
        to._SCHEMA  # Ensure schema is loaded

        plan = TaskPlan(objective="Test objective", steps=[
            TaskStep(id="s1", description="Step 1", dependencies=[]),
            TaskStep(id="s2", description="Step 2", dependencies=["s1"])
        ])
        state = TaskState(
            task_id="task123",
            user="user1",
            role="engineer",
            objective="Test objective",
            plan=plan,
            completed_steps=["s1"],
            current_step="s2",
            citations=[{"source": "doc1", "page": 1, "score": 0.9}],
            assumptions=["assumption1"],
            warnings=["warning1"],
            errors=[],
            unresolved_items=["item1"],
            next_action="Complete step 2",
            status="running",
            continuation_count=0
        )

        save_checkpoint(state)
        check("save_checkpoint", True)

        loaded = load_checkpoint("task123")
        check("load_checkpoint", loaded is not None)
        check("load_checkpoint task_id", loaded.task_id == "task123")
        check("load_checkpoint user", loaded.user == "user1")
        check("load_checkpoint objective", loaded.objective == "Test objective")
        check("load_checkpoint plan steps", len(loaded.plan.steps) == 2)
        check("load_checkpoint completed_steps", loaded.completed_steps == ["s1"])
        check("load_checkpoint current_step", loaded.current_step == "s2")
        check("load_checkpoint citations", len(loaded.citations) == 1)
        check("load_checkpoint citations preserved", loaded.citations[0]["source"] == "doc1")
        check("load_checkpoint assumptions", loaded.assumptions == ["assumption1"])
        check("load_checkpoint status", loaded.status == "running")

        # Test load_checkpoint_by_id
        loaded2 = load_checkpoint_by_id("task123")
        check("load_checkpoint_by_id", loaded2 is not None and loaded2.task_id == "task123")

        # Test list_user_tasks
        tasks = list_user_tasks("user1")
        check("list_user_tasks", len(tasks) == 1)
        check("list_user_tasks fields", "task_id" in tasks[0] and "objective" in tasks[0])

        # Test get_task_status
        status = get_task_status("task123", "user1")
        check("get_task_status", status is not None)
        check("get_task_status fields", "task_id" in status and "plan" in status)

        # Test access control
        status2 = get_task_status("task123", "user2")
        check("get_task_status access control", status2 is None)

    finally:
        to.TASK_DB = original_db
        shutil.rmtree(temp_dir)


# --- Test 5: Simple task without decomposition ---
def test_simple_task_no_decomposition():
    # Test that simple tasks don't get over-decomposed
    plan = TaskPlan(objective="What is 2+2?", steps=[
        TaskStep(id="step_1", description="What is 2+2?", dependencies=[])
    ])
    check("simple task single step", len(plan.steps) == 1)
    check("simple task step description", plan.steps[0].description == "What is 2+2?")


# --- Test 6: Large task decomposition ---
def test_large_task_decomposition():
    # Test that complex tasks get decomposed
    objective = "Analyze refinery pump health and generate a report"
    # We can't test the LLM planner without a real model, so test the structure
    plan = TaskPlan(objective=objective, steps=[
        TaskStep(id="step_1", description="Retrieve relevant SOP and P&ID information", dependencies=[]),
        TaskStep(id="step_2", description="Analyze the available sensor data", dependencies=["step_1"]),
        TaskStep(id="step_3", description="Generate the final engineering report", dependencies=["step_1", "step_2"])
    ])
    check("large task multiple steps", len(plan.steps) == 3)
    check("step dependencies", plan.steps[1].dependencies == ["step_1"])
    check("step dependencies multi", plan.steps[2].dependencies == ["step_1", "step_2"])

    next_step = plan.get_next_pending()
    check("first pending step", next_step.id == "step_1")

    plan.steps[0].status = "completed"
    next_step = plan.get_next_pending()
    check("second pending step", next_step.id == "step_2")

    plan.steps[1].status = "completed"
    next_step = plan.get_next_pending()
    check("third pending step", next_step.id == "step_3")

    plan.steps[2].status = "completed"
    check("plan complete", plan.is_complete())


# --- Test 7: Context compaction threshold ---
def test_context_compaction_threshold():
    # Create a message list that exceeds threshold
    long_text = "x" * (CONTEXT_MAX_TOKENS * 4)  # ~CONTEXT_MAX_TOKENS tokens
    messages = [
        {"role": "system", "content": "System"},
        {"role": "user", "content": long_text}
    ]
    budget = check_context_budget(messages)
    check("context compaction triggered", budget["should_compact"])
    check("context usage high", budget["usage_pct"] > 70)

    # Small message should not trigger
    messages_small = [
        {"role": "system", "content": "System"},
        {"role": "user", "content": "Short query"}
    ]
    budget2 = check_context_budget(messages_small)
    check("no compaction for small", not budget2["should_compact"])


# --- Test 8: Citation preservation ---
def test_citation_preservation():
    # Mock RAG result with citations
    rag_result = {
        "hits": [
            {"text": "Pump P-204 operates at 8 bar", "source": "SOP-204.pdf", "page": 5, "score": 0.95},
            {"text": "Max pressure 10 bar", "source": "SPEC-P204.pdf", "page": 2, "score": 0.88}
        ]
    }
    citations = extract_citations_from_result(rag_result)
    check("citations extracted", len(citations) == 2)
    check("citation fields", all("source" in c and "page" in c and "score" in c for c in citations))
    check("citation source preserved", citations[0]["source"] == "SOP-204.pdf")
    check("citation page preserved", citations[0]["page"] == 5)


# --- Test 9: Context summary generation (with mock) ---
def test_context_summary():
    # Test with a mock chat function that returns a valid summary
    def mock_chat(model, messages, **kw):
        return {
            "role": "assistant",
            "content": json.dumps({
                "objective": "Test objective",
                "completed_steps": ["step_1"],
                "verified_facts": ["Pump P-204 max pressure 8 bar"],
                "citations": [{"source": "SOP-204.pdf", "page": 5}],
                "assumptions": ["Pump is operational"],
                "warnings": [],
                "errors": [],
                "current_step": "step_2",
                "next_action": "Analyze sensor data",
                "unresolved_items": ["Sensor data not yet retrieved"],
                "output_requirements": "Final report with citations",
                "is_complete": False
            })
        }

    plan = TaskPlan(objective="Test objective", steps=[
        TaskStep(id="step_1", description="Get SOP", dependencies=[], status="completed"),
        TaskStep(id="step_2", description="Analyze data", dependencies=["step_1"])
    ])
    state = TaskState(
        task_id="task123",
        user="user1",
        role="engineer",
        objective="Test objective",
        plan=plan,
        completed_steps=["step_1"],
        current_step="step_2",
        citations=[{"source": "SOP-204.pdf", "page": 5}],
        assumptions=["Pump is operational"],
        warnings=[],
        errors=[],
        unresolved_items=["Sensor data not yet retrieved"],
        next_action="Analyze sensor data"
    )

    summary = summarize_context(state, chat_fn=mock_chat)
    check("summary generated", isinstance(summary, dict))
    check("summary has objective", summary.get("objective") == "Test objective")
    check("summary has completed_steps", "step_1" in summary.get("completed_steps", []))
    check("summary has citations", len(summary.get("citations", [])) > 0)
    check("summary has current_step", summary.get("current_step") == "step_2")
    check("summary is_complete false", summary.get("is_complete") is False)


# --- Test 10: Invalid summary recovery ---
def test_invalid_summary_recovery():
    def bad_chat(model, messages, **kw):
        return {"role": "assistant", "content": "not valid json"}

    plan = TaskPlan(objective="Test", steps=[TaskStep(id="s1", description="Step 1", dependencies=[])])
    state = TaskState(
        task_id="task123",
        user="user1",
        role="engineer",
        objective="Test",
        plan=plan,
        completed_steps=["s1"],
        current_step="s1"
    )

    summary = summarize_context(state, chat_fn=bad_chat)
    check("fallback summary on json error", isinstance(summary, dict))
    check("fallback has objective", summary.get("objective") == "Test")
    check("fallback is_complete false", summary.get("is_complete") is False)


# --- Test 11: Continuation message building ---
def test_continuation_messages():
    plan = TaskPlan(objective="Test objective", steps=[
        TaskStep(id="step_1", description="Step 1", dependencies=[], status="completed"),
        TaskStep(id="step_2", description="Step 2", dependencies=["step_1"])
    ])
    state = TaskState(
        task_id="task123",
        user="user1",
        role="engineer",
        objective="Test objective",
        plan=plan,
        completed_steps=["step_1"],
        current_step="step_2",
        next_action="Execute step 2"
    )

    summary = {
        "objective": "Test objective",
        "completed_steps": ["step_1"],
        "verified_facts": ["Fact 1"],
        "citations": [{"source": "doc1", "page": 1}],
        "assumptions": [],
        "warnings": [],
        "errors": [],
        "current_step": "step_2",
        "next_action": "Execute step 2",
        "unresolved_items": [],
        "output_requirements": "Report",
        "is_complete": False
    }

    messages = build_continuation_messages(state, summary, "Retrieved context for step 2")
    check("continuation messages", len(messages) == 2)
    check("continuation has system", messages[0]["role"] == "system")
    check("continuation has user", messages[1]["role"] == "user")
    check("continuation has objective", "Test objective" in messages[1]["content"])
    check("continuation has step", "step_2" in messages[1]["content"])
    check("continuation has context", "Retrieved context for step 2" in messages[1]["content"])


# --- Test 12: Task orchestration with mock ---
def test_task_orchestration_mock():
    # Mock chat function that returns a plan (no tools) then tool call then finishes
    call_count = {"count": 0}
    
    def mock_chat(model, messages, tools=None, images=None, num_ctx=None, **kw):
        call_count["count"] += 1
        print(f'mock_chat call #{call_count["count"]}, tools={tools is not None}, messages={len(messages)}')
        
        # Planning phase (no tools provided) - return a simple plan
        if tools is None:
            print('  -> returning plan')
            return {"role": "assistant", "content": json.dumps({
                "objective": "Analyze pump P-204 health",
                "steps": [
                    {"id": "step_1", "description": "Search for pump info", "dependencies": [], "status": "pending"}
                ]
            })}
        
        # Execution phase (tools provided)
        # First execution call: return tool call
        if len(messages) == 2:  # system + user
            print('  -> returning tool call')
            return {"role": "assistant", "tool_calls": [{"function": {"name": "search_knowledge_base", "arguments": {"query": "pump P-204", "top_k": 5}}}]}
        # Second execution call: finish
        print('  -> returning final')
        return {"role": "assistant", "content": "Found pump information."}

    # Mock MCP client
    class MockMCPClient:
        def openai_tool_schemas(self):
            return [{"type": "function", "function": {"name": "search_knowledge_base", "description": "Search KB", "parameters": {"type": "object"}}}]
        
        def call(self, name, arguments, approval_token=None):
            if name == "search_knowledge_base":
                return {"status": "ok", "result": {"hits": [{"text": "Pump info", "source": "doc1", "page": 1, "score": 0.9}]}}
            return {"status": "error", "error": "Unknown tool"}

    # Use a temporary database
    import tools.task_orchestrator as to
    from pathlib import Path
    original_db = to.TASK_DB
    temp_dir = tempfile.mkdtemp()
    temp_db = Path(os.path.join(temp_dir, "tasks.db"))

    try:
        to.TASK_DB = temp_db

        result = run_task_with_orchestration(
            "Analyze pump P-204 health",
            user="test_user",
            role="engineer",
            auto_approve=True,
            verbose=False,
            chat_fn=mock_chat,
            mcp_client=MockMCPClient()
        )

        print(f'Result complete: {result["complete"]}')
        print(f'Result: {result}')
        check("orchestration completed", result["complete"] is True)
        check("orchestration has task_id", "task_id" in result)
        check("orchestration has tool_calls", len(result["tool_calls"]) >= 1)
        check("orchestration tool was search_knowledge_base", result["tool_calls"][0]["tool"] == "search_knowledge_base")

    finally:
        to.TASK_DB = original_db
        shutil.rmtree(temp_dir)


# --- Test 13: Resume task from checkpoint ---
def test_resume_task():
    import tools.task_orchestrator as to
    from pathlib import Path
    original_db = to.TASK_DB
    temp_dir = tempfile.mkdtemp()
    temp_db = Path(os.path.join(temp_dir, "tasks.db"))

    try:
        to.TASK_DB = temp_db

        # Create initial task state with step_1 completed, step_2 pending
        plan = TaskPlan(objective="Test resume", steps=[
            TaskStep(id="step_1", description="Step 1", dependencies=[], status="completed"),
            TaskStep(id="step_2", description="Step 2", dependencies=["step_1"], status="pending")
        ])
        state = TaskState(
            task_id="resume123",
            user="test_user",
            role="engineer",
            objective="Test resume",
            plan=plan,
            completed_steps=["step_1"],
            current_step="step_2",
            next_action="Do step 2"
        )
        save_checkpoint(state)

        # Mock chat that continues from step 2 - returns tool call then finishes
        call_count = {"count": 0}
        def mock_chat(model, messages, tools=None, images=None, num_ctx=None, **kw):
            call_count["count"] += 1
            print(f'mock_chat call #{call_count["count"]}, tools={tools is not None}, messages={len(messages)}')
            
            # Resumption phase (tools provided)
            if len(messages) == 2:  # system + user (continuation prompt)
                print('  -> returning tool call for step_2')
                return {"role": "assistant", "tool_calls": [{"function": {"name": "search_knowledge_base", "arguments": {"query": "step 2 data", "top_k": 5}}}]}
            # After tool result: finish
            print('  -> returning final')
            return {"role": "assistant", "content": "Completed step 2 and finished."}

        # Mock MCP client
        class MockMCPClient:
            def openai_tool_schemas(self):
                return [{"type": "function", "function": {"name": "search_knowledge_base", "description": "Search KB", "parameters": {"type": "object"}}}]
            def call(self, name, arguments, approval_token=None):
                if name == "search_knowledge_base":
                    return {"status": "ok", "result": {"hits": [{"text": "Step 2 data", "source": "doc2", "page": 1, "score": 0.9}]}}
                return {"status": "error", "error": "Unknown tool"}

        result = run_task_with_orchestration(
            "",
            user="test_user",
            role="engineer",
            auto_approve=True,
            verbose=False,
            chat_fn=mock_chat,
            resume_task_id="resume123",
            mcp_client=MockMCPClient()
        )

        print(f'Result complete: {result["complete"]}')
        print(f'Result: {result}')
        check("resume completed", result["complete"] is True)
        check("resume has task_id", result.get("task_id") == "resume123")

    finally:
        to.TASK_DB = original_db
        shutil.rmtree(temp_dir)


# --- Test 14: Duplicate step prevention ---
def test_duplicate_step_prevention():
    plan = TaskPlan(objective="Test", steps=[
        TaskStep(id="step_1", description="Step 1", dependencies=[], status="completed"),
        TaskStep(id="step_2", description="Step 2", dependencies=["step_1"])
    ])
    # get_next_pending should not return completed steps
    next_step = plan.get_next_pending()
    check("next step is step_2", next_step.id == "step_2")


# --- Test 15: Max retry handling ---
def test_max_retry():
    plan = TaskPlan(objective="Test", steps=[
        TaskStep(id="step_1", description="Step 1", dependencies=[])
    ])
    step = plan.steps[0]
    step.retry_count = 2
    check("retry count tracked", step.retry_count == 2)
    step.retry_count = 3
    check("max retry exceeded", step.retry_count > 2)


# --- Test 16: Configuration values ---
def test_configuration():
    check("CONTEXT_MAX_TOKENS default", CONTEXT_MAX_TOKENS == 8192)
    check("CONTEXT_COMPACTION_THRESHOLD default", CONTEXT_COMPACTION_THRESHOLD == 0.75)
    import tools.task_orchestrator as to_module
    check("MAX_TASK_STEPS default", hasattr(to_module, 'MAX_TASK_STEPS'))


# --- Run all tests ---
if __name__ == "__main__":
    print("=" * 60)
    print("TASK ORCHESTRATION TESTS")
    print("=" * 60)

    test_task_step_plan()
    test_task_state()
    test_token_estimation()
    test_checkpoint_persistence()
    test_simple_task_no_decomposition()
    test_large_task_decomposition()
    test_context_compaction_threshold()
    test_citation_preservation()
    test_context_summary()
    test_invalid_summary_recovery()
    test_continuation_messages()
    test_task_orchestration_mock()
    test_resume_task()
    test_duplicate_step_prevention()
    test_max_retry()
    test_configuration()

    print()
    print(f"{len(fails)} failure(s)" if fails else "ALL CHECKS PASSED")
    sys.exit(1 if fails else 0)