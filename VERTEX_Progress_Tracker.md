# SIH26117 V.E.R.T.E.X — Progress Tracker

Based on `vertex_perplexity.pdf` (Core Requirements) and `planner.pdf` (The Context & Sovereignty Architecture), here is a summary of what we have achieved and what remains for the 4-day build.

## Quick Notes on the Architecture
The two Perplexity documents define the "winning formula" for this hackathon:
1. **The Foundation:** Purely local open-weight models (Qwen), strict air-gapping, and MCP tool connectivity.
2. **The Industrial Context Graph:** Moving beyond simple vector RAG. The system must understand relationships (e.g., *Pump P-204 -> located in -> CDU Unit -> governed by -> SOP-MECH-018*).
3. **Evidence Objects (EV-XXX):** The AI must not just "cite" documents. It must produce machine-readable Evidence Objects linking every high-impact claim to an exact page, table cell, or image bounding box, differentiating between *direct* and *derived* evidence.
4. **Sovereignty Observatory:** A dashboard proving to the judges that the system is secure (tracking 0 outbound network calls, local model usage, and a tamper-evident hashed audit log).

---

## 🚦 Task Checklist

### ✅ What We've Done (Completed)
- [x] **Docker Setup & Containerization:** The isolated `--network none` execution sandbox.
- [x] **Local Inference Working:** `ollama_client.py` configured for Qwen 3.5.
- [x] **MCP Tools Foundation:** `read_document`, `ocr_image`, and generation tools built in `impl.py` and exposed via `mcp_server.py`.
- [x] **Agentic Orchestration:** We implemented `orchestrator.py`, enforcing the sequential **Planner -> Researcher -> Writer** multi-agent workflow.
- [x] **Agent Guardrails (HITL):** Mutating tools (like document generation) are hard-blocked by a mandatory human approval token.
- [x] **Basic Audit Logging:** SQLite tracking of queries and tool calls.

### ⏳ What's Pending (To Do Next)
- [ ] **Document RAG Pipeline:** Build the `rag/` module (FastAPI on port 8100) using ChromaDB and `nomic-embed-text` to chunk and embed SOPs.
- [ ] **Industrial Context Graph (PostgreSQL):** Create the SQL schema for entities and relationships to link Assets (P-102A) to their respective SOPs and work orders.
- [ ] **Evidence Object Formatting:** Update the **Researcher** agent's prompt so its "Evidence Summary" strictly outputs the JSON `Evidence Object` schema (EV-001, EV-002) with lineage tracking, rather than plain text.
- [ ] **Sovereignty Observatory (Admin API):** Build the `/admin/network` and `/admin/status` endpoints to monitor active models, prove 0 external network calls, and chain the audit log hashes for tamper-evidence.
- [ ] **Demo Data Generation:** Run the script to generate the synthetic P-102A inspection reports and CSVs.
- [ ] **Web UI Integration:** Connect the React frontend to our FastAPI backend.
