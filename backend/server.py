from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Models for application generation
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
    stil: str = "Formell"  # Formell, Kreativ, Locker
    gdpr_consent: bool

class ApplicationResponse(BaseModel):
    id: str
    bewerbungstext: str
    created_at: datetime

# Existing models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Existing routes
@api_router.get("/")
async def root():
    return {"message": "Bewerbungsgenerator API - Ready!"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

import google.generativeai as genai  # ganz oben im File, falls noch nicht vorhanden

async def generate_application_with_google_gemini(request: ApplicationRequest) -> str:
    """Generate a professional German job application using Google Gemini API"""
    
    style_instructions = {
        "Formell": "sehr formal und traditionell, mit klassischen Formulierungen",
        "Kreativ": "kreativ und modern, aber trotzdem professionell",
        "Locker": "freundlich und persönlich, aber respektvoll"
    }
    
    style = style_instructions.get(request.stil, style_instructions["Formell"])
    
    prompt = f"""
Du bist ein Experte für deutsche Bewerbungsschreiben. Erstelle ein professionelles Bewerbungsschreiben auf Deutsch im {style}en Stil.

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

ANWEISUNGEN:
1. Erstelle ein vollständiges Bewerbungsschreiben auf Deutsch
2. Verwende eine professionelle Struktur mit Briefkopf, Anrede, Hauptteil und Schluss
3. Stil: {style}
4. Berücksichtige auch ungewöhnliche Eingaben intelligent (z. B. „Geld“ als Motivation professionell umformulieren)
5. Das Schreiben soll authentisch und überzeugend wirken
6. Verwende deutsche Geschäftsbriefkonventionen
7. Füge realistische Details hinzu, wenn nötig

Erstelle NUR das Bewerbungsschreiben, keine zusätzlichen Kommentare.
"""

    try:
        genai.configure(api_key=os.environ["GOOGLE_API_KEY"])
        model = genai.GenerativeModel("gemini-pro")
        response = model.generate_content(prompt)
        return response.text.strip()
        
    except Exception as e:
        logging.error(f"Application generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating application: {str(e)}")

@api_router.post("/generate-application", response_model=ApplicationResponse)
async def generate_application(request: ApplicationRequest):
    """Generate a professional German job application"""
    
    if not request.gdpr_consent:
        raise HTTPException(status_code=400, detail="GDPR consent is required")
    
    try:
        # Generate the application text using AI
        bewerbungstext = await generate_application_with_google_gemini(request)
        
        # Create response object
        application_response = ApplicationResponse(
            id=str(uuid.uuid4()),
            bewerbungstext=bewerbungstext,
            created_at=datetime.utcnow()
        )
        
        # Optional: Save to database
        application_dict = application_response.dict()
        application_dict.update({
            "personal_data": request.personal.dict(),
            "qualifications": request.qualifications.dict(),
            "company_data": request.company.dict(),
            "stil": request.stil
        })
        await db.applications.insert_one(application_dict)
        
        return application_response
        
    except Exception as e:
        logging.error(f"Application generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["https://bewerbungsagent0.onrender.com"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
