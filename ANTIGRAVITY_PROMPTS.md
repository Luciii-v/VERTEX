# Antigravity Prompt Playbook — SIH26117

Staged prompts, basic → hackathon level. Paste them in order. Do not skip the
explore and plan phases; that is where Antigravity earns its keep.

## Before you start

1. Unzip this project and open the folder in Antigravity.
2. `AGENTS.md` sits at the workspace root and loads automatically — it carries
   every constraint, so you do not need to repeat them in each prompt.
3. Also register it as an Always-On Workspace Rule: `…` dropdown →
   Customizations → Rules → **+ Workspace**. Belt and braces.
4. Anatomy of every prompt below: **role → context (with `@` file mentions) →
   task → constraints → acceptance criteria**. Type `@` to attach real file
   paths; it stops the agent guessing at structure.

---

# PHASE 0 — Orientation

## Prompt 0.1 — Explore before touching anything

```
Act as a senior Python engineer joining this project.

Read @AGENTS.md, @README.md, @SETUP.md, @tools/registry.py, @tools/impl.py,
@tools/sandbox.py, @tools/mcp_server.py, @tools/agent.py and @tools/router.py.

Do NOT write or modify any code yet. Produce a written report covering:
1. How a request travels from the HTTP API to a tool result. Name each file.
2. Exactly how the human-approval guardrail is enforced, and why approvals are
   NOT exposed as MCP tools.
3. What the two sandbox backends are and how they differ in isolation strength.
4. Which of the 27 SIH26117 requirements this code already satisfies, which are
   partially done, and which are missing entirely. Present as a table.
5. The three riskiest gaps for a 4-day build, with your reasoning.

Then run `python -m tests.test_smoke` and `python -m tests.test_agent` and
report the results.
```

Read the answer carefully. If it misdescribes the approval flow or the sandbox
backends, your rules file is not loading — fix that before going further.

---

# PHASE 1 — Verify the foundation

## Prompt 1.1 — Preflight

```
Run `python -m tools.agent --check` and interpret the output.

For each problem found, tell me the exact shell command to fix it. Pay
particular attention to whether the Docker sandbox image is pulled — per
@AGENTS.md the subprocess fallback is not a security boundary, and the image
cannot be pulled once we go air-gapped.

Do not modify code. This is diagnosis only.
```

## Prompt 1.2 — First live tool call, test-first

```
Write a new test file @tests/test_live_ollama.py that verifies our real local
model can drive our MCP tools. It must:

- Skip cleanly (not fail) if Ollama is unreachable, so CI stays green offline.
- Assert `qwen3.5:9b` is installed via tools.ollama_client.preflight.
- Send one tool-calling request and assert the model returns a tool_calls entry
  naming a real tool from our MCP listing.
- Run a full agent task end to end: "compute the mean of [4.2, 2.1, 3.8] in the
  sandbox" and assert the sandbox stdout contains the correct value.
- Assert the audit table gained rows for that task.

Then run it and iterate until it passes. Report the wall-clock time of the
inference call so we know our latency budget.
```

## Prompt 1.3 — Fix the argument-format mismatch

Run this only if 1.2 exposed malformed tool arguments.

```
`qwen3.5:9b` returned tool arguments in a shape our agent loop mishandles.
Here is the exact output:

[paste the raw tool_calls output]

Fix the argument normalisation in @tools/agent.py to handle this shape plus:
a JSON string instead of an object, arguments nested under an extra key,
numbers arriving as strings where the schema expects integers, and a missing
arguments key entirely.

Add a unit test for each of those five cases to @tests/test_agent.py using the
scripted chat_fn pattern — no live model calls. Run both test files.
```

---

# PHASE 2 — RAG (the highest-value feature)

## Prompt 2.1 — Plan first

```
Explore how @tools/impl.py consumes the knowledge base via
search_knowledge_base, then write an implementation plan artifact for a new
`rag/` module. Do not write code yet.

Requirements:
- FastAPI service on 127.0.0.1:8100 exposing exactly the /search contract in
  @AGENTS.md. That contract is frozen.
- Ingestion: PDF/DOCX/TXT → chunk → embed with nomic-embed-text via Ollama →
  persist in ChromaDB under workspace_data/chroma/.
- Chunking must preserve source filename and page number for citations.
- Also expose POST /ingest and GET /stats.
- Fully offline. ChromaDB must not attempt telemetry — disable it explicitly.

Your plan must list: files to create, pinned dependencies, chunk size and
overlap with your reasoning, and how you will test retrieval quality without
internet access.
```

Review the plan. Then:

## Prompt 2.2 — Build it

```
Implement the approved plan. Follow the test-first rule in @AGENTS.md:
write @tests/test_rag.py before the implementation.

Tests must cover: ingesting a 3-paragraph synthetic SOP, retrieving the correct
paragraph for a semantically-worded query that shares no keywords with it
(e.g. "how much corrosion is too much" must retrieve a chunk about wall-loss
limits), citations carrying the right source and page, graceful failure when
Ollama is down, and the /search response matching the frozen contract exactly.

Run the tests and iterate until they pass. Then confirm
tools.impl.search_knowledge_base reaches your live service successfully.
```

---

# PHASE 3 — Multimodal document pipeline

## Prompt 3.1 — Generate the demo corpus

```
Create @scripts/make_demo_data.py that generates our synthetic refinery corpus.
Public/synthetic content only — no proprietary data, per the problem statement.

Generate into workspace_data/:
1. kb/corrosion_response_SOP.pdf — sections on wall-loss limits (shutdown above
   3.0 mm), gasket seepage (repair within 7 days), expired gauge calibration,
   and an escalation matrix. Realistic engineering register.
2. kb/equipment_restart_procedure.pdf — approval prerequisites for restart.
3. uploads/inspection_report_P101.pdf — an inspection report for cooling water
   pump P-101 with a findings table: 4.2 mm wall loss at the discharge flange,
   minor gasket seepage, gauge calibration expired 2026-07-15.
4. uploads/inspection_report_P101_scanned.pdf — the same report rendered as
   page IMAGES with slight rotation and grain, so it has NO text layer and
   forces the OCR and vision path.
5. uploads/inspection_schedule.csv — 12 rows: equipment tag, last inspection
   date, interval in days. Some deliberately overdue relative to 2026-09-01.

Use reportlab or PyMuPDF. Pin any new dependency. The numbers must be internally
consistent, because our demo hinges on the model comparing 4.2 mm against the
3.0 mm limit and concluding shutdown. Run the script and confirm every file
exists with a sane page count.
```

## Prompt 3.2 — Prove the scanned path

```
Using @workspace_data/uploads/inspection_report_P101_scanned.pdf, verify our
multimodal pipeline works end to end.

1. Call tools.impl.read_document on it. Confirm it reports needs_vision true
   and text_layer_sparse on the pages — if not, the fixture is wrong, fix it.
2. Call ocr_image on a rendered page and report the mean confidence.
3. Run: python -m tools.agent "Read uploads/inspection_report_P101_scanned.pdf
   and list every finding with its equipment tag and measured value"
4. Compare the extracted values against the ground truth in
   @scripts/make_demo_data.py and report per-field accuracy.

If accuracy is poor, diagnose whether the failure is OCR quality, image
resolution, or prompting — then fix the actual cause. Do not paper over it by
hardcoding expected values anywhere.
```

---

# PHASE 4 — The flagship agentic workflow

## Prompt 4.1

```
Build the end-to-end scenario the judges will see. Add
@tests/test_scenario_approval_note.py that drives this whole chain:

Input: uploads/inspection_report_P101_scanned.pdf
Task: "Review this inspection report, compare the findings against our
corrosion SOP, classify the risk, and draft an approval note as a Word file."

Assert the agent:
1. Calls read_document, then ocr_image on the sparse pages.
2. Calls search_knowledge_base and retrieves the wall-loss limit chunk.
3. Correctly concludes 4.2 mm exceeds the 3.0 mm limit → HIGH risk / shutdown.
4. Hits the approval gate on generate_docx and STOPS.
5. After programmatic approval, writes a real .docx.
6. Produces a docx whose text contains the SOP citation with document and page.
7. Leaves a complete audit trail: task_start, each tool call, approval_granted,
   task_end.

Use the scripted chat_fn for determinism, plus a live-model variant that skips
when Ollama is down. Iterate until green.
```

## Prompt 4.2 — Multi-agent orchestration

```
Write an implementation plan for @tools/orchestrator.py implementing three
agent roles per requirement 17 — planner, researcher, writer — then implement it
after I approve the plan.

Hard constraint from @AGENTS.md: they must run SEQUENTIALLY and share ONE
loaded model. Never load two models concurrently on 24 GB.

- planner: decomposes the task into steps. Tools: none.
- researcher: gathers evidence. Tools: read_document, ocr_image,
  search_knowledge_base, list_files. No write tools.
- writer: produces the deliverable. Tools: the generate_* family only.

Each role gets its own system prompt and its own tool subset, enforced by
filtering the MCP listing — not by asking the model nicely. Emit a structured
handoff artifact between roles so the UI can render the chain.

Add tests asserting the researcher CANNOT call generate_docx even if it tries.
```

---

# PHASE 5 — Enterprise credibility

## Prompt 5.1 — Auth and RBAC

```
Implement real authentication to replace the X-User/X-Role headers, which are
currently trust-the-client.

- SQLite users table: username, password hash (hashlib.scrypt, per-user salt),
  role, created_at. No external auth library.
- POST /auth/login → signed session token. POST /auth/logout.
- Resolve identity from the token in @tools/http_api.py; keep the header path
  available only when WORKBENCH_DEV_AUTH=1.
- Seed three demo users: operator/engineer/admin.
- Admin-only endpoints for user CRUD.

Add tests: correct and incorrect passwords, an operator blocked from the
sandbox through the real auth path, token expiry, and confirmation that no
password or hash ever reaches the audit table.
```

## Prompt 5.2 — Admin dashboard API

```
Add the read-only endpoints the admin dashboard needs, all local:

GET /admin/status  → ollama preflight, sandbox preflight, disk free,
                     process uptime, loaded model, resident memory
GET /admin/network → outbound connection count (0), the sandbox network mode,
                     the bound interfaces, and a timestamped list of any
                     non-local request our tripwire blocked
GET /admin/models  → models.json plus which are actually installed in Ollama
GET /admin/audit/stats → counts by event type, by user, by tool; last 24h

/admin/network must derive real values — read them from the running system,
do not hardcode zeros. Admin role only. Add tests.
```

---

# PHASE 6 — Offline proof (your winning moment)

## Prompt 6.1

```
Build the artifact that proves sovereignty rather than asserting it.

1. @scripts/verify_airgap.sh — a script that:
   - lists every listening socket and flags any bound outside 127.0.0.1
   - greps the whole codebase for http:// and https:// literals and reports any
     host that is not localhost/127.0.0.1/host.docker.internal
   - runs the full test suite with an env var that makes any non-local DNS
     resolution fail, proving nothing depends on the internet
   - executes a sandbox job that ATTEMPTS an outbound request and captures the
     failure as positive evidence
   - writes a timestamped report to workspace_data/outputs/airgap_report.txt

2. @tests/test_no_external_calls.py — a test that fails the build if any source
   file gains a non-local URL literal. Allowlist only the three local hosts.

Run both. If the grep finds real violations, fix them and tell me what they were.
```

## Prompt 6.2 — Live network monitor

```
Add GET /admin/network/stream — a Server-Sent Events endpoint publishing a
network event every 2 seconds: outbound attempt count, blocked attempt count,
active local connections, and the sandbox network mode.

The UI will render this as a live "0 external calls" panel during the demo, so
it must reflect reality and update while a task runs. Use psutil (pin it) or
parse `lsof`; document which and why. Admin role only, and it must not itself
make any network call.
```

---

# PHASE 7 — Polish

## Prompt 7.1 — Hostile review of our own work

```
Act as a hostile SIH judge with a security background. Review this entire
codebase against the 27 requirements in @AGENTS.md and our README.

Produce:
1. Every place we CLAIM a property but do not enforce it in code.
2. Every path where confidential data could leave the machine, however unlikely.
3. Every way the model could bypass the approval guardrail.
4. The three questions you would ask to expose weakness in our demo, with the
   honest answer for each.
5. Anything that will break under live demo conditions: cold model load, a
   30-page PDF, two users at once, Docker not running, a mid-task ESC.

Rank by severity. Do not fix anything yet — I will choose.
```

## Prompt 7.2 — Demo hardening

```
Make the demo unbreakable, without faking any output.

1. Pre-warm the model on startup so the first query is not a cold load.
2. A cache keyed on file hash + task, so a repeated demo query returns fast —
   the cache must be visibly labelled as a cache in the response, never
   presented as fresh inference.
3. A timeout on every stage with a clear user-facing message, never a spinner
   that hangs forever.
4. @scripts/demo_reset.sh restoring a clean known state in under 10 seconds:
   clear outputs, reset the audit DB, re-seed users, re-ingest the KB.
5. A verbose mode logging each agent step with timing, so we can narrate the
   demo from the screen.

Then run every test file and report the full suite status.
```

## Prompt 7.3 — Judge-facing README

```
Rewrite @README.md for the judges. Include: the one-sentence pitch, an ASCII
architecture diagram, the requirement→implementation table with file paths for
all 27 items, exact setup commands, the four demo scenarios with expected
outputs, the air-gap verification procedure, an honest known-limitations
section, and the hardware we ran on.

Be accurate about what is and is not implemented. An honest limitations section
earns more credit than an overclaim a judge catches.
```

---

## Working rules for the whole build

- **Always explore → plan → execute** for anything touching more than one file.
  Ask for a plan artifact, read it, then approve.
- **Always end an implementation prompt with the test command.** Antigravity
  iterates well against real test output; that verification loop is the point.
- **`@`-mention files instead of describing them.** Cheaper and more accurate.
- **Paste real errors verbatim.** Never paraphrase a traceback.
- **Hit ESC** the moment it starts down a wrong path; re-prompt with the
  constraint it violated rather than letting it dig.
- **Commit after every green phase.** `git commit -m "phase 2: RAG green"`.
  A working checkpoint at hour 20 beats a broken masterpiece at hour 35.
- **Never let it add a cloud dependency "temporarily."** That is the one
  mistake this project cannot survive.
