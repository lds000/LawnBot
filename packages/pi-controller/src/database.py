"""
SQLite database layer using aiosqlite.
Replaces scattered .jsonl / .log / .txt state files with a single DB.
"""
import asyncio
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import aiosqlite

from src.config import CONFIG

log = logging.getLogger(__name__)

_db_path = CONFIG.database_path


async def init_db() -> None:
    """Create tables if they don't exist and migrate existing tables."""
    Path(_db_path).parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(_db_path) as db:
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS watering_history (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id      TEXT NOT NULL UNIQUE,
                set_name    TEXT NOT NULL,
                start_time  TEXT NOT NULL,
                end_time    TEXT,
                duration_seconds INTEGER,
                estimated_litres REAL,
                is_manual   INTEGER NOT NULL DEFAULT 0,
                completed   INTEGER NOT NULL DEFAULT 0,
                skip_reason TEXT
            );

            CREATE TABLE IF NOT EXISTS run_journal (
                run_id      TEXT NOT NULL,
                stage       TEXT NOT NULL CHECK(stage IN ('enqueued','executed')),
                recorded_at TEXT NOT NULL,
                PRIMARY KEY (run_id, stage)
            );

            CREATE TABLE IF NOT EXISTS sensor_readings (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                recorded_at TEXT NOT NULL,
                topic       TEXT NOT NULL,
                payload     TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_sensor_topic_time
                ON sensor_readings(topic, recorded_at);

            CREATE TABLE IF NOT EXISTS system_metrics (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                recorded_at TEXT NOT NULL,
                cpu_temp_c  REAL,
                cpu_percent REAL,
                memory_percent REAL,
                disk_percent REAL,
                uptime_seconds INTEGER
            );
        """)
        # Migrate existing watering_history table if columns are missing
        existing_cols = {row[1] async for row in await db.execute("PRAGMA table_info(watering_history)")}
        if "estimated_litres" not in existing_cols:
            await db.execute("ALTER TABLE watering_history ADD COLUMN estimated_litres REAL")
        if "skip_reason" not in existing_cols:
            await db.execute("ALTER TABLE watering_history ADD COLUMN skip_reason TEXT")
        await db.commit()
    log.info(f"Database ready at {_db_path}")


# --- Watering history ---

async def record_run_start(run_id: str, set_name: str, start_time: datetime, is_manual: bool) -> None:
    async with aiosqlite.connect(_db_path) as db:
        await db.execute(
            """INSERT OR IGNORE INTO watering_history
               (run_id, set_name, start_time, is_manual)
               VALUES (?, ?, ?, ?)""",
            (run_id, set_name, start_time.isoformat(), int(is_manual)),
        )
        await db.commit()


async def record_run_end(run_id: str, end_time: datetime, duration_seconds: int,
                         estimated_litres: Optional[float] = None) -> None:
    async with aiosqlite.connect(_db_path) as db:
        await db.execute(
            """UPDATE watering_history
               SET end_time=?, duration_seconds=?, completed=1, estimated_litres=?
               WHERE run_id=?""",
            (end_time.isoformat(), duration_seconds, estimated_litres, run_id),
        )
        await db.commit()


async def record_run_skip(run_id: str, set_name: str, start_time: datetime,
                          is_manual: bool, skip_reason: str) -> None:
    """Record a run that was skipped without watering (rain skip, soil moisture, etc.)."""
    async with aiosqlite.connect(_db_path) as db:
        await db.execute(
            """INSERT OR IGNORE INTO watering_history
               (run_id, set_name, start_time, end_time, duration_seconds, is_manual, completed, skip_reason)
               VALUES (?, ?, ?, ?, 0, ?, 0, ?)""",
            (run_id, set_name, start_time.isoformat(), start_time.isoformat(),
             int(is_manual), skip_reason),
        )
        await db.commit()


async def get_history(limit: int = 50) -> list[dict]:
    async with aiosqlite.connect(_db_path) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """SELECT * FROM watering_history
               ORDER BY start_time DESC LIMIT ?""",
            (limit,),
        ) as cursor:
            rows = await cursor.fetchall()
    return [dict(r) for r in rows]


async def prune_history(days: int = 30) -> None:
    cutoff = (datetime.now() - timedelta(days=days)).isoformat()
    async with aiosqlite.connect(_db_path) as db:
        await db.execute(
            "DELETE FROM watering_history WHERE start_time < ?", (cutoff,)
        )
        await db.commit()


# --- Run journal (idempotency) ---

async def was_enqueued(run_id: str) -> bool:
    async with aiosqlite.connect(_db_path) as db:
        async with db.execute(
            "SELECT 1 FROM run_journal WHERE run_id=? AND stage='enqueued'",
            (run_id,),
        ) as cur:
            return await cur.fetchone() is not None


async def was_executed(run_id: str) -> bool:
    async with aiosqlite.connect(_db_path) as db:
        async with db.execute(
            "SELECT 1 FROM run_journal WHERE run_id=? AND stage='executed'",
            (run_id,),
        ) as cur:
            return await cur.fetchone() is not None


async def mark_enqueued(run_id: str) -> None:
    async with aiosqlite.connect(_db_path) as db:
        await db.execute(
            "INSERT OR IGNORE INTO run_journal(run_id, stage, recorded_at) VALUES(?,?,?)",
            (run_id, "enqueued", datetime.now().isoformat()),
        )
        await db.commit()


async def mark_executed(run_id: str) -> None:
    async with aiosqlite.connect(_db_path) as db:
        await db.execute(
            "INSERT OR IGNORE INTO run_journal(run_id, stage, recorded_at) VALUES(?,?,?)",
            (run_id, "executed", datetime.now().isoformat()),
        )
        await db.commit()


# --- Sensor readings cache ---

async def store_sensor_reading(topic: str, payload: dict) -> None:
    async with aiosqlite.connect(_db_path) as db:
        await db.execute(
            "INSERT INTO sensor_readings(recorded_at, topic, payload) VALUES(?,?,?)",
            (datetime.now().isoformat(), topic, json.dumps(payload)),
        )
        await db.commit()


async def get_latest_sensor(topic: str) -> Optional[dict]:
    async with aiosqlite.connect(_db_path) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """SELECT payload FROM sensor_readings
               WHERE topic=? ORDER BY recorded_at DESC LIMIT 1""",
            (topic,),
        ) as cur:
            row = await cur.fetchone()
    return json.loads(row["payload"]) if row else None


async def get_sensor_history(topic: str, limit: int = 100) -> list[dict]:
    async with aiosqlite.connect(_db_path) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """SELECT recorded_at, payload FROM sensor_readings
               WHERE topic=? ORDER BY recorded_at DESC LIMIT ?""",
            (topic, limit),
        ) as cur:
            rows = await cursor.fetchall() if False else await cur.fetchall()
    return [{"recorded_at": r["recorded_at"], **json.loads(r["payload"])} for r in rows]


async def prune_sensor_readings(hours: int = 48) -> None:
    cutoff = (datetime.now() - timedelta(hours=hours)).isoformat()
    async with aiosqlite.connect(_db_path) as db:
        await db.execute(
            "DELETE FROM sensor_readings WHERE recorded_at < ?", (cutoff,)
        )
        await db.commit()


# --- System metrics ---

async def store_metrics(cpu_temp_c: Optional[float], cpu_percent: Optional[float],
                        memory_percent: Optional[float], disk_percent: Optional[float],
                        uptime_seconds: Optional[int]) -> None:
    async with aiosqlite.connect(_db_path) as db:
        await db.execute(
            """INSERT INTO system_metrics
               (recorded_at, cpu_temp_c, cpu_percent, memory_percent, disk_percent, uptime_seconds)
               VALUES(?,?,?,?,?,?)""",
            (datetime.now().isoformat(), cpu_temp_c, cpu_percent,
             memory_percent, disk_percent, uptime_seconds),
        )
        await db.commit()


async def prune_system_metrics(days: int = 7) -> None:
    cutoff = (datetime.now() - timedelta(days=days)).isoformat()
    async with aiosqlite.connect(_db_path) as db:
        await db.execute(
            "DELETE FROM system_metrics WHERE recorded_at < ?", (cutoff,)
        )
        await db.commit()


async def clear_history() -> None:
    """Delete all watering history records."""
    async with aiosqlite.connect(_db_path) as db:
        await db.execute("DELETE FROM watering_history")
        await db.commit()
