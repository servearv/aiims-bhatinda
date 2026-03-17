"""
Development runner for AIIMS Bathinda.

Starts both:
  1) Flask API server on port 3000
  2) Vite dev server on port 5173 (React HMR + proxies /api/* to Flask)

Usage:  python run_dev.py

Open http://localhost:5173 in your browser for dev mode with hot-reload.
"""

import os
import sys
import subprocess
import shutil
import time

ROOT = os.path.dirname(os.path.abspath(__file__))


def find_npx():
    """Find the npx executable cross-platform."""
    # Try plain 'npx' first (works on macOS/Linux and Windows with PATH set up)
    npx = shutil.which("npx")
    if npx:
        return npx
    # On Windows, try 'npx.cmd' explicitly
    npx_cmd = shutil.which("npx.cmd")
    if npx_cmd:
        return npx_cmd
    return None


def main():
    procs = []

    # 1) Start Flask API server on port 3000
    print("[dev] Starting Flask API server on http://localhost:3000 ...")
    flask_proc = subprocess.Popen(
        [sys.executable, "server.py"],
        cwd=ROOT,
    )
    procs.append(flask_proc)

    # Give Flask a moment to bind
    time.sleep(2)

    # 2) Start Vite dev server (React HMR) on port 5173
    print("[dev] Starting Vite dev server on http://localhost:5173 ...")
    print("[dev] Open http://localhost:5173 in your browser.\n")

    npx_path = find_npx()
    if npx_path:
        vite_proc = subprocess.Popen(
            [npx_path, "vite", "--host"],
            cwd=ROOT,
        )
    else:
        print("[dev] WARNING: npx not found, falling back to static server on port 5173")
        vite_proc = subprocess.Popen(
            [sys.executable, "-m", "http.server", "5173"],
            cwd=ROOT,
        )
    procs.append(vite_proc)

    # Wait for either to exit
    try:
        while True:
            for p in procs:
                if p.poll() is not None:
                    raise SystemExit(p.returncode)
            time.sleep(0.5)
    except (KeyboardInterrupt, SystemExit):
        print("\n[dev] Shutting down...")
        for p in procs:
            try:
                p.terminate()
            except Exception:
                pass
        for p in procs:
            try:
                p.wait(timeout=5)
            except Exception:
                p.kill()


if __name__ == "__main__":
    main()
