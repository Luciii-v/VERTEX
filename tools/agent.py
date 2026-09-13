"""The agent loop. Model <-> MCP tools, with guardrails intact.

This is the file that makes the project "agentic" rather than a chatbot:
plan -> call tool -> read result -> call another tool -> deliver a file.

Run it:
    python -m tools.agent "List the files, then compute 17*23 in the sandbox"
    python -m tools.agent --role admin --auto-approve "...draft an approval note..."
"""

from __future__ import annotations

import argparse
import json
import sys

from .audit import log_event
from .mcp_client import MCPClient
from .ollama_client import OllamaError, chat, preflight, unload
from .router import load_registry, route

SYSTEM_PROMPT = """You are an elite, highly intelligent on-premise engineering AI for a refinery. You run locally and have strict access to MCP tools. You must behave with the capability and precision of Gemini Pro. 

CRITICAL RULES:
1. ATTACHMENTS: If the user says `[Attached: filename]`, the file is in the `uploads/` directory. You MUST immediately use `ocr_image` on `uploads/filename` for images, or `read_document` for PDFs to understand the contents. Do not guess. YOU MUST ONLY READ THE SPECIFIC FILE ATTACHED. DO NOT call `list_files` to find and read other unrequested files.
2. FILE GENERATION: When asked to generate a report, Excel, or PPT, formulate the content based on facts and immediately call the appropriate generate_* tool (e.g., generate_pptx, generate_docx). 
3. APPROVALS: If a tool returns "approval_required", DO NOT RETRY IT. Immediately stop and output your final answer asking the user to approve the action. 
4. LOOP PREVENTION: NEVER call the same tool with the same arguments twice. If you get stuck, stop and explain the issue.
5. FINISHING: After generating a file, state exactly where it was saved using `workspace_data/outputs/filename.ext`, then provide a download link in this exact format: `[Download filename.ext](http://127.0.0.1:8000/download?path=outputs/filename.ext)`
6. Be concise, highly accurate, and extremely competent."""

# The max steps the model can take before forced cutoff
MAX_STEPS = 12
MAX_TOOL_RETRIES = 2


def run(
    task: str,
    *,
    user: str = "demo",
    role: str = "engineer",
    images: list[str] | None = None,
    auto_approve: bool = True,
    verbose: bool = True,
    chat_fn=chat,
    system_prompt: str | None = None,
    allowed_tools: list[str] | None = None,
) -> dict:
    decision = route(task, has_image=bool(images))
    model, num_ctx = decision["model"], decision["num_ctx"]

    # DEMO HARDENING: Prevent swap storms on Unified Memory
    from tools.ollama_client import unload
    if model != "qwen3.5:9b":
        unload("qwen3.5:9b")
    else:
        # If we are loading qwen3.5:9b, ensure qwen2.5-coder is unloaded!
        unload("qwen2.5-coder:7b")

    if verbose:
        print(f"\n\033[1mRouting\033[0m  {decision['role']} -> {model}")
        print(f"          {decision['reason']}")
        print(f"          context {num_ctx} tokens | outbound calls: 0\n")
        print("⚙️ [Orchestrator] Model is processing... (Please wait 1-3 minutes for execution)\n", flush=True)

    log_event(user=user, role=role, event="task_start", model=model,
              arguments={"task": task}, result_summary=decision["reason"])

    sp = system_prompt if system_prompt is not None else SYSTEM_PROMPT
    messages = [
        {"role": "system", "content": sp},
        {"role": "user", "content": task},
    ]
    transcript: list[dict] = []
    error_counts: dict[str, int] = {}
    pending: list[dict] = []

    with MCPClient(user=user, role=role) as mcp:
        tool_schemas = mcp.openai_tool_schemas()
        if allowed_tools is not None:
            tool_schemas = [t for t in tool_schemas if t["function"]["name"] in allowed_tools]

        if verbose:
            print(f"Tools available via MCP: {len(tool_schemas)}\n")

        first = True
        for step in range(1, MAX_STEPS + 1):
            try:
                msg = chat_fn(
                    model, messages, tools=tool_schemas,
                    images=images if first else None, num_ctx=num_ctx,
                )
            except OllamaError as exc:
                return _finish(transcript, f"Inference failed: {exc}", pending,
                               user, role, model, ok=False)
            first = False
            messages.append(msg)

            calls = msg.get("tool_calls") or []
            if not calls:
                return _finish(transcript, msg.get("content", ""), pending,
                               user, role, model, ok=True, verbose=verbose)

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
                    print(f"\033[36m[{step}] {name}\033[0m {_brief(args)}")

                envelope = mcp.call(name, args)

                # Guardrail: mutating tool wants a human.
                if envelope.get("status") == "approval_required":
                    if auto_approve:
                        # Approval state lives in the SERVER process, so it must
                        # be granted over the protocol, not imported locally.
                        token = mcp.approve(envelope["request_id"], approver=user)
                        envelope = mcp.call(name, args, approval_token=token)
                        if verbose:
                            print("      \033[33mauto-approved\033[0m (demo mode)")
                    else:
                        if verbose:
                            print(f"      \033[33mAPPROVAL REQUIRED\033[0m "
                                  f"id={envelope['request_id']}")
                        
                        import sys
                        if sys.stdin.isatty():
                            ans = input("      Do you want to approve this file generation? (y/n): ")
                            if ans.strip().lower() in ['y', 'yes']:
                                token = mcp.approve(envelope["request_id"], approver=user)
                                envelope = mcp.call(name, args, approval_token=token)
                                if verbose:
                                    print("      \033[32mmanually approved\033[0m")
                            else:
                                envelope = {"status": "error", "error": "Human explicitly rejected this action."}
                        else:
                            pending.append(envelope)

                if envelope.get("status") == "error":
                    error_counts[name] = error_counts.get(name, 0) + 1
                    if verbose:
                        print(f"      \033[31merror\033[0m {envelope['error'][:160]}")
                    if error_counts[name] > MAX_TOOL_RETRIES:
                        envelope = {
                            "status": "error",
                            "error": f"'{name}' failed {error_counts[name]} times. "
                                     "Stop calling it and explain the blocker.",
                        }
                elif envelope.get("status") == "ok" and verbose:
                    print(f"      \033[32mok\033[0m {_brief(envelope.get('result'))}")

            transcript.append({"step": step, "tool": name,
                               "arguments": args, "envelope": envelope})
            messages.append({
                "role": "tool",
                "tool_name": name,
                "content": json.dumps(envelope, default=str)[:6000],
            })

        return _finish(transcript, "Step limit reached before completion.",
                       pending, user, role, model, ok=False, verbose=verbose)


def _finish(transcript, answer, pending, user, role, model, *, ok, verbose=False):
    log_event(user=user, role=role, event="task_end", model=model,
              status="ok" if ok else "incomplete",
              result_summary=f"{len(transcript)} tool calls; "
                             f"{len(pending)} awaiting approval")
    if verbose:
        print(f"\n\033[1mAnswer\033[0m\n{answer}\n")
        print(f"{len(transcript)} tool calls | model {model} | "
              f"external network calls: 0")
        if pending:
            print(f"\n{len(pending)} action(s) awaiting approval:")
            for p in pending:
                print(f"  - {p['tool']} (id {p['request_id']})")
    return {"answer": answer, "tool_calls": transcript,
            "pending_approvals": pending, "model": model, "complete": ok}


def _brief(value, limit: int = 130) -> str:
    text = json.dumps(value, default=str) if not isinstance(value, str) else value
    text = " ".join(text.split())
    return text if len(text) <= limit else text[:limit] + "..."


def main() -> None:
    ap = argparse.ArgumentParser(description="Sovereign workbench agent")
    ap.add_argument("task", nargs="*")
    ap.add_argument("--role", default="engineer",
                    choices=["operator", "engineer", "admin"])
    ap.add_argument("--user", default="demo")
    ap.add_argument("--image", action="append", dest="images",
                    help="attach an image/scan (repeatable)")
    ap.add_argument("--auto-approve", action="store_true",
                    help="skip the human gate; DEMO ONLY, never in the pitch")
    ap.add_argument("--check", action="store_true",
                    help="preflight models and sandbox, then exit")
    args = ap.parse_args()

    if args.check:
        required = [m["id"] for m in load_registry()["models"]]
        from .sandbox import preflight as sbx
        print(json.dumps({"models": preflight(required), "sandbox": sbx()}, indent=2))
        return

    if not args.task:
        ap.error("a task is required unless --check is used")

    result = run(" ".join(args.task), user=args.user, role=args.role,
                 images=args.images, auto_approve=args.auto_approve)
    sys.exit(0 if result["complete"] else 1)


if __name__ == "__main__":
    main()
