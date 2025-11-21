from fastapi import FastAPI, Depends, HTTPException, status, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select, func, and_
from sqlalchemy.orm import selectinload
from contextlib import asynccontextmanager
from typing import List, Optional, Dict
from datetime import datetime, timedelta
import os
import random
from database import init_db, close_db, get_db
from models import (
    Base, TrainConfiguration, UserResponse, ScenarioGroup, ScenarioGroupItem, User, 
    EmailVerification, ScenarioGroupEditor, Study, Question, PostResponseQuestion, 
    PreStudyQuestion, QuestionTag, QuestionTagAssignment, QuestionResponse, QuestionResponseTag
)

# Default tags that should be available for the default question
DEFAULT_TAGS = [
    "comfort",
    "maximizing personal space",
    "accessibility",
    "convenience",
    "privacy",
    "safety",
    "view",
    "proximity to door"
]
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
    StudyResponse,
    QuestionCreate,
    QuestionResponse as QuestionResponseSchema,
    PostResponseQuestionCreate,
    PostResponseQuestionResponse,
    QuestionTagCreate,
    QuestionTagResponse,
    QuestionResponseCreate,
    QuestionResponseResponse,
    TagStatisticsResponse,
    TagLibraryResponse,
    PreStudyQuestionCreate,
    PreStudyQuestionResponse
)
from services.email import send_verification_email
from utils.auth import create_access_token, generate_verification_token, generate_verification_code, ACCESS_TOKEN_EXPIRE_MINUTES
from middleware.auth import get_current_user, get_optional_user

# Lifespan context manager for startup/shutdown events
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    yield
    # Shutdown
    await close_db()

async def get_or_create_default_tags(db: AsyncSession) -> List[QuestionTag]:
    """
    Get or create default tags. Returns a list of QuestionTag objects.
    """
    default_tags = []
    
    for tag_text in DEFAULT_TAGS:
        # Check if tag already exists
        tag_result = await db.execute(
            select(QuestionTag).where(QuestionTag.tag_text == tag_text)
        )
        tag = tag_result.scalar_one_or_none()
        
        if not tag:
            # Create the tag
            tag = QuestionTag(
                tag_text=tag_text,
                created_by_user_id=None,  # Default tags are system-created
                is_default=True
            )
            db.add(tag)
            await db.flush()
        
        default_tags.append(tag)
    
    return default_tags


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
    
    # Create default question "Why did you choose this spot?"
    default_question = Question(
        question_text="Why did you choose this spot?",
        allows_free_text=True,
        allows_tags=True,
        allows_multiple_tags=True
    )
    db.add(default_question)
    await db.flush()  # Flush to get the question ID
    
    default_post_response_question = PostResponseQuestion(
        question_id=default_question.id,
        train_configuration_id=db_config.id,
        is_required=False,
        free_text_required=False,
        order=0,
        is_default=True
    )
    db.add(default_post_response_question)
    await db.flush()
    
    # Get or create default tags and assign them to the default question
    default_tags = await get_or_create_default_tags(db)
    for order, tag in enumerate(default_tags):
        assignment = QuestionTagAssignment(
            question_id=default_question.id,
            tag_id=tag.id,
            order=order
        )
        db.add(assignment)
    
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
    # Match cookie expiration to token expiration (30 days default)
    response.set_cookie(
        key="session_token",
        value=access_token,
        httponly=True,
        secure=os.getenv("ENVIRONMENT") == "production",  # HTTPS only in production
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60  # Convert minutes to seconds
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
    # Match cookie expiration to token expiration (30 days default)
    response.set_cookie(
        key="session_token",
        value=access_token,
        httponly=True,
        secure=os.getenv("ENVIRONMENT") == "production",
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60  # Convert minutes to seconds
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


# PreStudyQuestion Endpoints

@app.post("/studies/{study_id}/pre-study-questions", response_model=PreStudyQuestionResponse, status_code=status.HTTP_201_CREATED)
async def create_pre_study_question(
    study_id: int,
    question_data: PreStudyQuestionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a pre-study question for a study.
    Requires authentication and user must be the study creator.
    """
    # Verify study exists and user is creator
    study_result = await db.execute(
        select(Study).where(Study.id == study_id)
    )
    study = study_result.scalar_one_or_none()
    
    if study is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Study with id {study_id} not found"
        )
    
    if study.created_by_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to modify this study"
        )
    
    # Create or link question
    if question_data.question_id:
        # Link to existing question
        question_result = await db.execute(
            select(Question).where(Question.id == question_data.question_id)
        )
        question = question_result.scalar_one_or_none()
        if question is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Question with id {question_data.question_id} not found"
            )
    else:
        # Create new question
        if not question_data.question_text or not question_data.question_text.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="question_text is required when question_id is not provided"
            )
        
        question = Question(
            question_text=question_data.question_text,
            allows_free_text=question_data.allows_free_text,
            allows_tags=question_data.allows_tags,
            allows_multiple_tags=question_data.allows_multiple_tags if hasattr(question_data, 'allows_multiple_tags') else True
        )
        db.add(question)
        await db.flush()  # Get the question ID
    
    # Check if question is already assigned to this study
    existing_result = await db.execute(
        select(PreStudyQuestion).where(
            PreStudyQuestion.question_id == question.id,
            PreStudyQuestion.study_id == study_id
        )
    )
    if existing_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This question is already assigned to this study"
        )
    
    # Determine order
    order_result = await db.execute(
        select(PreStudyQuestion).where(PreStudyQuestion.study_id == study_id)
    )
    existing_questions = order_result.scalars().all()
    order = question_data.order if question_data.order is not None else len(existing_questions)
    
    # Create PreStudyQuestion
    pre_study_question = PreStudyQuestion(
        question_id=question.id,
        study_id=study_id,
        order=order
    )
    db.add(pre_study_question)
    await db.flush()
    
    # Assign tags if provided
    if question_data.tag_ids:
        for tag_id in question_data.tag_ids:
            tag_result = await db.execute(
                select(QuestionTag).where(QuestionTag.id == tag_id)
            )
            tag = tag_result.scalar_one_or_none()
            if tag is None:
                continue
            
            assignment = QuestionTagAssignment(
                question_id=question.id,
                tag_id=tag_id,
                order=len(question_data.tag_ids)  # Simple order
            )
            db.add(assignment)
    
    await db.commit()
    await db.refresh(pre_study_question)
    
    # Load question and tags
    await db.refresh(question)
    await db.refresh(pre_study_question)
    
    # Get tags
    tag_assignments_result = await db.execute(
        select(QuestionTagAssignment).where(QuestionTagAssignment.question_id == question.id)
        .options(selectinload(QuestionTagAssignment.tag))
    )
    tag_assignments = tag_assignments_result.scalars().all()
    tags = [assignment.tag for assignment in tag_assignments]
    
    return PreStudyQuestionResponse(
        id=pre_study_question.id,
        question_id=pre_study_question.question_id,
        study_id=pre_study_question.study_id,
        order=pre_study_question.order,
        created_at=pre_study_question.created_at,
        updated_at=pre_study_question.updated_at,
        question=QuestionResponseSchema(
            id=question.id,
            question_text=question.question_text,
            allows_free_text=question.allows_free_text,
            allows_tags=question.allows_tags,
            allows_multiple_tags=question.allows_multiple_tags,
            created_at=question.created_at,
            updated_at=question.updated_at
        ),
        tags=[QuestionTagResponse(
            id=tag.id,
            tag_text=tag.tag_text,
            is_default=tag.is_default,
            created_by_user_id=tag.created_by_user_id,
            created_at=tag.created_at
        ) for tag in tags]
    )


@app.get("/studies/{study_id}/pre-study-questions", response_model=List[PreStudyQuestionResponse])
async def get_pre_study_questions(
    study_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all pre-study questions for a study.
    """
    # Verify study exists
    study_result = await db.execute(
        select(Study).where(Study.id == study_id)
    )
    if study_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Study with id {study_id} not found"
        )
    
    result = await db.execute(
        select(PreStudyQuestion)
        .where(PreStudyQuestion.study_id == study_id)
        .options(
            selectinload(PreStudyQuestion.question),
            selectinload(PreStudyQuestion.question).selectinload(Question.tag_assignments).selectinload(QuestionTagAssignment.tag)
        )
        .order_by(PreStudyQuestion.order)
    )
    pre_questions = result.scalars().all()
    
    # Build responses
    responses = []
    for pre_q in pre_questions:
        tags = [assignment.tag for assignment in pre_q.question.tag_assignments]
        responses.append(PreStudyQuestionResponse(
            id=pre_q.id,
            question_id=pre_q.question_id,
            study_id=pre_q.study_id,
            order=pre_q.order,
            created_at=pre_q.created_at,
            updated_at=pre_q.updated_at,
            question=QuestionResponseSchema(
                id=pre_q.question.id,
                question_text=pre_q.question.question_text,
                allows_free_text=pre_q.question.allows_free_text,
                allows_tags=pre_q.question.allows_tags,
                allows_multiple_tags=pre_q.question.allows_multiple_tags,
                created_at=pre_q.question.created_at,
                updated_at=pre_q.question.updated_at
            ),
            tags=[QuestionTagResponse(
                id=tag.id,
                tag_text=tag.tag_text,
                is_default=tag.is_default,
                created_by_user_id=tag.created_by_user_id,
                created_at=tag.created_at
            ) for tag in tags]
        ))
    
    return responses


@app.put("/studies/{study_id}/pre-study-questions/{pre_study_question_id}", response_model=PreStudyQuestionResponse)
async def update_pre_study_question(
    study_id: int,
    pre_study_question_id: int,
    question_data: PreStudyQuestionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a pre-study question.
    Requires authentication and user must be the study creator.
    """
    # Verify study exists and user is creator
    study_result = await db.execute(
        select(Study).where(Study.id == study_id)
    )
    study = study_result.scalar_one_or_none()
    
    if study is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Study with id {study_id} not found"
        )
    
    if study.created_by_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to modify this study"
        )
    
    # Get pre-study question
    pre_q_result = await db.execute(
        select(PreStudyQuestion).where(
            PreStudyQuestion.id == pre_study_question_id,
            PreStudyQuestion.study_id == study_id
        )
    )
    pre_study_question = pre_q_result.scalar_one_or_none()
    
    if pre_study_question is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pre-study question with id {pre_study_question_id} not found"
        )
    
    # Update order if provided
    if question_data.order is not None:
        pre_study_question.order = question_data.order
    
    # Update question text if provided (for new questions only, not linked ones)
    if question_data.question_text and not question_data.question_id:
        question_result = await db.execute(
            select(Question).where(Question.id == pre_study_question.question_id)
        )
        question = question_result.scalar_one()
        question.question_text = question_data.question_text
        question.allows_free_text = question_data.allows_free_text
        question.allows_tags = question_data.allows_tags
        if hasattr(question_data, 'allows_multiple_tags'):
            question.allows_multiple_tags = question_data.allows_multiple_tags
        if hasattr(question_data, 'allows_multiple_tags'):
            question.allows_multiple_tags = question_data.allows_multiple_tags
    
    # Update tag assignments
    if question_data.tag_ids is not None:
        current_tag_assignments_result = await db.execute(
            select(QuestionTagAssignment).where(
                QuestionTagAssignment.question_id == pre_study_question.question_id
            )
        )
        current_tag_assignments = current_tag_assignments_result.scalars().all()
        current_tag_ids = {assignment.tag_id for assignment in current_tag_assignments}
        
        tags_to_add = set(question_data.tag_ids) - current_tag_ids
        tags_to_remove = current_tag_ids - set(question_data.tag_ids)
        
        # Remove tags no longer in the list
        for assignment in current_tag_assignments:
            if assignment.tag_id in tags_to_remove:
                await db.delete(assignment)
        
        # Add new tags
        for order, tag_id in enumerate(question_data.tag_ids):
            if tag_id in tags_to_add:
                tag_result = await db.execute(
                    select(QuestionTag).where(QuestionTag.id == tag_id)
                )
                tag = tag_result.scalar_one_or_none()
                if tag is None:
                    continue
                
                assignment = QuestionTagAssignment(
                    question_id=pre_study_question.question_id,
                    tag_id=tag_id,
                    order=order
                )
                db.add(assignment)
            else:
                # Update order for existing tags
                for existing_assignment in current_tag_assignments:
                    if existing_assignment.tag_id == tag_id:
                        existing_assignment.order = order
                        break
    
    await db.commit()
    await db.refresh(pre_study_question)
    
    # Get updated question and tags
    question_result = await db.execute(
        select(Question).where(Question.id == pre_study_question.question_id)
    )
    question = question_result.scalar_one()
    
    tag_assignments_result = await db.execute(
        select(QuestionTagAssignment).where(QuestionTagAssignment.question_id == question.id)
        .options(selectinload(QuestionTagAssignment.tag))
    )
    tag_assignments = tag_assignments_result.scalars().all()
    tags = [assignment.tag for assignment in tag_assignments]
    
    return PreStudyQuestionResponse(
        id=pre_study_question.id,
        question_id=pre_study_question.question_id,
        study_id=pre_study_question.study_id,
        order=pre_study_question.order,
        created_at=pre_study_question.created_at,
        updated_at=pre_study_question.updated_at,
        question=QuestionResponseSchema(
            id=question.id,
            question_text=question.question_text,
            allows_free_text=question.allows_free_text,
            allows_tags=question.allows_tags,
            allows_multiple_tags=question.allows_multiple_tags,
            created_at=question.created_at,
            updated_at=question.updated_at
        ),
        tags=[QuestionTagResponse(
            id=tag.id,
            tag_text=tag.tag_text,
            is_default=tag.is_default,
            created_by_user_id=tag.created_by_user_id,
            created_at=tag.created_at
        ) for tag in tags]
    )


@app.delete("/studies/{study_id}/pre-study-questions/{pre_study_question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pre_study_question(
    study_id: int,
    pre_study_question_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a pre-study question.
    Requires authentication and user must be the study creator.
    """
    # Verify study exists and user is creator
    study_result = await db.execute(
        select(Study).where(Study.id == study_id)
    )
    study = study_result.scalar_one_or_none()
    
    if study is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Study with id {study_id} not found"
        )
    
    if study.created_by_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to modify this study"
        )
    
    # Get pre-study question
    pre_q_result = await db.execute(
        select(PreStudyQuestion).where(
            PreStudyQuestion.id == pre_study_question_id,
            PreStudyQuestion.study_id == study_id
        )
    )
    pre_study_question = pre_q_result.scalar_one_or_none()
    
    if pre_study_question is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pre-study question with id {pre_study_question_id} not found"
        )
    
    await db.delete(pre_study_question)
    await db.commit()
    
    return None


# Question Endpoints

@app.post("/train-configurations/{config_id}/questions", response_model=PostResponseQuestionResponse, status_code=status.HTTP_201_CREATED)
async def create_post_response_question(
    config_id: int,
    question_data: PostResponseQuestionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a post-response question for a scenario.
    Requires authentication.
    """
    # Verify train configuration exists
    config_result = await db.execute(
        select(TrainConfiguration).where(TrainConfiguration.id == config_id)
    )
    config = config_result.scalar_one_or_none()
    
    if config is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Train configuration with id {config_id} not found"
        )
    
    # Check if scenario is in a study (for validation of is_required and free_text_required)
    from models import ScenarioGroupItem, Study
    scenario_in_study = False
    item_result = await db.execute(
        select(ScenarioGroupItem).where(ScenarioGroupItem.train_configuration_id == config_id)
    )
    items = item_result.scalars().all()
    if items:
        group_ids = [item.scenario_group_id for item in items]
        study_result = await db.execute(
            select(Study).where(Study.scenario_group_id.in_(group_ids))
        )
        scenario_in_study = study_result.scalar_one_or_none() is not None
    
    # Validate is_required and free_text_required only allowed if scenario is in a study
    if (question_data.is_required or question_data.free_text_required) and not scenario_in_study:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="is_required and free_text_required can only be set when scenario is part of a study"
        )
    
    # Create or link question
    if question_data.question_id:
        # Link to existing question
        question_result = await db.execute(
            select(Question).where(Question.id == question_data.question_id)
        )
        question = question_result.scalar_one_or_none()
        if question is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Question with id {question_data.question_id} not found"
            )
    else:
        # Create new question
        if not question_data.question_text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="question_text is required when question_id is not provided"
            )
        question = Question(
            question_text=question_data.question_text,
            allows_free_text=question_data.allows_free_text,
            allows_tags=question_data.allows_tags,
            allows_multiple_tags=question_data.allows_multiple_tags if hasattr(question_data, 'allows_multiple_tags') else True
        )
        db.add(question)
        await db.flush()
    
    # Create PostResponseQuestion
    post_response_question = PostResponseQuestion(
        question_id=question.id,
        train_configuration_id=config_id,
        is_required=question_data.is_required,
        free_text_required=question_data.free_text_required,
        order=question_data.order,
        is_default=False
    )
    db.add(post_response_question)
    await db.flush()
    
    # Assign tags if provided
    if question_data.tag_ids:
        for tag_id in question_data.tag_ids:
            tag_result = await db.execute(
                select(QuestionTag).where(QuestionTag.id == tag_id)
            )
            tag = tag_result.scalar_one_or_none()
            if tag is None:
                continue  # Skip invalid tag IDs
            
            # Check if assignment already exists
            existing_result = await db.execute(
                select(QuestionTagAssignment).where(
                    and_(
                        QuestionTagAssignment.question_id == question.id,
                        QuestionTagAssignment.tag_id == tag_id
                    )
                )
            )
            if existing_result.scalar_one_or_none() is None:
                assignment = QuestionTagAssignment(
                    question_id=question.id,
                    tag_id=tag_id,
                    order=len(question_data.tag_ids) - question_data.tag_ids.index(tag_id)
                )
                db.add(assignment)
    
    await db.commit()
    
    # Reload with relationships
    result = await db.execute(
        select(PostResponseQuestion)
        .where(PostResponseQuestion.id == post_response_question.id)
        .options(
            selectinload(PostResponseQuestion.question),
            selectinload(PostResponseQuestion.question).selectinload(Question.tag_assignments).selectinload(QuestionTagAssignment.tag)
        )
    )
    post_response_question = result.scalar_one()
    
    # Build response
    tags = [assignment.tag for assignment in post_response_question.question.tag_assignments]
    return PostResponseQuestionResponse(
        id=post_response_question.id,
        question_id=post_response_question.question_id,
        train_configuration_id=post_response_question.train_configuration_id,
        is_required=post_response_question.is_required,
        free_text_required=post_response_question.free_text_required,
        order=post_response_question.order,
        is_default=post_response_question.is_default,
        created_at=post_response_question.created_at,
        updated_at=post_response_question.updated_at,
        question=QuestionResponseSchema(
            id=post_response_question.question.id,
            question_text=post_response_question.question.question_text,
            allows_free_text=post_response_question.question.allows_free_text,
            allows_tags=post_response_question.question.allows_tags,
            allows_multiple_tags=post_response_question.question.allows_multiple_tags,
            created_at=post_response_question.question.created_at,
            updated_at=post_response_question.question.updated_at
        ),
        tags=[QuestionTagResponse(
            id=tag.id,
            tag_text=tag.tag_text,
            is_default=tag.is_default,
            created_by_user_id=tag.created_by_user_id,
            created_at=tag.created_at
        ) for tag in tags]
    )


@app.get("/train-configurations/{config_id}/questions", response_model=List[PostResponseQuestionResponse])
async def get_post_response_questions(
    config_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all post-response questions for a scenario.
    """
    result = await db.execute(
        select(PostResponseQuestion)
        .where(PostResponseQuestion.train_configuration_id == config_id)
        .options(
            selectinload(PostResponseQuestion.question),
            selectinload(PostResponseQuestion.question).selectinload(Question.tag_assignments).selectinload(QuestionTagAssignment.tag)
        )
        .order_by(PostResponseQuestion.order)
    )
    questions = result.scalars().all()
    
    # Build responses
    responses = []
    for post_q in questions:
        tags = [assignment.tag for assignment in post_q.question.tag_assignments]
        responses.append(PostResponseQuestionResponse(
            id=post_q.id,
            question_id=post_q.question_id,
            train_configuration_id=post_q.train_configuration_id,
            is_required=post_q.is_required,
            free_text_required=post_q.free_text_required,
            order=post_q.order,
            is_default=post_q.is_default,
            created_at=post_q.created_at,
            updated_at=post_q.updated_at,
            question=QuestionResponseSchema(
                id=post_q.question.id,
                question_text=post_q.question.question_text,
                allows_free_text=post_q.question.allows_free_text,
                allows_tags=post_q.question.allows_tags,
                allows_multiple_tags=post_q.question.allows_multiple_tags,
                created_at=post_q.question.created_at,
                updated_at=post_q.question.updated_at
            ),
            tags=[QuestionTagResponse(
                id=tag.id,
                tag_text=tag.tag_text,
                is_default=tag.is_default,
                created_by_user_id=tag.created_by_user_id,
                created_at=tag.created_at
            ) for tag in tags]
        ))
    
    return responses


@app.get("/train-configurations/{config_id}/questions-for-response", response_model=List[PostResponseQuestionResponse])
async def get_questions_for_response(
    config_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get questions for a scenario (for response page).
    Same as get_post_response_questions but with a different endpoint name for clarity.
    """
    return await get_post_response_questions(config_id, db)


@app.put("/train-configurations/{config_id}/questions/{post_response_question_id}", response_model=PostResponseQuestionResponse)
async def update_post_response_question(
    config_id: int,
    post_response_question_id: int,
    question_data: PostResponseQuestionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a post-response question.
    Requires authentication.
    """
    # Verify PostResponseQuestion exists and belongs to config
    result = await db.execute(
        select(PostResponseQuestion).where(
            and_(
                PostResponseQuestion.id == post_response_question_id,
                PostResponseQuestion.train_configuration_id == config_id
            )
        )
        .options(selectinload(PostResponseQuestion.question))
    )
    post_response_question = result.scalar_one_or_none()
    
    if post_response_question is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Post-response question with id {post_response_question_id} not found"
        )
    
    # Check if scenario is in a study
    from models import ScenarioGroupItem, Study
    scenario_in_study = False
    item_result = await db.execute(
        select(ScenarioGroupItem).where(ScenarioGroupItem.train_configuration_id == config_id)
    )
    items = item_result.scalars().all()
    if items:
        group_ids = [item.scenario_group_id for item in items]
        study_result = await db.execute(
            select(Study).where(Study.scenario_group_id.in_(group_ids))
        )
        scenario_in_study = study_result.scalar_one_or_none() is not None
    
    # Validate is_required and free_text_required
    if (question_data.is_required or question_data.free_text_required) and not scenario_in_study:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="is_required and free_text_required can only be set when scenario is part of a study"
        )
    
    # Update question if not default (cannot edit question_text if is_default)
    if not post_response_question.is_default:
        if question_data.question_text:
            post_response_question.question.question_text = question_data.question_text
        post_response_question.question.allows_free_text = question_data.allows_free_text
        post_response_question.question.allows_tags = question_data.allows_tags
    
    # Update PostResponseQuestion fields
    post_response_question.is_required = question_data.is_required
    post_response_question.free_text_required = question_data.free_text_required
    post_response_question.order = question_data.order
    
    # Update tag assignments
    if question_data.tag_ids is not None:
        # Get existing assignments
        existing_assignments_result = await db.execute(
            select(QuestionTagAssignment).where(
                QuestionTagAssignment.question_id == post_response_question.question_id
            )
        )
        existing_assignments = existing_assignments_result.scalars().all()
        existing_tag_ids = {assignment.tag_id for assignment in existing_assignments}
        new_tag_ids = set(question_data.tag_ids)
        
        # Remove assignments that are no longer in the new list
        for assignment in existing_assignments:
            if assignment.tag_id not in new_tag_ids:
                await db.delete(assignment)
        
        # Add new assignments (only for tags that don't already exist)
        for order, tag_id in enumerate(question_data.tag_ids):
            if tag_id not in existing_tag_ids:
                tag_result = await db.execute(
                    select(QuestionTag).where(QuestionTag.id == tag_id)
                )
                tag = tag_result.scalar_one_or_none()
                if tag is None:
                    continue
                
                assignment = QuestionTagAssignment(
                    question_id=post_response_question.question_id,
                    tag_id=tag_id,
                    order=order
                )
                db.add(assignment)
        
        # Update order for existing assignments
        for assignment in existing_assignments:
            if assignment.tag_id in new_tag_ids:
                new_order = question_data.tag_ids.index(assignment.tag_id)
                assignment.order = new_order
    
    await db.commit()
    
    # Reload with relationships
    result = await db.execute(
        select(PostResponseQuestion)
        .where(PostResponseQuestion.id == post_response_question_id)
        .options(
            selectinload(PostResponseQuestion.question),
            selectinload(PostResponseQuestion.question).selectinload(Question.tag_assignments).selectinload(QuestionTagAssignment.tag)
        )
    )
    post_response_question = result.scalar_one()
    
    # Build response
    tags = [assignment.tag for assignment in post_response_question.question.tag_assignments]
    return PostResponseQuestionResponse(
        id=post_response_question.id,
        question_id=post_response_question.question_id,
        train_configuration_id=post_response_question.train_configuration_id,
        is_required=post_response_question.is_required,
        free_text_required=post_response_question.free_text_required,
        order=post_response_question.order,
        is_default=post_response_question.is_default,
        created_at=post_response_question.created_at,
        updated_at=post_response_question.updated_at,
        question=QuestionResponseSchema(
            id=post_response_question.question.id,
            question_text=post_response_question.question.question_text,
            allows_free_text=post_response_question.question.allows_free_text,
            allows_tags=post_response_question.question.allows_tags,
            allows_multiple_tags=post_response_question.question.allows_multiple_tags,
            created_at=post_response_question.question.created_at,
            updated_at=post_response_question.question.updated_at
        ),
        tags=[QuestionTagResponse(
            id=tag.id,
            tag_text=tag.tag_text,
            is_default=tag.is_default,
            created_by_user_id=tag.created_by_user_id,
            created_at=tag.created_at
        ) for tag in tags]
    )


@app.delete("/train-configurations/{config_id}/questions/{post_response_question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post_response_question(
    config_id: int,
    post_response_question_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a post-response question.
    Requires authentication.
    """
    result = await db.execute(
        select(PostResponseQuestion).where(
            and_(
                PostResponseQuestion.id == post_response_question_id,
                PostResponseQuestion.train_configuration_id == config_id
            )
        )
        .options(selectinload(PostResponseQuestion.question))
    )
    post_response_question = result.scalar_one_or_none()
    
    if post_response_question is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Post-response question with id {post_response_question_id} not found"
        )
    
    question_id = post_response_question.question_id
    
    # Delete PostResponseQuestion
    await db.delete(post_response_question)
    
    # Check if question is used by other PostResponseQuestions (or future PreResponseQuestion, etc.)
    other_post_result = await db.execute(
        select(PostResponseQuestion).where(
            and_(
                PostResponseQuestion.question_id == question_id,
                PostResponseQuestion.id != post_response_question_id
            )
        )
    )
    other_posts = other_post_result.scalars().all()
    
    # If no other references, delete the question and its tag assignments
    if not other_posts:
        # Delete tag assignments
        assignments_result = await db.execute(
            select(QuestionTagAssignment).where(QuestionTagAssignment.question_id == question_id)
        )
        for assignment in assignments_result.scalars().all():
            await db.delete(assignment)
        
        # Delete question
        question_result = await db.execute(
            select(Question).where(Question.id == question_id)
        )
        question = question_result.scalar_one_or_none()
        if question:
            await db.delete(question)
    
    await db.commit()
    
    return None


@app.get("/questions/tag-library", response_model=TagLibraryResponse)
async def get_tag_library(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get tag library (default tags, your tags, community tags).
    Requires authentication.
    """
    # Get default tags
    default_result = await db.execute(
        select(QuestionTag).where(QuestionTag.is_default == True).order_by(QuestionTag.tag_text)
    )
    default_tags = default_result.scalars().all()
    
    # Get user's tags
    your_result = await db.execute(
        select(QuestionTag).where(
            and_(
                QuestionTag.created_by_user_id == current_user.id,
                QuestionTag.is_default == False
            )
        ).order_by(QuestionTag.tag_text)
    )
    your_tags = your_result.scalars().all()
    
    # Get community tags (non-default tags created by other users)
    community_result = await db.execute(
        select(QuestionTag).where(
            and_(
                QuestionTag.is_default == False,
                QuestionTag.created_by_user_id != current_user.id,
                QuestionTag.created_by_user_id.isnot(None)
            )
        ).order_by(QuestionTag.tag_text)
    )
    community_tags = community_result.scalars().all()
    
    return TagLibraryResponse(
        default_tags=[QuestionTagResponse(
            id=tag.id,
            tag_text=tag.tag_text,
            is_default=tag.is_default,
            created_by_user_id=tag.created_by_user_id,
            created_at=tag.created_at
        ) for tag in default_tags],
        your_tags=[QuestionTagResponse(
            id=tag.id,
            tag_text=tag.tag_text,
            is_default=tag.is_default,
            created_by_user_id=tag.created_by_user_id,
            created_at=tag.created_at
        ) for tag in your_tags],
        community_tags=[QuestionTagResponse(
            id=tag.id,
            tag_text=tag.tag_text,
            is_default=tag.is_default,
            created_by_user_id=tag.created_by_user_id,
            created_at=tag.created_at
        ) for tag in community_tags]
    )


@app.post("/questions/tags", response_model=QuestionTagResponse, status_code=status.HTTP_201_CREATED)
async def create_question_tag(
    tag_data: QuestionTagCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new question tag.
    Requires authentication.
    """
    # Check if tag already exists
    existing_result = await db.execute(
        select(QuestionTag).where(QuestionTag.tag_text == tag_data.tag_text)
    )
    if existing_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tag with text '{tag_data.tag_text}' already exists"
        )
    
    # Only admin can create default tags (for now, we'll prevent it)
    if tag_data.is_default:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can create default tags"
        )
    
    tag = QuestionTag(
        tag_text=tag_data.tag_text,
        created_by_user_id=current_user.id,
        is_default=False
    )
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    
    return QuestionTagResponse(
        id=tag.id,
        tag_text=tag.tag_text,
        is_default=tag.is_default,
        created_by_user_id=tag.created_by_user_id,
        created_at=tag.created_at
    )


@app.post("/user-responses/{response_id}/question-responses", response_model=List[QuestionResponseResponse])
async def submit_question_responses(
    response_id: int,
    responses: List[QuestionResponseCreate],
    db: AsyncSession = Depends(get_db)
):
    """
    Submit question responses for a user response.
    """
    # Verify user response exists
    response_result = await db.execute(
        select(UserResponse).where(UserResponse.id == response_id)
    )
    user_response = response_result.scalar_one_or_none()
    
    if user_response is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User response with id {response_id} not found"
        )
    
    question_responses = []
    
    for response_data in responses:
        # Verify post-response question exists
        post_q_result = await db.execute(
            select(PostResponseQuestion).where(
                PostResponseQuestion.id == response_data.post_response_question_id
            )
            .options(selectinload(PostResponseQuestion.question))
        )
        post_q = post_q_result.scalar_one_or_none()
        
        if post_q is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Post-response question with id {response_data.post_response_question_id} not found"
            )
        
        # Validate free_text_required
        if post_q.free_text_required and (not response_data.free_text_response or not response_data.free_text_response.strip()):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Free text response is required for question {post_q.id}"
            )
        
        # Create question response
        question_response = QuestionResponse(
            user_response_id=response_id,
            post_response_question_id=response_data.post_response_question_id,
            free_text_response=response_data.free_text_response
        )
        db.add(question_response)
        await db.flush()
        
        # Add selected tags
        if response_data.selected_tag_ids:
            for tag_id in response_data.selected_tag_ids:
                # Verify tag exists and is assigned to the question
                tag_result = await db.execute(
                    select(QuestionTag).where(QuestionTag.id == tag_id)
                )
                tag = tag_result.scalar_one_or_none()
                if tag is None:
                    continue
                
                # Check if tag is assigned to the question
                assignment_result = await db.execute(
                    select(QuestionTagAssignment).where(
                        and_(
                            QuestionTagAssignment.question_id == post_q.question_id,
                            QuestionTagAssignment.tag_id == tag_id
                        )
                    )
                )
                if assignment_result.scalar_one_or_none() is None:
                    continue  # Skip tags not assigned to this question
                
                response_tag = QuestionResponseTag(
                    question_response_id=question_response.id,
                    tag_id=tag_id
                )
                db.add(response_tag)
        
        question_responses.append(question_response)
    
    await db.commit()
    
    # Reload with relationships
    result_responses = []
    for qr in question_responses:
        result = await db.execute(
            select(QuestionResponse)
            .where(QuestionResponse.id == qr.id)
            .options(selectinload(QuestionResponse.selected_tags).selectinload(QuestionResponseTag.tag))
        )
        qr = result.scalar_one()
        
        result_responses.append(QuestionResponseResponse(
            id=qr.id,
            user_response_id=qr.user_response_id,
            post_response_question_id=qr.post_response_question_id,
            free_text_response=qr.free_text_response,
            created_at=qr.created_at,
            selected_tags=[QuestionTagResponse(
                id=tag.tag.id,
                tag_text=tag.tag.tag_text,
                is_default=tag.tag.is_default,
                created_by_user_id=tag.tag.created_by_user_id,
                created_at=tag.tag.created_at
            ) for tag in qr.selected_tags]
        ))
    
    return result_responses


@app.get("/train-configurations/{config_id}/questions/{post_response_question_id}/tag-statistics", response_model=List[TagStatisticsResponse])
async def get_tag_statistics(
    config_id: int,
    post_response_question_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get tag usage statistics for a question.
    """
    # Verify post-response question exists and belongs to config
    result = await db.execute(
        select(PostResponseQuestion).where(
            and_(
                PostResponseQuestion.id == post_response_question_id,
                PostResponseQuestion.train_configuration_id == config_id
            )
        )
        .options(selectinload(PostResponseQuestion.question))
    )
    post_q = result.scalar_one_or_none()
    
    if post_q is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Post-response question with id {post_response_question_id} not found"
        )
    
    # Get all question responses for this post-response question
    qr_result = await db.execute(
        select(QuestionResponse).where(
            QuestionResponse.post_response_question_id == post_response_question_id
        )
        .options(selectinload(QuestionResponse.selected_tags))
    )
    question_responses = qr_result.scalars().all()
    
    # Count tag selections
    tag_counts = {}
    for qr in question_responses:
        for response_tag in qr.selected_tags:
            tag_id = response_tag.tag_id
            if tag_id not in tag_counts:
                tag_counts[tag_id] = 0
            tag_counts[tag_id] += 1
    
    # Get tag details
    if not tag_counts:
        return []
    
    tags_result = await db.execute(
        select(QuestionTag).where(QuestionTag.id.in_(tag_counts.keys()))
    )
    tags = {tag.id: tag for tag in tags_result.scalars().all()}
    
    # Build statistics
    statistics = []
    for tag_id, count in tag_counts.items():
        if tag_id in tags:
            statistics.append(TagStatisticsResponse(
                tag_id=tag_id,
                tag_text=tags[tag_id].tag_text,
                selection_count=count
            ))
    
    # Sort by selection count descending
    statistics.sort(key=lambda x: x.selection_count, reverse=True)
    
    return statistics


@app.get("/train-configurations/{config_id}/question-responses", response_model=Dict[int, List[QuestionResponseResponse]])
async def get_question_responses_for_scenario(
    config_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all question responses for a scenario, grouped by post_response_question_id.
    Returns a dictionary mapping question_id -> list of responses.
    """
    # Get all post-response questions for this scenario
    post_q_result = await db.execute(
        select(PostResponseQuestion).where(
            PostResponseQuestion.train_configuration_id == config_id
        )
    )
    post_questions = post_q_result.scalars().all()
    post_question_ids = [pq.id for pq in post_questions]
    
    if not post_question_ids:
        return {}
    
    # Get all question responses for these questions
    qr_result = await db.execute(
        select(QuestionResponse)
        .where(QuestionResponse.post_response_question_id.in_(post_question_ids))
        .options(
            selectinload(QuestionResponse.selected_tags).selectinload(QuestionResponseTag.tag)
        )
        .order_by(QuestionResponse.created_at.desc())
    )
    question_responses = qr_result.scalars().all()
    
    # Group by post_response_question_id
    grouped = {}
    for qr in question_responses:
        question_id = qr.post_response_question_id
        if question_id not in grouped:
            grouped[question_id] = []
        
        grouped[question_id].append(QuestionResponseResponse(
            id=qr.id,
            user_response_id=qr.user_response_id,
            post_response_question_id=qr.post_response_question_id,
            free_text_response=qr.free_text_response,
            created_at=qr.created_at,
            selected_tags=[QuestionTagResponse(
                id=tag.tag.id,
                tag_text=tag.tag.tag_text,
                is_default=tag.tag.is_default,
                created_by_user_id=tag.tag.created_by_user_id,
                created_at=tag.tag.created_at
            ) for tag in qr.selected_tags]
        ))
    
    return grouped

