"""Package entrypoint for the Python backend task host."""

from __future__ import annotations

from cx_backend.host.stdio_host import run_stdio_host


if __name__ == "__main__":
    run_stdio_host()

