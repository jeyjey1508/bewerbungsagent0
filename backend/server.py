from fastapi import FastAPI, APIRouter, HTTPException, Body
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List
from fastapi.responses import StreamingResponse
from weasyprint import HTML
from io import BytesIO
import base64
import httpx
import uuid
import logging
import os
import re
from datetime import datetime
from pathlib import Path

# === Setup ===
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()
api_router = APIRouter(prefix="/api")

# === Models ===
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
    jobanzeige: str = ""
    stil: str = "Formell"
    gdpr_consent: bool
    includeUnterschrift: bool = False


class ApplicationResponse(BaseModel):
    id: str
    bewerbungstext: str
    created_at: datetime

class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# === KI-Funktion ===
async def generate_application_with_cerebras(request: ApplicationRequest) -> str:
    prompt = f"""
Du bist ein Experte für deutsche Bewerbungsschreiben. Erstelle ein Bewerbungsschreiben im Stil: {request.stil}.
Nutze maximal 200 Wörter.

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
"""

    # Füge die Stellenanzeige nur ergänzend hinzu
    if request.jobanzeige:
        prompt += f"\n\nSTELLENANZEIGE (optional):\n{request.jobanzeige}"

    prompt += "\nErstelle nur den Bewerbungstext. Verwende Absätze und schreibe keine Grußformel, wenn sie schon enthalten ist."

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
        logger.error(f"Application generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating application: {str(e)}")

# === Endpunkte ===
@api_router.get("/")
async def root():
    return {"message": "Bewerbungsgenerator API - Ready!"}

@api_router.post("/generate-application", response_model=ApplicationResponse)
async def generate_application(request: ApplicationRequest):
    if not request.gdpr_consent:
        raise HTTPException(status_code=400, detail="GDPR consent is required")

    raw = await generate_application_with_cerebras(request)
    clean = re.split(r"(?i)mit\s+freundlichen\s+grüßen", raw)[0].strip()
    paragraphs = [f"<p>{p.strip()}</p>" for p in clean.split("\n\n") if p.strip()]
    content_html = "".join(paragraphs)

    # ✅ KORRIGIERTE UNTERSCHRIFT-LOGIK
    if request.includeUnterschrift:
        signature_space = "<br><br><br>"  # 3 Zeilen Platz nur wenn Checkbox aktiviert
    else:
        signature_space = ""  # Kein extra Platz wenn Checkbox nicht aktiviert

    # CSS als separate Variable definieren
    css_styles = """
        body { font-family: Arial; font-size: 12pt; line-height: 1.5; margin: 1cm; }
        .signature { margin-top: 30px; }
    """

    html = f"""
    <html>
        <head>
            <meta charset='utf-8'>
            <style>
                {css_styles}
            </style>
        </head>
        <body>
            <div style="text-align: right;">{request.personal.vorname} {request.personal.nachname}</div>
            <div style="text-align: right;">{request.personal.adresse}</div>
            <div style="text-align: right;">{request.personal.email}</div>
            <div style="text-align: right;">{request.personal.telefon}</div>
    
            <br>
    
            <div>{request.company.firmenname}</div>
            <div>{request.company.ansprechpartner}</div>
            <div>{request.company.firmenadresse}</div>
    
            <div style="text-align: right;">{datetime.utcnow().strftime('%d.%m.%Y')}</div>
    
            <br>
            <div><strong>Bewerbung um eine Stelle als {request.qualifications.position}</strong></div>
            <br>
            {content_html}
            <div class="signature">
                <p>Mit freundlichen Grüßen</p>
                {signature_space}
                <p>{request.personal.vorname} {request.personal.nachname}</p>
            </div>
        </body>
    </html>
    """

    return ApplicationResponse(id=str(uuid.uuid4()), bewerbungstext=html, created_at=datetime.utcnow())

@api_router.post("/export-pdf-from-html")
async def export_pdf_from_html(html: str = Body(..., embed=True), filename: str = Body("Bewerbung.pdf", embed=True)):
    try:
        pdf_bytes = HTML(string=html).write_pdf()
        return StreamingResponse(BytesIO(pdf_bytes), media_type="application/pdf", headers={
            "Content-Disposition": f"attachment; filename={filename}"
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF-Export fehlgeschlagen: {str(e)}")

@api_router.post("/send-email")
async def send_email(
    to: str = Body(...),
    subject: str = Body(...),
    html: str = Body(...),
    filename: str = Body("Bewerbung.pdf")
):
    try:
        pdf_bytes = HTML(string=html).write_pdf()
        encoded_pdf = base64.b64encode(pdf_bytes).decode("utf-8")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF-Erstellung fehlgeschlagen: {str(e)}")

    resend_api_key = os.getenv("RESEND_API_KEY")
    resend_from = os.getenv("RESEND_FROM")

    if not resend_api_key or not resend_from:
        raise HTTPException(status_code=500, detail="Resend-Konfiguration fehlt")

    payload = {
        "from": resend_from,
        "to": [to],
        "subject": subject,
        "html": "<p>Im Anhang findest du deine Bewerbung als PDF.</p>",
        "attachments": [{
            "filename": filename,
            "content": encoded_pdf,
            "content_type": "application/pdf"
        }]
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {resend_api_key}",
                    "Content-Type": "application/json"
                },
                json=payload
            )
            response.raise_for_status()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"E-Mail-Versand fehlgeschlagen: {str(e)}")

    return {"message": "E-Mail erfolgreich gesendet"}

# === Router & Middleware ganz zum Schluss ===
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[
        "https://bewerbungsagent0.onrender.com",
        "https://bewerbungsagent0-1.onrender.com",
        "https://bewerbungsai.com"
    ],
    allow_methods=["*"],
    allow_headers=["*"]
)
