"""Local MCP server over stdio -- requirement 15, with zero dependencies.

Implements the Model Context Protocol JSON-RPC surface the agent needs:
  initialize, tools/list, tools/call, ping

Written against the raw protocol rather than the SDK on purpose: no wheels to
download, nothing to install on an air-gapped machine, and you can explain every
line to a judge. If you later want the official SDK, the tool functions in
impl.py are unchanged -- only this file gets swapped.

Run:      python -m tools.mcp_server
Identity: pass WORKBENCH_USER / WORKBENCH_ROLE in the environment, so every
          tool call is attributed in the audit log.
"""

from __future__ import annotations

import json
import os
import sys
import traceback

from . import impl  # noqa: F401  -- importing registers all tools
from .registry import (
    ToolError,
    approve,
    call_tool,
    list_tools,
    pending_approvals,
    reject,
)

PROTOCOL_VERSION = "2024-11-05"
SERVER_INFO = {"name": "sovereign-workbench-tools", "version": "0.1.0"}

USER = os.environ.get("WORKBENCH_USER", "demo")
ROLE = os.environ.get("WORKBENCH_ROLE", "engineer")


def _result(request_id, payload):
    return {"jsonrpc": "2.0", "id": request_id, "result": payload}


def _error(request_id, code, message):
    return {"jsonrpc": "2.0", "id": request_id,
            "error": {"code": code, "message": message}}


def handle(msg: dict) -> dict | None:
    method = msg.get("method")
    request_id = msg.get("id")
    params = msg.get("params") or {}

    if method == "initialize":
        return _result(request_id, {
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": SERVER_INFO,
        })

    if method in ("notifications/initialized", "initialized"):
        return None  # notification, no reply

    if method == "ping":
        return _result(request_id, {})

    # --- non-standard, human-only channel -------------------------------
    # Approvals deliberately live OUTSIDE tools/*, so the model can never
    # discover or call them. Only the UI / CLI operator reaches these.
    if method == "workbench/approvals":
        return _result(request_id, {"pending": pending_approvals()})

    if method in ("workbench/approve", "workbench/reject"):
        rid = params.get("request_id")
        approver = params.get("approver", USER)
        try:
            fn = approve if method.endswith("approve") else reject
            record = fn(rid, approver)
        except ToolError as exc:
            return _error(request_id, -32602, str(exc))
        return _result(request_id, {
            "status": "approved" if method.endswith("approve") else "rejected",
            "approval_token": rid if method.endswith("approve") else None,
            "request": record,
        })

    if method == "tools/list":
        return _result(request_id, {"tools": list_tools()})

    if method == "tools/call":
        name = params.get("name")
        args = params.get("arguments") or {}
        approval = params.get("_meta", {}).get("approval_token")
        envelope = call_tool(
            name, args, user=USER, role=ROLE, approval_token=approval
        )
        # MCP expects content blocks; we return the envelope as JSON text so the
        # agent sees status/error/approval_required verbatim.
        return _result(request_id, {
            "content": [{"type": "text",
                         "text": json.dumps(envelope, indent=2, default=str)}],
            "isError": envelope.get("status") == "error",
        })

    return _error(request_id, -32601, f"method not found: {method}")


def main() -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            _emit(_error(None, -32700, "parse error"))
            continue
        try:
            reply = handle(msg)
        except Exception:  # noqa: BLE001
            traceback.print_exc(file=sys.stderr)
            reply = _error(msg.get("id"), -32603, "internal error")
        if reply is not None:
            _emit(reply)


def _emit(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj, default=str) + "\n")
    sys.stdout.flush()


if __name__ == "__main__":
    main()
