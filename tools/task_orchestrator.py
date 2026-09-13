"""Long-Horizon Task Orchestration and Context Management.

This module provides:
- Task decomposition into ordered steps
- Context/token monitoring with configurable thresholds
- Durable checkpointing for resumability
- Context summarization for continuation
- Citation preservation across continuations
"""

from __future__ import annotations

import json
import os
import sqlite3
import threading
import time
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from .audit import log_event
from .ollama_client import chat, OllamaError
from .router import route

# Configuration with sensible defaults
CONTEXT_MAX_TOKENS = int(os.environ.get("CONTEXT_MAX_TOKENS", "8192"))
CONTEXT_COMPACTION_THRESHOLD = float(os.environ.get("CONTEXT_COMPACTION_THRESHOLD", "0.75"))
MAX_TASK_STEPS = int(os.environ.get("MAX_TASK_STEPS", "12"))
MAX_STEP_RETRIES = int(os.environ.get("MAX_STEP_RETRIES", "2"))
MAX_CONTEXT_CONTINUATIONS = int(os.environ.get("MAX_CONTEXT_CONTINUATIONS", "5"))
SUMMARY_MODEL = os.environ.get("SUMMARY_MODEL", "qwen3.5:9b")

# Token estimation: rough heuristic for models without tokenizer access
# ~1 token per 4 characters for English text
CHARS_PER_TOKEN = 4

TASK_DB = Path(os.environ.get("WORKBENCH_TASK_DB", "workspace_data/tasks.db"))
_lock = threading.Lock()

_SCHEMA = """
CREATE TABLE IF NOT EXISTS task_checkpoints (
    id              TEXT PRIMARY KEY,
    task_id         TEXT NOT NULL,
    user            TEXT NOT NULL,
    role            TEXT NOT NULL,
    objective       TEXT NOT NULL,
    plan_json       TEXT NOT NULL,
    completed_steps TEXT NOT NULL,
    current_step    TEXT,
    intermediate_results_json TEXT,
    citations_json  TEXT,
    assumptions_json TEXT,
    warnings_json   TEXT,
    errors_json     TEXT,
    unresolved_items_json TEXT,
    next_action     TEXT,
    status          TEXT NOT NULL,
    continuation_count INTEGER DEFAULT 0,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_task_user ON task_checkpoints(user);
CREATE INDEX IF NOT EXISTS idx_task_status ON task_checkpoints(status);
CREATE INDEX IF NOT EXISTS idx_task_updated ON task_checkpoints(updated_at);
"""


def _connect() -> sqlite3.Connection:
    TASK_DB.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(TASK_DB, timeout=10)
    conn.executescript(_SCHEMA)
    conn.row_factory = sqlite3.Row
    return conn


@dataclass
class TaskStep:
    """A single step in a task plan."""
    id: str
    description: str
    dependencies: list[str] = field(default_factory=list)
    status: str = "pending"  # pending, in_progress, completed, failed
    required_inputs: list[str] = field(default_factory=list)
    expected_output: str = ""
    retry_count: int = 0
    result: Any = None
    error: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "TaskStep":
        return cls(**data)


@dataclass
class TaskPlan:
    """Complete task plan with ordered steps."""
    objective: str
    steps: list[TaskStep] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "objective": self.objective,
            "steps": [s.to_dict() for s in self.steps]
        }

    @classmethod
    def from_dict(cls, data: dict) -> "TaskPlan":
        return cls(
            objective=data["objective"],
            steps=[TaskStep.from_dict(s) for s in data["steps"]]
        )

    def get_step(self, step_id: str) -> TaskStep | None:
        for s in self.steps:
            if s.id == step_id:
                return s
        return None

    def get_next_pending(self) -> TaskStep | None:
        for s in self.steps:
            if s.status == "pending":
                deps_done = all(
                    self.get_step(d).status == "completed" for d in s.dependencies
                )
                if deps_done:
                    return s
        return None

    def is_complete(self) -> bool:
        return all(s.status == "completed" for s in self.steps)


@dataclass
class TaskState:
    """Serializable task state for checkpointing."""
    task_id: str
    user: str
    role: str
    objective: str
    plan: TaskPlan
    completed_steps: list[str] = field(default_factory=list)
    current_step: str | None = None
    intermediate_results: dict = field(default_factory=dict)
    citations: list[dict] = field(default_factory=list)
    assumptions: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    errors: list[dict] = field(default_factory=list)
    unresolved_items: list[str] = field(default_factory=list)
    next_action: str = ""
    status: str = "created"  # created, running, paused, completed, failed
    continuation_count: int = 0
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        d = asdict(self)
        d["plan"] = self.plan.to_dict()
        return d

    @classmethod
    def from_dict(cls, data: dict) -> "TaskState":
        plan = TaskPlan.from_dict(data["plan"])
        return cls(
            task_id=data["task_id"],
            user=data["user"],
            role=data["role"],
            objective=data["objective"],
            plan=plan,
            completed_steps=data.get("completed_steps", []),
            current_step=data.get("current_step"),
            intermediate_results=data.get("intermediate_results", {}),
            citations=data.get("citations", []),
            assumptions=data.get("assumptions", []),
            warnings=data.get("warnings", []),
            errors=data.get("errors", []),
            unresolved_items=data.get("unresolved_items", []),
            next_action=data.get("next_action", ""),
            status=data.get("status", "created"),
            continuation_count=data.get("continuation_count", 0),
            created_at=data.get("created_at", datetime.now(timezone.utc).isoformat()),
            updated_at=data.get("updated_at", datetime.now(timezone.utc).isoformat()),
        )


def estimate_tokens(text: str) -> int:
    """Estimate token count from text. Uses character heuristic if no tokenizer available."""
    if not text:
        return 0
    return max(1, len(text) // CHARS_PER_TOKEN)


def estimate_messages_tokens(messages: list[dict]) -> int:
    """Estimate total tokens for a message list."""
    total = 0
    for m in messages:
        content = m.get("content", "")
        if isinstance(content, str):
            total += estimate_tokens(content)
        elif isinstance(content, list):
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    total += estimate_tokens(item.get("text", ""))
    return total


def check_context_budget(messages: list[dict], max_tokens: int = CONTEXT_MAX_TOKENS,
                          threshold: float = CONTEXT_COMPACTION_THRESHOLD) -> dict:
    """Check if context usage exceeds threshold."""
    used = estimate_messages_tokens(messages)
    budget = int(max_tokens * threshold)
    return {
        "used_tokens": used,
        "max_tokens": max_tokens,
        "threshold_tokens": budget,
        "threshold_pct": threshold,
        "remaining": max_tokens - used,
        "should_compact": used >= budget,
        "usage_pct": round(used / max_tokens * 100, 1)
    }


SUMMARY_PROMPT_TEMPLATE = """You are a task-state summarizer for a long-running engineering workflow.

Create a structured continuation state for the next LLM call.

Original objective:
{objective}

Task plan:
{task_plan}

Completed work:
{completed_work}

Retrieved evidence and citations:
{citations}

Current step:
{current_step}

Unresolved items:
{unresolved_items}

Errors or failed attempts:
{errors}

Output requirements:
{output_requirements}

Rules:
1. Preserve all important technical facts and numerical values.
2. Preserve citations exactly and do not invent sources.
3. Clearly separate verified facts, assumptions, and unresolved items.
4. Do not repeat completed work.
5. Identify the exact next step and action.
6. Do not claim that the task is complete unless every required step is complete.
7. Return valid structured JSON.

Output schema:
{{
  "objective": "",
  "completed_steps": [],
  "verified_facts": [],
  "citations": [],
  "assumptions": [],
  "warnings": [],
  "errors": [],
  "current_step": "",
  "next_action": "",
  "unresolved_items": [],
  "output_requirements": "",
  "is_complete": false
}}"""


CONTINUATION_PROMPT_TEMPLATE = """You are continuing a previously started task.

Original objective:
{objective}

Task state:
{structured_summary}

Current step:
{current_step}

Next action:
{next_action}

Relevant retrieved context:
{retrieved_context}

Instructions:
- Continue from the current step.
- Do not repeat completed steps.
- Preserve all verified facts and citations.
- Use only supported evidence.
- If evidence is missing, say so clearly.
- Update the task state after completing this step.
- Do not mark the task complete until all required steps are finished."""


def generate_task_plan(objective: str, chat_fn: Callable = chat, model: str | None = None) -> TaskPlan:
    """Decompose a large objective into an ordered execution plan."""
    if model is None:
        decision = route(objective)
        model = decision["model"]

    planner_prompt = f"""You are a task planner for an engineering investigation workbench.
Break down the following objective into concrete, ordered steps.

Objective: {objective}

Rules:
1. Only decompose if the task genuinely requires multiple distinct steps.
2. For simple questions (lookup, single calculation, single document read), return a single step.
3. Each step must have a clear description, dependencies, and expected output.
4. Steps should be executable by the available tools (search_knowledge_base, read_document, run_python_sandbox, query_context_graph, ocr_image, generate_docx, generate_xlsx, generate_pptx).
5. Return valid JSON only.

Output format:
{{
  "objective": "{objective}",
  "steps": [
    {{
      "id": "step_1",
      "description": "Retrieve relevant SOP and P&ID information",
      "dependencies": [],
      "required_inputs": ["equipment_id"],
      "expected_output": "SOP sections and P&ID analysis for equipment"
    }}
  ]
}}"""

    try:
        msg = chat_fn(model, [
            {"role": "system", "content": "You are a precise task planner. Output only valid JSON."},
            {"role": "user", "content": planner_prompt}
        ], num_ctx=8192, temperature=0.1)
        content = msg.get("content", "").strip()
        # Extract JSON from response
        start = content.find("{")
        end = content.rfind("}") + 1
        if start >= 0 and end > start:
            plan_data = json.loads(content[start:end])
            return TaskPlan.from_dict(plan_data)
    except (json.JSONDecodeError, KeyError, OllamaError) as exc:
        log_event(user="system", role="system", event="plan_generation_failed",
                  result_summary=str(exc))

    # Fallback: single-step plan
    return TaskPlan(objective=objective, steps=[
        TaskStep(
            id="step_1",
            description=objective,
            dependencies=[],
            required_inputs=[],
            expected_output="Answer or deliverable"
        )
    ])


def save_checkpoint(state: TaskState) -> None:
    """Persist task checkpoint to database."""
    with _lock, _connect() as conn:
        conn.execute("""
            INSERT OR REPLACE INTO task_checkpoints
            (id, task_id, user, role, objective, plan_json, completed_steps,
             current_step, intermediate_results_json, citations_json,
             assumptions_json, warnings_json, errors_json,
             unresolved_items_json, next_action, status, continuation_count,
             created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            state.task_id, state.task_id, state.user, state.role, state.objective,
            json.dumps(state.plan.to_dict()),
            json.dumps(state.completed_steps),
            state.current_step,
            json.dumps(state.intermediate_results, default=str),
            json.dumps(state.citations, default=str),
            json.dumps(state.assumptions),
            json.dumps(state.warnings),
            json.dumps(state.errors, default=str),
            json.dumps(state.unresolved_items),
            state.next_action,
            state.status,
            state.continuation_count,
            state.created_at,
            datetime.now(timezone.utc).isoformat()
        ))
    log_event(user=state.user, role=state.role, event="checkpoint_saved",
              result_summary=f"task={state.task_id} step={state.current_step}")


def _row_to_state_dict(row: sqlite3.Row) -> dict:
    """Convert database row to TaskState-compatible dict."""
    d = dict(row)
    # Map database column names to TaskState field names
    d["plan"] = json.loads(d.pop("plan_json"))
    d["completed_steps"] = json.loads(d.pop("completed_steps"))
    d["intermediate_results"] = json.loads(d.pop("intermediate_results_json"))
    d["citations"] = json.loads(d.pop("citations_json"))
    d["assumptions"] = json.loads(d.pop("assumptions_json"))
    d["warnings"] = json.loads(d.pop("warnings_json"))
    d["errors"] = json.loads(d.pop("errors_json"))
    d["unresolved_items"] = json.loads(d.pop("unresolved_items_json"))
    return d


def load_checkpoint(task_id: str) -> TaskState | None:
    """Load latest checkpoint for a task."""
    with _lock, _connect() as conn:
        row = conn.execute(
            "SELECT * FROM task_checkpoints WHERE task_id = ? ORDER BY updated_at DESC LIMIT 1",
            (task_id,)
        ).fetchone()
    if not row:
        return None
    return TaskState.from_dict(_row_to_state_dict(row))


def load_checkpoint_by_id(checkpoint_id: str) -> TaskState | None:
    """Load specific checkpoint by ID."""
    with _lock, _connect() as conn:
        row = conn.execute(
            "SELECT * FROM task_checkpoints WHERE id = ?", (checkpoint_id,)
        ).fetchone()
    if not row:
        return None
    return TaskState.from_dict(_row_to_state_dict(row))


def list_user_tasks(user: str, status: str | None = None) -> list[dict]:
    """List tasks for a user."""
    with _lock, _connect() as conn:
        sql = "SELECT * FROM task_checkpoints WHERE user = ?"
        params = [user]
        if status:
            sql += " AND status = ?"
            params.append(status)
        sql += " ORDER BY updated_at DESC"
        rows = conn.execute(sql, params).fetchall()
    return [dict(r) for r in rows]


def create_task(objective: str, user: str, role: str, chat_fn: Callable = chat) -> TaskState:
    """Create a new task with initial plan."""
    plan = generate_task_plan(objective, chat_fn=chat_fn)
    task_id = uuid.uuid4().hex[:12]
    state = TaskState(
        task_id=task_id,
        user=user,
        role=role,
        objective=objective,
        plan=plan,
        status="running"
    )
    save_checkpoint(state)
    log_event(user=user, role=role, event="task_created",
              result_summary=f"task={task_id} steps={len(plan.steps)}")
    return state


def summarize_context(state: TaskState, chat_fn: Callable = chat) -> dict:
    """Generate structured summary for context continuation."""
    completed_work = []
    for step_id in state.completed_steps:
        step = state.plan.get_step(step_id)
        if step and step.result:
            completed_work.append({
                "step": step_id,
                "description": step.description,
                "result_summary": str(step.result)[:500]
            })

    prompt = SUMMARY_PROMPT_TEMPLATE.format(
        objective=state.objective,
        task_plan=json.dumps(state.plan.to_dict(), indent=2),
        completed_work=json.dumps(completed_work, indent=2),
        citations=json.dumps(state.citations, indent=2),
        current_step=state.current_step or "unknown",
        unresolved_items=json.dumps(state.unresolved_items, indent=2),
        errors=json.dumps(state.errors, indent=2),
        output_requirements="Produce final deliverable with citations"
    )

    try:
        msg = chat_fn(SUMMARY_MODEL, [
            {"role": "system", "content": "You are a precise summarizer. Output only valid JSON."},
            {"role": "user", "content": prompt}
        ], num_ctx=8192, temperature=0.1)
        content = msg.get("content", "").strip()
        start = content.find("{")
        end = content.rfind("}") + 1
        if start >= 0 and end > start:
            summary = json.loads(content[start:end])
            log_event(user=state.user, role=state.role, event="context_summarized",
                      result_summary=f"task={state.task_id}")
            return summary
    except (json.JSONDecodeError, OllamaError) as exc:
        log_event(user=state.user, role=state.role, event="summary_failed",
                  result_summary=str(exc))

    # Fallback summary
    return {
        "objective": state.objective,
        "completed_steps": state.completed_steps,
        "verified_facts": [],
        "citations": state.citations,
        "assumptions": state.assumptions,
        "warnings": state.warnings,
        "errors": state.errors,
        "current_step": state.current_step,
        "next_action": state.next_action,
        "unresolved_items": state.unresolved_items,
        "output_requirements": "Produce final deliverable with citations",
        "is_complete": False
    }


def build_continuation_messages(state: TaskState, summary: dict,
                                 retrieved_context: str = "") -> list[dict]:
    """Build messages for continuation after context compaction."""
    return [
        {"role": "system", "content": "You are continuing a multi-step engineering investigation."},
        {"role": "user", "content": CONTINUATION_PROMPT_TEMPLATE.format(
            objective=state.objective,
            structured_summary=json.dumps(summary, indent=2),
            current_step=state.current_step or "unknown",
            next_action=state.next_action or summary.get("next_action", ""),
            retrieved_context=retrieved_context or "(no new context retrieved)"
        )}
    ]


def extract_citations_from_result(result: Any) -> list[dict]:
    """Extract citation information from tool results."""
    citations = []
    if isinstance(result, dict):
        hits = result.get("hits", [])
        for hit in hits:
            citations.append({
                "source": hit.get("source", ""),
                "page": hit.get("page", 0),
                "score": hit.get("score", 0),
                "text_preview": hit.get("text", "")[:200]
            })
    return citations


def run_task_with_orchestration(
    task: str,
    user: str = "demo",
    role: str = "engineer",
    auto_approve: bool = True,
    verbose: bool = True,
    chat_fn: Callable = chat,
    resume_task_id: str | None = None,
    mcp_client: Any = None
) -> dict:
    """Main entry point: run a task with full orchestration and context management."""
    # Resume or create task
    if resume_task_id:
        state = load_checkpoint(resume_task_id)
        if not state:
            return {"error": f"Task {resume_task_id} not found", "complete": False}
        if state.user != user:
            return {"error": "Unauthorized: cannot resume another user's task", "complete": False}
        log_event(user=user, role=role, event="task_resumed",
                  result_summary=f"task={state.task_id}")
    else:
        state = create_task(task, user, role, chat_fn=chat_fn)

    # Get model for this task
    decision = route(task)
    model = decision["model"]
    num_ctx = decision["num_ctx"]

    # Unload other models to prevent memory pressure
    from .ollama_client import unload
    for m in ["qwen3.5:9b", "qwen2.5-coder:7b"]:
        if m != model:
            unload(m)

    # MCP client for tool access
    if mcp_client is None:
        from .mcp_client import MCPClient
        mcp_cm = MCPClient(user=user, role=role)
    else:
        # For testing, use provided client directly (no context manager)
        class _DummyCM:
            def __init__(self, client):
                self.client = client
            def __enter__(self):
                return self.client
            def __exit__(self, *args):
                pass
        mcp_cm = _DummyCM(mcp_client)

    with mcp_cm as mcp:
        tool_schemas = mcp.openai_tool_schemas()
        max_steps = MAX_TASK_STEPS
        step_count = 0

        # Build initial messages
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": task}
        ]

        transcript = []
        error_counts: dict[str, int] = {}
        pending: list[dict] = []

        while step_count < max_steps:
            step_count += 1

            # Ensure current_step is set to the next pending step
            if state.current_step is None:
                next_step = state.plan.get_next_pending()
                if next_step:
                    state.current_step = next_step.id
                    next_step.status = "in_progress"
                    state.next_action = next_step.description
                else:
                    state.next_action = "Finalize and produce deliverable"

            # Check context budget
            budget = check_context_budget(messages)
            if budget["should_compact"] and state.continuation_count < MAX_CONTEXT_CONTINUATIONS:
                if verbose:
                    print(f"\n\033[33m[Context] Compacting at {budget['usage_pct']}% usage\033[0m")

                # Save checkpoint before compaction
                save_checkpoint(state)

                # Generate summary
                summary = summarize_context(state, chat_fn)

                # Validate summary
                if not isinstance(summary, dict) or "objective" not in summary:
                    summary = {
                        "objective": state.objective,
                        "completed_steps": state.completed_steps,
                        "verified_facts": [],
                        "citations": state.citations,
                        "assumptions": state.assumptions,
                        "warnings": state.warnings,
                        "errors": state.errors,
                        "current_step": state.current_step,
                        "next_action": state.next_action,
                        "unresolved_items": state.unresolved_items,
                        "output_requirements": "Produce final deliverable with citations",
                        "is_complete": False
                    }

                # Retrieve context for next step if needed
                retrieved_context = ""
                if state.current_step:
                    step = state.plan.get_step(state.current_step)
                    if step and step.required_inputs:
                        # Could trigger RAG search here
                        pass

                # Build fresh continuation context
                messages = build_continuation_messages(state, summary, retrieved_context)
                state.continuation_count += 1
                state.status = "running"
                save_checkpoint(state)

                if verbose:
                    print(f"\033[33m[Context] Continuation #{state.continuation_count}\033[0m")

            # Call model
            try:
                msg = chat_fn(model, messages, tools=tool_schemas, num_ctx=num_ctx)
            except OllamaError as exc:
                state.errors.append({"step": state.current_step, "error": str(exc), "time": datetime.now(timezone.utc).isoformat()})
                state.status = "failed"
                save_checkpoint(state)
                return _finish_task(state, transcript, pending, f"Inference failed: {exc}", ok=False)

            messages.append(msg)
            calls = msg.get("tool_calls") or []

            if not calls:
                # No tool calls - check if task is complete
                if state.plan.is_complete():
                    state.status = "completed"
                    save_checkpoint(state)
                    return _finish_task(state, transcript, pending, msg.get("content", ""), ok=True)
                else:
                    # Model stopped early - prompt to continue
                    messages.append({"role": "user", "content": "Continue with the next step."})
                    continue

            # Execute tool calls
            for call in calls:
                fn = call.get("function", {})
                name = fn.get("name", "")
                args = fn.get("arguments") or {}
                if isinstance(args, str):
                    try:
                        args = json.loads(args)
                    except json.JSONDecodeError:
                        args = {}

                if verbose:
                    print(f"\033[36m[{step_count}] {name}\033[0m {json.dumps(args)[:130]}")

                envelope = mcp.call(name, args)

                # Handle approval
                if envelope.get("status") == "approval_required":
                    if auto_approve:
                        token = mcp.approve(envelope["request_id"], approver=user)
                        envelope = mcp.call(name, args, approval_token=token)
                        if verbose:
                            print("      \033[33mauto-approved\033[0m")
                    else:
                        pending.append(envelope)
                        if verbose:
                            print(f"      \033[33mAPPROVAL REQUIRED\033[0m id={envelope['request_id']}")

                # Handle result
                if envelope.get("status") == "error":
                    error_counts[name] = error_counts.get(name, 0) + 1
                    if verbose:
                        print(f"      \033[31merror\033[0m {envelope['error'][:160]}")
                    if error_counts[name] > MAX_STEP_RETRIES:
                        envelope = {
                            "status": "error",
                            "error": f"'{name}' failed {error_counts[name]} times. Stop and explain."
                        }
                elif envelope.get("status") == "ok" and verbose:
                    print(f"      \033[32mok\033[0m {json.dumps(envelope.get('result'))[:130]}")
                    # Extract citations from RAG results
                    if name == "search_knowledge_base":
                        new_citations = extract_citations_from_result(envelope.get("result", {}))
                        state.citations.extend(new_citations)

                # Update step state
                if state.current_step:
                    step = state.plan.get_step(state.current_step)
                    if step:
                        step.result = envelope.get("result")
                        step.error = envelope.get("error")
                        if envelope.get("status") == "ok":
                            step.status = "completed"
                            state.completed_steps.append(state.current_step)
                        else:
                            step.status = "failed"
                            step.retry_count += 1
                            state.errors.append({
                                "step": state.current_step,
                                "tool": name,
                                "error": envelope.get("error"),
                                "time": datetime.now(timezone.utc).isoformat()
                            })

                transcript.append({"step": step_count, "tool": name,
                                   "arguments": args, "envelope": envelope})
                messages.append({
                    "role": "tool",
                    "tool_name": name,
                    "content": json.dumps(envelope, default=str)[:6000]
                })

                # Advance to next step
                next_step = state.plan.get_next_pending()
                if next_step:
                    state.current_step = next_step.id
                    next_step.status = "in_progress"
                    state.next_action = next_step.description
                else:
                    state.current_step = None
                    state.next_action = "Finalize and produce deliverable"

                save_checkpoint(state)

        # Step limit reached
        state.status = "incomplete"
        save_checkpoint(state)
        return _finish_task(state, transcript, pending, "Step limit reached", ok=False)


SYSTEM_PROMPT = """You are an elite, highly intelligent on-premise engineering AI for a refinery. You run locally and have strict access to MCP tools. You must behave with the capability and precision of a senior engineer.

CRITICAL RULES:
1. ATTACHMENTS: If the user says `[Attached: filename]`, the file is in the `uploads/` directory. You MUST immediately use `ocr_image` on `uploads/filename` for images, or `read_document` for PDFs to understand the contents. Do not guess. YOU MUST ONLY READ THE SPECIFIC FILE ATTACHED. DO NOT call `list_files` to find and read other unrequested files.
2. FILE GENERATION: When asked to generate a report, Excel, or PPT, formulate the content based on facts and immediately call the appropriate generate_* tool (e.g., generate_pptx, generate_docx). 
3. APPROVALS: If a tool returns "approval_required", DO NOT RETRY IT. Immediately stop and output your final answer asking the user to approve the action. 
4. LOOP PREVENTION: NEVER call the same tool with the same arguments twice. If you get stuck, stop and explain the issue.
5. FINISHING: After generating a file, state exactly where it was saved using `workspace_data/outputs/filename.ext`, then provide a download link in this exact format: `[Download filename.ext](http://127.0.0.1:8000/download?path=outputs/filename.ext)`
6. Be concise, highly accurate, and extremely competent.
7. TASK CONTINUATION: If you receive a continuation prompt, you are resuming a previous task. Use the provided structured summary to understand what was done. Continue from the exact current step. Do not repeat completed work. Preserve all citations and verified facts.
"""

def _finish_task(state: TaskState, transcript: list, pending: list,
                 answer: str, ok: bool) -> dict:
    log_event(user=state.user, role=state.role, event="task_end",
              status="ok" if ok else state.status,
              result_summary=f"{len(transcript)} tool calls; {len(pending)} awaiting approval; continuations={state.continuation_count}")
    return {
        "answer": answer,
        "tool_calls": transcript,
        "pending_approvals": pending,
        "task_id": state.task_id,
        "task_status": state.status,
        "continuations": state.continuation_count,
        "complete": ok
    }


def get_task_status(task_id: str, user: str) -> dict | None:
    """Get current task status for UI polling."""
    state = load_checkpoint(task_id)
    if not state or state.user != user:
        return None
    return {
        "task_id": state.task_id,
        "objective": state.objective,
        "status": state.status,
        "completed_steps": state.completed_steps,
        "current_step": state.current_step,
        "continuation_count": state.continuation_count,
        "plan": state.plan.to_dict(),
        "updated_at": state.updated_at
    }


# Exported for API integration
__all__ = [
    "TaskStep", "TaskPlan", "TaskState",
    "create_task", "run_task_with_orchestration",
    "save_checkpoint", "load_checkpoint", "load_checkpoint_by_id",
    "list_user_tasks", "get_task_status",
    "summarize_context", "build_continuation_messages",
    "estimate_tokens", "estimate_messages_tokens", "check_context_budget",
    "CONTEXT_MAX_TOKENS", "CONTEXT_COMPACTION_THRESHOLD",
    "MAX_TASK_STEPS", "MAX_STEP_RETRIES", "MAX_CONTEXT_CONTINUATIONS", "SUMMARY_MODEL"
]