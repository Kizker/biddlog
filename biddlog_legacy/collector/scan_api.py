"""
Scan API — REST endpoint untuk trigger collector dari dashboard.

Endpoints:
  GET  /api/scan/status         — cek status scan (idle/running/done/error)
  POST /api/scan/start          — trigger scan baru
  GET  /api/data/<path>         — serve file output collector
  GET  /api/adb/status          — cek koneksi ADB ke HP
"""

from __future__ import annotations

import json
import os
import subprocess
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, Response, jsonify, request, send_from_directory
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

OUTPUT_DIR = Path(__file__).resolve().parent / "output"
COLLECTOR_DIR = Path(__file__).resolve().parent

# ---------- Scan state ----------

scan_lock = threading.Lock()
scan_state: dict = {
    "status": "idle",       # idle | running | done | error
    "type": None,           # "bidding" | "invoice"
    "account": None,        # None | "menik" | "mubdi" | "aldi"
    "started_at": None,
    "finished_at": None,
    "collected_count": 0,
    "error": None,
    "log_tail": [],         # last 30 log lines
}


def reset_scan_state(scan_type: str, account: str | None = None) -> None:
    scan_state["status"] = "running"
    scan_state["type"] = scan_type
    scan_state["account"] = account
    scan_state["started_at"] = datetime.now(timezone.utc).isoformat()
    scan_state["finished_at"] = None
    scan_state["collected_count"] = 0
    scan_state["error"] = None
    scan_state["log_tail"] = []


def run_collector_in_background(command: list[str], scan_type: str, account: str | None = None) -> None:
    """Run collector script in a separate thread, streaming stdout to scan_state."""

    def _worker() -> None:
        try:
            process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                cwd=str(COLLECTOR_DIR),
                bufsize=1,
            )

            for line in iter(process.stdout.readline, ""):
                stripped = line.rstrip()
                if stripped:
                    scan_state["log_tail"] = (scan_state["log_tail"] + [stripped])[-30:]
                    # Try to detect collected count from log
                    if "total terkumpul:" in stripped:
                        try:
                            count_part = stripped.split("total terkumpul:")[1].split("|")[0].strip()
                            count = int(count_part.split("/")[0])
                            scan_state["collected_count"] = count
                        except (ValueError, IndexError):
                            pass

            process.wait()

            if process.returncode == 0:
                scan_state["status"] = "done"
                # Read summary for final count
                _read_final_count(scan_type, account)
            else:
                scan_state["status"] = "error"
                scan_state["error"] = f"Collector exited with code {process.returncode}"

        except Exception as exc:
            scan_state["status"] = "error"
            scan_state["error"] = str(exc)
        finally:
            scan_state["finished_at"] = datetime.now(timezone.utc).isoformat()

    thread = threading.Thread(target=_worker, daemon=True)
    thread.start()


def _read_final_count(scan_type: str, account: str | None) -> None:
    """Read the final item count from summary/output files."""
    try:
        if scan_type == "bidding":
            summary_path = OUTPUT_DIR / "scan-list" / "scan-summary.json"
            if summary_path.exists():
                data = json.loads(summary_path.read_text(encoding="utf-8"))
                scan_state["collected_count"] = data.get("collected_count", 0)
        elif scan_type == "invoice" and account:
            output_path = OUTPUT_DIR / "invoice" / f"invoice-{account}.json"
            if output_path.exists():
                data = json.loads(output_path.read_text(encoding="utf-8"))
                scan_state["collected_count"] = len(data) if isinstance(data, list) else 0
    except Exception:
        pass


# ---------- Routes ----------

@app.route("/api/scan/status")
def scan_status():
    """Return current scan status."""
    return jsonify(scan_state)


@app.route("/api/scan/start", methods=["POST"])
def scan_start():
    """Start a new scan. Expects JSON body: {type: 'bidding'|'invoice', account?: string, options?: {}}"""
    with scan_lock:
        if scan_state["status"] == "running":
            return jsonify({"error": "Scan sedang berjalan. Tunggu sampai selesai."}), 409

        body = request.get_json(force=True, silent=True) or {}
        scan_type = body.get("type", "bidding")
        account = body.get("account")
        options = body.get("options", {})

        if scan_type not in ("bidding", "invoice"):
            return jsonify({"error": f"Tipe scan tidak valid: {scan_type}"}), 400

        if scan_type == "invoice" and account not in ("menik", "mubdi", "aldi"):
            return jsonify({"error": f"Akun invoice tidak valid: {account}"}), 400

        # Build command
        if scan_type == "bidding":
            command = ["python", "appium_collector.py", "--backend", "adb"]

            expected_total = options.get("expected_total")
            if expected_total:
                command.extend(["--expected-total", str(expected_total)])

            scan_profile = options.get("scan_profile")
            if scan_profile in ("accuracy", "balanced", "fast"):
                command.extend(["--scan-profile", scan_profile])

            if options.get("phone_feedback"):
                command.append("--phone-feedback")

            if options.get("no_reset_position"):
                command.append("--no-reset-position")

        else:  # invoice
            command = [
                "python", "invoice_collector.py",
                "--account", account,
                "--no-launch",
            ]

            expected_total = options.get("expected_total")
            if expected_total:
                command.extend(["--expected-total", str(expected_total)])

            if options.get("phone_feedback"):
                command.append("--phone-feedback")

        reset_scan_state(scan_type, account)
        run_collector_in_background(command, scan_type, account)

        return jsonify({
            "status": "started",
            "type": scan_type,
            "account": account,
            "command": " ".join(command),
        })


@app.route("/api/scan/stop", methods=["POST"])
def scan_stop():
    """Stop a running scan (best-effort, sends SIGTERM)."""
    if scan_state["status"] != "running":
        return jsonify({"error": "Tidak ada scan yang sedang berjalan."}), 409

    # We can't easily kill the subprocess from here without storing the PID,
    # but marking as error will prevent new scans from being blocked
    scan_state["status"] = "error"
    scan_state["error"] = "Scan dihentikan manual oleh pengguna."
    scan_state["finished_at"] = datetime.now(timezone.utc).isoformat()
    return jsonify({"status": "stopped"})


@app.route("/api/data/<path:filepath>")
def serve_data(filepath: str):
    """Serve files from collector output directory.

    Examples:
      GET /api/data/scan-list/bidding-items.json
      GET /api/data/invoice/invoice-items.json
      GET /api/data/invoice/invoice-menik.json
    """
    # Security: only allow json and csv files, no path traversal
    safe_path = Path(filepath)
    if ".." in safe_path.parts:
        return jsonify({"error": "Path tidak valid"}), 400

    full_path = OUTPUT_DIR / safe_path
    if not full_path.exists():
        return jsonify({"error": f"File tidak ditemukan: {filepath}"}), 404

    if full_path.suffix not in (".json", ".csv", ".txt", ".log"):
        return jsonify({"error": f"Tipe file tidak diizinkan: {full_path.suffix}"}), 403

    return send_from_directory(str(OUTPUT_DIR), filepath)


@app.route("/api/data/list")
def list_data():
    """List all available output files."""
    files = []
    for root, _dirs, filenames in os.walk(OUTPUT_DIR):
        for filename in filenames:
            full_path = Path(root) / filename
            if full_path.suffix in (".json", ".csv"):
                relative = full_path.relative_to(OUTPUT_DIR)
                stat = full_path.stat()
                files.append({
                    "path": str(relative).replace("\\", "/"),
                    "size": stat.st_size,
                    "modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                })

    files.sort(key=lambda f: f["modified"], reverse=True)
    return jsonify(files)


@app.route("/api/adb/status")
def adb_status():
    """Check ADB connection status."""
    try:
        result = subprocess.run(
            ["adb", "devices"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode != 0:
            return jsonify({
                "connected": False,
                "error": result.stderr.strip() or "ADB command failed",
            })

        lines = [
            line.strip()
            for line in result.stdout.splitlines()
            if line.strip() and not line.lower().startswith("list of devices")
        ]

        devices = []
        for line in lines:
            parts = line.split("\t")
            if len(parts) >= 2:
                devices.append({
                    "serial": parts[0],
                    "state": parts[1],
                })

        authorized = [d for d in devices if d["state"] == "device"]
        return jsonify({
            "connected": len(authorized) > 0,
            "devices": devices,
            "authorized_count": len(authorized),
        })

    except FileNotFoundError:
        return jsonify({
            "connected": False,
            "error": "ADB command tidak ditemukan. Pastikan ADB tunnel aktif.",
        })
    except subprocess.TimeoutExpired:
        return jsonify({
            "connected": False,
            "error": "ADB timeout. Periksa SSH tunnel.",
        })

UPLOAD_KEY = os.environ.get("UPLOAD_KEY", "biddlog2026")

ALLOWED_UPLOAD_PATHS = {
    "scan-list/bidding-items.json",
    "scan-list/bidding-items.csv",
    "scan-list/scan-summary.json",
    "invoice/invoice-items.json",
    "invoice/invoice-menik.json",
    "invoice/invoice-menik.csv",
    "invoice/invoice-mubdi.json",
    "invoice/invoice-mubdi.csv",
    "invoice/invoice-aldi.json",
    "invoice/invoice-aldi.csv",
}


@app.route("/api/data/upload", methods=["POST"])
def upload_data():
    """Upload scan result files from portable collector.

    Expects multipart form-data with:
      - file: the JSON/CSV file
      - path: target relative path (e.g. 'scan-list/bidding-items.json')
      - key:  upload key for basic auth
    """
    key = request.form.get("key", "")
    if key != UPLOAD_KEY:
        return jsonify({"error": "Upload key tidak valid."}), 403

    target_path = request.form.get("path", "")
    if target_path not in ALLOWED_UPLOAD_PATHS:
        return jsonify({
            "error": f"Path upload tidak diizinkan: {target_path}",
            "allowed": sorted(ALLOWED_UPLOAD_PATHS),
        }), 400

    uploaded_file = request.files.get("file")
    if not uploaded_file:
        return jsonify({"error": "Tidak ada file yang dikirim."}), 400

    safe_path = Path(target_path)
    if ".." in safe_path.parts:
        return jsonify({"error": "Path tidak valid"}), 400

    full_path = OUTPUT_DIR / safe_path
    full_path.parent.mkdir(parents=True, exist_ok=True)

    # Save with backup
    if full_path.exists():
        backup_path = full_path.with_suffix(full_path.suffix + ".bak")
        try:
            backup_path.write_bytes(full_path.read_bytes())
        except Exception:
            pass

    uploaded_file.save(str(full_path))

    return jsonify({
        "status": "ok",
        "path": target_path,
        "size": full_path.stat().st_size,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    })


@app.route("/api/health")
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "collector_dir": str(COLLECTOR_DIR),
        "output_dir": str(OUTPUT_DIR),
    })


if __name__ == "__main__":
    port = int(os.environ.get("SCAN_API_PORT", 5000))
    print(f"Scan API starting on port {port}...")
    print(f"Collector dir: {COLLECTOR_DIR}")
    print(f"Output dir: {OUTPUT_DIR}")
    app.run(host="0.0.0.0", port=port, debug=False)
