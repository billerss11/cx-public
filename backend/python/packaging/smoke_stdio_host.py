"""Smoke-test a packaged backend stdio host executable."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path


def _resolve_executable() -> Path:
    raw = os.getenv("CX_BACKEND_EXECUTABLE", "").strip()
    if not raw:
        raise RuntimeError("CX_BACKEND_EXECUTABLE is required.")
    executable = Path(raw).expanduser().resolve()
    if not executable.exists():
        raise RuntimeError(f"Backend executable not found: {executable}")
    return executable


def main() -> int:
    executable = _resolve_executable()

    request = {
        "requestId": "packaging-smoke-1",
        "task": "backend.health",
        "taskVersion": "1.0",
        "payload": {},
        "context": {"source": "packaging-smoke"},
    }

    process = subprocess.Popen(
        [str(executable)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    try:
        assert process.stdin is not None
        assert process.stdout is not None

        process.stdin.write(json.dumps(request) + "\n")
        process.stdin.flush()

        raw_response = process.stdout.readline().strip()
        if not raw_response:
            stderr_text = process.stderr.read() if process.stderr else ""
            raise RuntimeError(f"No response from backend host. stderr={stderr_text}")

        response = json.loads(raw_response)
        if not response.get("ok"):
            raise RuntimeError(f"Backend returned error response: {response}")
        if response.get("result", {}).get("status") != "ok":
            raise RuntimeError(f"Unexpected health response: {response}")
    finally:
        process.terminate()
        process.wait(timeout=10)

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # pragma: no cover - smoke script command-line failure path
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
