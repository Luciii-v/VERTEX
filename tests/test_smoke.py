"""Smoke tests: run these before you touch anything else. `python -m tests.test_smoke`"""
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tools import impl                      # registers tools
from tools.registry import call_tool, list_tools, approve
from tools.audit import recent

fails = []
def check(label, cond, detail=""):
    print(("PASS  " if cond else "FAIL  ") + label + (f"  -> {detail}" if detail and not cond else ""))
    if not cond: fails.append(label)

names = [t["name"] for t in list_tools()]
check("tools registered", len(names) >= 8, names)
print("      " + ", ".join(names))

# 1. sandbox executes and captures stdout
r = call_tool("run_python_sandbox", {"code": "print(2**10)"})
check("sandbox runs code", r["status"] == "ok" and "1024" in r["result"]["stdout"], r)
print(f"      backend={r['result']['backend']} network={r['result']['network']}")

# 2. sandbox surfaces errors instead of crashing
r = call_tool("run_python_sandbox", {"code": "1/0"})
check("sandbox reports traceback", r["result"]["exit_code"] != 0 and "ZeroDivisionError" in r["result"]["stderr"])

# 3. sandbox enforces timeout
r = call_tool("run_python_sandbox", {"code": "while True: pass", "timeout": 3})
check("sandbox kills runaway code", r["result"]["timed_out"] is True)

# 4. sandbox returns artifacts
r = call_tool("run_python_sandbox", {"code": "open('out.txt','w').write('hello')"})
check("sandbox returns artifacts", len(r["result"]["artifacts"]) == 1, r["result"]["artifacts"])

# 5. input files reach the sandbox
r = call_tool("run_python_sandbox", {"code": "print(open('in.csv').read().strip())", "files": {"in.csv": "a,b\n1,2"}})
check("input files mounted", "1,2" in r["result"]["stdout"], r)

# 6. RBAC: operator may not execute code
r = call_tool("run_python_sandbox", {"code": "print(1)"}, role="operator")
check("RBAC blocks operator from sandbox", r["status"] == "error" and "may not call" in r["error"])

# 7. guardrail: mutating tool needs approval
r = call_tool("generate_docx", {"filename": "t.docx", "title": "T", "blocks": []})
check("mutating tool gated", r["status"] == "approval_required", r)
rid = r.get("request_id")

# 8. after approval it runs (skips if python-docx absent)
approve(rid, "admin")
r = call_tool("generate_docx", {"filename": "smoke.docx", "title": "Approval Note",
    "blocks": [{"type":"paragraph","text":"Corrosion observed at P-101 discharge flange."},
               {"type":"bullets","items":["Replace gasket in 7 days","Recalibrate gauge"]},
               {"type":"table","rows":[["Finding","Risk"],["Flange corrosion","High"]]}]}, approval_token=rid)
if r["status"] == "error" and "python-docx" in r["error"]:
    print("SKIP  docx generation (python-docx not installed)")
else:
    check("docx generated after approval", r["status"] == "ok", r)

# 9. token is single use
r = call_tool("generate_docx", {"filename": "again.docx", "title": "T", "blocks": []}, approval_token=rid)
check("approval token is single-use", r["status"] == "approval_required")

# 10. path traversal blocked
r = call_tool("read_document", {"path": "../../../etc/passwd"})
check("path traversal blocked", r["status"] == "error", r)

# 11. bad args do not crash the loop
r = call_tool("run_python_sandbox", {"nonsense": 1})
check("invalid arguments handled", r["status"] == "error" and "invalid arguments" in r["error"])

# 12. unknown tool
check("unknown tool handled", call_tool("nope", {})["status"] == "error")

# 13. audit captured everything
rows = recent(limit=100)
check("audit log populated", len(rows) >= 12, len(rows))
check("audit records denials", any(x["event"] == "denied" for x in rows))
check("audit records approvals", any(x["event"] == "approval_granted" for x in rows))

# 14. every tool exposes a valid-looking schema
bad = [t["name"] for t in list_tools() if t["inputSchema"].get("type") != "object"]
check("all schemas are object-typed", not bad, bad)

print()
print(f"{len(fails)} failure(s)" if fails else "ALL CHECKS PASSED")
sys.exit(1 if fails else 0)
