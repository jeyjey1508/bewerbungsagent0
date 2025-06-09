from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pydantic import BaseModel, Field
from typing import List
import uuid
from datetime import datetime
from pathlib import Path
import httpx

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

class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# === Routes ===
@api_router.get("/")
async def root():
    return {"message": "Bewerbungsgenerator API - Ready!"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_obj = StatusCheck(**input.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    return []

async def generate_application_with_cerebras(request: ApplicationRequest) -> str:
    prompt = f"""
Du bist ein Experte für deutsche Bewerbungsschreiben. Erstelle ein Bewerbungsschreiben im Stil: {request.stil}.

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

Erstelle nur den Bewerbungstext. Verwende Absätze zwischen Sinnabschnitten. Wiederhole keine Grußformel, die am Ende folgt.
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

@api_router.post("/generate-application", response_model=ApplicationResponse)
async def generate_application(request: ApplicationRequest):
    if not request.gdpr_consent:
        raise HTTPException(status_code=400, detail="GDPR consent is required")

    bewerbung_raw = await generate_application_with_cerebras(request)

    # Bewerbung in Absätze umwandeln
    paragraphs = bewerbung_raw.strip().split("\n\n")
    content_html = "".join(f"<p>{para.strip()}</p>" for para in paragraphs if para.strip())

    html = f"""
<html>
    <head>
        <meta charset='utf-8'>
        <style>
            body {{
                font-family: Arial, sans-serif;
                margin: 2.5cm;
                line-height: 1.5;
                font-size: 12pt;
            }}
            .top-right {{
                text-align: right;
            }}
            .address-block {{
                margin-top: 40px;
                margin-bottom: 40px;
            }}
            .subject {{
                font-weight: bold;
                margin: 20px 0;
            }}
            .signature {{
                margin-top: 40px;
            }}
        </style>
    </head>
    <body>
        <div>{request.personal.vorname} {request.personal.nachname}<br>
        {request.personal.adresse}<br>
        {request.personal.email} • {request.personal.telefon}</div>

        <div class='top-right'>{datetime.utcnow().strftime('%d.%m.%Y')}</div>

        <div class='address-block'>
            {request.company.firmenname}<br>
            {request.company.ansprechpartner}<br>
            {request.company.firmenadresse}
        </div>

        <div class='subject'>Bewerbung um eine Stelle als {request.qualifications.position}</div>

        {content_html}

        <div class='signature'>
            <p>Mit freundlichen Grüßen</p>
            <p>{request.personal.vorname} {request.personal.nachname}</p>
        </div>
    </body>
</html>
"""

    return ApplicationResponse(
        id=str(uuid.uuid4()),
        bewerbungstext=html,
        created_at=datetime.utcnow()
    )

# === Middleware ===
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["https://bewerbungsagent0.onrender.com"],
    allow_methods=["*"],
    allow_headers=["*"]
)
