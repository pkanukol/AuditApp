"""
Resets the database completely and reseeds with fresh data.
Usage: python seed.py

WARNING: drops all tables and recreates them — all existing data is lost.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app.database import engine, SessionLocal, Base
from app import models, auth

print("Dropping all tables...")
Base.metadata.drop_all(bind=engine)
print("Recreating all tables...")
Base.metadata.create_all(bind=engine)

USERS = [
    # --- Auditors ---
    dict(email="auditor@harvest.com",   name="Auditor Pavani",  designation="Academic Auditor",       role="auditor", location="Both"),
    dict(email="principal_K@harvest.com", name="Principal Kodathi",     designation="Principal",               role="auditor", location="Both"),
  dict(email="principal_A@harvest.com", name="Principal Attibele",     designation="Principal",               role="auditor", location="Both"),
    dict(email="chairman@harvest.com",  name="Chairman",      designation="Chairman",                role="auditor", location="Both"),
    dict(email="ch1@harvest.com",        name="Curriculum Head1",    designation="Curriculum Head",              role="auditor", location="Both"),
  dict(email="ch2@harvest.com",        name="Curriculum Head2",    designation="Curriculum Head",              role="auditor", location="Both"),
    # --- SMEs ---
    dict(email="sme3@harvest.com",       name="SME Three",     designation="Subject Matter Expert",   role="sme",     location="Both"),
    dict(email="sme1@harvest.com",      name="SME One",       designation="Subject Matter Expert",   role="sme",     location="Both"),
    dict(email="pavani.k@harvestinternationalschool.in",      name="SME Two",       designation="Subject Matter Expert",   role="sme",     location="Both"),
]

TEACHERS = [
    # (email, name, location, sme_email)
    ("teacher6@harvest.com",  "Teacher Six",   "Attibele",  "sme3@harvest.com"),
    ("teacher1@harvest.com", "Teacher One",   "Kodathi",  "sme1@harvest.com"),
    ("teacher2@harvest.com", "Teacher Two",   "Kodathi",  "sme1@harvest.com"),
    ("teacher3@harvest.com", "Teacher Three", "Attibele", "sme1@harvest.com"),
    ("kp.pavani@gmail.com", "Teacher Four",  "Attibele", "sme2@harvest.com"),
    ("teacher5@harvest.com", "Teacher Five",  "Kodathi",  "sme2@harvest.com"),
]

DEFAULT_PASSWORD = "password123"


def seed():
    db = SessionLocal()
    try:
        # Insert auditors and SMEs first
        for u in USERS:
            db.add(models.User(
                email=u["email"],
                password_hash=auth.get_password_hash(DEFAULT_PASSWORD),
                name=u["name"],
                designation=u["designation"],
                role=u["role"],
                location=u["location"],
                sme_id=None,
            ))
            print(f"  added {u['email']}")
        db.commit()

        # Insert teachers — resolve each SME's id from the DB
        for email, name, location, sme_email in TEACHERS:
            sme = db.query(models.User).filter(models.User.email == sme_email).first()
            if not sme:
                print(f"  ERROR: SME {sme_email} not found — cannot create {email}")
                continue
            db.add(models.User(
                email=email,
                password_hash=auth.get_password_hash(DEFAULT_PASSWORD),
                name=name,
                designation="Primary Teacher",
                role="teacher",
                location=location,
                sme_id=sme.id,
            ))
            print(f"  added {email} -> {sme_email}")
        db.commit()

        print("\nDone. All users in DB:")
        for u in db.query(models.User).order_by(models.User.id).all():
            sme_ref = f"sme_id={u.sme_id}" if u.sme_id else ""
            print(f"  [{u.id}] {u.email:<32} {u.role:<8} {sme_ref}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
