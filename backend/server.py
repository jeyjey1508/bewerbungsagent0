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

# AI-powered application generation
async def generate_application_with_openrouter(request: ApplicationRequest) -> str:
    """Generate a professional German job application using OpenRouter API"""
    
    # Create a comprehensive German prompt based on the style
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
4. Berücksichtige auch ungewöhnliche Eingaben intelligent (z.B. wenn jemand "Geld" als Motivation angibt, formuliere das professioneller um)
5. Das Schreiben soll authentisch und überzeugend wirken
6. Verwende deutsche Geschäftsbriefkonventionen
7. Füge realistische Details hinzu, wenn nötig

Erstelle NUR das Bewerbungsschreiben, keine zusätzlichen Kommentare.
"""

    try:
        openrouter_api_key = os.environ.get('OPENROUTER_API_KEY')
        print("DEBUG: OPENROUTER_API_KEY =", openrouter_api_key)
        if not openrouter_api_key:
            raise HTTPException(status_code=500, detail="OpenRouter API key not configured")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {openrouter_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "mistralai/mixtral-8x7b-instruct",
                    "messages": [
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "max_tokens": 2000,
                    "temperature": 0.7
                },
                timeout=30.0
            )
            
            response.raise_for_status()
            result = response.json()
            
            if 'choices' in result and len(result['choices']) > 0:
                return result['choices'][0]['message']['content']
            else:
                raise HTTPException(status_code=500, detail="Invalid response from OpenRouter API")
                
    except httpx.HTTPError as e:
        logging.error(f"OpenRouter API error: {e}")
        raise HTTPException(status_code=500, detail=f"Error calling OpenRouter API: {str(e)}")
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
        bewerbungstext = await generate_application_with_openrouter(request)
        
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
