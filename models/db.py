"""SQLite persistence for simulation runs (replay + shareable snapshots)."""

from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_lock = threading.Lock()
_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "emergence.db"


def _connect() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _lock:
        conn = _connect()
        try:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS runs (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    label TEXT,
                    params_json TEXT NOT NULL,
                    snapshots_json TEXT NOT NULL
                )
                """
            )
            conn.commit()
        finally:
            conn.close()


def save_simulation_run(
    params: dict[str, Any],
    snapshots: list[dict[str, Any]],
    label: str | None = None,
) -> str:
    run_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    with _lock:
        conn = _connect()
        try:
            conn.execute(
                "INSERT INTO runs (id, created_at, label, params_json, snapshots_json) VALUES (?, ?, ?, ?, ?)",
                (
                    run_id,
                    now,
                    label,
                    json.dumps(params, separators=(",", ":")),
                    json.dumps(snapshots, separators=(",", ":")),
                ),
            )
            conn.commit()
        finally:
            conn.close()
    return run_id


def load_simulation_run(run_id: str) -> dict[str, Any] | None:
    with _lock:
        conn = _connect()
        try:
            row = conn.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
            if row is None:
                return None
            return {
                "id": row["id"],
                "created_at": row["created_at"],
                "label": row["label"],
                "params": json.loads(row["params_json"]),
                "snapshots": json.loads(row["snapshots_json"]),
            }
        finally:
            conn.close()


def list_simulation_runs(limit: int = 50) -> list[dict[str, Any]]:
    with _lock:
        conn = _connect()
        try:
            rows = conn.execute(
                "SELECT id, created_at, label FROM runs ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
            return [
                {"id": r["id"], "created_at": r["created_at"], "label": r["label"]}
                for r in rows
            ]
        finally:
            conn.close()
