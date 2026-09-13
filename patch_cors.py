with open('tools/http_api.py', 'r') as f:
    content = f.read()

import_str = "from fastapi import FastAPI, File, Header, HTTPException, UploadFile\nfrom fastapi.middleware.cors import CORSMiddleware"
content = content.replace("from fastapi import FastAPI, File, Header, HTTPException, UploadFile", import_str)

app_str = 'app = FastAPI(title="Sovereign Workbench - Tool Layer", version="0.1.0")\n\napp.add_middleware(\n    CORSMiddleware,\n    allow_origins=["*"],\n    allow_credentials=True,\n    allow_methods=["*"],\n    allow_headers=["*"],\n)\n'
content = content.replace('app = FastAPI(title="Sovereign Workbench - Tool Layer", version="0.1.0")', app_str)

with open('tools/http_api.py', 'w') as f:
    f.write(content)
