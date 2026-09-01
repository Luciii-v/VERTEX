# Setup — sandbox + MCP tools on your M5 (24 GB)

Copy-paste in order. Should take about 15 minutes.

## 1. Environment

```bash
cd sovereign-workbench
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
brew install tesseract          # OCR fallback
```

## 2. Models

You have `qwen3.5:9b` already. Add the two that complete the stack:

```bash
ollama pull qwen2.5-coder:7b    # 4.7 GB — the second routing target
ollama pull nomic-embed-text    # 274 MB — embeddings for your RAG teammate
ollama list
```

Optional but worth trying on Apple Silicon — the MLX build is compiled for
Metal and is usually noticeably faster on an M-series chip, at 8.9 GB instead
of 6.6 GB:

```bash
ollama pull qwen3.5:9b-mlx
```

Benchmark both with one prompt and keep whichever is faster. If you switch,
change the `id` in `tools/models.json`; nothing else in the codebase moves.

## 3. Sandbox image — do this while you still have internet

```bash
docker pull python:3.12-slim
```

Without this, the sandbox silently falls back to subprocess mode and your
strongest sovereignty claim evaporates. Verify:

```bash
python -m tools.agent --check
```

You want `"docker_available": true`, `"image_pulled": true`,
`"active_backend": "docker"`, and `"ready": true` for models.

## 4. Verify

```bash
python -m tests.test_smoke     # 17 checks — tool layer
python -m tests.test_agent     # 15 checks — routing, MCP, guardrails
```

Both should print `ALL CHECKS PASSED`. `test_agent` uses a scripted fake model,
so it passes even with Ollama off — handy for debugging your own changes
without waiting on inference.

## 5. First real run

```bash
ollama serve                                    # terminal 1

# terminal 2
python -m tools.agent "Compute the 90th percentile of [4.2, 2.1, 3.8, 5.5, 1.2] in the sandbox"
python -m tools.agent "List the files available to you"
```

You should see the routing banner, the tool call, real stdout, then a summary.

## 6. Write path and the guardrail

```bash
python -m tools.agent "Draft an approval note for pump P-101 with a corrosion finding and save it as a Word file"
```

It will stop with `APPROVAL REQUIRED` and an id. That's correct — it's
requirement 8 working. To let it through in a rehearsal:

```bash
python -m tools.agent --auto-approve "Draft an approval note for P-101 ..."
open workspace_data/outputs/
```

Never use `--auto-approve` in the actual pitch. The human click is the feature.

## 7. Vision, once you have a scan

```bash
cp ~/Desktop/scanned_report.pdf workspace_data/uploads/
python -m tools.agent "Read uploads/scanned_report.pdf and list every finding with its equipment tag"
```

Because `qwen3.5:9b` is multimodal, the same model reads the page image and
reasons about it — no model swap, no memory spike.

## 8. Serve the HTTP API for your UI teammate

```bash
uvicorn tools.http_api:app --host 127.0.0.1 --port 8000
open http://127.0.0.1:8000/docs
```

FastAPI's auto-generated docs page is a genuinely useful handover artifact —
your teammate can try every endpoint without you explaining anything.

---

## Memory budget on 24 GB

| Resident | GB |
|---|---:|
| macOS + apps | ~6 |
| `qwen3.5:9b` @ 8K context | ~8 |
| ChromaDB + FastAPI + sandbox container | ~2 |
| Headroom | ~8 |

One rule: **never two large models resident at once.** Call
`ollama_client.unload(previous_model)` before loading the other, or set
`OLLAMA_MAX_LOADED_MODELS=1`. And leave `num_ctx` at 8192 — the model
advertises 256K, but that's KV cache in the same 24 GB, and it is the single
easiest way to freeze your laptop mid-demo.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Ollama unreachable` | server not running | `ollama serve` |
| `backend=subprocess` | Docker Desktop off | start Docker, re-pull the image |
| Model ignores tools entirely | wrong tag pulled | confirm `qwen3.5:9b` in `ollama list` |
| Tool args arrive as a string | some builds emit JSON strings | already handled in `agent.py` |
| Laptop fans max, output crawls | context too large or two models loaded | drop `num_ctx`, `unload()` the other |
| `refusing non-local inference endpoint` | `OLLAMA_HOST` points off-box | that tripwire is intentional — fix the env var |
