import docx
import json
from pathlib import Path
import os

OUTPUTS = Path("workspace_data/outputs")
dest = OUTPUTS / "legal_suggestions_summary.docx"

doc = docx.Document()

# Set modern font for the whole document
style = doc.styles['Normal']
font = style.font
font.name = 'Helvetica'

doc.add_heading("Legal Suggestions Summary: Vendor Agreement II (NDA)", level=0)

blocks = [
    {"type": "heading", "level": 1, "text": "Document Overview"},
    {"type": "paragraph", "text": "This document outlines the terms of a Non-Disclosure Agreement (NDA) between the Company and its MSME vendors. It is designed to protect confidential information while providing favorable conditions for vendors, particularly regarding freedom to work with other clients."},
    {"type": "heading", "level": 1, "text": "Key Confidentiality Rules"},
    {"type": "bullets", "items": [
        "Clause 1: All non-public data (designs, drawings, plans, customer details) is inherently confidential. Explicit labeling is not required.",
        "Clause 2: Exclusions apply if the information is already public or independently developed.",
        "Clause 3: Vendors cannot post photos of designs on social media or their personal portfolios without explicit written consent."
    ]},
    {"type": "heading", "level": 1, "text": "Security & Breach Protocol"},
    {"type": "bullets", "items": [
        "Clause 4: If legally required by a court order to disclose data, vendors must provide immediate written notice to the Company.",
        "Clause 5: Any data leak, hack, or unauthorized access must be reported within exactly 24 hours."
    ]},
    {"type": "heading", "level": 1, "text": "Vendor-Friendly Provisions (Clause 10)"},
    {"type": "paragraph", "text": "This is the most favorable clause for our vendors. It explicitly guarantees NO Restraint of Trade. Vendors are completely free to work with other clients simultaneously without restriction, provided they do not leak our Company data. There are no heavy penalties or non-compete clauses."},
    {"type": "heading", "level": 1, "text": "Term & Resolution"},
    {"type": "paragraph", "text": "The agreement term is 3 years, terminable with 30 days' notice. Disputes will first go through a 15-day amicable negotiation period, followed by independent arbitration under Indian law in Delhi."}
]

for b in blocks:
    kind = b.get("type")
    if kind == "heading":
        h = doc.add_heading(b.get("text", ""), level=b.get("level", 1))
    elif kind == "paragraph":
        doc.add_paragraph(b.get("text", ""))
    elif kind == "bullets":
        for item in b.get("items", []):
            doc.add_paragraph(str(item), style="List Bullet")

doc.save(dest)
print(f"Beautiful doc saved to {dest}")
