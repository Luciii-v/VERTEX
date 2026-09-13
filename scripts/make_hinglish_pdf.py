import os
from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY

def make_pdf():
    DATA_DIR = Path(os.environ.get("WORKBENCH_DATA", "workspace_data"))
    output_path = DATA_DIR / "outputs" / "Pitch_Guide_Hinglish.pdf"
    
    doc = SimpleDocTemplate(str(output_path), pagesize=letter)
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = styles['Heading1']
    title_style.alignment = 1 # Center
    
    h2_style = styles['Heading2']
    h2_style.spaceBefore = 15
    h2_style.spaceAfter = 5
    
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
        
    def add_p(text):
        story.append(Paragraph(text, p_style))
        
    def add_bullet(text):
        story.append(Paragraph(f"• {text}", bullet_style))

    add_title("V.E.R.T.E.X. Pitch Guide: Humne Backend Kaise Banaya")
    add_p("<i>Yeh guide batayega ki humne exactly kya banaya, kaise banaya, aur kyun banaya. Judges se baat karne se pehle isko ache se padh lena taaki hum dono same page par rahein!</i>")
    
    add_h2("1. The Problem We Solved (The 'Why')")
    add_p("Most companies AI (jaise ChatGPT) use karna chahti hain apne PDFs aur data padhne ke liye. Lekin classified industries (jaise oil refineries ya defense) apna secret data internet par send nahi kar sakti. Isliye humne V.E.R.T.E.X. banaya. Yeh ek 100% 'air-gapped' AI system hai jo purely local laptop par chalta hai, bina internet connect kiye.")

    add_h2("2. The Local AI Brain (Ollama)")
    add_bullet("<b>Kya:</b> OpenAI API use karne ke badle, humne Open-Source models locally run kiye.")
    add_bullet("<b>Kaise:</b> Humne Ollama use kiya jisme qwen3.5:9b (text ke liye) aur qwen2.5-coder (coding ke liye) models hain.")
    add_bullet("<b>Kyun:</b> MacBook Air ki Unified Memory (RAM) limited hoti hai. Agar hum saare models ek saath load karte toh laptop freeze (swap storm) ho jata. Toh humne special code likha jo purane model ko memory se delete karke naya model load karta hai taaki laptop fast chale.")

    add_h2("3. The Multi-Agent Orchestrator")
    add_bullet("<b>Kya:</b> Ek AI se sab kuch karwane ke badle, humne AI agents ki ek team banayi jo step-by-step kaam karti hai.")
    add_bullet("<b>Kaise:</b> Planner task ko break karta hai, Researcher PDFs padhta hai, aur Writer final documents banata hai.")
    add_bullet("<b>Kyun:</b> Ek AI ko bohot saare tools dene se wo confuse ho jata hai. Divide and conquer se accuracy bohot badh jati hai.")

    add_h2("4. The Knowledge Base (RAG)")
    add_bullet("<b>Kya:</b> RAG (Retrieval-Augmented Generation) se AI hazaron pages ke manuals instantly padh sakta hai.")
    add_bullet("<b>Kaise:</b> Humne FastAPI aur ChromaDB use karke local server banaya. Jab user PDF upload karta hai, PyMuPDF usko chote chunks mein tod kar database mein save karta hai.")
    add_bullet("<b>Kyun:</b> AI poora 500-page manual yaad nahi rakh sakta, isliye RAG usko sirf relevant paragraph search karne mein help karta hai (jaise 3.0mm wall loss rule).")

    add_h2("5. The Eyes (PaddleOCR)")
    add_bullet("<b>Kya:</b> AI messy handwritten notes aur diagrams kaise padhta hai.")
    add_bullet("<b>Kaise:</b> Pehle humne heavy Vision models (LLaVA) try kiye the, par wo bohot slow the (8+ minutes). Isliye humne backend mein PaddleOCR install kiya.")
    add_bullet("<b>Kyun:</b> PaddleOCR fast hai aur bina heavy LLM ke text aur coordinates nikal leta hai seconds mein.")

    add_h2("6. The Industrial Context Graph")
    add_bullet("<b>Kya:</b> Ek database jo physical equipment ko unke PDF manuals se connect karta hai.")
    add_bullet("<b>Kaise:</b> Humne ek lightweight SQLite database banaya jisme Assets (Pump P-101) aur Documents (SOP-018) ke beech relationship mapped hai.")
    add_bullet("<b>Kyun:</b> Isse AI ko 'industrial common sense' milta hai ki kaunsa pump kis SOP se governed hai. Heavy PostgreSQL ki zaroorat nahi padi.")

    add_h2("7. The Guardrails (Human-In-The-Loop)")
    add_bullet("<b>Kya:</b> AI bina human permission ke system par files likh ya delete nahi kar sakta.")
    add_bullet("<b>Kaise:</b> Agar AI document generate karne ka try karta hai, toh system pause hoke 'APPROVAL REQUIRED' bolta hai. Jab tak human 'y' press nahi karta, file nahi banti.")
    add_bullet("<b>Kyun:</b> Judges ko prove karne ke liye ki AI rogue (out of control) nahi ho sakta. Human hamesha in-control hai.")

    add_h2("8. The Winning Feature: Sovereignty Observatory")
    add_bullet("<b>Kya:</b> Mathematical proof ki hamara system sach mein offline hai.")
    add_bullet("<b>Kaise:</b> Ek bash script (verify_airgap.sh) macOS ke system tools (lsof) use karke live check karti hai ki koi data internet par toh nahi ja raha.")
    add_bullet("<b>Kyun:</b> Koi bhi claim kar sakta hai ki unka AI private hai, par hum code aur system audit se mathematical proof de rahe hain. Yeh hamara mic-drop moment hai!")

    add_h2("Common Judge Questions & Answers")
    add_p("<b>Q: Aapne PostgreSQL ki jagah SQLite kyun use kiya?</b><br/>Ans: Sovereign aur portable system ke liye zero-configuration chahiye tha. SQLite se humein saari relational mapping mil gayi bina judges ke laptop par heavy server setup kiye.")
    
    add_p("<b>Q: Aapne itne bade models Mac par memory crash ke bina kaise chalaye?</b><br/>Ans: Humne custom router banaya hai. Jab AI text se coding task par switch karta hai, toh hamara code deliberately purane model ko RAM se flush kar deta hai. Isse 'swap storms' prevent hote hain.")
    
    add_p("<b>Q: Aap kaise prove kar sakte ho ki data bahar nahi ja raha?</b><br/>Ans: Humne Sovereignty Observatory banaya hai. Ek script hai jo macOS network sockets ko scan karti hai aur intentionally hamare sandbox ka internet block karke trace dikhati hai. Hum sirf bolte nahi, hum verify karte hain.")

    doc.build(story)
    print(f"Hinglish PDF generated at {output_path}")

if __name__ == "__main__":
    make_pdf()
