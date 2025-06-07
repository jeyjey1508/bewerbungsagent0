from fastapi import FastAPI, APIRouter, HTTPException 
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pydantic import BaseModel
from typing import List
import uuid
from datetime import datetime
from pathlib import Path
import httpx
import base64
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

# === ENV & Logging ===
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# === FastAPI Setup ===
app = FastAPI()
api_router = APIRouter(prefix="/api")

# === Data Models ===
class PersonalData(BaseModel):
    vorname: str
    nachname: str
    alter: int
    email: str
    telefon: str
    adresse: str

class Qualifications(BaseModel):
    position: str
    ausbildung: str
    berufserfahrung: str
    staerken: str
    sprachen: str
    motivation: str

class CompanyData(BaseModel):
    firmenname: str
    ansprechpartner: str
    firmenadresse: str

class ApplicationRequest(BaseModel):
    personal: PersonalData
    qualifications: Qualifications
    company: CompanyData
    stil: str = "Formell"
    gdpr_consent: bool

class ApplicationResponse(BaseModel):
    id: str
    bewerbung_pdf_base64: str
    created_at: datetime

# === Routes ===
@api_router.get("/")
async def root():
    return {"message": "Bewerbungsgenerator API - Ready!"}

async def generate_application_text(request: ApplicationRequest) -> str:
    prompt = f"""
Du bist ein Bewerbungsexperte. Verfasse ein vollständiges Bewerbungsschreiben streng nach der Norm DIN 5008. Halte dich an folgende Struktur:

1. Absenderadresse oben rechts
2. Empfängeradresse links, 4,5 cm vom oberen Rand
3. Datum rechts
4. Betreff fett ohne 'Betreff:' davor
5. Anrede
6. Fließtext mit Absätzen (Einleitung, Hauptteil, Schluss)
7. Grußformel mit Namen darunter

Nutze folgende Informationen:

PERSÖNLICHE DATEN:
- Name: {request.personal.vorname} {request.personal.nachname}
- Alter: {request.personal.alter}
- E-Mail: {request.personal.email}
- Telefon: {request.personal.telefon}
- Adresse: {request.personal.adresse}

QUALIFIKATIONEN:
- Gewünschte Position: {request.qualifications.position}
- Ausbildung: {request.qualifications.ausbildung}
- Berufserfahrung: {request.qualifications.berufserfahrung}
- Stärken & Fähigkeiten: {request.qualifications.staerken}
- Sprachkenntnisse: {request.qualifications.sprachen}
- Motivation: {request.qualifications.motivation}

FIRMENDATEN:
- Firmenname: {request.company.firmenname}
- Ansprechpartner: {request.company.ansprechpartner}
- Firmenadresse: {request.company.firmenadresse}

Gib nur den Bewerbungstext zurück.
"""

    headers = {
        "Authorization": f"Bearer {os.environ['CEREBRAS_API_KEY']}",
        "Content-Type": "application/json"
    }

    body = {
        "model": "llama-4-scout-17b-16e-instruct",
        "stream": False,
        "max_tokens": 2048,
        "temperature": 0.7,
        "top_p": 1,
        "messages": [
            {"role": "system", "content": "Du bist ein professioneller Bewerbungsschreiber."},
            {"role": "user", "content": prompt}
        ]
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post("https://api.cerebras.ai/v1/chat/completions", headers=headers, json=body)

        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"].strip()

    except Exception as e:
        logging.error(f"Application generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating application: {str(e)}")

def generate_pdf_from_text(content: str) -> bytes:
    buffer = BytesIO()
    p = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    text_object = p.beginText(72, height - 72)
    text_object.setFont("Helvetica", 12)

    for line in content.split("\n"):
        text_object.textLine(line)

    p.drawText(text_object)
    p.showPage()
    p.save()

    buffer.seek(0)
    return buffer.read()

@api_router.post("/generate-application", response_model=ApplicationResponse)
async def generate_application(request: ApplicationRequest):
    if not request.gdpr_consent:
        raise HTTPException(status_code=400, detail="GDPR consent is required")

    try:
        text = await generate_application_text(request)
        pdf_bytes = generate_pdf_from_text(text)
        pdf_base64 = base64.b64encode(pdf_bytes).decode("utf-8")

        response_obj = ApplicationResponse(
            id=str(uuid.uuid4()),
            bewerbung_pdf_base64=pdf_base64,
            created_at=datetime.utcnow()
        )

        return response_obj

    except Exception as e:
        logger.error(f"Application generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating application: {str(e)}")

# === Middleware ===
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["https://bewerbungsagent0.onrender.com"],
    allow_methods=["*"],
    allow_headers=["*"]
)
