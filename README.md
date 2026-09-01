# Sovereign Workbench — Tool & Sandbox Layer (SIH26117)

Your half of the build: the MCP tool server, the execution sandbox, RBAC,
audit logging and the human-approval guardrail. Nothing here talks to the
internet, and nothing here knows which model is being used.

```
tools/
  registry.py     tool registration, RBAC, guardrails, the ONE call path
  agent.py        the agent loop (model <-> MCP tools) + CLI
  router.py       model selection, driven by models.json (req 18)
  models.json     the model registry -- add a model here, nowhere else
  ollama_client.py  stdlib-only Ollama client with a non-local tripwire
  mcp_client.py   MCP client the agent uses (proves req 15 end to end)
  audit.py        append-only SQLite audit log (req 7) + CSV export
  sandbox.py      Docker `--network none` executor + macOS fallback
  impl.py         the 9 tools themselves
  mcp_server.py   MCP over stdio, zero dependencies (req 15)
  http_api.py     REST surface for the UI teammate
tests/test_smoke.py   17 checks on the tool layer
tests/test_agent.py   15 checks on routing, MCP and guardrails (no Ollama needed)
```

## Quick start

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

python -m tests.test_smoke                 # should print ALL CHECKS PASSED
python -m tests.test_agent                 # should print ALL CHECKS PASSED
docker pull python:3.12-slim               # DO THIS BEFORE GOING AIR-GAPPED

uvicorn tools.http_api:app --host 127.0.0.1 --port 8000   # for the UI
python -m tools.agent --check                             # preflight
python -m tools.agent "compute 17*23 in the sandbox"      # try it
```

Full step-by-step in **SETUP.md**.

## The tool surface

| Tool | Mutating | Roles | Purpose |
|---|---|---|---|
| `list_files` | no | all | discover uploads/outputs/kb |
| `read_document` | no | all | PDF/DOCX/XLSX/CSV/image → text per page, page PNGs, `needs_vision` flag |
| `ocr_image` | no | all | offline OCR with boxes + confidence |
| `search_knowledge_base` | no | all | RAG passages with source + page for citation |
| `run_python_sandbox` | no | engineer, admin | execute & verify code, no network |
| `sandbox_status` | no | all | backend, limits, isolation — for the dashboard |
| `generate_docx` | **yes** | engineer, admin | real approval notes |
| `generate_xlsx` | **yes** | engineer, admin | schedules, calculations |
| `generate_pptx` | **yes** | engineer, admin | management decks |

Adding a tool is one decorated function in `impl.py`. The MCP listing, the
audit log, RBAC and the approval gate all pick it up automatically — that
"add a tool without redesigning the system" property is the same argument the
model registry makes, and judges respond to it.

## Three design decisions to defend out loud

**1. `--network none` is the sovereignty proof.** The sandbox is not merely
told not to call out — the kernel gives it no network interface at all. Demo
move: ask the assistant to fetch a URL, let it write the code, and show the
`socket.gaierror` in stderr. That's a far stronger claim than a firewall rule.
On a machine without Docker the fallback backend reports
`network: host-inherited`, and `sandbox_status` says so explicitly. Never
present the fallback as a security boundary.

**2. Tools return facts, not prose.** `read_document` gives you text, page
images and a `needs_vision` hint; it does not decide anything. The orchestrator
picks the model. This is what keeps your layer swappable between Qwen, Gemma
and Llama, and it stops your scope from bleeding into the router owner's.

**3. Mutating tools cannot self-approve.** Any file-writing tool returns
`{"status": "approval_required", "request_id": ...}` instead of executing. The
UI renders Approve/Reject; approval yields a **single-use** token. The model
literally cannot write to disk without a human click — that's requirement 8,
and it's visible on screen.

## Contract for the UI teammate

Base `http://127.0.0.1:8000`. Identity via `X-User` and `X-Role`
(`operator` | `engineer` | `admin`).

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | sandbox status + `outbound_network_calls: 0` |
| GET | `/tools` | render tool chips from `inputSchema`; `_mutating` → lock icon |
| POST | `/tools/call` | `{tool, arguments, approval_token?}` |
| GET | `/approvals` | pending queue |
| POST | `/approvals/{id}/approve` | returns `approval_token` → resend the call |
| POST | `/approvals/{id}/reject` | |
| GET | `/audit?limit=200` | admin dashboard table |
| GET | `/audit/export` | CSV for the compliance moment |
| POST | `/upload` | multipart → `workspace_data/uploads` |
| GET | `/files/{uploads\|outputs\|kb}` | file browser |
| GET | `/download?path=` | fetch a generated deliverable |

Every response is `{status: "ok"|"error"|"approval_required", ...}`. Have the UI
switch on `status` and it handles all three cases with one code path.

## Contract for the RAG teammate

One endpoint, and you're done coordinating:

```
POST http://127.0.0.1:8100/search   {"query": str, "top_k": int}
->   {"hits": [{"text": str, "source": str, "page": int, "score": float}]}
```

Override with `RAG_ENDPOINT`. Until it exists, `search_knowledge_base` returns
a clean "local RAG service unreachable" error rather than hanging — so you can
build and test everything else today.

## Contract for the orchestrator teammate

Speak MCP over stdio (`python -m tools.mcp_server`), or hit `/tools/call`.
Set `WORKBENCH_USER` and `WORKBENCH_ROLE` so calls are attributed in the audit
log. Two rules for the agent loop:

- On `status: "error"`, read the message, fix, retry **at most twice**. Cap it
  or a live demo will hang.
- On `status: "approval_required"`, stop and surface the request. Do not retry.

## Before you unplug the network

- [ ] `docker pull python:3.12-slim`
- [ ] `pip download -r requirements.txt -d wheels/`
- [ ] `ollama pull` all four models
- [ ] tesseract binary installed (or PaddleOCR weights cached)
- [ ] `python -m tests.test_smoke` passes with `backend=docker`
- [ ] `/health` shows `docker_available: true`, `image_pulled: true`

That last one has killed more hackathon demos than any bug: the sandbox image
must be pulled while you still have internet.
