import os
import re
from pathlib import Path
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import chromadb
from chromadb.utils.embedding_functions import OllamaEmbeddingFunction
import uvicorn

app = FastAPI(title="VERTEX RAG Service")

# Configuration
DATA_DIR = Path(os.environ.get("WORKBENCH_DATA", "workspace_data")).resolve()
CHROMA_DIR = DATA_DIR / "chroma"
CHROMA_DIR.mkdir(parents=True, exist_ok=True)

OLLAMA_URL = "http://127.0.0.1:11434/api/embeddings"
EMBEDDING_MODEL = "nomic-embed-text"

# ChromaDB Client
try:
    # Disable telemetry as per rules
    import chromadb.config
    settings = chromadb.config.Settings(anonymized_telemetry=False)
    chroma_client = chromadb.PersistentClient(path=str(CHROMA_DIR), settings=settings)
    
    embedding_func = OllamaEmbeddingFunction(
        model_name=EMBEDDING_MODEL,
        url=OLLAMA_URL
    )
    
    collection = chroma_client.get_or_create_collection(
        name="vertex_kb",
        embedding_function=embedding_func
    )
except Exception as e:
    print(f"Warning: Failed to initialize ChromaDB: {e}")
    collection = None

# --- Models ---
class SearchRequest(BaseModel):
    query: str
    top_k: int = 3

class IngestRequest(BaseModel):
    path: str  # Path relative to workspace_data, e.g. "kb/SOP-MECH-018.txt"

# --- Helper Functions ---
def chunk_text(text: str, source: str, chunk_size: int = 600, overlap: int = 100):
    """Simple overlapping chunker that preserves metadata."""
    chunks = []
    # Split by paragraphs roughly
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    
    current_chunk = ""
    for p in paragraphs:
        if len(current_chunk) + len(p) < chunk_size:
            current_chunk += p + "\n\n"
        else:
            if current_chunk:
                chunks.append({"text": current_chunk.strip(), "source": source, "page": 1})
            current_chunk = p + "\n\n"
            
    if current_chunk:
        chunks.append({"text": current_chunk.strip(), "source": source, "page": 1})
        
    return chunks

# --- Endpoints ---

@app.post("/search")
def search(req: SearchRequest):
    if collection is None:
        raise HTTPException(status_code=503, detail="Local RAG service unreachable (Chroma DB failed to load).")
    
    try:
        results = collection.query(
            query_texts=[req.query],
            n_results=req.top_k
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    hits = []
    if results and results["documents"] and results["documents"][0]:
        for i in range(len(results["documents"][0])):
            meta = results["metadatas"][0][i] if results["metadatas"] else {}
            # Distance is returned; we convert to a pseudo-score (1.0 - distance)
            distance = results["distances"][0][i] if "distances" in results and results["distances"] else 0.5
            
            hits.append({
                "text": results["documents"][0][i],
                "source": meta.get("source", "unknown"),
                "page": int(meta.get("page", 1)),
                "score": round(max(0.0, 1.0 - distance), 3)
            })
            
    return {"hits": hits}

@app.post("/ingest")
def ingest(req: IngestRequest):
    if collection is None:
        raise HTTPException(status_code=503, detail="RAG service unreachable.")
        
    file_path = (DATA_DIR / req.path).resolve()
    if not file_path.is_relative_to(DATA_DIR) or not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found in workspace_data.")
        
    try:
        text = ""
        if file_path.suffix.lower() == ".pdf":
            import fitz
            with fitz.open(file_path) as doc:
                text = "\n\n".join([page.get_text() for page in doc])
        else:
            text = file_path.read_text(encoding="utf-8", errors="ignore")
            
        chunks = chunk_text(text, source=file_path.name)
        
        ids = [f"{file_path.name}_{i}" for i in range(len(chunks))]
        documents = [c["text"] for c in chunks]
        metadatas = [{"source": c["source"], "page": c["page"]} for c in chunks]
        
        # Upsert into Chroma
        collection.upsert(
            ids=ids,
            documents=documents,
            metadatas=metadatas
        )
        return {"status": "ok", "chunks_added": len(chunks)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stats")
def stats():
    if collection is None:
        return {"status": "offline"}
    return {
        "status": "online",
        "collection_count": collection.count(),
        "embedding_model": EMBEDDING_MODEL
    }

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8100)
