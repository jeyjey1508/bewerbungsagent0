from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List
import uuid
from datetime import datetime
from openai import AsyncOpenAI

# Load .env
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# MongoDB
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# OpenAI client
openai_client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])

# FastAPI app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
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

# Routes
@api_router.get("/")
async def root():
    return {"message": "Bewerbungsgenerator API - Ready!"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    obj = StatusCheck(**input.dict())
    await db.status_checks.insert_one(obj.dict())
    return obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    result = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**entry) for entry in result]

async def generate_application_with_openai(request: ApplicationRequest) -> str:
    prompt = f"""
Du bist ein Experte für deutsche Bewerbungsschreiben. Erstelle ein Bewerbungsschreiben im Stil: {request.stil}

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

    try:
        response = await client.chat.completions.create(
            model="gpt-3.5-turbo",  # <== hier ändern
            messages=[
                {"role": "system", "content": "Du bist ein professioneller Bewerbungsschreiber."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=1000
        )


    except Exception as e:
        logging.error(f"Application generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating application: {str(e)}")

@api_router.post("/generate-application", response_model=ApplicationResponse)
async def generate_application(request: ApplicationRequest):
    if not request.gdpr_consent:
        raise HTTPException(status_code=400, detail="GDPR consent is required")

    try:
        text = await generate_application_with_openai(request)
        result = ApplicationResponse(
            id=str(uuid.uuid4()),
            bewerbungstext=text,
            created_at=datetime.utcnow()
        )

        data = result.dict()
        data.update({
            "personal_data": request.personal.dict(),
            "qualifications": request.qualifications.dict(),
            "company_data": request.company.dict(),
            "stil": request.stil
        })
        await db.applications.insert_one(data)
        return result

    except Exception as e:
        logging.error(f"Application generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating application: {str(e)}")

# 🔄 Include all routes
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://bewerbungsagent0.onrender.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shutdown cleanup
@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
