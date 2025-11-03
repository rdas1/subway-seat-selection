from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from contextlib import asynccontextmanager
import os
from database import init_db, close_db, get_db
from models import Base

# Lifespan context manager for startup/shutdown events
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    yield
    # Shutdown
    await close_db()

app = FastAPI(
    title="Subway Seat Selection API",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS - support multiple origins from environment variable
# Default includes both development (Vite) and production (nginx) ports
cors_origins_env = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:80,http://localhost")
cors_origins = [origin.strip() for origin in cors_origins_env.split(",")]
if "*" in cors_origins:
    cors_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "Welcome to Subway Seat Selection API"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/db-test")
async def db_test(db: AsyncSession = Depends(get_db)):
    """
    Test endpoint to verify database connection.
    """
    try:
        # Simple query to test connection
        result = await db.execute(text("SELECT 1"))
        row = result.scalar_one()
        return {"status": "connected", "message": "Database connection successful", "test_value": row}
    except Exception as e:
        return {"status": "error", "message": str(e)}

