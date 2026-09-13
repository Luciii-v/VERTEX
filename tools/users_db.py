"""User management SQLite backend for VERTEX.

Handles authentication, roles, and credential verification using an SQLite database,
replacing the legacy Electron flat-file JSON storage.
Dependency-free to support the air-gapped constraints.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import re
import sqlite3
import threading
import time
import uuid
from pathlib import Path

USERS_DB = Path(os.environ.get("WORKBENCH_USERS_DB", "workspace_data/users.db"))
_lock = threading.Lock()

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MS = 5 * 60 * 1000
PBKDF2_ITERATIONS = 600_000
VALID_ROLES = frozenset({"operator", "engineer", "admin", "approver", "employee"})
_USERNAME = re.compile(r"^[A-Za-z0-9._-]{3,50}$")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    username        TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    salt            TEXT NOT NULL,
    role            TEXT NOT NULL,
    failed_attempts INTEGER DEFAULT 0,
    locked_until    INTEGER,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

CREATE TABLE IF NOT EXISTS user_settings (
    user_id         TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    settings_json   TEXT NOT NULL DEFAULT '{}',
    updated_at      INTEGER NOT NULL
);
"""

def _connect() -> sqlite3.Connection:
    USERS_DB.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(USERS_DB, timeout=10)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.executescript(_SCHEMA)
    conn.row_factory = sqlite3.Row
    return conn

def _derive_hash(password: str, salt: str) -> str:
    """Return a slow password hash; passwords are never stored or returned."""
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ITERATIONS
    ).hex()


def _now_ms() -> int:
    return int(time.time() * 1000)


def _validate_new_user(username: str, password: str, role: str) -> str | None:
    if not _USERNAME.fullmatch(username):
        return "Username must use 3-50 letters, numbers, dots, underscores, or hyphens."
    if not 12 <= len(password) <= 128:
        return "Password must be 12-128 characters."
    if password.casefold() == username.casefold():
        return "Password must not match the username."
    if role not in VALID_ROLES:
        return f"Unknown role '{role}'."
    return None


def _create_user(conn: sqlite3.Connection, username: str, password: str, role: str) -> None:
    user_id = f"u-{uuid.uuid4()}"
    salt = str(uuid.uuid4())
    now = _now_ms()
    conn.execute(
        """INSERT INTO users
        (id, username, password_hash, salt, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (user_id, username.casefold(), _derive_hash(password, salt), salt, role, now, now),
    )
    # User-owned settings are keyed by the immutable user ID, never a shared account.
    conn.execute(
        "INSERT INTO user_settings (user_id, updated_at) VALUES (?, ?)",
        (user_id, now),
    )

def is_setup_complete() -> bool:
    with _lock:
        with _connect() as conn:
            row = conn.execute("SELECT COUNT(*) as c FROM users").fetchone()
            return row["c"] > 0

def setup_initial_admin(username: str, password: str) -> None:
    error = _validate_new_user(username, password, "admin")
    if error:
        raise ValueError(error)
    with _lock:
        with _connect() as conn:
            row = conn.execute("SELECT COUNT(*) as c FROM users").fetchone()
            if row["c"] > 0:
                raise ValueError("Initial access has already been configured.")
            
            _create_user(conn, username, password, "admin")
            conn.commit()

def get_user_role(username: str) -> str | None:
    if not username:
        return None
    with _lock:
        with _connect() as conn:
            row = conn.execute("SELECT role FROM users WHERE username = ?", (username.casefold(),)).fetchone()
            if row:
                return row["role"]
            return None

def verify_login(username: str, password: str) -> dict:
    username_lower = username.casefold()
    with _lock:
        with _connect() as conn:
            row = conn.execute("SELECT * FROM users WHERE username = ?", (username_lower,)).fetchone()
            
            if not row:
                return {"ok": False, "message": "Invalid username or password."}
            
            now = int(time.time() * 1000)
            if row["locked_until"] and row["locked_until"] > now:
                return {"ok": False, "message": "Invalid username or password.", "blocked": True}
                
            candidate = _derive_hash(password, row["salt"])
            
            if not hmac.compare_digest(candidate, row["password_hash"]):
                attempts = row["failed_attempts"] + 1
                locked_until = now + LOCKOUT_MS if attempts >= MAX_FAILED_ATTEMPTS else None
                
                conn.execute(
                    "UPDATE users SET failed_attempts = ?, locked_until = ? WHERE username = ?",
                    (attempts, locked_until, username_lower)
                )
                conn.commit()
                return {"ok": False, "message": "Invalid username or password.", "attempts": attempts}
            
            # Success
            conn.execute(
                "UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE username = ?",
                (username_lower,)
            )
            conn.commit()
            return {"ok": True, "username": row["username"], "role": row["role"]}

def list_users() -> list[dict]:
    with _lock:
        with _connect() as conn:
            rows = conn.execute(
                "SELECT id, username, role, created_at, updated_at FROM users ORDER BY username"
            ).fetchall()
            return [dict(r) for r in rows]

def add_user(username: str, password: str, role: str) -> dict:
    username_lower = username.casefold()
    error = _validate_new_user(username, password, role)
    if error:
        return {"ok": False, "message": error}
    with _lock:
        with _connect() as conn:
            existing = conn.execute("SELECT id FROM users WHERE username = ?", (username_lower,)).fetchone()
            if existing:
                return {"ok": False, "message": f"User {username} already exists."}
                
            _create_user(conn, username_lower, password, role)
            conn.commit()
            return {"ok": True}

def delete_user(user_id: str) -> dict:
    with _lock:
        with _connect() as conn:
            # Prevent deleting the last admin
            admin_count = conn.execute("SELECT COUNT(*) as c FROM users WHERE role = 'admin'").fetchone()["c"]
            target = conn.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
            
            if not target:
                return {"ok": False, "message": "User not found."}
                
            if target["role"] == "admin" and admin_count <= 1:
                return {"ok": False, "message": "Cannot delete the last admin user."}
                
            conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
            conn.commit()
            return {"ok": True}

def set_role(user_id: str, role: str) -> dict:
    if role not in VALID_ROLES:
        return {"ok": False, "message": f"Unknown role '{role}'."}
    with _lock:
        with _connect() as conn:
            # Prevent removing the last admin
            admin_count = conn.execute("SELECT COUNT(*) as c FROM users WHERE role = 'admin'").fetchone()["c"]
            target = conn.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
            
            if not target:
                return {"ok": False, "message": "User not found."}
                
            if target["role"] == "admin" and role != "admin" and admin_count <= 1:
                return {"ok": False, "message": "Cannot remove admin role from the last admin user."}
                
            conn.execute(
                "UPDATE users SET role = ?, updated_at = ? WHERE id = ?",
                (role, _now_ms(), user_id),
            )
            conn.commit()
            return {"ok": True}

def reset_password(user_id: str, password: str) -> dict:
    if not 12 <= len(password) <= 128:
        return {"ok": False, "message": "Password must be 12-128 characters."}
    with _lock:
        with _connect() as conn:
            target = conn.execute("SELECT id FROM users WHERE id = ?", (user_id,)).fetchone()
            if not target:
                return {"ok": False, "message": "User not found."}
                
            salt = str(uuid.uuid4())
            hsh = _derive_hash(password, salt)
            conn.execute(
                """UPDATE users SET password_hash = ?, salt = ?, failed_attempts = 0,
                locked_until = NULL, updated_at = ? WHERE id = ?""",
                (hsh, salt, _now_ms(), user_id),
            )
            conn.commit()
            return {"ok": True}
