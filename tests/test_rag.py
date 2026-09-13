"""Tests for the RAG FastAPI service."""
import os
import sys
import unittest
from pathlib import Path
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set dummy environment variables to avoid writing to real chroma in tests
os.environ["WORKBENCH_DATA"] = "/tmp/rag_test_data"
test_dir = Path("/tmp/rag_test_data")
test_dir.mkdir(parents=True, exist_ok=True)

# Write a dummy document for ingestion
dummy_doc = test_dir / "test_sop.txt"
dummy_doc.write_text("The maximum allowable wall loss is 3.0 mm.\n\nIf vibration exceeds 7.1 mm/s, immediately halt the pump.\n\nGasket seepage must be repaired within 7 days.")

from rag.main import app, collection

class TestRAG(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        # Clear collection for test
        if collection is not None:
            try:
                collection.delete(where={"source": "test_sop.txt"})
            except:
                pass

    def test_health_stats(self):
        resp = self.client.get("/stats")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("status", resp.json())

    def test_ingest_and_search(self):
        if collection is None:
            self.skipTest("ChromaDB / Ollama offline")
            
        # 1. Ingest
        resp = self.client.post("/ingest", json={"path": "test_sop.txt"})
        self.assertEqual(resp.status_code, 200)
        self.assertGreater(resp.json()["chunks_added"], 0)
        
        # 2. Search
        # Searching for "how much corrosion is too much" should retrieve the 3.0 mm limit
        search_resp = self.client.post("/search", json={"query": "how much corrosion is too much", "top_k": 1})
        self.assertEqual(search_resp.status_code, 200)
        
        hits = search_resp.json().get("hits", [])
        self.assertEqual(len(hits), 1)
        self.assertIn("3.0 mm", hits[0]["text"])
        self.assertEqual(hits[0]["source"], "test_sop.txt")
        self.assertEqual(hits[0]["page"], 1)

if __name__ == "__main__":
    unittest.main()
