from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
import secrets

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', secrets.token_urlsafe(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# API Key for ESP32
API_KEY = os.environ.get('ESP32_API_KEY', 'default_esp32_key_change_me')

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    full_name: str
    role: str  # Operator, Engineer, Manager
    hashed_password: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

class LatestTemperature(BaseModel):
    model_config = ConfigDict(extra="ignore")
    machine_type: str
    temperature: float
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class IngestTemperature(BaseModel):
    api_key: str
    machine_type: str
    temperature: float

class PredictionRequest(BaseModel):
    machine_type: str
    running_hours: float
    feeding_rate: float
    temperature: Optional[float] = None
    vibration: float
    maintenance_date: str

class Prediction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    machine_type: str
    running_hours: float
    feeding_rate: float
    temperature: float
    vibration: float
    maintenance_date: str
    prediction_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    risk_score: float
    condition_level: str
    explanation: str
    alerts: List[str]

class Config(BaseModel):
    model_config = ConfigDict(extra="ignore")
    sensor_mode: str = "prototype_low_temp"  # or shopfloor_high_temp
    thresholds: dict
    api_key: str

# ==================== UTILITY FUNCTIONS ====================

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# ==================== DEFAULT THRESHOLDS ====================

DEFAULT_THRESHOLDS = {
    "prototype_low_temp": {
        "temperature": {"green": 40, "yellow": 45, "red": 120},
    },
    "shopfloor_high_temp": {
        "CNC": {"green": 75, "yellow": 95, "red": 120},
        "EDM": {"green": 70, "yellow": 90, "red": 120},
        "Lathe": {"green": 70, "yellow": 90, "red": 120},
        "Grinding": {"green": 65, "yellow": 85, "red": 120}
    },
    "vibration": {
        "CNC": {"green": 70, "yellow": 100},
        "EDM": {"green": 60, "yellow": 90},
        "Lathe": {"green": 70, "yellow": 100},
        "Grinding": {"green": 50, "yellow": 80}
    },
    "feed_rate": {
        "CNC": {"green": 1500, "yellow": 2000},
        "EDM": {"green": 500, "yellow": 700},
        "Lathe": {"green": 900, "yellow": 1200},
        "Grinding": {"green": 400, "yellow": 600}
    },
    "running_hours": {
        "CNC": {"green": 10000, "yellow": 12000},
        "EDM": {"green": 9000, "yellow": 11000},
        "Lathe": {"green": 11000, "yellow": 13000},
        "Grinding": {"green": 8000, "yellow": 10000}
    }
}

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserRegister):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate role
    if user_data.role not in ["Operator", "Engineer", "Manager"]:
        raise HTTPException(status_code=400, detail="Invalid role. Must be Operator, Engineer, or Manager")
    
    # Create user
    user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        role=user_data.role,
        hashed_password=get_password_hash(user_data.password)
    )
    
    doc = user.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.users.insert_one(doc)
    
    # Create token
    access_token = create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user={
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role
        }
    )

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user['hashed_password']):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_access_token(
        data={"sub": user['email']},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user={
            "id": user['id'],
            "email": user['email'],
            "full_name": user['full_name'],
            "role": user['role']
        }
    )

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user['id'],
        "email": current_user['email'],
        "full_name": current_user['full_name'],
        "role": current_user['role']
    }

# ==================== TEMPERATURE INGESTION (ESP32) ====================

@api_router.post("/ingest-temperature")
async def ingest_temperature(data: IngestTemperature):
    # Validate API key
    if data.api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    # Validate machine type
    if data.machine_type not in ["CNC", "EDM", "Lathe", "Grinding"]:
        raise HTTPException(status_code=400, detail="Invalid machine type")
    
    # Update or insert latest temperature
    temp_data = LatestTemperature(
        machine_type=data.machine_type,
        temperature=data.temperature
    )
    
    doc = temp_data.model_dump()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.latest_temperature.update_one(
        {"machine_type": data.machine_type},
        {"$set": doc},
        upsert=True
    )
    
    return {
        "ok": True,
        "machine_type": data.machine_type,
        "temperature": data.temperature,
        "updated_at": doc['updated_at']
    }

@api_router.get("/latest-temperature")
async def get_latest_temperature(machine_type: str, current_user: dict = Depends(get_current_user)):
    temp = await db.latest_temperature.find_one({"machine_type": machine_type}, {"_id": 0})
    if not temp:
        return {"machine_type": machine_type, "temperature": None, "updated_at": None}
    return temp

# ==================== PREDICTION ENGINE ====================

def calculate_subscore(value: float, green_threshold: float, yellow_threshold: float, red_threshold: float = None) -> float:
    """Calculate subscore (0-100) based on thresholds"""
    if value <= green_threshold:
        return (value / green_threshold) * 30
    elif value <= yellow_threshold:
        range_size = yellow_threshold - green_threshold
        position = value - green_threshold
        return 30 + (position / range_size) * 40
    else:
        if red_threshold:
            range_size = red_threshold - yellow_threshold
            position = min(value - yellow_threshold, range_size)
            return 70 + (position / range_size) * 30
        else:
            # No red threshold, scale beyond yellow
            overshoot = value - yellow_threshold
            return min(70 + (overshoot / yellow_threshold) * 30, 100)

@api_router.post("/predict")
async def predict(request: PredictionRequest, current_user: dict = Depends(get_current_user)):
    # Get config
    config = await db.config.find_one({}, {"_id": 0})
    if not config:
        # Create default config
        config = {
            "sensor_mode": "prototype_low_temp",
            "thresholds": DEFAULT_THRESHOLDS,
            "api_key": API_KEY
        }
        await db.config.insert_one(config)
    
    sensor_mode = config.get('sensor_mode', 'prototype_low_temp')
    thresholds = config.get('thresholds', DEFAULT_THRESHOLDS)
    
    # Get temperature if not provided
    temperature = request.temperature
    if temperature is None:
        temp_data = await db.latest_temperature.find_one({"machine_type": request.machine_type}, {"_id": 0})
        if not temp_data:
            raise HTTPException(status_code=400, detail=f"No temperature data available for {request.machine_type}. Please provide temperature manually or ensure ESP32 is sending data.")
        temperature = temp_data['temperature']
    
    # Get thresholds for this machine
    machine = request.machine_type
    
    # Temperature thresholds based on sensor mode
    if sensor_mode == "prototype_low_temp":
        temp_thresholds = thresholds['prototype_low_temp']['temperature']
    else:
        temp_thresholds = thresholds['shopfloor_high_temp'][machine]
    
    vib_thresholds = thresholds['vibration'][machine]
    feed_thresholds = thresholds['feed_rate'][machine]
    hours_thresholds = thresholds['running_hours'][machine]
    
    # Calculate subscores
    temp_subscore = calculate_subscore(
        temperature,
        temp_thresholds['green'],
        temp_thresholds['yellow'],
        temp_thresholds.get('red', 120)
    )
    
    vib_subscore = calculate_subscore(
        request.vibration,
        vib_thresholds['green'],
        vib_thresholds['yellow']
    )
    
    feed_subscore = calculate_subscore(
        request.feeding_rate,
        feed_thresholds['green'],
        feed_thresholds['yellow']
    )
    
    hours_subscore = calculate_subscore(
        request.running_hours,
        hours_thresholds['green'],
        hours_thresholds['yellow']
    )
    
    # Weights
    weights = {'temperature': 0.35, 'vibration': 0.35, 'feed_rate': 0.15, 'running_hours': 0.15}
    
    # Calculate risk score
    risk_score = (
        weights['temperature'] * temp_subscore +
        weights['vibration'] * vib_subscore +
        weights['feed_rate'] * feed_subscore +
        weights['running_hours'] * hours_subscore
    )
    
    # Determine condition level
    alerts = []
    explanation_parts = []
    
    # Check each metric
    if temperature > temp_thresholds.get('red', 120):
        condition_level = "Critical"
        alerts.append("CRITICAL: Temperature exceeds safe limits")
        explanation_parts.append(f"Temperature {temperature}°C is in RED zone (>{temp_thresholds.get('red', 120)}°C)")
    elif temperature > temp_thresholds['yellow']:
        alerts.append("Temperature approaching limits")
        explanation_parts.append(f"Temperature {temperature}°C is in YELLOW zone (>{temp_thresholds['yellow']}°C)")
    else:
        explanation_parts.append(f"Temperature {temperature}°C is in GREEN zone (<={temp_thresholds['green']}°C)")
    
    if request.vibration > vib_thresholds['yellow']:
        alerts.append("Vibration exceeds normal range")
        explanation_parts.append(f"Vibration {request.vibration} µm is in RED zone (>{vib_thresholds['yellow']} µm)")
    elif request.vibration > vib_thresholds['green']:
        alerts.append("Vibration caution")
        explanation_parts.append(f"Vibration {request.vibration} µm is in YELLOW zone (>{vib_thresholds['green']} µm)")
    else:
        explanation_parts.append(f"Vibration {request.vibration} µm is in GREEN zone (<={vib_thresholds['green']} µm)")
    
    if request.feeding_rate > feed_thresholds['yellow']:
        alerts.append("Feed rate too high")
        explanation_parts.append(f"Feed rate {request.feeding_rate} mm/min is in RED zone (>{feed_thresholds['yellow']} mm/min)")
    elif request.feeding_rate > feed_thresholds['green']:
        alerts.append("Feed rate elevated")
        explanation_parts.append(f"Feed rate {request.feeding_rate} mm/min is in YELLOW zone (>{feed_thresholds['green']} mm/min)")
    else:
        explanation_parts.append(f"Feed rate {request.feeding_rate} mm/min is in GREEN zone (<={feed_thresholds['green']} mm/min)")
    
    if request.running_hours > hours_thresholds['yellow']:
        alerts.append("Service window exceeded")
        explanation_parts.append(f"Running hours {request.running_hours} h is in RED zone (>{hours_thresholds['yellow']} h)")
    elif request.running_hours > hours_thresholds['green']:
        alerts.append("Service window approaching")
        explanation_parts.append(f"Running hours {request.running_hours} h is in YELLOW zone (>{hours_thresholds['green']} h)")
    else:
        explanation_parts.append(f"Running hours {request.running_hours} h is in GREEN zone (<={hours_thresholds['green']} h)")
    
    # Determine condition level
    has_red = (
        temperature > temp_thresholds.get('red', 120) or
        request.vibration > vib_thresholds['yellow'] or
        request.feeding_rate > feed_thresholds['yellow'] or
        request.running_hours > hours_thresholds['yellow']
    )
    
    has_yellow = (
        temperature > temp_thresholds['yellow'] or
        request.vibration > vib_thresholds['green'] or
        request.feeding_rate > feed_thresholds['green'] or
        request.running_hours > hours_thresholds['green']
    )
    
    if has_red or risk_score >= 70:
        condition_level = "Critical"
        if not alerts:
            alerts.append("Immediate repair recommended")
    elif has_yellow or risk_score >= 35:
        condition_level = "Medium"
        if not alerts:
            alerts.append("Schedule inspection")
    else:
        condition_level = "Good"
        alerts = ["All metrics within safe bands"]
    
    explanation = ". ".join(explanation_parts) + "."
    
    # Save prediction
    prediction = Prediction(
        machine_type=request.machine_type,
        running_hours=request.running_hours,
        feeding_rate=request.feeding_rate,
        temperature=temperature,
        vibration=request.vibration,
        maintenance_date=request.maintenance_date,
        risk_score=round(risk_score, 2),
        condition_level=condition_level,
        explanation=explanation,
        alerts=alerts
    )
    
    doc = prediction.model_dump()
    doc['prediction_date'] = doc['prediction_date'].isoformat()
    await db.predictions.insert_one(doc)
    
    return {
        "condition_level": condition_level,
        "risk_score": round(risk_score, 2),
        "explanation": explanation,
        "alerts": alerts,
        "thresholds_used": {
            "sensor_mode": sensor_mode,
            "temperature": temp_thresholds,
            "vibration": vib_thresholds,
            "feed_rate": feed_thresholds,
            "running_hours": hours_thresholds
        }
    }

# ==================== HISTORY ====================

@api_router.get("/history")
async def get_history(
    machine_type: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if machine_type:
        query['machine_type'] = machine_type
    if from_date:
        query['prediction_date'] = {"$gte": from_date}
    if to_date:
        if 'prediction_date' in query:
            query['prediction_date']['$lte'] = to_date
        else:
            query['prediction_date'] = {"$lte": to_date}
    
    predictions = await db.predictions.find(query, {"_id": 0}).sort("prediction_date", -1).skip(offset).limit(limit).to_list(limit)
    return predictions

# ==================== CONFIG ====================

@api_router.get("/config")
async def get_config(current_user: dict = Depends(get_current_user)):
    config = await db.config.find_one({}, {"_id": 0})
    if not config:
        config = {
            "sensor_mode": "prototype_low_temp",
            "thresholds": DEFAULT_THRESHOLDS,
            "api_key": API_KEY
        }
    return config

@api_router.post("/config")
async def update_config(config_data: dict, current_user: dict = Depends(get_current_user)):
    # Only managers can update config
    if current_user['role'] != "Manager":
        raise HTTPException(status_code=403, detail="Only managers can update configuration")
    
    await db.config.update_one({}, {"$set": config_data}, upsert=True)
    return {"ok": True, "message": "Configuration updated successfully"}

# ==================== INCLUDE ROUTER ====================

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
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
