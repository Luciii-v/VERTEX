"""The tool surface. Everything the agent is allowed to do lives here.

Rule of thumb used throughout: a tool returns FACTS and FILE PATHS, never
prose. Prose is the model's job. This is what keeps the tool layer
model-agnostic (requirement 15) -- swap Qwen for Gemma and none of this changes.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from .registry import ToolError, tool
from .sandbox import preflight as sandbox_preflight
from .sandbox import run_code

DATA = Path(os.environ.get("WORKBENCH_DATA", "workspace_data"))
UPLOADS = DATA / "uploads"
OUTPUTS = DATA / "outputs"
KB = DATA / "kb"
for _p in (UPLOADS, OUTPUTS, KB):
    _p.mkdir(parents=True, exist_ok=True)


def _resolve(path: str, *, root: Path = DATA) -> Path:
    """Confine every path to the data root. Blocks ../../etc/passwd."""
    p = (root / path).resolve() if not Path(path).is_absolute() else Path(path).resolve()
    root_r = root.resolve()
    if root_r not in p.parents and p != root_r:
        raise ToolError(f"path escapes the workbench data root: {path}")
    if not p.exists():
        raise ToolError(f"file not found: {path}")
    return p


# --------------------------------------------------------------------------
# 1. Filesystem / ingestion
# --------------------------------------------------------------------------

@tool(
    description=(
        "List files available in the workbench data area. Use this first when "
        "the user refers to 'the report' or 'the uploaded file' without a path."
    ),
    schema={
        "type": "object",
        "properties": {
            "subdir": {
                "type": "string",
                "enum": ["uploads", "outputs", "kb"],
                "default": "uploads",
            }
        },
    },
    tags=("filesystem",),
)
def list_files(subdir: str = "uploads") -> list[dict]:
    base = DATA / subdir
    if not base.exists():
        return []
    return [
        {
            "path": str(p.relative_to(DATA)),
            "size_bytes": p.stat().st_size,
            "suffix": p.suffix.lower(),
        }
        for p in sorted(base.rglob("*"))
        if p.is_file()
    ]


@tool(
    description=(
        "Extract machine-readable content from a document (PDF, DOCX, XLSX, CSV, "
        "TXT, or image). Returns extracted text per page, plus rendered page "
        "images and a `needs_vision` hint when a page has little or no text "
        "layer (i.e. it is scanned or is a drawing). Does NOT interpret the "
        "content -- pass the text or the page images to a model for that."
    ),
    schema={
        "type": "object",
        "properties": {
            "path": {"type": "string", "description": "Path relative to the data root, e.g. uploads/report.pdf"},
            "max_pages": {"type": "integer", "default": 20},
        },
        "required": ["path"],
    },
    tags=("ingestion", "multimodal"),
)
def read_document(path: str, max_pages: int = 20) -> dict:
    src = _resolve(path)
    suffix = src.suffix.lower()

    if suffix == ".pdf":
        return _read_pdf(src, max_pages)
    if suffix in (".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp"):
        return {
            "kind": "image",
            "pages": [{"page": 1, "text": "", "image_path": str(src)}],
            "needs_vision": True,
            "needs_ocr": True,
            "note": "Image input: send image_path to the vision model, and/or call ocr_image.",
        }
    if suffix in (".txt", ".md", ".csv", ".json"):
        text = src.read_text(encoding="utf-8", errors="replace")
        return {"kind": "text", "pages": [{"page": 1, "text": text}],
                "needs_vision": False, "needs_ocr": False}
    if suffix == ".docx":
        return {"kind": "docx", "pages": [{"page": 1, "text": _read_docx(src)}],
                "needs_vision": False, "needs_ocr": False}
    if suffix in (".xlsx", ".xlsm"):
        return {"kind": "xlsx", "sheets": _read_xlsx(src),
                "needs_vision": False, "needs_ocr": False}
    raise ToolError(f"unsupported file type: {suffix}")


def _read_pdf(src: Path, max_pages: int) -> dict:
    try:
        import fitz  # PyMuPDF
    except ImportError as exc:
        raise ToolError("PyMuPDF not installed. `pip install pymupdf`") from exc

    render_dir = OUTPUTS / f"pages_{src.stem}"
    render_dir.mkdir(parents=True, exist_ok=True)
    pages, needs_vision = [], False

    with fitz.open(src) as doc:
        for i, page in enumerate(doc):
            if i >= max_pages:
                break
            text = page.get_text().strip()
            # A page with almost no text layer is scanned art or a drawing.
            sparse = len(text) < 40
            needs_vision = needs_vision or sparse
            img_path = render_dir / f"page_{i + 1}.png"
            if not img_path.exists():
                page.get_pixmap(dpi=200).save(img_path)
            pages.append({
                "page": i + 1,
                "text": text,
                "char_count": len(text),
                "image_path": str(img_path),
                "text_layer_sparse": sparse,
            })
        total = doc.page_count

    return {
        "kind": "pdf",
        "page_count": total,
        "pages_returned": len(pages),
        "pages": pages,
        "needs_vision": needs_vision,
        "needs_ocr": needs_vision,
        "note": ("Some pages have no text layer -- run ocr_image on their "
                 "image_path, or send the image to the vision model."
                 if needs_vision else "Full text layer present; no OCR needed."),
    }


# --------------------------------------------------------------------------
# 2. Industrial Context Graph (PostgreSQL / SQLite)
# --------------------------------------------------------------------------

@tool(
    description=(
        "Query the Industrial Context Graph database to find relationships between "
        "Assets, Locations, Work Orders, and SOPs. Use this to discover which "
        "documents govern an equipment tag, or where an asset is located."
    ),
    schema={
        "type": "object",
        "properties": {
            "entity_id": {"type": "string", "description": "The exact ID (e.g., 'P-101', 'SOP-MECH-018'). If empty, returns all entities."},
        }
    },
    tags=("context_graph", "database"),
)
def query_context_graph(entity_id: str = "") -> dict:
    import sqlite3
    db_path = DATA / "context_graph.db"
    if not db_path.exists():
        raise ToolError("Context graph DB not initialized.")
        
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    if not entity_id:
        # Return summary of all entities if no ID provided
        rows = cursor.execute("SELECT id, type, name FROM entities").fetchall()
        conn.close()
        return {"all_entities": [dict(r) for r in rows]}
        
    # Get exact entity details
    ent = cursor.execute("SELECT * FROM entities WHERE id = ?", (entity_id,)).fetchone()
    if not ent:
        conn.close()
        return {"error": f"Entity '{entity_id}' not found in the Context Graph."}
        
    # Get inbound and outbound relationships
    outbound = cursor.execute('''
        SELECT relation_type, target_id, e.name as target_name, e.type as target_type
        FROM relationships r
        JOIN entities e ON r.target_id = e.id
        WHERE source_id = ?
    ''', (entity_id,)).fetchall()
    
    inbound = cursor.execute('''
        SELECT relation_type, source_id, e.name as source_name, e.type as source_type
        FROM relationships r
        JOIN entities e ON r.source_id = e.id
        WHERE target_id = ?
    ''', (entity_id,)).fetchall()
    
    conn.close()
    return {
        "entity": dict(ent),
        "relationships_outbound": [dict(r) for r in outbound],
        "relationships_inbound": [dict(r) for r in inbound],
    }


# --------------------------------------------------------------------------
# 3. Parsers
# --------------------------------------------------------------------------

def _read_docx(src: Path) -> str:
    try:
        import docx
    except ImportError as exc:
        raise ToolError("python-docx not installed. `pip install python-docx`") from exc
    d = docx.Document(str(src))
    parts = [p.text for p in d.paragraphs if p.text.strip()]
    for table in d.tables:
        for row in table.rows:
            parts.append(" | ".join(c.text.strip() for c in row.cells))
    return "\n".join(parts)


def _read_xlsx(src: Path) -> list[dict]:
    try:
        import openpyxl
    except ImportError as exc:
        raise ToolError("openpyxl not installed. `pip install openpyxl`") from exc
    wb = openpyxl.load_workbook(str(src), data_only=True)
    out = []
    for ws in wb.worksheets:
        rows = [
            [("" if c is None else c) for c in row]
            for row in ws.iter_rows(values_only=True)
        ]
        out.append({"sheet": ws.title, "rows": rows[:500]})
    return out


@tool(
    description=(
        "Run local OCR on an image or a rendered PDF page and return the text "
        "plus per-block bounding boxes and confidence. Fully offline. Use this "
        "for typed scanned text before reaching for the vision model -- it is "
        "faster and more literal."
    ),
    schema={
        "type": "object",
        "properties": {
            "path": {"type": "string"},
            "lang": {"type": "string", "default": "en"},
        },
        "required": ["path"],
    },
    tags=("ingestion", "multimodal"),
)
def ocr_image(path: str, lang: str = "en") -> dict:
    src = _resolve(path)
    try:
        from paddleocr import PaddleOCR
    except ImportError:
        return _ocr_tesseract(src, lang)

    global _PADDLE
    try:
        _PADDLE
    except NameError:
        import logging
        logging.getLogger('ppocr').setLevel(logging.ERROR)
        _PADDLE = PaddleOCR(use_angle_cls=True, lang=lang)

    raw = _PADDLE.ocr(str(src)) or []
    blocks = []
    for page in raw:
        if not page:
            continue
        if isinstance(page, dict) and "rec_texts" in page:
            for box, text, conf in zip(page.get("rec_polys", []), page.get("rec_texts", []), page.get("rec_scores", [])):
                blocks.append({"text": text, "confidence": round(float(conf), 3),
                               "box": [[round(float(x)), round(float(y))] for x, y in box]})
        else:
            for box, (text, conf) in page:
                blocks.append({"text": text, "confidence": round(float(conf), 3),
                               "box": [[round(float(x)), round(float(y))] for x, y in box]})
    return {
        "engine": "paddleocr",
        "text": "\n".join(b["text"] for b in blocks),
        "blocks": blocks,
        "mean_confidence": round(
            sum(b["confidence"] for b in blocks) / len(blocks), 3) if blocks else 0.0,
    }


def _ocr_tesseract(src: Path, lang: str) -> dict:
    try:
        import pytesseract
        from PIL import Image
    except ImportError as exc:
        raise ToolError(
            "No OCR engine available. Install paddleocr, or pytesseract + the "
            "tesseract binary. Do this BEFORE going air-gapped."
        ) from exc
    lang_code = {"en": "eng"}.get(lang, lang)
    text = pytesseract.image_to_string(Image.open(src), lang=lang_code)
    return {"engine": "tesseract", "text": text.strip(), "blocks": [],
            "mean_confidence": None}


# --------------------------------------------------------------------------
# 2. Knowledge base -- thin client over the RAG teammate's service
# --------------------------------------------------------------------------

@tool(
    description=(
        "Search the organisation's local knowledge base (SOPs, safety manuals, "
        "past approval notes) and return the most relevant passages WITH their "
        "source document and page, so the answer can be cited. Never leaves the "
        "machine."
    ),
    schema={
        "type": "object",
        "properties": {
            "query": {"type": "string"},
            "top_k": {"type": "integer", "default": 5, "maximum": 20},
        },
        "required": ["query"],
    },
    tags=("rag",),
)
def search_knowledge_base(query: str, top_k: int = 5) -> dict:
    """Delegates to the RAG service owned by another teammate.

    CONTRACT (agree this and stop coordinating):
      POST http://127.0.0.1:8100/search  {"query": str, "top_k": int}
      ->   {"hits": [{"text": str, "source": str, "page": int, "score": float}]}
    """
    import urllib.error
    import urllib.request

    endpoint = os.environ.get("RAG_ENDPOINT", "http://127.0.0.1:8100/search")
    payload = json.dumps({"query": query, "top_k": top_k}).encode()
    req = urllib.request.Request(
        endpoint, data=payload, headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read())
    except urllib.error.URLError as exc:
        raise ToolError(
            f"local RAG service unreachable at {endpoint} ({exc.reason}). "
            "Start the knowledge-base service."
        ) from exc

    hits = data.get("hits", [])
    return {
        "query": query,
        "hit_count": len(hits),
        "hits": hits,
        "citation_hint": "Quote source + page for every claim you make from these.",
    }


# --------------------------------------------------------------------------
# 3. Sandbox
# --------------------------------------------------------------------------

@tool(
    description=(
        "Execute Python or bash in an isolated sandbox with NO network access "
        "and return exit code, stdout, stderr and any files the code produced. "
        "Use this to verify code you wrote, and to do arithmetic or data "
        "processing rather than computing it in your head. If the exit code is "
        "non-zero, read stderr, fix the code, and call this again."
    ),
    schema={
        "type": "object",
        "properties": {
            "code": {"type": "string"},
            "language": {"type": "string", "enum": ["python", "bash"], "default": "python"},
            "stdin": {"type": "string", "default": ""},
            "files": {
                "type": "object",
                "description": "filename -> text content, placed in the working dir",
                "additionalProperties": {"type": "string"},
            },
            "timeout": {"type": "integer", "default": 30, "maximum": 120},
        },
        "required": ["code"],
    },
    allowed_roles=("engineer", "admin"),   # operators cannot execute code
    tags=("sandbox", "code"),
)
def run_python_sandbox(
    code: str,
    language: str = "python",
    stdin: str = "",
    files: dict | None = None,
    timeout: int = 30,
) -> dict:
    return run_code(
        code, language=language, stdin=stdin, files=files, timeout=timeout
    ).as_dict()


@tool(
    description="Report sandbox backend, resource limits and network isolation status.",
    schema={"type": "object", "properties": {}},
    tags=("sandbox", "diagnostics"),
)
def sandbox_status() -> dict:
    return sandbox_preflight()


# --------------------------------------------------------------------------
# 4. Deliverable generation -- mutating, so gated by human approval
# --------------------------------------------------------------------------

@tool(
    description=(
        "Write a Word document from structured sections. Produces a real .docx "
        "file on disk. Pass a heading plus a list of blocks; supported block "
        "types are 'heading', 'paragraph', 'bullets' and 'table'."
    ),
    schema={
        "type": "object",
        "properties": {
            "filename": {"type": "string", "description": "e.g. approval_note_P101.docx"},
            "title": {"type": "string"},
            "blocks": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "type": {"type": "string",
                                 "enum": ["heading", "paragraph", "bullets", "table"]},
                        "text": {"type": "string"},
                        "items": {"type": "array", "items": {"type": "string"}},
                        "rows": {"type": "array",
                                 "items": {"type": "array", "items": {"type": "string"}}},
                    },
                    "required": ["type"],
                },
            },
        },
        "required": ["filename", "title", "blocks"],
    },
    mutating=True,
    allowed_roles=("engineer", "admin"),
    tags=("deliverable",),
)
def generate_docx(filename: str, title: str, blocks: list[dict]) -> dict:
    try:
        import docx
        import json
    except ImportError as exc:
        raise ToolError("python-docx not installed. `pip install python-docx`") from exc

    # If the LLM passes a single string inside a list instead of parsing it
    if isinstance(blocks, list) and len(blocks) == 1 and isinstance(blocks[0], str):
        try:
            blocks = json.loads(blocks[0])
        except json.JSONDecodeError:
            pass
            
    if isinstance(blocks, str):
        try:
            blocks = json.loads(blocks)
        except json.JSONDecodeError:
            blocks = [{"type": "paragraph", "text": blocks}]
            
    if not isinstance(blocks, list):
        blocks = [blocks]

    doc = docx.Document()
    
    # Make it beautiful & modern!
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Arial'
    
    doc.add_heading(title, level=0)
    for b in blocks:
        if isinstance(b, str):
            doc.add_paragraph(b)
            continue
        
        kind = b.get("type")
        if kind == "heading":
            doc.add_heading(b.get("text", ""), level=min(int(b.get("level", 1)), 4))
        elif kind == "paragraph":
            text = b.get("text")
            if not text and "items" in b:
                text = "\n".join(str(x) for x in b["items"])
            doc.add_paragraph(text or "")
        elif kind == "bullets":
            for item in b.get("items", []):
                doc.add_paragraph(str(item), style="List Bullet")
        elif kind == "table":
            rows = b.get("rows") or []
            if not rows:
                continue
            table = doc.add_table(rows=len(rows), cols=len(rows[0]))
            table.style = "Light Grid Accent 1"
            for r, row in enumerate(rows):
                for c, val in enumerate(row):
                    table.cell(r, c).text = str(val)
        else:
            raise ToolError(f"unknown block type: {kind}")

    dest = OUTPUTS / Path(filename).name
    doc.save(dest)
    return {"path": str(dest), "size_bytes": dest.stat().st_size,
            "block_count": len(blocks)}


@tool(
    description="Write an Excel workbook. `sheets` maps sheet name -> rows (first row = header).",
    schema={
        "type": "object",
        "properties": {
            "filename": {"type": "string"},
            "sheets": {
                "type": "object",
                "additionalProperties": {
                    "type": "array",
                    "items": {"type": "array", "items": {"type": ["string", "number"]}},
                },
            },
        },
        "required": ["filename", "sheets"],
    },
    mutating=True,
    allowed_roles=("engineer", "admin"),
    tags=("deliverable",),
)
def generate_xlsx(filename: str, sheets: dict) -> dict:
    try:
        import openpyxl
        from openpyxl.styles import Font
    except ImportError as exc:
        raise ToolError("openpyxl not installed. `pip install openpyxl`") from exc

    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    for name, rows in sheets.items():
        ws = wb.create_sheet(title=str(name)[:31])
        for row in rows:
            ws.append(list(row))
        if ws.max_row >= 1:
            for cell in ws[1]:
                cell.font = Font(bold=True)
            for col in ws.columns:
                width = max((len(str(c.value or "")) for c in col), default=8)
                ws.column_dimensions[col[0].column_letter].width = min(width + 2, 50)
    dest = OUTPUTS / Path(filename).name
    wb.save(dest)
    return {"path": str(dest), "sheets": list(sheets), "size_bytes": dest.stat().st_size}


@tool(
    description=(
        "Write a PowerPoint deck. `slides` is a list of {title, bullets[]} objects. "
        "Use for management or board summaries."
    ),
    schema={
        "type": "object",
        "properties": {
            "filename": {"type": "string"},
            "deck_title": {"type": "string"},
            "slides": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "bullets": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["title"],
                },
            },
        },
        "required": ["filename", "deck_title", "slides"],
    },
    mutating=True,
    allowed_roles=("engineer", "admin"),
    tags=("deliverable",),
)
def generate_pptx(filename: str, deck_title: str, slides: list[dict]) -> dict:
    try:
        from pptx import Presentation
        from pptx.util import Pt
    except ImportError as exc:
        raise ToolError("python-pptx not installed. `pip install python-pptx`") from exc

    prs = Presentation()
    title_layout, body_layout = prs.slide_layouts[0], prs.slide_layouts[1]

    s = prs.slides.add_slide(title_layout)
    s.shapes.title.text = deck_title
    s.placeholders[1].text = "Generated locally - no data left this machine"

    for spec in slides:
        slide = prs.slides.add_slide(body_layout)
        slide.shapes.title.text = spec.get("title", "")
        tf = slide.placeholders[1].text_frame
        tf.clear()
        bullets = spec.get("bullets", []) or [""]
        for i, b in enumerate(bullets):
            para = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            para.text = str(b)
            para.font.size = Pt(18)
    dest = OUTPUTS / Path(filename).name
    prs.save(dest)
    return {"path": str(dest), "slide_count": len(slides) + 1,
            "size_bytes": dest.stat().st_size}
