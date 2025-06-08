from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pydantic import BaseModel, Field
from typing import List
import uuid
from datetime import datetime
import httpx
from pathlib import Path

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

# === Utility Function ===
def format_to_din5008_html(personal: PersonalData, company: CompanyData, date: str, body: str, position: str) -> str:
    return f"""
<html>
    <head>
        <meta charset=\"utf-8\">
        <style>
            body {{
                font-family: Arial, sans-serif;
                margin: 50px;
                line-height: 1.5;
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
        <div>{personal.vorname} {personal.nachname}<br>
        {personal.adresse}<br>
        {personal.email} • {personal.telefon}</div>

        <div class=\"top-right\">{date}</div>

        <div class=\"address-block\">
            {company.firmenname}<br>
            {company.ansprechpartner}<br>
            {company.firmenadresse}
        </div>

        <div class=\"subject\">Bewerbung um eine Stelle als {position}</div>

        <div>{body}</div>

        <div class=\"signature\">
            <p>Mit freundlichen Grüßen</p>
            <p>{personal.vorname} {personal.nachname}</p>
        </div>
    </body>
</html>
"""

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
        logging.error(f"Application generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating application: {str(e)}")

@api_router.post("/generate-application", response_model=ApplicationResponse)
async def generate_application(request: ApplicationRequest):
    if not request.gdpr_consent:
        raise HTTPException(status_code=400, detail="GDPR consent is required")

    try:
        bewerbungstext = await generate_application_with_cerebras(request)

        formatted_html = format_to_din5008_html(
            personal=request.personal,
            company=request.company,
            date=datetime.utcnow().strftime("%d.%m.%Y"),
            body=bewerbungstext,
            position=request.qualifications.position
        )

        response_obj = ApplicationResponse(
            id=str(uuid.uuid4()),
            bewerbungstext=formatted_html,
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
