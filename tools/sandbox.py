"""Code execution sandbox (requirement: 'coding task run and verified in a sandbox').

Two backends, auto-detected:

  docker   -- preferred. `--network none` is the single most important flag in
              this whole project: it makes "no external calls" a kernel-enforced
              fact rather than a promise, and you can show it to the judges by
              running `requests.get(...)` inside the sandbox and watching it fail.
  subprocess -- fallback for machines without Docker (or Docker Desktop off).
              Weaker isolation: separate process, temp cwd, scrubbed env,
              wall-clock timeout, output caps. Honest about its limits.

Never claim the subprocess backend is a security boundary. In the demo, run the
Docker backend and say so.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import uuid
from dataclasses import dataclass, asdict
from pathlib import Path

DEFAULT_IMAGE = os.environ.get("SANDBOX_IMAGE", "python:3.12-slim")
DEFAULT_TIMEOUT = int(os.environ.get("SANDBOX_TIMEOUT", "30"))
DEFAULT_MEMORY = os.environ.get("SANDBOX_MEMORY", "512m")
DEFAULT_CPUS = os.environ.get("SANDBOX_CPUS", "1.0")
MAX_OUTPUT_CHARS = 20_000


@dataclass
class ExecResult:
    backend: str
    exit_code: int
    stdout: str
    stderr: str
    timed_out: bool
    duration_ms: int
    artifacts: list[str]
    network: str  # "none" | "host-inherited"

    def as_dict(self) -> dict:
        return asdict(self)


def docker_available() -> bool:
    if shutil.which("docker") is None:
        return False
    try:
        return subprocess.run(
            ["docker", "info"], capture_output=True, timeout=8
        ).returncode == 0
    except Exception:
        return False


def run_code(
    code: str,
    *,
    language: str = "python",
    stdin: str = "",
    files: dict[str, str] | None = None,
    timeout: int = DEFAULT_TIMEOUT,
    backend: str | None = None,
) -> ExecResult:
    """Execute `code` in isolation and return structured output.

    `files` maps relative filename -> text content, copied into the sandbox
    working directory before execution (e.g. an input CSV). Any NEW file the
    code writes is returned in `artifacts` and copied to workspace_data/outputs.
    """
    import time

    if language not in ("python", "bash"):
        raise ValueError(f"unsupported language: {language}")

    chosen = backend or ("docker" if docker_available() else "subprocess")
    workdir = Path(tempfile.mkdtemp(prefix="sbx_"))
    entry = "main.py" if language == "python" else "main.sh"
    (workdir / entry).write_text(code, encoding="utf-8")
    for name, content in (files or {}).items():
        safe = Path(name).name  # no path traversal into the sandbox
        (workdir / safe).write_text(content, encoding="utf-8")

    before = {p.name for p in workdir.iterdir()}
    started = time.perf_counter()

    try:
        if chosen == "docker":
            proc, timed_out = _run_docker(workdir, entry, language, stdin, timeout)
            network = "none"
        else:
            proc, timed_out = _run_subprocess(workdir, entry, language, stdin, timeout)
            network = "host-inherited"

        artifacts = _collect_artifacts(workdir, before)
        return ExecResult(
            backend=chosen,
            exit_code=proc.returncode,
            stdout=_cap(proc.stdout),
            stderr=_cap(proc.stderr),
            timed_out=timed_out,
            duration_ms=int((time.perf_counter() - started) * 1000),
            artifacts=artifacts,
            network=network,
        )
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


def _run_docker(workdir, entry, language, stdin, timeout):
    cmd = [
        "docker", "run", "--rm", "-i",
        "--network", "none",              # <- the sovereignty proof
        "--memory", DEFAULT_MEMORY,
        "--memory-swap", DEFAULT_MEMORY,  # no swap escape hatch
        "--cpus", DEFAULT_CPUS,
        "--pids-limit", "128",            # fork-bomb guard
        "--cap-drop", "ALL",
        "--security-opt", "no-new-privileges",
        "--read-only",                    # rootfs immutable
        "--tmpfs", "/tmp:size=64m,exec",
        "-v", f"{workdir}:/work",         # only writable path
        "-w", "/work",
        "-u", f"{os.getuid()}:{os.getgid()}" if hasattr(os, "getuid") else "1000:1000",
        DEFAULT_IMAGE,
        "python" if language == "python" else "bash", entry,
    ]
    return _spawn(cmd, stdin, timeout, cwd=None)


def _run_subprocess(workdir, entry, language, stdin, timeout):
    import sys

    interpreter = sys.executable if language == "python" else "bash"
    env = {
        "PATH": "/usr/bin:/bin:/usr/local/bin",
        "HOME": str(workdir),
        "TMPDIR": str(workdir),
        "PYTHONDONTWRITEBYTECODE": "1",
        # deliberately no proxy/API/token vars inherited
    }
    return _spawn([interpreter, entry], stdin, timeout, cwd=workdir, env=env)


def _spawn(cmd, stdin, timeout, cwd, env=None):
    try:
        proc = subprocess.run(
            cmd,
            input=stdin,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=cwd,
            env=env,
        )
        return proc, False
    except subprocess.TimeoutExpired as exc:
        class _Timed:
            returncode = 124
            stdout = exc.stdout or ""
            stderr = (exc.stderr or "") + f"\n[sandbox] killed after {timeout}s"
        return _Timed(), True


def _collect_artifacts(workdir: Path, before: set[str]) -> list[str]:
    out_dir = Path("workspace_data/outputs")
    out_dir.mkdir(parents=True, exist_ok=True)
    saved = []
    for p in sorted(workdir.iterdir()):
        if p.name in before or not p.is_file():
            continue
        dest = out_dir / f"{uuid.uuid4().hex[:6]}_{p.name}"
        shutil.copy2(p, dest)
        saved.append(str(dest))
    return saved


def _cap(text: str | None) -> str:
    text = text or ""
    if len(text) <= MAX_OUTPUT_CHARS:
        return text
    return text[:MAX_OUTPUT_CHARS] + f"\n...[truncated, {len(text)} chars total]"


def preflight() -> dict:
    """Sandbox readiness, shown on the admin dashboard next to the GPU check."""
    ok = docker_available()
    image_present = False
    if ok:
        image_present = subprocess.run(
            ["docker", "image", "inspect", DEFAULT_IMAGE],
            capture_output=True,
        ).returncode == 0
    return {
        "docker_available": ok,
        "image": DEFAULT_IMAGE,
        "image_pulled": image_present,
        "active_backend": "docker" if ok else "subprocess",
        "network_isolation": "kernel-enforced (--network none)" if ok
                             else "NOT isolated - process-level only",
        "limits": {"memory": DEFAULT_MEMORY, "cpus": DEFAULT_CPUS,
                   "timeout_s": DEFAULT_TIMEOUT, "pids": 128},
        "warning": None if (ok and image_present) else
                   f"Run `docker pull {DEFAULT_IMAGE}` BEFORE going air-gapped.",
    }
