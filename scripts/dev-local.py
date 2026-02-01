#!/usr/bin/env python3
"""Run local dev stack: static server + Decap local backend + visits index watcher."""
from __future__ import annotations

import os
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
VISITS_DIR = BASE_DIR / "site" / "visits"
BUILD_SCRIPT = BASE_DIR / "scripts" / "build-visits-index.py"


def ensure_tools() -> None:
    if shutil.which("npx") is None:
        raise SystemExit("npx not found. Install Node.js to use Decap local backend.")


def current_mtime() -> float:
    if not VISITS_DIR.exists():
        return 0.0
    return max((p.stat().st_mtime for p in VISITS_DIR.glob("*.json")), default=0.0)


def run_build() -> None:
    subprocess.run([sys.executable, str(BUILD_SCRIPT)], check=True)


def main() -> None:
    ensure_tools()

    run_build()
    last_mtime = current_mtime()

    http_proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", "--directory", "site", "8000"],
        cwd=BASE_DIR,
        start_new_session=True,
    )
    decap_proc = subprocess.Popen(
        ["npx", "decap-server"],
        cwd=BASE_DIR,
        start_new_session=True,
    )

    def shutdown() -> None:
        for proc in (http_proc, decap_proc):
            if proc.poll() is None:
                try:
                    os.killpg(proc.pid, signal.SIGTERM)
                except ProcessLookupError:
                    proc.terminate()

    def handle_signal(_sig: int, _frame: object) -> None:
        shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    try:
        while True:
            if http_proc.poll() is not None or decap_proc.poll() is not None:
                break
            new_mtime = current_mtime()
            if new_mtime > last_mtime:
                run_build()
                last_mtime = new_mtime
            time.sleep(1.5)
    finally:
        shutdown()


if __name__ == "__main__":
    main()
