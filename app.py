"""Emergence — single entry Flask + SocketIO server."""

from __future__ import annotations

import threading
import time
from typing import Any

from flask import Flask, jsonify, render_template
from flask_socketio import SocketIO, emit

from models.db import init_db, list_simulation_runs, load_simulation_run, save_simulation_run
from simulations.engine import EmergenceEngine

app = Flask(__name__, static_folder="static", template_folder="templates")
app.config["SECRET_KEY"] = "emergence-secret-change-in-production"

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="threading",
    logger=False,
    engineio_logger=False,
)

engine = EmergenceEngine()


def simulation_loop() -> None:
    while True:
        time.sleep(0.052)
        try:
            payload = engine.build_payload() if engine.paused else engine.step()
            socketio.emit("state", payload)
        except Exception as exc:  # pragma: no cover
            print("simulation_loop:", exc)


@socketio.on("connect")
def on_connect() -> None:
    emit("state", engine.build_payload())


@socketio.on("control")
def on_control(data: dict[str, Any] | None) -> None:
    data = data or {}
    action = data.get("action")
    if action == "pause":
        engine.paused = True
        emit("state", engine.build_payload())
    elif action == "resume":
        engine.paused = False
        emit("state", engine.build_payload())
    elif action == "toggle_pause":
        engine.paused = not engine.paused
        emit("state", engine.build_payload())
    elif action == "reset":
        engine.reset_all()
        emit("state", engine.build_payload())
    elif action == "shock":
        engine.market.external_shock()
        emit("state", engine.build_payload())
    elif action == "set_params":
        engine.sync_params_from_ui(data.get("params") or {})
        emit("state", engine.build_payload())


@socketio.on("save_run")
def on_save_run(data: dict[str, Any] | None) -> None:
    data = data or {}
    label = data.get("label")
    params = data.get("params") or {}
    snaps = list(engine.snapshot_ring)
    run_id = save_simulation_run(params, snaps, label=label)
    emit("run_saved", {"id": run_id})


@app.route("/")
def index() -> str:
    return render_template("index.html")


@app.route("/api/runs")
def api_runs() -> Any:
    return jsonify(list_simulation_runs())


@app.route("/api/run/<run_id>")
def api_run(run_id: str) -> Any:
    row = load_simulation_run(run_id)
    if row is None:
        return jsonify({"error": "not_found"}), 404
    return jsonify(row)


@app.route("/health")
def health() -> Any:
    return jsonify({"ok": True, "tick": engine.tick})


def main() -> None:
    init_db()
    threading.Thread(target=simulation_loop, daemon=True).start()
    socketio.run(app, host="0.0.0.0", port=5055, debug=False, allow_unsafe_werkzeug=True)


if __name__ == "__main__":
    main()
