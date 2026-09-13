"""Tool registry: single source of truth for every tool the agent can call.

Design goals (maps to SIH26117 requirements):
  - req 15 (MCP): every tool declares a JSON Schema, so the MCP server can
    advertise it without hand-written glue.
  - req 6  (RBAC): every tool declares which roles may invoke it.
  - req 7  (audit): invocation goes through one wrapper -> one audit row.
  - req 8  (guardrails): tools flagged `mutating` cannot execute without an
    approval token issued by a human in the UI.

Adding a tool = one decorated function. No other file changes.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable

from .audit import log_event

ROLES = ("operator", "engineer", "admin", "approver", "employee")


class ToolError(Exception):
    """Raised for expected, user-facing tool failures."""


class PermissionDenied(ToolError):
    pass


class ApprovalRequired(ToolError):
    """Raised when a mutating tool is called without a valid approval token."""

    def __init__(self, tool: str, args: dict, request_id: str):
        self.tool = tool
        self.args = args
        self.request_id = request_id
        super().__init__(f"tool '{tool}' requires human approval")

    def to_envelope(self) -> dict:
        return {
            "status": "approval_required",
            "request_id": self.request_id,
            "tool": self.tool,
            "arguments": self.args,
            "message": (
                f"'{self.tool}' changes state on this machine. "
                "Approve in the workbench UI to continue."
            ),
        }


@dataclass
class Tool:
    name: str
    description: str
    schema: dict
    fn: Callable[..., Any]
    mutating: bool = False
    allowed_roles: tuple[str, ...] = ROLES
    tags: tuple[str, ...] = field(default_factory=tuple)


REGISTRY: dict[str, Tool] = {}

# request_id -> approval record, populated by the UI via approve()
_PENDING: dict[str, dict] = {}
_APPROVED: set[str] = set()


def tool(
    *,
    description: str,
    schema: dict,
    mutating: bool = False,
    allowed_roles: tuple[str, ...] = ROLES,
    tags: tuple[str, ...] = (),
):
    """Register a function as an agent-callable tool."""

    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        name = fn.__name__
        if name in REGISTRY:
            raise RuntimeError(f"duplicate tool name: {name}")
        REGISTRY[name] = Tool(
            name=name,
            description=description,
            schema=schema,
            fn=fn,
            mutating=mutating,
            allowed_roles=allowed_roles,
            tags=tags,
        )
        return fn

    return decorator


def list_tools() -> list[dict]:
    """MCP-shaped tool listing."""
    return [
        {
            "name": t.name,
            "description": t.description,
            "inputSchema": t.schema,
            # non-standard hints, consumed by our own UI
            "_mutating": t.mutating,
            "_allowedRoles": list(t.allowed_roles),
            "_tags": list(t.tags),
        }
        for t in REGISTRY.values()
    ]


def request_approval(name: str, arguments: dict, user: str, role: str) -> str:
    """Store who requested a protected action so it runs with their rights.

    An approver authorizes work; they do not inherit or replace the engineer's
    tool permissions.  This keeps the Admin -> Approver -> Engineer workflow
    auditable and prevents an approval from accidentally escalating access.
    """
    request_id = uuid.uuid4().hex[:12]
    _PENDING[request_id] = {
        "tool": name,
        "arguments": arguments,
        "user": user,
        "role": role,
        "requested_at": time.time(),
    }
    return request_id


def pending_approvals() -> list[dict]:
    return [{"request_id": k, **v} for k, v in _PENDING.items()]


def approve(request_id: str, approver: str, approver_role: str = "admin") -> dict:
    rec = _PENDING.pop(request_id, None)
    if rec is None:
        raise ToolError(f"unknown approval request: {request_id}")
    _APPROVED.add(request_id)
    log_event(
        user=approver,
        role=approver_role,
        event="approval_granted",
        tool=rec["tool"],
        arguments=rec["arguments"],
        result_summary=f"request {request_id}",
    )
    return rec


def reject(request_id: str, approver: str, approver_role: str = "admin") -> dict:
    rec = _PENDING.pop(request_id, None)
    if rec is None:
        raise ToolError(f"unknown approval request: {request_id}")
    log_event(
        user=approver,
        role=approver_role,
        event="approval_rejected",
        tool=rec["tool"],
        arguments=rec["arguments"],
    )
    return rec


def call_tool(
    name: str,
    arguments: dict,
    *,
    user: str = "demo",
    role: str = "engineer",
    approval_token: str | None = None,
) -> dict:
    """The ONE entry point. MCP server, HTTP API and tests all go through here.

    Returns a JSON-serialisable envelope, never raises for expected failures --
    the agent loop should be able to read the error and retry.
    """
    started = time.perf_counter()
    t = REGISTRY.get(name)
    if t is None:
        return {"status": "error", "error": f"no such tool: {name}"}

    if role not in t.allowed_roles:
        log_event(
            user=user, role=role, event="denied", tool=name, arguments=arguments,
            result_summary="role not permitted",
        )
        return {
            "status": "error",
            "error": f"role '{role}' may not call '{name}' "
                     f"(allowed: {', '.join(t.allowed_roles)})",
        }

    if t.mutating:
        if approval_token is None or approval_token not in _APPROVED:
            rid = request_approval(name, arguments, user, role)
            log_event(
                user=user, role=role, event="approval_requested",
                tool=name, arguments=arguments, result_summary=rid,
            )
            return ApprovalRequired(name, arguments, rid).to_envelope()
        _APPROVED.discard(approval_token)  # single use

    try:
        result = t.fn(**arguments)
        status = "ok"
        summary = _summarise(result)
    except ToolError as exc:
        result, status, summary = None, "error", str(exc)
    except TypeError as exc:  # bad arguments from the model
        result, status, summary = None, "error", f"invalid arguments: {exc}"
    except Exception as exc:  # noqa: BLE001 - never kill the agent loop
        result, status, summary = None, "error", f"{type(exc).__name__}: {exc}"

    elapsed_ms = int((time.perf_counter() - started) * 1000)
    log_event(
        user=user, role=role, event="tool_call", tool=name,
        arguments=arguments, status=status, result_summary=summary,
        duration_ms=elapsed_ms,
    )

    if status == "error":
        return {"status": "error", "error": summary, "duration_ms": elapsed_ms}
    return {"status": "ok", "result": result, "duration_ms": elapsed_ms}


def _summarise(value: Any, limit: int = 300) -> str:
    text = repr(value)
    return text if len(text) <= limit else text[:limit] + "..."
