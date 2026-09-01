# AGENTS.md — Sovereign AI Workbench (SIH26117)

Antigravity loads this file automatically. It is the project constitution.
Consult it before proposing any change.

## Mission

An air-gapped, on-premise AI workbench for a refinery (MRPL). Engineers upload
confidential documents, drawings and scans; the system reads them, reasons over
the company's own SOPs, executes code, and produces real deliverable files.
No data ever leaves the machine.

## Non-negotiable rules

1. **NEVER add a network call to any host other than `127.0.0.1`, `localhost`,
   or `host.docker.internal`.** No OpenAI, Anthropic, Gemini, HuggingFace
   downloads at runtime, cloud OCR, hosted vector DBs, telemetry, analytics,
   Sentry, or CDN-loaded fonts/JS/CSS. Vendor every frontend asset locally.
   If you believe a task requires an external call, STOP and ask instead.
2. **No CDN links in HTML.** `npm install` the dependency and bundle it.
   A `<script src="https://...">` tag fails the demo even if it works offline
   from cache.
3. **Never invent facts about documents.** Answers about SOPs must come from
   retrieval results and must cite source document + page.
4. **File-writing tools require human approval.** Never bypass, auto-approve,
   or add a "skip approval" default. `--auto-approve` exists for local
   rehearsal only and must never be the default anywhere.
5. **Never log secrets or full document contents** into the audit table.
   Redact, or store a summary plus a path.
6. **Do not add a dependency without adding it to `requirements.txt`
   (or `package.json`) with a pinned version.** Everything must be
   installable from a local wheel/module cache with no internet.

## Hardware budget — this constrains every design choice

Primary machine: MacBook Air M5, 24 GB unified memory, no discrete GPU.
Teammates: 2x MacBook Air M4 16 GB, 2x Intel Arc 16 GB, 1x Intel i3 8 GB.

- Never hold two large models in memory at once. Unload before loading.
- Default `num_ctx` is 8192. Do not raise it without a stated reason —
  the model advertises 256K, but KV cache lives in the same 24 GB.
- Assume no CUDA. Apple Metal via Ollama on the host; containers get no GPU.
- Prefer small, quantized models over larger ones. Latency is a demo risk.

## Model stack (Ollama, all local)

| Role | Model | Size | Notes |
|---|---|---:|---|
| general + vision + tool calling | `qwen3.5:9b` | 6.6 GB | Q4_K_M, multimodal, 256K max ctx. Primary. |
| code | `qwen2.5-coder:7b` | 4.7 GB | Second routing target. |
| embeddings | `nomic-embed-text` | 274 MB | Indexing and retrieval only. |
| light fallbacks (16 GB Macs) | `qwen3.5:4b`, `qwen2.5-coder:3b` | — | Registry aliases. |

Models are declared in `tools/models.json`. **Adding a model must be a data
change to that file only** — never hardcode a model id anywhere else.

## Architecture

```
React/Vite UI  ──HTTP──▶  FastAPI (tools/http_api.py)
                              │
                              ├── agent loop (tools/agent.py)
                              │      ├── router (tools/router.py) → models.json
                              │      ├── Ollama on host :11434 (tools/ollama_client.py)
                              │      └── MCP client → MCP server (stdio JSON-RPC)
                              │                          └── 9 tools (tools/impl.py)
                              ├── registry: RBAC + approval gate + audit
                              └── RAG service :8100 (separate module)
                                     └── ChromaDB + nomic-embed-text
```

Ports: UI 5173, API 8000, RAG 8100, Ollama 11434. Bind everything to
`127.0.0.1`, never `0.0.0.0`, except inside a container.

## Module ownership — respect these boundaries

| Module | Owner | Do not edit from elsewhere |
|---|---|---|
| `tools/` (sandbox, MCP, RBAC, audit, agent, router) | me | — |
| `frontend/` | UI teammate | Do not restructure it |
| `rag/` (ingestion, ChromaDB, `/search`) | RAG teammate | Consume via HTTP only |

## Cross-module contracts — treat as frozen APIs

**RAG service:**
```
POST http://127.0.0.1:8100/search  {"query": str, "top_k": int}
->   {"hits": [{"text": str, "source": str, "page": int, "score": float}]}
```

**Tool API** (identity via `X-User` and `X-Role` headers):
```
GET  /health                      GET  /tools
POST /tools/call                  {tool, arguments, approval_token?}
GET  /approvals                   POST /approvals/{id}/approve|reject
GET  /audit?limit=                GET  /audit/export
POST /upload                      GET  /files/{uploads|outputs|kb}
GET  /download?path=
```

**Every tool response is one of three shapes.** Handle all three:
```json
{"status":"ok","result":{...},"duration_ms":123}
{"status":"error","error":"human-readable message"}
{"status":"approval_required","request_id":"a3f9","tool":"generate_docx","arguments":{...}}
```

## Roles (RBAC)

`operator` — read, RAG query only. `engineer` — + sandbox, + file generation
(with approval). `admin` — + user management, + audit export.

## Tool design rules

- Tools return **facts and file paths, never prose.** Interpretation is the
  model's job. This keeps the tool layer model-agnostic.
- Every tool declares a JSON Schema, its `mutating` flag and its allowed roles
  via the `@tool` decorator in `tools/impl.py`. Adding a tool is ONE decorated
  function — no edits to the MCP server, audit, RBAC or approval code.
- All filesystem paths must be confined to `workspace_data/` via
  `impl._resolve()`. Never accept an unchecked user path.
- Tools must never raise to the caller. Return an error envelope the agent can
  read and retry from.

## Agent loop rules

- Max 12 steps per task. Max 2 retries per failing tool. Both are hard caps —
  a hung demo is worse than an incomplete answer.
- On `approval_required` the agent must STOP and surface the request, never
  retry the call.
- The routing decision (`model`, `reason`) is user-facing product, not a debug
  log. Always render it.
- Approvals are exposed as `workbench/approve` RPC methods, deliberately NOT as
  tools, so the model cannot discover or grant its own approval. Never move
  them into `tools/list`.

## Testing — run before claiming any task is done

```bash
python -m tests.test_smoke     # 17 checks: tool layer, RBAC, guardrails
python -m tests.test_agent     # 15 checks: routing, MCP, agent loop
python -m tools.agent --check   # preflight: models + sandbox readiness
```

Write the test before the implementation. When you change behaviour, add a
check to the relevant file. Tests must pass with Ollama switched off — use the
scripted `chat_fn` pattern in `tests/test_agent.py`, never a live model call.

## Code standards

- Python 3.12+, `from __future__ import annotations`, full type hints.
- Standard library only in `tools/ollama_client.py`, `tools/mcp_server.py`,
  `tools/mcp_client.py` and `tools/audit.py`. These must work with zero
  installed packages so they survive a broken air-gapped environment.
- FastAPI + Pydantic for the API. No ORM; `sqlite3` directly.
- Frontend: React + Vite + TypeScript, plain CSS or Tailwind compiled locally.
- Comments explain *why*, not *what*. Prefer a short comment naming the
  requirement (e.g. `# req 8: human approval`) over restating the code.
- No `print()` for diagnostics in library code — return structured data and let
  the caller render it. `tools/agent.py` CLI output is the exception.

## Things that have already been decided — do not relitigate

- Ollama runs on the **host**, not in Docker. Containers get no Metal access.
- The sandbox uses `docker run --network none`. The subprocess fallback is NOT
  a security boundary and `sandbox_status` must keep saying so.
- MCP is implemented as raw JSON-RPC with no SDK dependency, on purpose:
  nothing to install air-gapped.
- `qwen3.5:9b` handles both vision and general reasoning, so there is no
  separate vision model to load.
