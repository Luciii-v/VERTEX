import re

with open('tools/http_api.py', 'r') as f:
    content = f.read()

# Find the interceptor block
interceptor_old = """
        class QueueIO(io.StringIO):
            def write(self, s):
                if s.strip():
                    q.put({"type": "log", "content": s.strip()})
"""

interceptor_new = """
        import re
        ansi_escape = re.compile(r'\\x1B(?:[@-Z\\\\-_]|\\[[0-?]*[ -/]*[@-~])')
        class QueueIO(io.StringIO):
            def write(self, s):
                clean_s = ansi_escape.sub('', s).strip()
                if clean_s:
                    q.put({"type": "log", "content": clean_s})
"""

if "ansi_escape" not in content:
    content = content.replace(interceptor_old.strip(), interceptor_new.strip())

with open('tools/http_api.py', 'w') as f:
    f.write(content)
