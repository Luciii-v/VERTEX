import requests
from pathlib import Path

DATA_DIR = Path("workspace_data")

files_to_ingest = [
    "kb/corrosion_response_SOP.pdf",
    "kb/equipment_restart_procedure.pdf",
    "uploads/inspection_report_P101.pdf"
]

print("Ingesting files into RAG...")
for f in files_to_ingest:
    try:
        resp = requests.post("http://127.0.0.1:8100/ingest", json={"path": f})
        print(f"Ingest {f}: {resp.json()}")
    except Exception as e:
        print(f"Failed to connect to RAG server: {e}")
