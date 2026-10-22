import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import text
from app.db.session import engine, SessionLocal
from app.models import Patient

def run():
    print("Migrating patients table for patient_number...")
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE patients ADD COLUMN IF NOT EXISTS patient_number VARCHAR(50);"))
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_patient_number ON patients(patient_number);"))
        conn.commit()
    print("Schema updated successfully.")

    db = SessionLocal()
    try:
        patients = db.query(Patient).order_by(Patient.created_at).all()
        print(f"Found {len(patients)} existing patients to assign patient numbers.")
        
        counter = 1001
        for p in patients:
            if not p.patient_number:
                candidate = f"AYUR-{counter}"
                while db.query(Patient).filter(Patient.patient_number == candidate).first():
                    counter += 1
                    candidate = f"AYUR-{counter}"
                p.patient_number = candidate
                print(f"Assigned {candidate} to {p.first_name} {p.last_name}")
                counter += 1
        db.commit()
        print("All existing patients backfilled with unique patient numbers!")
    finally:
        db.close()

if __name__ == "__main__":
    run()
