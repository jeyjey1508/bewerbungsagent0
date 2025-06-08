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
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from io import BytesIO
from fastapi.responses import StreamingResponse

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
    bewerbungstext: str
    created_at: datetime

# === Routes ===
@api_router.get("/")
async def root():
    return {"message": "Bewerbungsgenerator API - Ready!"}

async def generate_application_with_cerebras(request: ApplicationRequest) -> str:
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

Gib nur den formatierten Bewerbungstext im DIN-5008-Stil zurück.
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

def generate_pdf_din5008(request: ApplicationRequest, text: str):
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    absender_x = 350
    absender_y = height - 40
    empfaenger_x = 50
    empfaenger_y = height - 120
    datum_x = 350
    datum_y = empfaenger_y - 40
    betreff_y = datum_y - 60
    text_y = betreff_y - 40

    c.drawString(absender_x, absender_y, f"{request.personal.vorname} {request.personal.nachname}")
    c.drawString(absender_x, absender_y - 15, request.personal.adresse)
    c.drawString(absender_x, absender_y - 30, request.personal.email)
    c.drawString(absender_x, absender_y - 45, request.personal.telefon)

    c.drawString(empfaenger_x, empfaenger_y, request.company.firmenname)
    c.drawString(empfaenger_x, empfaenger_y - 15, request.company.firmenadresse)
    c.drawString(empfaenger_x, empfaenger_y - 30, f"z. Hd. {request.company.ansprechpartner}")

    c.drawString(datum_x, datum_y, datetime.today().strftime("%d.%m.%Y"))

    c.setFont("Helvetica-Bold", 12)
    c.drawString(empfaenger_x, betreff_y, f"Bewerbung um die Position: {request.qualifications.position}")

    c.setFont("Helvetica", 11)
    for i, line in enumerate(text.split("\n")):
        c.drawString(empfaenger_x, text_y - i * 15, line.strip())

    c.showPage()
    c.save()
    buffer.seek(0)

    return StreamingResponse(buffer, media_type='application/pdf', headers={"Content-Disposition": "inline; filename=bewerbung.pdf"})

@api_router.post("/generate-application", response_model=ApplicationResponse)
async def generate_application(request: ApplicationRequest):
    if not request.gdpr_consent:
        raise HTTPException(status_code=400, detail="GDPR consent is required")

    try:
        bewerbungstext = await generate_application_with_cerebras(request)
        response_obj = ApplicationResponse(
            id=str(uuid.uuid4()),
            bewerbungstext=bewerbungstext,
            created_at=datetime.utcnow()
        )
        return response_obj
    except Exception as e:
        logger.error(f"Application generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating application: {str(e)}")

@api_router.post("/generate-application-pdf")
async def generate_application_pdf(request: ApplicationRequest):
    if not request.gdpr_consent:
        raise HTTPException(status_code=400, detail="GDPR consent is required")

    bewerbungstext = await generate_application_with_cerebras(request)
    return generate_pdf_din5008(request, bewerbungstext)

# === Middleware ===
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["https://bewerbungsagent0.onrender.com"],
    allow_methods=["*"],
    allow_headers=["*"]
)
