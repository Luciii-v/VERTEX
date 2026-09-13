import re

with open('frontend/vertex_mac/dist/assets/index-kJBPNr2A.js', 'r') as f:
    content = f.read()

# Replace "X-User": "demo" with "X-User": t().userName
content = content.replace('"X-User":"demo"', '"X-User": t().userName')
# Actually, in my template I put "X-User": "demo" with spaces
content = content.replace('"X-User": "demo"', '"X-User": t().userName')

with open('frontend/vertex_mac/dist/assets/index-kJBPNr2A.js', 'w') as f:
    f.write(content)

print("✅ Patched UI auth")
