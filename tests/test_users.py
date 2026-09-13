"""Tests for the local SQLite user management system."""
from pathlib import Path

import pytest
from fastapi import HTTPException

import tools.users_db as users_db
from tools import http_api
from tools.registry import approve, request_approval


@pytest.fixture(autouse=True)
def isolated_users_database(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Keep test accounts entirely outside the workbench data directory."""
    monkeypatch.setattr(users_db, "USERS_DB", tmp_path / "users.db")

def test_setup_admin():
    assert not users_db.is_setup_complete()
    
    users_db.setup_initial_admin("admin_test", "securepassword123")
    assert users_db.is_setup_complete()
    
    # Second setup should fail
    try:
        users_db.setup_initial_admin("hacker", "pwd")
        assert False, "Should have raised ValueError"
    except ValueError:
        pass

def test_login_and_roles():
    users_db.setup_initial_admin("admin_test", "securepassword123")
    res = users_db.verify_login("admin_test", "securepassword123")
    assert res["ok"]
    assert res["username"] == "admin_test"
    assert res["role"] == "admin"
    
    res = users_db.verify_login("admin_test", "wrong")
    assert not res["ok"]
    assert "attempts" in res
    
    assert users_db.get_user_role("admin_test") == "admin"
    assert users_db.get_user_role("nonexistent") is None

def test_user_management():
    users_db.setup_initial_admin("admin_test", "securepassword123")
    # Add a user
    res = users_db.add_user("engineer_test", "password12345", "engineer")
    assert res["ok"]
    
    assert users_db.get_user_role("engineer_test") == "engineer"
    
    # Set role
    res = users_db.set_role("u-something", "operator") # Wrong id
    assert not res["ok"]
    
    users = users_db.list_users()
    eng = [u for u in users if u["username"] == "engineer_test"][0]
    
    res = users_db.set_role(eng["id"], "operator")
    assert res["ok"]
    assert users_db.get_user_role("engineer_test") == "operator"
    
    # Delete user
    res = users_db.delete_user(eng["id"])
    assert res["ok"]
    assert users_db.get_user_role("engineer_test") is None


def test_admin_provisions_only_approvers_and_engineers():
    users_db.setup_initial_admin("admin_test", "securepassword123")

    created = http_api.create_user(
        http_api.AuthRequest(username="approver_test", password="securepassword123"),
        role="approver", x_user="admin_test",
    )
    assert created["ok"]
    assert users_db.get_user_role("approver_test") == "approver"

    denied = http_api.create_user(
        http_api.AuthRequest(username="second_admin", password="securepassword123"),
        role="admin", x_user="admin_test",
    )
    assert not denied["ok"]
    assert "Approver or Engineer" in denied["message"]


def test_approval_keeps_the_engineers_identity():
    request_id = request_approval("generate_docx", {}, "engineer_test", "engineer")
    request = approve(request_id, "approver_test", "approver")
    assert request["user"] == "engineer_test"
    assert request["role"] == "engineer"


def test_only_approver_or_admin_can_view_pending_actions():
    users_db.setup_initial_admin("admin_test", "securepassword123")
    assert users_db.add_user("engineer_test", "anothersecurepassword", "engineer")["ok"]
    assert users_db.add_user("approver_test", "anothersecurepassword", "approver")["ok"]

    with pytest.raises(HTTPException) as blocked:
        http_api.approvals(x_user="engineer_test")
    assert blocked.value.status_code == 403
    assert "pending" in http_api.approvals(x_user="approver_test")


def test_user_records_are_isolated_and_do_not_expose_credentials():
    users_db.setup_initial_admin("admin_test", "securepassword123")
    assert users_db.add_user("operator_test", "anothersecurepassword", "operator")["ok"]

    rows = users_db.list_users()
    assert {row["username"] for row in rows} == {"admin_test", "operator_test"}
    assert all("password_hash" not in row and "salt" not in row for row in rows)
    assert users_db.verify_login("operator_test", "anothersecurepassword")["role"] == "operator"


def test_admin_can_reset_a_forgotten_password():
    users_db.setup_initial_admin("admin_test", "securepassword123")
    assert users_db.add_user("operator_test", "firstsecurepassword", "operator")["ok"]
    user = next(row for row in users_db.list_users() if row["username"] == "operator_test")

    assert users_db.reset_password(user["id"], "replacementpassword")["ok"]
    assert not users_db.verify_login("operator_test", "firstsecurepassword")["ok"]
    assert users_db.verify_login("operator_test", "replacementpassword")["ok"]


def test_invalid_user_input_is_rejected():
    assert not users_db.add_user("bad user", "anothersecurepassword", "operator")["ok"]
    assert not users_db.add_user("operator_test", "short", "operator")["ok"]
    assert not users_db.add_user("operator_test", "anothersecurepassword", "invented-role")["ok"]
    
def test_admin_protection():
    users_db.setup_initial_admin("admin_test", "securepassword123")
    users = users_db.list_users()
    admin = [u for u in users if u["username"] == "admin_test"][0]
    
    # Cannot delete last admin
    res = users_db.delete_user(admin["id"])
    assert not res["ok"]
    assert "last admin" in res["message"]
    
    # Cannot remove role of last admin
    res = users_db.set_role(admin["id"], "engineer")
    assert not res["ok"]
    assert "last admin" in res["message"]
    
    # Add second admin
    users_db.add_user("admin2", "anothersecurepassword", "admin")
    
    # Now we can delete the first admin
    res = users_db.delete_user(admin["id"])
    assert res["ok"]

if __name__ == "__main__":
    test_setup_admin()
    test_login_and_roles()
    test_user_management()
    test_admin_protection()
    print("ALL USER TESTS PASSED")
