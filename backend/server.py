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
    return StatusCheck(**input.dict())

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

Erstelle nur den Bewerbungstext.
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
        logger.error(f"Application generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating application: {str(e)}")

def format_din_5008(request: ApplicationRequest, body_text: str) -> str:
    absender = f"{request.personal.vorname} {request.personal.nachname}\n{request.personal.adresse}\n{request.personal.email} • {request.personal.telefon}"
    empfaenger = f"{request.company.firmenname}\n{request.company.ansprechpartner}\n{request.company.firmenadresse}"
    datum = datetime.utcnow().strftime("%d.%m.%Y")

    rechtsblock = f"{empfaenger:<50}{datum:>30}"

    return f"""{absender}

{rechtsblock}

Bewerbung um eine Stelle als {request.qualifications.position}

{body_text}

Mit freundlichen Grüßen

{request.personal.vorname} {request.personal.nachname}"""

@api_router.post("/generate-application", response_model=ApplicationResponse)
async def generate_application(request: ApplicationRequest):
    if not request.gdpr_consent:
        raise HTTPException(status_code=400, detail="GDPR consent is required")

    try:
        raw_text = await generate_application_with_cerebras(request)
        bewerbungstext = format_din_5008(request, raw_text)

        response_obj = ApplicationResponse(
            id=str(uuid.uuid4()),
            bewerbungstext=bewerbungstext,
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
