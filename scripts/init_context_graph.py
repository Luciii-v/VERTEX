import sqlite3
import os
from pathlib import Path

DATA_DIR = Path(os.environ.get("WORKBENCH_DATA", "workspace_data"))
DB_PATH = DATA_DIR / "context_graph.db"

def init_db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    # Remove existing DB for a fresh start
    if DB_PATH.exists():
        DB_PATH.unlink()
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print(f"Initializing Industrial Context Graph at {DB_PATH}...")
    
    # Create Entities table
    cursor.execute('''
    CREATE TABLE entities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,         -- e.g., 'Asset', 'SOP', 'WorkOrder', 'Location'
        name TEXT NOT NULL,
        description TEXT
    )
    ''')
    
    # Create Relationships table
    cursor.execute('''
    CREATE TABLE relationships (
        source_id TEXT NOT NULL,
        relation_type TEXT NOT NULL, -- e.g., 'governed_by', 'located_in', 'requires_permit'
        target_id TEXT NOT NULL,
        FOREIGN KEY (source_id) REFERENCES entities (id),
        FOREIGN KEY (target_id) REFERENCES entities (id),
        PRIMARY KEY (source_id, relation_type, target_id)
    )
    ''')
    
    # --- SEED DATA ---
    entities = [
        # Assets
        ("P-101", "Asset", "Cooling Water Pump", "Main cooling water circulation pump"),
        ("P-102A", "Asset", "Boiler Feed Pump A", "Primary boiler feed pump"),
        ("CDU-01", "Location", "Crude Distillation Unit", "Primary refinery unit"),
        
        # Documents
        ("SOP-MECH-018", "SOP", "Piping and Equipment Integrity SOP", "Governs wall loss limits and vibration"),
        ("SOP-SAFE-005", "SOP", "Equipment Restart Protocol", "Safety prerequisites for equipment restart"),
        
        # Work Orders
        ("WO-9921", "WorkOrder", "P-101 Vibration Inspection", "Pending inspection order"),
    ]
    
    cursor.executemany("INSERT INTO entities VALUES (?, ?, ?, ?)", entities)
    
    relationships = [
        ("P-101", "located_in", "CDU-01"),
        ("P-102A", "located_in", "CDU-01"),
        ("P-101", "governed_by", "SOP-MECH-018"),
        ("P-102A", "governed_by", "SOP-MECH-018"),
        ("P-101", "requires_protocol", "SOP-SAFE-005"),
        ("WO-9921", "targets_asset", "P-101"),
    ]
    
    cursor.executemany("INSERT INTO relationships VALUES (?, ?, ?)", relationships)
    
    conn.commit()
    conn.close()
    print("✅ Context Graph seeded successfully with Assets, Locations, SOPs, and Relationships!")

if __name__ == "__main__":
    init_db()
