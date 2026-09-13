"""Multi-agent orchestrator for VERTEX."""
from __future__ import annotations

import argparse
import sys
from typing import Any

from .agent import run as agent_run

PLANNER_PROMPT = """You are the Orchestration Planner.
Your job is to break down the user's task into concrete investigation steps for the Researcher, and drafting steps for the Writer.
Return your plan as a detailed list.
Do not attempt to execute any tools yourself."""

RESEARCHER_PROMPT = """You are the Researcher.
Your job is to gather evidence by searching the knowledge base, reading documents and diagrams, and analyzing data in the sandbox.
Execute the Planner's investigation steps. Extract facts, numbers, and findings.
Do not attempt to write the final deliverable. Output a comprehensive Evidence Summary of your findings."""

WRITER_PROMPT = """You are the Writer.
Your job is to take the Researcher's Evidence Summary and draft the final deliverables (reports, work orders) requested by the user.
You MUST use your file generation tools to physically create these files. 
CRITICAL: To make the document beautiful and aesthetic, you must use a mix of 'heading' (levels 1-3), 'paragraph', and 'bullets' block types. Never just output one giant paragraph.
Request human approval when prompted. Do not attempt to search or read documents; rely entirely on the Evidence Summary."""

# The specific MCP tools each role is allowed to see and use
ROLES = {
    "planner": {
        "prompt": PLANNER_PROMPT,
        "tools": []  # No tools, pure reasoning
    },
    "researcher": {
        "prompt": RESEARCHER_PROMPT,
        "tools": [
            "read_document",
            "ocr_image",
            "search_knowledge_base",
            "list_files",
            "run_python_sandbox",
            "sandbox_status",
        ]
    },
    "writer": {
        "prompt": WRITER_PROMPT,
        "tools": [
            "generate_docx",
            "generate_xlsx",
            "generate_pptx",
        ]
    }
}

def run_orchestrator(task: str, user: str = "demo", role: str = "engineer", auto_approve: bool = True, verbose: bool = True, chat_fn=None) -> dict[str, Any]:
    print("\n" + "="*50)
    print("▶ STARTING MULTI-AGENT ORCHESTRATION")
    print("="*50)
    
    # We need to pass chat_fn if it was provided
    kwargs = {"user": user, "role": role, "verbose": verbose, "auto_approve": auto_approve}
    if chat_fn is not None:
        kwargs["chat_fn"] = chat_fn
    
    # 1. PLANNER
    print("\n--- 🧠 [1/3] PLANNER PHASE ---")
    plan_result = agent_run(
        f"Create a plan for this task: {task}", 
        system_prompt=ROLES["planner"]["prompt"],
        allowed_tools=ROLES["planner"]["tools"],
        **kwargs
    )
    plan_text = plan_result.get("answer", "")
    
    # 2. RESEARCHER
    print("\n--- 🔍 [2/3] RESEARCHER PHASE ---")
    research_task = f"User task: {task}\n\nPlanner's Plan:\n{plan_text}\n\nExecute the investigation steps and return an Evidence Summary."
    research_result = agent_run(
        research_task,
        system_prompt=ROLES["researcher"]["prompt"],
        allowed_tools=ROLES["researcher"]["tools"],
        **kwargs
    )
    evidence_text = research_result.get("answer", "")
    
    # 3. WRITER
    print("\n--- ✍️  [3/3] WRITER PHASE ---")
    write_task = f"User task: {task}\n\nEvidence Summary:\n{evidence_text}\n\nGenerate the requested deliverables."
    writer_result = agent_run(
        write_task,
        system_prompt=ROLES["writer"]["prompt"],
        allowed_tools=ROLES["writer"]["tools"],
        **kwargs
    )
    
    return {
        "plan": plan_text,
        "evidence": evidence_text,
        "final_result": writer_result,
        "complete": writer_result.get("complete", False)
    }

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("task", nargs="+")
    ap.add_argument("--role", default="engineer")
    ap.add_argument("--user", default="demo")
    ap.add_argument("--auto-approve", action="store_true")
    args = ap.parse_args()
    
    result = run_orchestrator(" ".join(args.task), user=args.user, role=args.role, auto_approve=args.auto_approve)
    sys.exit(0 if result["complete"] else 1)
