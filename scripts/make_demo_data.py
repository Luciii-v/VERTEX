"""Generate synthetic refinery corpus for the SIH26117 demo."""
import os
from pathlib import Path
import csv

# We'll use reportlab to make PDFs
try:
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
except ImportError:
    import subprocess
    import sys
    print("Installing reportlab...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "reportlab"])
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter

DATA_DIR = Path(os.environ.get("WORKBENCH_DATA", "workspace_data")).resolve()
KB_DIR = DATA_DIR / "kb"
UPLOADS_DIR = DATA_DIR / "uploads"

KB_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

def make_pdf(path, title, lines):
    c = canvas.Canvas(str(path), pagesize=letter)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(72, 750, title)
    c.setFont("Helvetica", 12)
    y = 710
    for line in lines:
        if y < 72:
            c.showPage()
            c.setFont("Helvetica", 12)
            y = 750
        c.drawString(72, y, line)
        y -= 20
    c.save()
    print(f"Generated: {path}")

def main():
    print(f"Creating demo data in {DATA_DIR}...")
    
    # 1. SOP
    make_pdf(
        KB_DIR / "corrosion_response_SOP.pdf",
        "SOP-MECH-018: Piping and Equipment Integrity",
        [
            "Revision: 6",
            "Effective Date: 2026-04-01",
            "",
            "1. Wall Loss Limits",
            "The maximum allowable wall loss for active service pipes is 3.0 mm.",
            "If wall loss exceeds 3.0 mm, an immediate shutdown must be initiated.",
            "",
            "2. Gasket Seepage",
            "Minor gasket seepage on discharge flanges must be repaired within 7 days.",
            "",
            "3. Instrument Calibration",
            "Gauges with expired calibration (over 12 months) must be replaced.",
        ]
    )

    # 2. Restart Procedure
    make_pdf(
        KB_DIR / "equipment_restart_procedure.pdf",
        "SOP-OPS-042: Equipment Restart Prerequisites",
        [
            "Before restarting any crude charge pump after a maintenance shutdown:",
            "- Maintenance Manager must approve the WO closure.",
            "- Operations must verify all block valves are open.",
            "- Seal flush system must be pressurized.",
        ]
    )

    # 3. Inspection Report (Text PDF)
    make_pdf(
        UPLOADS_DIR / "inspection_report_P101.pdf",
        "Inspection Report IR-1042",
        [
            "Equipment Tag: Pump P-101",
            "Date: 2026-09-10",
            "Inspector: J. Doe",
            "",
            "Findings:",
            "- Measured wall loss at discharge flange: 4.2 mm.",
            "- Minor gasket seepage observed on casing.",
            "- Pressure gauge calibration expired on 2026-07-15.",
            "",
            "Vibration data: 8.2 mm/s RMS (Drive End)."
        ]
    )

    # 4. CSV Schedule
    csv_path = UPLOADS_DIR / "inspection_schedule.csv"
    with open(csv_path, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(["Equipment_Tag", "Last_Inspection", "Interval_Days"])
        w.writerow(["P-101", "2026-08-01", "30"])
        w.writerow(["P-102A", "2025-06-15", "180"])
        w.writerow(["V-12", "2026-01-10", "365"])
    print(f"Generated: {csv_path}")

if __name__ == "__main__":
    main()
