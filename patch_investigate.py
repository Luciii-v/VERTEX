with open('tools/http_api.py', 'r') as f:
    content = f.read()

import_str = "from pydantic import BaseModel\nimport threading\nimport queue\nfrom .agent import run as run_agent\n"
if "from .agent import run as run_agent" not in content:
    content = content.replace("from pydantic import BaseModel", import_str)

endpoint_str = """
class InvestigateRequest(BaseModel):
    query: str

@app.post("/investigate")
async def investigate(req: InvestigateRequest, x_user: str | None = Header(None), x_role: str | None = Header(None)):
    user, role = _identity(x_user, x_role)
    q = queue.Queue()
    
    def target():
        # Custom print interceptor to stream verbose output to the queue
        import sys, io
        class QueueIO(io.StringIO):
            def write(self, s):
                if s.strip():
                    q.put({"type": "log", "content": s.strip()})
        old_stdout = sys.stdout
        sys.stdout = QueueIO()
        try:
            res = run_agent(req.query, user=user, role=role, verbose=True)
            q.put({"type": "result", "content": res})
        except Exception as e:
            q.put({"type": "error", "content": str(e)})
        finally:
            sys.stdout = old_stdout
            q.put(None)

    threading.Thread(target=target).start()

    async def event_generator():
        while True:
            try:
                # non-blocking wait to allow async generator to yield control
                item = await asyncio.to_thread(q.get, timeout=0.5)
                if item is None:
                    break
                yield f"data: {json.dumps(item)}\n\n"
            except queue.Empty:
                continue

    return StreamingResponse(event_generator(), media_type="text/event-stream")
"""

if "/investigate" not in content:
    content += endpoint_str

with open('tools/http_api.py', 'w') as f:
    f.write(content)
