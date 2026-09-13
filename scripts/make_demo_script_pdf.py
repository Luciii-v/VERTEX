import os
from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def make_pdf():
    DATA_DIR = Path(os.environ.get("WORKBENCH_DATA", "workspace_data"))
    output_path = DATA_DIR / "uploads" / "VERTEX_Demo_Tasks.pdf"
    
    doc = SimpleDocTemplate(str(output_path), pagesize=letter)
    styles = getSampleStyleSheet()
    title_style = styles['Heading1']
    title_style.alignment = 1 
    h2_style = styles['Heading2']
    h2_style.spaceBefore = 10
    h2_style.spaceAfter = 5
    p_style = ParagraphStyle('CustomBody', parent=styles['Normal'], fontSize=11, leading=15, spaceAfter=10)

    story = []
    story.append(Paragraph("VERTEX Master Execution Protocol", title_style))
    story.append(Spacer(1, 15))
    story.append(Paragraph("<b>Instructions for the VERTEX AI Agent:</b>", p_style))
    story.append(Paragraph("Please execute the following tasks. The Researcher Agent must compile the data, and the Writer Agent MUST use its designated MCP tools to generate the final deliverables. DO NOT use the Python Sandbox to create documents.", p_style))
    
    story.append(Paragraph("Task 1: Filesystem Audit", h2_style))
    story.append(Paragraph("Use 'list_files' to audit the 'uploads' directory.", p_style))
    
    story.append(Paragraph("Task 2: Context Graph & Knowledge Base (RAG)", h2_style))
    story.append(Paragraph("Use 'query_context_graph' to look up 'P-101' and identify its SOP. Then use 'search_knowledge_base' to find the 'maximum allowable wall loss' for that SOP.", p_style))
    
    story.append(Paragraph("Task 3: Isolated Python Sandbox", h2_style))
    story.append(Paragraph("Use 'run_python_sandbox' to calculate the sum of numbers 1 through 100. (DO NOT use the sandbox for anything else).", p_style))
    
    story.append(Paragraph("Task 4: Document Generation (Writer Agent Only)", h2_style))
    story.append(Paragraph("The Writer agent must use the 'generate_docx' MCP tool to create 'P101_Demo_Report.docx' summarizing the wall loss rule.", p_style))
    
    story.append(Paragraph("Task 5: Data Generation (Writer Agent Only)", h2_style))
    story.append(Paragraph("The Writer agent must use the 'generate_xlsx' MCP tool to create 'Asset_Metrics.xlsx' with dummy data for P-101.", p_style))
    
    story.append(Paragraph("Task 6: Presentation Generation (Writer Agent Only)", h2_style))
    story.append(Paragraph("The Writer agent must use the 'generate_pptx' MCP tool to create 'Demo_Success.pptx' with a slide stating the Demo was successful.", p_style))

    doc.build(story)

if __name__ == "__main__":
    make_pdf()
