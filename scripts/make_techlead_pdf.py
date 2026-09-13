import os
from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY

def make_pdf():
    DATA_DIR = Path(os.environ.get("WORKBENCH_DATA", "workspace_data"))
    output_path = DATA_DIR / "outputs" / "TechLead_DeepDive_Architecture.pdf"
    
    doc = SimpleDocTemplate(str(output_path), pagesize=letter)
    styles = getSampleStyleSheet()
    
    title_style = styles['Heading1']
    title_style.alignment = 1 # Center
    
    h2_style = styles['Heading2']
    h2_style.spaceBefore = 15
    h2_style.spaceAfter = 5
    
    h3_style = styles['Heading3']
    h3_style.spaceBefore = 10
    h3_style.spaceAfter = 5
    
    p_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        alignment=TA_JUSTIFY,
        spaceAfter=10
    )
    
    bullet_style = ParagraphStyle(
        'CustomBullet',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        leftIndent=20,
        spaceAfter=5
    )

    story = []
    
    def add_title(text):
        story.append(Paragraph(text, title_style))
        story.append(Spacer(1, 15))
    def add_h2(text):
        story.append(Paragraph(text, h2_style))
    def add_h3(text):
        story.append(Paragraph(text, h3_style))
    def add_p(text):
        story.append(Paragraph(text, p_style))
    def add_bullet(text):
        story.append(Paragraph(f"• {text}", bullet_style))

    add_title("V.E.R.T.E.X. Tech Lead Deep Dive")
    add_p("<i>This document is strictly for the Tech Lead. Use this exact technical terminology to eliminate any doubts the judges might have about the architecture's legitimacy.</i>")
    
    # --- 1. CORE TECH STACK ---
    add_h2("1. Core Tech Stack (The Backbone)")
    add_bullet("<b>Inference Engine:</b> Ollama (Local LLM execution)")
    add_bullet("<b>Models:</b> qwen3.5:9b (Orchestrator), qwen2.5-coder:7b (Code), llava:latest (Vision)")
    add_bullet("<b>Vector DB (RAG):</b> ChromaDB (Local SQLite-based vector store)")
    add_bullet("<b>Relational DB (Context Graph):</b> SQLite (Zero-config, highly portable)")
    add_bullet("<b>Vision/OCR:</b> PaddleOCR (MobileNet-v3 lightweight backbone)")
    add_bullet("<b>Network & API:</b> FastAPI (for SSE streaming) + psutil (Kernel-level socket auditing)")
    add_bullet("<b>Custom MCP Loop:</b> Pure Python State Machine (Zero dependency on LangChain)")

    # --- 2. THE EXECUTION PIPELINE ---
    add_h2("2. Exact Execution Pipeline (Low-Level Flow)")
    add_h3("Step 1: Dynamic Routing & Pre-flight")
    add_p("`tools/router.py` parses `sys.argv`. Agar `--image` flag milta hai, router text model ko bypass karke LLaVA load karta hai. Warna default qwen3.5:9b select hota hai.")
    add_h3("Step 2: VRAM / Unified Memory Flush (Swap Storm Mitigation)")
    add_p("`ollama_client.py::unload()` trigger hota hai. Ye purane models ko `/api/chat` via `keep_alive=0` bhej kar VRAM/Unified Memory se evict (flush) kar deta hai, taaki Mac ka swap memory crash na ho.")
    add_h3("Step 3: Multi-Agent State Machine")
    add_p("`orchestrator.py` system prompts inject karta hai. Prompt pehle <b>Planner</b> ke paas jata hai jo ek execution DAG (Directed Acyclic Graph) banata hai. Fir control <b>Researcher</b> aur end mein <b>Writer</b> ko pass hota hai.")
    add_h3("Step 4: Custom MCP Tool Interception")
    add_p("AI ek JSON payload emit karta hai. `agent.py` is output ko intercept karta hai, JSON parse karta hai, aur `tools/registry.py` mein RBAC check karta hai.")
    add_h3("Step 5: The HITL Mutating Guardrail")
    add_p("Agar tool `mutating=True` flag carry karta hai, toh `agent.py` execution halt kar deta hai. Wo `sys.stdin.isatty()` se I/O hijack karke user se terminal mein [y/n] approval maangta hai.")
    add_h3("Step 6: Sovereignty Observatory (Live Auditing)")
    add_p("Background mein `tools/http_api.py` ek FastAPI server chalata hai. Ye Server-Sent Events (SSE) stream karta hai jisme `psutil.net_connections()` live har TCP socket ko audit karta hai.")

    # --- 3. ARCHITECTURE DEFENSES ---
    add_h2("3. Defending the Architecture")
    add_h3("Q1. Tumne LangChain kyun nahi use kiya?")
    add_p("<i>'LangChain is built for cloud infrastructure. For an Air-gapped Sovereign AI, relying on third-party black-box wrappers introduces security vulnerabilities. We built a custom Model Context Protocol (MCP) in raw Python for kernel-level security control.'</i>")
    add_h3("Q2. Tumne PostgreSQL ki jagah SQLite kyun use kiya?")
    add_p("<i>'Industrial Edge deployments require zero-configuration. SQLite provides full ACID compliance and relational mapping but runs entirely in-process, making our system highly resilient on low-spec hardware.'</i>")
    add_h3("Q3. Document reading ke liye LLaVA ki jagah PaddleOCR kyun?")
    add_p("<i>'Loading a massive Vision Transformer (ViT) like LLaVA just to read text causes severe memory thrashing. PaddleOCR uses a lightweight MobileNet-v3 backbone, allowing sub-second OCR without evicting our primary LLM from the Unified Memory.'</i>")

    # --- 4. LIVE DEMONSTRATION PLAYBOOK ---
    add_h2("4. Live Demonstration Playbook (What can we demo?)")
    add_p("Hum currently yeh 4 high-impact workflows live pitch mein run kar sakte hain:")
    add_bullet("<b>End-to-End File Generation with HITL:</b> Hum ek raw PDF (like legal document ya SOP) upload karke AI se report generate karwa sakte hain. Demo highlight: 'Dekhiye kaise file save hone se pehle AI execution freeze hoti hai aur human terminal pe [y/n] enter karta hai.'")
    add_bullet("<b>The Air-gap Proof (Sovereignty Observatory):</b> `verify_airgap.sh` run karke sandbox mein ek fake Google request pass kar sakte hain, aur dikha sakte hain ki macOS kernel level pe wo connection kaise 'Connection refused' (block) ho jata hai. Saath hi live FastAPI SSE stream (`/admin/network/stream`) chalakar 0 outbound connections prove kar sakte hain.")
    add_bullet("<b>Multi-Hop Context Graph Query:</b> AI ko bol sakte hain 'Check P-101'. AI pehle SQLite Graph se P-101 ka SOP tag nikalega, fir RAG se wo manual padhega, aur decision lega. Yeh dikhata hai ki system hardware aur manuals ke relation samajhta hai.")
    add_bullet("<b>Multimodal Extraction (PaddleOCR):</b> Ek messy handwriting ya diagram image dekar dikha sakte hain ki AI PaddleOCR trigger karke kaise sub-second speed mein text nikal leta hai.")

    # --- 5. EXTENDED Q&A ---
    add_h2("5. Extended Q&A (Anticipated Questions)")
    
    add_h3("Q1. Judge: 'If your system is completely air-gapped, how do you update the AI models or the Knowledge Base?'")
    add_p("<b>Ans:</b> 'Knowledge base bilkul local ChromaDB aur SQLite par run hota hai. Authorized personnel USB ya secure offline Intranet se naye PDFs drop kar sakte hain, aur hamara `auto_ingest.py` script unhe offline vectorize kar dega. Models ke liye, hum quantized `.GGUF` model files locally push kar sakte hain bina kisi external API ya internet ke.'")
    
    add_h3("Q2. Judge: 'What happens if a malicious insider tries to prompt the AI to run a destructive command?'")
    add_p("<b>Ans:</b> 'Hamara Python Sandbox macOS ke `subprocess` namespace ko strict boundaries mein limit karta hai, aur network proxies ko `0.0.0.0` pe bind (block) kar deta hai. Agar koi malicious insider `rm -rf` jaisi command dene ka try karta hai, toh hamara Role-Based Access Control (RBAC) usko reject kar dega, aur koi bhi Mutating tool chalne se pehle waise bhi HITL gate par ruk jayega.'")
    
    add_h3("Q3. User (Industrial Worker): 'Will this AI replace my job or make decisions for me without my consent?'")
    add_p("<b>Ans:</b> 'Nahi, V.E.R.T.E.X ek Copilot hai, Autopilot nahi. Final decision hamesha human ka hi hoga. Humne Human-In-The-Loop (HITL) gate isi liye banaya hai taaki AI sirf heavy data process kare, action aur approval sirf ek authorized operator hi de sake.'")
    
    add_h3("Q4. Judge: 'How scalable is this if we want to deploy it across 50 different factories?'")
    add_p("<b>Ans:</b> 'Kyunki humne heavy cloud APIs, Docker, aur PostgreSQL drop karke SQLite aur containerized Ollama models use kiye hain, ye poora system ek single ruggedized edge-server (ya high-end laptop) pe easily deploy ho sakta hai. Ye infinitely horizontally scalable hai kyunki har factory ka apna private, independent offline node hoga jo baaki kisi pe depend nahi karta.'")

    doc.build(story)
    print(f"PDF generated at {output_path}")

if __name__ == "__main__":
    make_pdf()
