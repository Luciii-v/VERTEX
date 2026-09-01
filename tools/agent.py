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

SYSTEM_PROMPT = """You are the on-premise engineering assistant for a refinery. \
You run entirely on local hardware; no data leaves this machine.

Rules:
- Use tools for anything factual. Never guess a file's contents, and never do \
arithmetic in your head -- run it in the sandbox.
- Ground every claim about procedures in search_knowledge_base results, and \
cite the source document and page.
- After reading a document, if a page is marked text_layer_sparse or \
needs_vision, call ocr_image on that page's image_path.
- Tools that write files require human approval. If a call returns \
status "approval_required", tell the user what you want to write and stop. \
Do not retry it.
- If a tool returns status "error", read the message, correct your arguments \
or your code, and try again at most twice. Then explain what blocked you.
- Finish with a short plain-language summary naming any file you produced."""

MAX_STEPS = 12
MAX_TOOL_RETRIES = 2


def run(
    task: str,
    *,
    user: str = "demo",
    role: str = "engineer",
    images: list[str] | None = None,
    auto_approve: bool = False,
    verbose: bool = True,
    chat_fn=chat,
) -> dict:
    decision = route(task, has_image=bool(images))
    model, num_ctx = decision["model"], decision["num_ctx"]

    if verbose:
        print(f"\n\033[1mRouting\033[0m  {decision['role']} -> {model}")
        print(f"          {decision['reason']}")
        print(f"          context {num_ctx} tokens | outbound calls: 0\n")

    log_event(user=user, role=role, event="task_start", model=model,
              arguments={"task": task}, result_summary=decision["reason"])

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": task},
    ]
    transcript: list[dict] = []
    error_counts: dict[str, int] = {}
    pending: list[dict] = []

    with MCPClient(user=user, role=role) as mcp:
        tool_schemas = mcp.openai_tool_schemas()
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
                        pending.append(envelope)
                        if verbose:
                            print(f"      \033[33mAPPROVAL REQUIRED\033[0m "
                                  f"id={envelope['request_id']}")

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
    ap.add_argument("task", nargs="+")
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

    result = run(" ".join(args.task), user=args.user, role=args.role,
                 images=args.images, auto_approve=args.auto_approve)
    sys.exit(0 if result["complete"] else 1)


if __name__ == "__main__":
    main()
