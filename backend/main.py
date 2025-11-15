from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select, func
from contextlib import asynccontextmanager
from typing import List, Optional
import os
import random
from database import init_db, close_db, get_db
from models import Base, TrainConfiguration, UserResponse
from schemas import (
    TrainConfigurationCreate,
    TrainConfigurationResponse,
    UserResponseCreate,
    UserResponseResponse,
    ResponseStatistics
)

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


# Train Configuration Endpoints

@app.post("/train-configurations", response_model=TrainConfigurationResponse, status_code=status.HTTP_201_CREATED)
async def create_train_configuration(
    config: TrainConfigurationCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new train configuration.
    """
    # Validate that tiles match the specified dimensions
    if len(config.tiles) != config.height:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Number of rows in tiles ({len(config.tiles)}) does not match height ({config.height})"
        )
    
    for i, row in enumerate(config.tiles):
        if len(row) != config.width:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Row {i} has {len(row)} columns, expected {config.width}"
            )
    
    # Convert tiles to JSON-serializable format
    tiles_json = [[tile.model_dump() for tile in row] for row in config.tiles]
    
    db_config = TrainConfiguration(
        name=config.name,
        height=config.height,
        width=config.width,
        tiles=tiles_json
    )
    
    db.add(db_config)
    await db.commit()
    await db.refresh(db_config)
    
    return db_config


@app.get("/train-configurations", response_model=List[TrainConfigurationResponse])
async def list_train_configurations(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """
    List all train configurations with pagination.
    """
    result = await db.execute(
        select(TrainConfiguration)
        .order_by(TrainConfiguration.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    configurations = result.scalars().all()
    return configurations


@app.get("/train-configurations/random", response_model=TrainConfigurationResponse)
async def get_random_train_configuration(
    db: AsyncSession = Depends(get_db)
):
    """
    Get a random train configuration.
    """
    # First, get the count of configurations
    count_result = await db.execute(
        select(func.count(TrainConfiguration.id))
    )
    count = count_result.scalar_one()
    
    if count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No train configurations found"
        )
    
    # Get a random offset
    random_offset = random.randint(0, count - 1)
    
    # Fetch the configuration at that offset
    result = await db.execute(
        select(TrainConfiguration)
        .offset(random_offset)
        .limit(1)
    )
    config = result.scalar_one_or_none()
    
    if config is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Failed to retrieve random train configuration"
        )
    
    return config


@app.get("/train-configurations/{config_id}", response_model=TrainConfigurationResponse)
async def get_train_configuration(
    config_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific train configuration by ID.
    """
    result = await db.execute(
        select(TrainConfiguration).where(TrainConfiguration.id == config_id)
    )
    config = result.scalar_one_or_none()
    
    if config is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Train configuration with id {config_id} not found"
        )
    
    return config


# User Response Endpoints

@app.post("/user-responses", response_model=UserResponseResponse, status_code=status.HTTP_201_CREATED)
async def create_user_response(
    response: UserResponseCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Submit a user response (where they chose to sit or stand).
    """
    # Verify that the train configuration exists
    config_result = await db.execute(
        select(TrainConfiguration).where(TrainConfiguration.id == response.train_configuration_id)
    )
    config = config_result.scalar_one_or_none()
    
    if config is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Train configuration with id {response.train_configuration_id} not found"
        )
    
    # Validate that row and col are within bounds
    if response.row >= config.height or response.col >= config.width:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Position ({response.row}, {response.col}) is out of bounds for grid size {config.height}x{config.width}"
        )
    
    db_response = UserResponse(
        train_configuration_id=response.train_configuration_id,
        row=response.row,
        col=response.col,
        selection_type=response.selection_type,
        user_session_id=response.user_session_id,
        user_id=response.user_id,
        gender=response.gender
    )
    
    db.add(db_response)
    await db.commit()
    await db.refresh(db_response)
    
    return db_response


@app.get("/user-responses", response_model=List[UserResponseResponse])
async def list_user_responses(
    train_configuration_id: Optional[int] = None,
    user_session_id: Optional[str] = None,
    user_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """
    List user responses with optional filtering.
    """
    query = select(UserResponse)
    
    if train_configuration_id is not None:
        query = query.where(UserResponse.train_configuration_id == train_configuration_id)
    if user_session_id is not None:
        query = query.where(UserResponse.user_session_id == user_session_id)
    if user_id is not None:
        query = query.where(UserResponse.user_id == user_id)
    
    query = query.order_by(UserResponse.created_at.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    responses = result.scalars().all()
    return responses


@app.get("/user-responses/{response_id}", response_model=UserResponseResponse)
async def get_user_response(
    response_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific user response by ID.
    """
    result = await db.execute(
        select(UserResponse).where(UserResponse.id == response_id)
    )
    response = result.scalar_one_or_none()
    
    if response is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User response with id {response_id} not found"
        )
    
    return response


@app.get("/train-configurations/{config_id}/statistics", response_model=ResponseStatistics)
async def get_response_statistics(
    config_id: int,
    gender: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Get aggregated statistics for responses to a specific train configuration.
    Optionally filter by gender ('man', 'woman', 'neutral').
    """
    # Verify that the train configuration exists
    config_result = await db.execute(
        select(TrainConfiguration).where(TrainConfiguration.id == config_id)
    )
    config = config_result.scalar_one_or_none()
    
    if config is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Train configuration with id {config_id} not found"
        )
    
    # Get all responses for this configuration, optionally filtered by gender
    query = select(UserResponse).where(UserResponse.train_configuration_id == config_id)
    if gender:
        query = query.where(UserResponse.gender == gender)
    
    result = await db.execute(query)
    responses = result.scalars().all()
    
    # Calculate statistics
    total_responses = len(responses)
    seat_selections = sum(1 for r in responses if r.selection_type == "seat")
    floor_selections = sum(1 for r in responses if r.selection_type == "floor")
    
    # Build heatmap (position -> count)
    heatmap = {}
    for response in responses:
        key = f"{response.row},{response.col}"
        heatmap[key] = heatmap.get(key, 0) + 1
    
    return ResponseStatistics(
        train_configuration_id=config_id,
        total_responses=total_responses,
        seat_selections=seat_selections,
        floor_selections=floor_selections,
        selection_heatmap=heatmap
    )

