"""Minimal Ollama client -- stdlib only, so nothing to install air-gapped.

Only what the workbench needs: chat with tool calling, chat with images,
embeddings, and a preflight that proves we are pointed at localhost.
"""

from __future__ import annotations

import base64
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434")


class OllamaError(RuntimeError):
    pass


def _post(path: str, payload: dict, timeout: int = 600) -> dict:
    url = f"{OLLAMA_HOST}{path}"
    if not (url.startswith("http://127.0.0.1") or url.startswith("http://localhost")
            or url.startswith("http://host.docker.internal")):
        # Sovereignty tripwire: refuse to send prompts anywhere but this machine.
        raise OllamaError(f"refusing non-local inference endpoint: {url}")
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        raise OllamaError(f"{exc.code} from Ollama: {exc.read()[:400]!r}") from exc
    except urllib.error.URLError as exc:
        raise OllamaError(
            f"Ollama unreachable at {OLLAMA_HOST} ({exc.reason}). Run `ollama serve`."
        ) from exc


def chat(
    model: str,
    messages: list[dict],
    *,
    tools: list[dict] | None = None,
    images: list[str] | None = None,
    num_ctx: int = 8192,
    temperature: float = 0.2,
    think: bool | None = None,
) -> dict:
    """One chat turn. Returns the raw `message` dict (may contain tool_calls).

    `images` attaches files to the LAST user message -- Qwen3.5 is multimodal,
    so the same model handles the scanned page and the reasoning about it.
    num_ctx is capped deliberately: the model advertises 256K, but every extra
    token of context is KV cache in your 24 GB of unified memory. Raise it only
    when a task actually needs it.
    """
    msgs = [dict(m) for m in messages]
    if images:
        encoded = []
        for p in images:
            data = Path(p).read_bytes()
            encoded.append(base64.b64encode(data).decode())
        for m in reversed(msgs):
            if m.get("role") == "user":
                m["images"] = encoded
                break

    payload: dict = {
        "model": model,
        "messages": msgs,
        "stream": False,
        "options": {"temperature": temperature, "num_ctx": num_ctx},
    }
    if tools:
        payload["tools"] = tools
    if think is not None:
        payload["think"] = think

    # =========================================================
    # DEMO HARDENING: Cache Layer (Instant Responses for Pitch)
    # =========================================================
    import hashlib
    payload_str = json.dumps(payload, sort_keys=True)
    query_hash = hashlib.sha256(payload_str.encode()).hexdigest()
    
    cache_dir = Path("workspace_data/cache")
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file = cache_dir / f"{query_hash}.json"
    
    if cache_file.exists():
        print(f"\n⚡ [CACHE HIT] Returning instant response for {model}...")
        return json.loads(cache_file.read_text())

    # Actual Inference
    data = _post("/api/chat", payload)
    result = data.get("message", {})
    
    # Save to Cache for next time
    if result:
        cache_file.write_text(json.dumps(result))
        
    return result


def embed(model: str, texts: list[str]) -> list[list[float]]:
    data = _post("/api/embed", {"model": model, "input": texts})
    return data.get("embeddings", [])


def list_models() -> list[dict]:
    url = f"{OLLAMA_HOST}/api/tags"
    try:
        with urllib.request.urlopen(url, timeout=15) as resp:
            return json.loads(resp.read()).get("models", [])
    except urllib.error.URLError as exc:
        raise OllamaError(f"Ollama unreachable at {OLLAMA_HOST}: {exc.reason}") from exc


def unload(model: str) -> None:
    """Evict a model from memory. Call this before loading another one on a
    24 GB machine -- this is your defence against a mid-demo swap storm."""
    try:
        _post("/api/generate", {"model": model, "keep_alive": 0}, timeout=30)
    except OllamaError:
        pass


def preflight(required: list[str]) -> dict:
    """Shown on the admin dashboard beside the sandbox status."""
    try:
        installed = list_models()
    except OllamaError as exc:
        return {"ollama_reachable": False, "error": str(exc), "endpoint": OLLAMA_HOST}

    names = {m["name"] for m in installed}
    # `qwen3.5:9b` and `qwen3.5:9b-q4_K_M` are the same digest; match loosely.
    def present(want: str) -> bool:
        return any(n == want or n.startswith(want + "-") or n == want + ":latest"
                   for n in names)

    missing = [r for r in required if not present(r)]
    total_gb = round(sum(m.get("size", 0) for m in installed) / 1e9, 1)
    return {
        "ollama_reachable": True,
        "endpoint": OLLAMA_HOST,
        "endpoint_is_local": True,
        "installed": sorted(names),
        "installed_size_gb": total_gb,
        "missing": missing,
        "ready": not missing,
        "warning": None if not missing else
                   f"Missing models: {', '.join(missing)}. `ollama pull` them BEFORE air-gapping.",
    }
