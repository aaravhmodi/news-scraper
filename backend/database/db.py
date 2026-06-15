from __future__ import annotations

import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator


DB_PATH = Path(os.getenv("BIASBUSTER_DB_PATH", "./biasbuster.sqlite3"))


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return uuid.uuid4().hex


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS projects (
              id TEXT PRIMARY KEY,
              topic TEXT NOT NULL,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS articles (
              id TEXT PRIMARY KEY,
              project_id TEXT NOT NULL,
              url TEXT NOT NULL,
              source_name TEXT NOT NULL DEFAULT '',
              headline TEXT NOT NULL DEFAULT '',
              author TEXT,
              published_at TEXT,
              raw_text TEXT NOT NULL DEFAULT '',
              extraction_status TEXT NOT NULL DEFAULT 'failed',
              created_at TEXT NOT NULL,
              FOREIGN KEY(project_id) REFERENCES projects(id)
            );

            CREATE TABLE IF NOT EXISTS article_analyses (
              id TEXT PRIMARY KEY,
              article_id TEXT NOT NULL UNIQUE,
              payload TEXT NOT NULL,
              created_at TEXT NOT NULL,
              FOREIGN KEY(article_id) REFERENCES articles(id)
            );

            CREATE TABLE IF NOT EXISTS project_comparisons (
              id TEXT PRIMARY KEY,
              project_id TEXT NOT NULL UNIQUE,
              payload TEXT NOT NULL,
              created_at TEXT NOT NULL,
              FOREIGN KEY(project_id) REFERENCES projects(id)
            );
            """
        )


def insert_project(topic: str) -> str:
    project_id = new_id()
    with connect() as conn:
        conn.execute(
            "INSERT INTO projects (id, topic, created_at) VALUES (?, ?, ?)",
            (project_id, topic, now_iso()),
        )
    return project_id


def insert_article(project_id: str, url: str, manual_text: str | None = None) -> str:
    article_id = new_id()
    status = "manual" if manual_text else "pending"
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO articles (id, project_id, url, raw_text, extraction_status, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (article_id, project_id, url, manual_text or "", status, now_iso()),
        )
    return article_id


def update_article(article_id: str, **fields: Any) -> None:
    if not fields:
        return
    assignments = ", ".join(f"{key} = ?" for key in fields)
    values = list(fields.values()) + [article_id]
    with connect() as conn:
        conn.execute(f"UPDATE articles SET {assignments} WHERE id = ?", values)


def save_analysis(article_id: str, payload: dict[str, Any]) -> None:
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO article_analyses (id, article_id, payload, created_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(article_id) DO UPDATE SET payload = excluded.payload, created_at = excluded.created_at
            """,
            (new_id(), article_id, json.dumps(payload), now_iso()),
        )


def save_comparison(project_id: str, payload: dict[str, Any]) -> None:
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO project_comparisons (id, project_id, payload, created_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(project_id) DO UPDATE SET payload = excluded.payload, created_at = excluded.created_at
            """,
            (new_id(), project_id, json.dumps(payload), now_iso()),
        )


def fetch_project(project_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        project = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not project:
            return None
        articles = conn.execute(
            """
            SELECT a.*, aa.payload AS analysis_payload
            FROM articles a
            LEFT JOIN article_analyses aa ON aa.article_id = a.id
            WHERE a.project_id = ?
            ORDER BY a.created_at
            """,
            (project_id,),
        ).fetchall()
        comparison = conn.execute(
            "SELECT payload FROM project_comparisons WHERE project_id = ?", (project_id,)
        ).fetchone()

    result = dict(project)
    result["articles"] = []
    for row in articles:
        item = dict(row)
        payload = item.pop("analysis_payload")
        item["analysis"] = json.loads(payload) if payload else None
        result["articles"].append(item)
    result["comparison"] = json.loads(comparison["payload"]) if comparison else None
    return result


def fetch_articles_for_project(project_id: str) -> list[dict[str, Any]]:
    project = fetch_project(project_id)
    return project["articles"] if project else []
