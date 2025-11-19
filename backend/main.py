from fastapi import FastAPI, Depends, HTTPException, status, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select, func, and_
from sqlalchemy.orm import selectinload
from contextlib import asynccontextmanager
from typing import List, Optional
from datetime import datetime, timedelta
import os
import random
from database import init_db, close_db, get_db
from models import Base, TrainConfiguration, UserResponse, ScenarioGroup, ScenarioGroupItem, User, EmailVerification, ScenarioGroupEditor, Study
from schemas import (
    TrainConfigurationCreate,
    TrainConfigurationResponse,
    UserResponseCreate,
    UserResponseResponse,
    ResponseStatistics,
    ScenarioGroupCreate,
    ScenarioGroupUpdate,
    ScenarioGroupResponse,
    ScenarioGroupItemCreate,
    ScenarioGroupItemResponse,
    SendVerificationRequest,
    VerifyTokenRequest,
    UserResponse as UserResponseSchema,
    AuthResponse,
    ScenarioGroupEditorResponse,
    StudyCreate,
    StudyUpdate,
    StudyResponse
)
from services.email import send_verification_email
from utils.auth import create_access_token, generate_verification_token, generate_verification_code
from middleware.auth import get_current_user, get_optional_user

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
        title=config.title,
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


@app.put("/train-configurations/{config_id}", response_model=TrainConfigurationResponse)
async def update_train_configuration(
    config_id: int,
    config: TrainConfigurationCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update an existing train configuration.
    """
    # Get the existing configuration
    result = await db.execute(
        select(TrainConfiguration).where(TrainConfiguration.id == config_id)
    )
    db_config = result.scalar_one_or_none()
    
    if db_config is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Train configuration with id {config_id} not found"
        )
    
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
    
    # Update the configuration
    db_config.name = config.name
    db_config.title = config.title
    db_config.height = config.height
    db_config.width = config.width
    db_config.tiles = tiles_json
    
    await db.commit()
    await db.refresh(db_config)
    
    return db_config


# User Response Endpoints

@app.post("/user-responses", response_model=UserResponseResponse, status_code=status.HTTP_201_CREATED)
async def create_user_response(
    response: UserResponseCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Submit a user response (where they chose to sit or stand).
    If a response already exists for this session and scenario, it will be updated instead of creating a new one.
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
    
    # Check if a response already exists for this session and scenario
    existing_response = None
    if response.user_session_id:
        existing_result = await db.execute(
            select(UserResponse).where(
                UserResponse.train_configuration_id == response.train_configuration_id,
                UserResponse.user_session_id == response.user_session_id
            )
        )
        existing_response = existing_result.scalar_one_or_none()
    
    if existing_response:
        # Update existing response
        existing_response.row = response.row
        existing_response.col = response.col
        existing_response.selection_type = response.selection_type
        existing_response.gender = response.gender
        # Note: user_id can be updated if provided, but typically session_id is the identifier
        
        await db.commit()
        await db.refresh(existing_response)
        return existing_response
    else:
        # Create new response
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


# Authentication Endpoints

@app.post("/auth/send-verification", status_code=status.HTTP_200_OK)
async def send_verification(
    request: SendVerificationRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Send verification email with magic link and/or token code.
    """
    email = request.email.lower().strip()
    verification_type = request.verification_type
    
    # Generate verification token and/or code
    token = None
    code = None
    
    if verification_type in ("magic_link", "both"):
        token = generate_verification_token()
    
    if verification_type in ("token", "both"):
        code = generate_verification_code()
    
    # Create expiration time (30 minutes)
    expires_at = datetime.utcnow() + timedelta(minutes=30)
    
    # Create email verification record
    email_verification = EmailVerification(
        email=email,
        token=token,
        verification_code=code,
        expires_at=expires_at,
        verification_type=verification_type
    )
    
    db.add(email_verification)
    await db.commit()
    
    # Send email
    try:
        await send_verification_email(email, verification_type, token, code)
    except Exception as e:
        # If email fails, we still created the record, but log the error
        print(f"Failed to send verification email: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification email"
        )
    
    return {"message": "Verification email sent successfully"}


@app.get("/auth/verify-link", response_model=AuthResponse)
async def verify_link(
    token: str = Query(..., description="Verification token from magic link"),
    db: AsyncSession = Depends(get_db),
    response: Response = Response()
):
    """
    Verify magic link token and create/update user session.
    """
    # Find verification record
    result = await db.execute(
        select(EmailVerification).where(
            and_(
                EmailVerification.token == token,
                EmailVerification.expires_at > datetime.utcnow(),
                EmailVerification.used_at.is_(None)
            )
        )
    )
    verification = result.scalar_one_or_none()
    
    if not verification:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token"
        )
    
    # Mark as used
    verification.used_at = datetime.utcnow()
    
    # Get or create user
    user_result = await db.execute(
        select(User).where(User.email == verification.email)
    )
    user = user_result.scalar_one_or_none()
    
    if not user:
        # Create new user
        user = User(email=verification.email)
        db.add(user)
        await db.flush()
    
    await db.commit()
    
    # Create JWT token
    access_token = create_access_token(user.id, user.email)
    
    # Set session cookie
    response.set_cookie(
        key="session_token",
        value=access_token,
        httponly=True,
        secure=os.getenv("ENVIRONMENT") == "production",  # HTTPS only in production
        samesite="lax",
        max_age=30 * 60  # 30 minutes
    )
    
    return AuthResponse(
        user=UserResponseSchema(id=user.id, email=user.email, created_at=user.created_at),
        message="Authentication successful"
    )


@app.post("/auth/verify-token", response_model=AuthResponse)
async def verify_token(
    request: VerifyTokenRequest,
    db: AsyncSession = Depends(get_db),
    response: Response = Response()
):
    """
    Verify token code and create/update user session.
    """
    email = request.email.lower().strip()
    code = request.verification_code.strip()
    
    # Find verification record
    result = await db.execute(
        select(EmailVerification).where(
            and_(
                EmailVerification.email == email,
                EmailVerification.verification_code == code,
                EmailVerification.expires_at > datetime.utcnow(),
                EmailVerification.used_at.is_(None)
            )
        )
    )
    verification = result.scalar_one_or_none()
    
    if not verification:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code"
        )
    
    # Mark as used
    verification.used_at = datetime.utcnow()
    
    # Get or create user
    user_result = await db.execute(
        select(User).where(User.email == email)
    )
    user = user_result.scalar_one_or_none()
    
    if not user:
        # Create new user
        user = User(email=email)
        db.add(user)
        await db.flush()
    
    await db.commit()
    
    # Create JWT token
    access_token = create_access_token(user.id, user.email)
    
    # Set session cookie
    response.set_cookie(
        key="session_token",
        value=access_token,
        httponly=True,
        secure=os.getenv("ENVIRONMENT") == "production",
        samesite="lax",
        max_age=30 * 60  # 30 minutes
    )
    
    return AuthResponse(
        user=UserResponseSchema(id=user.id, email=user.email, created_at=user.created_at),
        message="Authentication successful"
    )


@app.post("/auth/logout", status_code=status.HTTP_200_OK)
async def logout(response: Response):
    """
    Logout user by clearing session cookie.
    """
    response.delete_cookie(key="session_token")
    return {"message": "Logged out successfully"}


@app.get("/auth/me", response_model=UserResponseSchema)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """
    Get current authenticated user information.
    """
    return UserResponseSchema(
        id=current_user.id,
        email=current_user.email,
        created_at=current_user.created_at
    )


# Scenario Group Endpoints

@app.post("/scenario-groups", response_model=ScenarioGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_scenario_group(
    group: ScenarioGroupCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new scenario group with optional initial items.
    Requires authentication.
    """
    # Create the scenario group
    db_group = ScenarioGroup(
        created_by_user_id=current_user.id
    )
    db.add(db_group)
    await db.flush()  # Flush to get the ID
    
    # Add initial items if provided
    if group.items:
        # Validate that all train configurations exist
        for item in group.items:
            config_result = await db.execute(
                select(TrainConfiguration).where(TrainConfiguration.id == item.train_configuration_id)
            )
            config = config_result.scalar_one_or_none()
            if config is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Train configuration with id {item.train_configuration_id} not found"
                )
        
        # Create items
        for item in group.items:
            db_item = ScenarioGroupItem(
                scenario_group_id=db_group.id,
                train_configuration_id=item.train_configuration_id,
                order=item.order
            )
            db.add(db_item)
    
    await db.commit()
    
    # Reload with relationships
    result = await db.execute(
        select(ScenarioGroup)
        .where(ScenarioGroup.id == db_group.id)
        .options(selectinload(ScenarioGroup.items).selectinload(ScenarioGroupItem.train_configuration))
    )
    db_group = result.scalar_one()
    
    return db_group


@app.get("/scenario-groups", response_model=List[ScenarioGroupResponse])
async def list_scenario_groups(
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """
    List scenario groups that the current user created or has edit access to.
    Requires authentication.
    """
    from models import ScenarioGroupEditor
    
    # Get scenario groups where user is creator or editor
    query = select(ScenarioGroup).where(
        (ScenarioGroup.created_by_user_id == current_user.id) |
        (ScenarioGroup.id.in_(
            select(ScenarioGroupEditor.scenario_group_id).where(
                ScenarioGroupEditor.user_id == current_user.id
            )
        ))
    )
    
    query = query.order_by(ScenarioGroup.created_at.desc()).offset(skip).limit(limit)
    query = query.options(selectinload(ScenarioGroup.items).selectinload(ScenarioGroupItem.train_configuration))
    
    result = await db.execute(query)
    groups = result.scalars().all()
    
    return groups


@app.get("/scenario-groups/{group_id}", response_model=ScenarioGroupResponse)
async def get_scenario_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific scenario group by ID.
    Requires authentication and user must be creator or editor.
    """
    from models import ScenarioGroupEditor
    
    result = await db.execute(
        select(ScenarioGroup)
        .where(ScenarioGroup.id == group_id)
        .options(selectinload(ScenarioGroup.items).selectinload(ScenarioGroupItem.train_configuration))
    )
    group = result.scalar_one_or_none()
    
    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario group with id {group_id} not found"
        )
    
    # Check if user is creator or editor
    is_creator = group.created_by_user_id == current_user.id
    editor_result = await db.execute(
        select(ScenarioGroupEditor).where(
            and_(
                ScenarioGroupEditor.scenario_group_id == group_id,
                ScenarioGroupEditor.user_id == current_user.id
            )
        )
    )
    is_editor = editor_result.scalar_one_or_none() is not None
    
    if not (is_creator or is_editor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this scenario group"
        )
    
    return group


@app.put("/scenario-groups/{group_id}", response_model=ScenarioGroupResponse)
async def update_scenario_group(
    group_id: int,
    group_update: ScenarioGroupUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a scenario group.
    Requires authentication and user must be creator or editor.
    """
    from models import ScenarioGroupEditor
    
    result = await db.execute(
        select(ScenarioGroup).where(ScenarioGroup.id == group_id)
    )
    group = result.scalar_one_or_none()
    
    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario group with id {group_id} not found"
        )
    
    # Check if user is creator or editor
    is_creator = group.created_by_user_id == current_user.id
    editor_result = await db.execute(
        select(ScenarioGroupEditor).where(
            and_(
                ScenarioGroupEditor.scenario_group_id == group_id,
                ScenarioGroupEditor.user_id == current_user.id
            )
        )
    )
    is_editor = editor_result.scalar_one_or_none() is not None
    
    if not (is_creator or is_editor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to update this scenario group"
        )
    
    # ScenarioGroupUpdate currently has no fields, but keeping structure for future
    await db.commit()
    
    # Reload with relationships
    result = await db.execute(
        select(ScenarioGroup)
        .where(ScenarioGroup.id == group_id)
        .options(selectinload(ScenarioGroup.items).selectinload(ScenarioGroupItem.train_configuration))
    )
    group = result.scalar_one()
    
    return group


@app.delete("/scenario-groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scenario_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a scenario group and all its items.
    Requires authentication and user must be creator (only creator can delete).
    """
    result = await db.execute(
        select(ScenarioGroup).where(ScenarioGroup.id == group_id)
    )
    group = result.scalar_one_or_none()
    
    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario group with id {group_id} not found"
        )
    
    # Only creator can delete
    if group.created_by_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the creator can delete a scenario group"
        )
    
    await db.delete(group)
    await db.commit()
    
    return None


# Scenario Group Editor Management Endpoints

@app.post("/scenario-groups/{group_id}/editors", response_model=ScenarioGroupEditorResponse, status_code=status.HTTP_201_CREATED)
async def add_scenario_group_editor(
    group_id: int,
    user_id: int = Query(..., description="User ID to add as editor"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Add an editor to a scenario group.
    Requires authentication and user must be creator.
    """
    from models import ScenarioGroupEditor
    
    # Verify group exists
    group_result = await db.execute(
        select(ScenarioGroup).where(ScenarioGroup.id == group_id)
    )
    group = group_result.scalar_one_or_none()
    
    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario group with id {group_id} not found"
        )
    
    # Only creator can add editors
    if group.created_by_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the creator can add editors to a scenario group"
        )
    
    # Verify user exists
    user_result = await db.execute(
        select(User).where(User.id == user_id)
    )
    editor_user = user_result.scalar_one_or_none()
    
    if editor_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found"
        )
    
    # Check if already an editor
    existing_result = await db.execute(
        select(ScenarioGroupEditor).where(
            and_(
                ScenarioGroupEditor.scenario_group_id == group_id,
                ScenarioGroupEditor.user_id == user_id
            )
        )
    )
    existing = existing_result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already an editor of this scenario group"
        )
    
    # Create editor relationship
    editor = ScenarioGroupEditor(
        scenario_group_id=group_id,
        user_id=user_id
    )
    db.add(editor)
    await db.commit()
    await db.refresh(editor)
    await db.refresh(editor, ["user"])
    
    return editor


@app.delete("/scenario-groups/{group_id}/editors/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_scenario_group_editor(
    group_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Remove an editor from a scenario group.
    Requires authentication and user must be creator.
    """
    from models import ScenarioGroupEditor
    
    # Verify group exists
    group_result = await db.execute(
        select(ScenarioGroup).where(ScenarioGroup.id == group_id)
    )
    group = group_result.scalar_one_or_none()
    
    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario group with id {group_id} not found"
        )
    
    # Only creator can remove editors
    if group.created_by_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the creator can remove editors from a scenario group"
        )
    
    # Find editor relationship
    editor_result = await db.execute(
        select(ScenarioGroupEditor).where(
            and_(
                ScenarioGroupEditor.scenario_group_id == group_id,
                ScenarioGroupEditor.user_id == user_id
            )
        )
    )
    editor = editor_result.scalar_one_or_none()
    
    if editor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} is not an editor of scenario group {group_id}"
        )
    
    await db.delete(editor)
    await db.commit()
    
    return None


@app.get("/scenario-groups/{group_id}/editors", response_model=List[ScenarioGroupEditorResponse])
async def list_scenario_group_editors(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all editors of a scenario group.
    Requires authentication and user must be creator or editor.
    """
    from models import ScenarioGroupEditor
    
    # Verify group exists
    group_result = await db.execute(
        select(ScenarioGroup).where(ScenarioGroup.id == group_id)
    )
    group = group_result.scalar_one_or_none()
    
    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario group with id {group_id} not found"
        )
    
    # Check if user is creator or editor
    is_creator = group.created_by_user_id == current_user.id
    editor_result = await db.execute(
        select(ScenarioGroupEditor).where(
            and_(
                ScenarioGroupEditor.scenario_group_id == group_id,
                ScenarioGroupEditor.user_id == current_user.id
            )
        )
    )
    is_editor = editor_result.scalar_one_or_none() is not None
    
    if not (is_creator or is_editor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to view editors of this scenario group"
        )
    
    # Get all editors
    editors_result = await db.execute(
        select(ScenarioGroupEditor)
        .where(ScenarioGroupEditor.scenario_group_id == group_id)
        .options(selectinload(ScenarioGroupEditor.user))
    )
    editors = editors_result.scalars().all()
    
    return editors


@app.post("/scenario-groups/{group_id}/items", response_model=ScenarioGroupItemResponse, status_code=status.HTTP_201_CREATED)
async def add_scenario_group_item(
    group_id: int,
    item: ScenarioGroupItemCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Add an item to a scenario group.
    Requires authentication and user must be creator or editor.
    """
    from models import ScenarioGroupEditor
    
    # Verify group exists
    group_result = await db.execute(
        select(ScenarioGroup).where(ScenarioGroup.id == group_id)
    )
    group = group_result.scalar_one_or_none()
    
    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario group with id {group_id} not found"
        )
    
    # Check if user is creator or editor
    is_creator = group.created_by_user_id == current_user.id
    editor_result = await db.execute(
        select(ScenarioGroupEditor).where(
            and_(
                ScenarioGroupEditor.scenario_group_id == group_id,
                ScenarioGroupEditor.user_id == current_user.id
            )
        )
    )
    is_editor = editor_result.scalar_one_or_none() is not None
    
    if not (is_creator or is_editor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to modify this scenario group"
        )
    
    # Verify train configuration exists
    config_result = await db.execute(
        select(TrainConfiguration).where(TrainConfiguration.id == item.train_configuration_id)
    )
    config = config_result.scalar_one_or_none()
    
    if config is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Train configuration with id {item.train_configuration_id} not found"
        )
    
    # Create the item
    db_item = ScenarioGroupItem(
        scenario_group_id=group_id,
        train_configuration_id=item.train_configuration_id,
        order=item.order
    )
    
    db.add(db_item)
    
    # Update the study's updated_at timestamp if this scenario group is associated with a study
    from datetime import timezone
    study_result = await db.execute(
        select(Study).where(Study.scenario_group_id == group_id)
    )
    studies = study_result.scalars().all()
    for study in studies:
        study.updated_at = datetime.now(timezone.utc)
    
    await db.commit()
    
    # Reload with relationship
    result = await db.execute(
        select(ScenarioGroupItem)
        .where(ScenarioGroupItem.id == db_item.id)
        .options(selectinload(ScenarioGroupItem.train_configuration))
    )
    db_item = result.scalar_one()
    
    return db_item


@app.put("/scenario-groups/{group_id}/items/{item_id}", response_model=ScenarioGroupItemResponse)
async def update_scenario_group_item(
    group_id: int,
    item_id: int,
    item_update: ScenarioGroupItemCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update an item in a scenario group (e.g., change order or train configuration).
    Requires authentication and user must be creator or editor.
    """
    from models import ScenarioGroupEditor
    
    # Verify group exists
    group_result = await db.execute(
        select(ScenarioGroup).where(ScenarioGroup.id == group_id)
    )
    group = group_result.scalar_one_or_none()
    
    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario group with id {group_id} not found"
        )
    
    # Check if user is creator or editor
    is_creator = group.created_by_user_id == current_user.id
    editor_result = await db.execute(
        select(ScenarioGroupEditor).where(
            and_(
                ScenarioGroupEditor.scenario_group_id == group_id,
                ScenarioGroupEditor.user_id == current_user.id
            )
        )
    )
    is_editor = editor_result.scalar_one_or_none() is not None
    
    if not (is_creator or is_editor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to modify this scenario group"
        )
    
    # Verify item exists and belongs to the group
    item_result = await db.execute(
        select(ScenarioGroupItem).where(
            ScenarioGroupItem.id == item_id,
            ScenarioGroupItem.scenario_group_id == group_id
        )
    )
    db_item = item_result.scalar_one_or_none()
    
    if db_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with id {item_id} not found in scenario group {group_id}"
        )
    
    # Verify train configuration exists if it's being changed
    if item_update.train_configuration_id != db_item.train_configuration_id:
        config_result = await db.execute(
            select(TrainConfiguration).where(TrainConfiguration.id == item_update.train_configuration_id)
        )
        config = config_result.scalar_one_or_none()
        
        if config is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Train configuration with id {item_update.train_configuration_id} not found"
            )
    
    # Update the item
    db_item.train_configuration_id = item_update.train_configuration_id
    db_item.order = item_update.order
    
    await db.commit()
    
    # Reload with relationship
    result = await db.execute(
        select(ScenarioGroupItem)
        .where(ScenarioGroupItem.id == item_id)
        .options(selectinload(ScenarioGroupItem.train_configuration))
    )
    db_item = result.scalar_one()
    
    return db_item


@app.delete("/scenario-groups/{group_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scenario_group_item(
    group_id: int,
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Remove an item from a scenario group.
    Requires authentication and user must be creator or editor.
    """
    from models import ScenarioGroupEditor
    
    # Verify group exists
    group_result = await db.execute(
        select(ScenarioGroup).where(ScenarioGroup.id == group_id)
    )
    group = group_result.scalar_one_or_none()
    
    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario group with id {group_id} not found"
        )
    
    # Check if user is creator or editor
    is_creator = group.created_by_user_id == current_user.id
    editor_result = await db.execute(
        select(ScenarioGroupEditor).where(
            and_(
                ScenarioGroupEditor.scenario_group_id == group_id,
                ScenarioGroupEditor.user_id == current_user.id
            )
        )
    )
    is_editor = editor_result.scalar_one_or_none() is not None
    
    if not (is_creator or is_editor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to modify this scenario group"
        )
    
    # Verify item exists and belongs to the group
    item_result = await db.execute(
        select(ScenarioGroupItem).where(
            ScenarioGroupItem.id == item_id,
            ScenarioGroupItem.scenario_group_id == group_id
        )
    )
    db_item = item_result.scalar_one_or_none()
    
    if db_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with id {item_id} not found in scenario group {group_id}"
        )
    
    await db.delete(db_item)
    await db.commit()
    
    return None


# Study Endpoints

@app.post("/studies", response_model=StudyResponse, status_code=status.HTTP_201_CREATED)
async def create_study(
    study: StudyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new study.
    Requires authentication.
    """
    # Verify scenario group exists and user has access
    group_result = await db.execute(
        select(ScenarioGroup).where(ScenarioGroup.id == study.scenario_group_id)
    )
    group = group_result.scalar_one_or_none()
    
    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario group with id {study.scenario_group_id} not found"
        )
    
    # Check if user is creator or editor
    is_creator = group.created_by_user_id == current_user.id
    editor_result = await db.execute(
        select(ScenarioGroupEditor).where(
            and_(
                ScenarioGroupEditor.scenario_group_id == study.scenario_group_id,
                ScenarioGroupEditor.user_id == current_user.id
            )
        )
    )
    is_editor = editor_result.scalar_one_or_none() is not None
    
    if not (is_creator or is_editor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to create a study with this scenario group"
        )
    
    # Create the study
    db_study = Study(
        title=study.title,
        description=study.description,
        email=study.email.lower().strip(),
        scenario_group_id=study.scenario_group_id,
        created_by_user_id=current_user.id
    )
    db.add(db_study)
    await db.commit()
    await db.refresh(db_study)
    
    # Reload with relationships
    result = await db.execute(
        select(Study)
        .where(Study.id == db_study.id)
        .options(selectinload(Study.scenario_group).selectinload(ScenarioGroup.items).selectinload(ScenarioGroupItem.train_configuration))
    )
    db_study = result.scalar_one()
    
    return db_study


@app.get("/studies", response_model=List[StudyResponse])
async def list_studies(
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """
    List all studies created by the current user.
    Requires authentication.
    """
    query = select(Study).where(Study.created_by_user_id == current_user.id)
    query = query.order_by(Study.created_at.desc()).offset(skip).limit(limit)
    query = query.options(selectinload(Study.scenario_group).selectinload(ScenarioGroup.items).selectinload(ScenarioGroupItem.train_configuration))
    
    result = await db.execute(query)
    studies = result.scalars().all()
    
    return studies


@app.get("/studies/{study_id}", response_model=StudyResponse)
async def get_study(
    study_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific study by ID.
    Requires authentication and user must be the creator.
    """
    result = await db.execute(
        select(Study)
        .where(Study.id == study_id)
        .options(selectinload(Study.scenario_group).selectinload(ScenarioGroup.items).selectinload(ScenarioGroupItem.train_configuration))
    )
    study = result.scalar_one_or_none()
    
    if study is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Study with id {study_id} not found"
        )
    
    # Check if user is creator
    if study.created_by_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this study"
        )
    
    return study


@app.put("/studies/{study_id}", response_model=StudyResponse)
async def update_study(
    study_id: int,
    study_update: StudyUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a study.
    Requires authentication and user must be the creator.
    """
    result = await db.execute(
        select(Study).where(Study.id == study_id)
    )
    study = result.scalar_one_or_none()
    
    if study is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Study with id {study_id} not found"
        )
    
    # Check if user is creator
    if study.created_by_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to update this study"
        )
    
    # Update fields if provided
    if study_update.title is not None:
        study.title = study_update.title
    if study_update.description is not None:
        study.description = study_update.description
    if study_update.email is not None:
        study.email = study_update.email.lower().strip()
    if study_update.scenario_group_id is not None:
        # Verify new scenario group exists and user has access
        group_result = await db.execute(
            select(ScenarioGroup).where(ScenarioGroup.id == study_update.scenario_group_id)
        )
        group = group_result.scalar_one_or_none()
        
        if group is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scenario group with id {study_update.scenario_group_id} not found"
            )
        
        # Check if user is creator or editor of the new group
        is_creator = group.created_by_user_id == current_user.id
        editor_result = await db.execute(
            select(ScenarioGroupEditor).where(
                and_(
                    ScenarioGroupEditor.scenario_group_id == study_update.scenario_group_id,
                    ScenarioGroupEditor.user_id == current_user.id
                )
            )
        )
        is_editor = editor_result.scalar_one_or_none() is not None
        
        if not (is_creator or is_editor):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to use this scenario group"
            )
        
        study.scenario_group_id = study_update.scenario_group_id
    
    await db.commit()
    
    # Reload with relationships
    result = await db.execute(
        select(Study)
        .where(Study.id == study_id)
        .options(selectinload(Study.scenario_group).selectinload(ScenarioGroup.items).selectinload(ScenarioGroupItem.train_configuration))
    )
    study = result.scalar_one()
    
    return study


@app.delete("/studies/{study_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_study(
    study_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a study.
    Requires authentication and user must be the creator.
    """
    result = await db.execute(
        select(Study).where(Study.id == study_id)
    )
    study = result.scalar_one_or_none()
    
    if study is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Study with id {study_id} not found"
        )
    
    # Check if user is creator
    if study.created_by_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to delete this study"
        )
    
    await db.delete(study)
    await db.commit()
    
    return None

