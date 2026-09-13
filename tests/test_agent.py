"""Agent-loop test with a scripted fake model. Proves the plumbing without Ollama."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from tools.agent import run
from tools.router import route

fails=[]
def check(l,c,d=""):
    print(("PASS  " if c else "FAIL  ")+l+(f"  -> {d}" if d and not c else "")); 
    if not c: fails.append(l)

# --- router ---
check("routes code task", route("write a python script")["role"]=="code")
check("routes image task", route("analyse this scanned drawing")["role"]=="vision")
check("routes image by attachment", route("what is this?", has_image=True)["role"]=="vision")
check("routes plain text", route("summarise the SOP")["role"]=="general")
check("vision uses multimodal general model", route("read the scan")["model"]=="qwen3.5:9b")

def scripted(*turns):
    """Returns a chat_fn that replays canned assistant messages in order."""
    state={"i":0,"seen":[]}
    def fn(model, messages, tools=None, images=None, num_ctx=None, **kw):
        state["seen"].append(len(tools or []))
        i=state["i"]; state["i"]+=1
        return turns[i] if i<len(turns) else {"role":"assistant","content":"done"}
    fn.state=state
    return fn

def tc(name, args):
    return {"role":"assistant","tool_calls":[{"function":{"name":name,"arguments":args}}]}

# --- 1. tool call then answer ---
fn = scripted(tc("run_python_sandbox",{"code":"print(17*23)"}),
              {"role":"assistant","content":"17 x 23 = 391."})
r = run("compute 17*23 in the sandbox", chat_fn=fn, verbose=False)
check("agent executed tool via MCP", r["tool_calls"][0]["envelope"]["status"]=="ok")
check("sandbox output correct", "391" in r["tool_calls"][0]["envelope"]["result"]["stdout"])
check("agent returned final answer", "391" in r["answer"])
check("model saw tool schemas", fn.state["seen"][0] >= 9, fn.state["seen"])

# --- 2. approval gate blocks writes ---
fn = scripted(tc("generate_docx",{"filename":"note.docx","title":"Approval Note","blocks":[{"type":"paragraph","text":"x"}]}),
              {"role":"assistant","content":"I need approval to write the file."})
r = run("draft the approval note", chat_fn=fn, verbose=False, auto_approve=False)
check("write blocked pending approval", len(r["pending_approvals"])==1, r["pending_approvals"])
check("agent told to stop, not retry", r["tool_calls"][0]["envelope"]["status"]=="approval_required")

# --- 3. auto-approve path works over the protocol ---
fn = scripted(tc("generate_docx",{"filename":"note2.docx","title":"Approval Note","blocks":[{"type":"bullets","items":["Replace gasket"]}]}),
              {"role":"assistant","content":"Wrote the note."})
r = run("draft the approval note", chat_fn=fn, auto_approve=True, verbose=False)
env=r["tool_calls"][0]["envelope"]
if env["status"]=="error" and "python-docx" in env.get("error",""):
    print("SKIP  docx write (python-docx missing)")
else:
    check("auto-approve produced a real file", env["status"]=="ok" and env["result"]["path"].endswith(".docx"), env)

# --- 4. retry cap stops a failing tool ---
bad = tc("read_document",{"path":"nope.pdf"})
fn = scripted(bad,bad,bad,bad,{"role":"assistant","content":"File is missing."})
r = run("read nope.pdf", chat_fn=fn, verbose=False)
msgs=[t["envelope"].get("error","") for t in r["tool_calls"]]
check("retry cap engaged", any("Stop calling it" in m for m in msgs), msgs)

# --- 5. RBAC flows through the agent ---
fn = scripted(tc("run_python_sandbox",{"code":"print(1)"}),
              {"role":"assistant","content":"Not permitted."})
r = run("run code", chat_fn=fn, role="operator", verbose=False)
check("operator blocked from sandbox via MCP", "may not call" in r["tool_calls"][0]["envelope"]["error"])

# --- 6. step limit safety ---
loop = tc("list_files",{})
fn = scripted(*([loop]*30))
r = run("loop forever", chat_fn=fn, verbose=False)
check("step limit prevents infinite loop", r["complete"] is False and len(r["tool_calls"])<=12, len(r["tool_calls"]))

print()
print(f"{len(fails)} failure(s)" if fails else "ALL CHECKS PASSED")
sys.exit(1 if fails else 0)
