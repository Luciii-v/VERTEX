"""HTTP surface for the UI teammate. Bind to 127.0.0.1 only.

This is the contract to hand over so the two of you stop blocking each other:

  GET  /health                      -> sandbox + tool readiness
  GET  /tools                       -> tool catalogue (name, schema, mutating, roles)
  POST /tools/call                  -> {tool, arguments, approval_token?}
  GET  /approvals                   -> pending human-approval requests
  POST /approvals/{id}/approve       -> grants a single-use token
  POST /approvals/{id}/reject
  GET  /audit?limit=200             -> audit rows for the admin dashboard
  GET  /audit/export                -> CSV path for the compliance demo
  POST /upload                      -> multipart file -> workspace_data/uploads
  GET  /files/{subdir}              -> list files
  GET  /download?path=...           -> fetch a generated deliverable

Identity comes from the X-User / X-Role headers. Swap these for real session
auth once your RBAC/login module lands -- nothing else here changes.

Run: uvicorn tools.http_api:app --host 127.0.0.1 --port 8000
"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from . import impl
from .audit import export_csv, log_event, recent
from .registry import (
    ROLES,
    ToolError,
    approve,
    call_tool,
    list_tools,
    pending_approvals,
    reject,
)
from .sandbox import preflight

app = FastAPI(title="Sovereign Workbench - Tool Layer", version="0.1.0")


def _identity(user: str | None, role: str | None) -> tuple[str, str]:
    user = user or "demo"
    role = (role or "engineer").lower()
    if role not in ROLES:
        raise HTTPException(400, f"unknown role '{role}' (expected one of {ROLES})")
    return user, role


class ToolCall(BaseModel):
    tool: str
    arguments: dict = {}
    approval_token: str | None = None


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "tool_count": len(list_tools()),
        "sandbox": preflight(),
        "outbound_network_calls": 0,
        "note": "All inference, OCR, retrieval and file generation are local.",
    }


@app.get("/tools")
def tools() -> dict:
    return {"tools": list_tools()}


@app.post("/tools/call")
def tools_call(
    body: ToolCall,
    x_user: str | None = Header(None),
    x_role: str | None = Header(None),
) -> dict:
    user, role = _identity(x_user, x_role)
    return call_tool(
        body.tool, body.arguments, user=user, role=role,
        approval_token=body.approval_token,
    )


@app.get("/approvals")
def approvals() -> dict:
    return {"pending": pending_approvals()}


@app.post("/approvals/{request_id}/approve")
def approvals_approve(
    request_id: str,
    x_user: str | None = Header(None),
    x_role: str | None = Header(None),
) -> dict:
    user, role = _identity(x_user, x_role)
    if role not in ("engineer", "admin"):
        raise HTTPException(403, "only engineer or admin may approve actions")
    try:
        rec = approve(request_id, user)
    except ToolError as exc:
        raise HTTPException(404, str(exc)) from exc
    # The token IS the request id; it is single use and consumed on next call.
    return {"status": "approved", "approval_token": request_id, "request": rec}


@app.post("/approvals/{request_id}/reject")
def approvals_reject(
    request_id: str,
    x_user: str | None = Header(None),
    x_role: str | None = Header(None),
) -> dict:
    user, _ = _identity(x_user, x_role)
    try:
        return {"status": "rejected", "request": reject(request_id, user)}
    except ToolError as exc:
        raise HTTPException(404, str(exc)) from exc


@app.get("/audit")
def audit(limit: int = 200, user: str | None = None) -> dict:
    return {"rows": recent(limit=limit, user=user)}


@app.get("/audit/export")
def audit_export() -> dict:
    path = export_csv(impl.OUTPUTS / "audit_export.csv")
    return {"path": str(path)}


@app.post("/upload")
async def upload(
    file: UploadFile = File(...),
    x_user: str | None = Header(None),
    x_role: str | None = Header(None),
) -> dict:
    user, role = _identity(x_user, x_role)
    dest = impl.UPLOADS / Path(file.filename or "upload.bin").name
    dest.write_bytes(await file.read())
    log_event(user=user, role=role, event="upload", status="ok",
              result_summary=str(dest))
    return {"path": str(dest.relative_to(impl.DATA)),
            "size_bytes": dest.stat().st_size}


@app.get("/files/{subdir}")
def files(subdir: str = "uploads") -> dict:
    if subdir not in ("uploads", "outputs", "kb"):
        raise HTTPException(400, "subdir must be uploads, outputs or kb")
    return {"files": impl.list_files(subdir)}


@app.get("/download")
def download(path: str):
    target = (impl.DATA / path).resolve()
    if impl.DATA.resolve() not in target.parents or not target.is_file():
        raise HTTPException(404, "not found")
    return FileResponse(target, filename=target.name)
