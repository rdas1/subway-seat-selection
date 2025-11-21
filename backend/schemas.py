from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime


# Tile schemas matching frontend types
class TileSchema(BaseModel):
    type: Literal["seat", "floor", "barrier"] = Field(..., description="Type of tile: 'seat', 'floor', or 'barrier'")
    occupied: bool = Field(..., description="Whether the tile is occupied")
    person: Optional[Literal["man", "woman", "child", "neutral"]] = Field(None, description="Person type: 'man', 'woman', 'child', 'neutral', or null")
    isDoor: Optional[bool] = Field(None, description="Whether this tile is a door")
    isStanchion: Optional[bool] = Field(None, description="Whether this tile has a stanchion")


# Train Configuration Schemas
class TrainConfigurationCreate(BaseModel):
    name: Optional[str] = Field(None, description="Optional name/description for the configuration")
    title: Optional[str] = Field(None, description="Optional title for the configuration")
    height: int = Field(..., gt=0, description="Height of the grid (number of rows)")
    width: int = Field(..., gt=0, description="Width of the grid (number of columns)")
    tiles: List[List[TileSchema]] = Field(..., description="2D array of tiles representing the grid")


class TrainConfigurationResponse(BaseModel):
    id: int
    name: Optional[str]
    title: Optional[str]
    height: int
    width: int
    tiles: List[List[Dict[str, Any]]]  # JSON representation
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# User Response Schemas
class UserResponseCreate(BaseModel):
    train_configuration_id: int = Field(..., description="ID of the train configuration")
    row: int = Field(..., ge=0, description="Row position of the selection")
    col: int = Field(..., ge=0, description="Column position of the selection")
    selection_type: Literal["seat", "floor"] = Field(..., description="Type of selection: 'seat' or 'floor'")
    user_session_id: Optional[str] = Field(None, description="Optional session identifier")
    user_id: Optional[str] = Field(None, description="Optional user identifier")
    gender: Optional[Literal["man", "woman", "neutral", "prefer-not-to-say"]] = Field(None, description="User gender: 'man', 'woman', 'neutral', or 'prefer-not-to-say'")


class UserResponseResponse(BaseModel):
    id: int
    train_configuration_id: int
    row: int
    col: int
    selection_type: str
    user_session_id: Optional[str]
    user_id: Optional[str]
    gender: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# Aggregated response statistics
class ResponseStatistics(BaseModel):
    train_configuration_id: int
    total_responses: int
    seat_selections: int
    floor_selections: int
    selection_heatmap: Dict[str, int] = Field(..., description="Dictionary mapping 'row,col' to count of selections")


# Scenario Group Schemas
class ScenarioGroupItemCreate(BaseModel):
    train_configuration_id: int = Field(..., description="ID of the train configuration to add")
    order: int = Field(..., ge=0, description="Order position within the group (0-indexed)")


class ScenarioGroupItemResponse(BaseModel):
    id: int
    scenario_group_id: int
    train_configuration_id: int
    order: int
    created_at: datetime
    train_configuration: Optional[TrainConfigurationResponse] = None

    class Config:
        from_attributes = True


class ScenarioGroupCreate(BaseModel):
    items: Optional[List[ScenarioGroupItemCreate]] = Field(default=[], description="Optional list of scenarios to add initially")


class ScenarioGroupUpdate(BaseModel):
    # Currently no updatable fields, but keeping structure for future
    pass


class ScenarioGroupResponse(BaseModel):
    id: int
    created_by_user_id: int
    created_at: datetime
    updated_at: Optional[datetime]
    items: List[ScenarioGroupItemResponse] = []

    class Config:
        from_attributes = True


# Authentication Schemas
class SendVerificationRequest(BaseModel):
    email: str = Field(..., description="Email address to send verification to")
    verification_type: Literal["magic_link", "token", "both"] = Field(..., description="Type of verification to send")


class VerifyTokenRequest(BaseModel):
    email: str = Field(..., description="Email address")
    verification_code: str = Field(..., description="6-digit verification code")


class UserResponse(BaseModel):
    id: int
    email: str
    created_at: datetime

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    user: UserResponse
    message: str = "Authentication successful"


class ScenarioGroupEditorResponse(BaseModel):
    id: int
    scenario_group_id: int
    user_id: int
    created_at: datetime
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True


# Study Schemas
class StudyCreate(BaseModel):
    title: str = Field(..., description="Title of the study")
    description: Optional[str] = Field(None, description="Optional description of the study")
    email: str = Field(..., description="Email for study participants")
    scenario_group_id: int = Field(..., description="ID of the scenario group to associate with this study")


class StudyUpdate(BaseModel):
    title: Optional[str] = Field(None, description="Title of the study")
    description: Optional[str] = Field(None, description="Optional description of the study")
    email: Optional[str] = Field(None, description="Email for study participants")
    scenario_group_id: Optional[int] = Field(None, description="ID of the scenario group to associate with this study")


class StudyResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    email: str
    scenario_group_id: int
    created_by_user_id: int
    created_at: datetime
    updated_at: Optional[datetime]
    scenario_group: Optional[ScenarioGroupResponse] = None

    class Config:
        from_attributes = True


# Question Schemas
class QuestionCreate(BaseModel):
    question_text: str = Field(..., description="The question text")
    allows_free_text: bool = Field(True, description="Whether the question allows free text responses")
    allows_tags: bool = Field(True, description="Whether the question allows tag selection")
    allows_multiple_tags: bool = Field(True, description="Whether the question allows multiple tag selection (only valid if allows_tags is True)")


class QuestionResponse(BaseModel):
    id: int
    question_text: str
    allows_free_text: bool
    allows_tags: bool
    allows_multiple_tags: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class PostResponseQuestionCreate(BaseModel):
    question_id: Optional[int] = Field(None, description="ID of existing question to link, or None to create new")
    question_text: Optional[str] = Field(None, description="Question text (required if question_id not provided)")
    is_required: bool = Field(False, description="Whether the question is required (only valid if scenario is in a study)")
    free_text_required: bool = Field(False, description="Whether free text is required (only valid if scenario is in a study)")
    allows_free_text: bool = Field(True, description="Whether the question allows free text (only used when creating new Question)")
    allows_tags: bool = Field(True, description="Whether the question allows tags (only used when creating new Question)")
    order: int = Field(0, description="Order position for the question")
    tag_ids: Optional[List[int]] = Field(default=[], description="List of tag IDs to assign to the question")


class QuestionTagCreate(BaseModel):
    tag_text: str = Field(..., description="The tag text (must be unique)")
    is_default: bool = Field(False, description="Whether this is a default tag (only settable by admin)")


class QuestionTagResponse(BaseModel):
    id: int
    tag_text: str
    is_default: bool
    created_by_user_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class PostResponseQuestionResponse(BaseModel):
    id: int
    question_id: int
    train_configuration_id: int
    is_required: bool
    free_text_required: bool
    order: int
    is_default: bool
    created_at: datetime
    updated_at: Optional[datetime]
    question: QuestionResponse
    tags: List[QuestionTagResponse] = []

    class Config:
        from_attributes = True


class QuestionResponseCreate(BaseModel):
    post_response_question_id: int = Field(..., description="ID of the post-response question")
    free_text_response: Optional[str] = Field(None, description="Free text response (required if question.free_text_required=True)")
    selected_tag_ids: Optional[List[int]] = Field(default=[], description="List of selected tag IDs (always optional)")


class QuestionResponseResponse(BaseModel):
    id: int
    user_response_id: int
    post_response_question_id: int
    free_text_response: Optional[str]
    created_at: datetime
    selected_tags: List[QuestionTagResponse] = []

    class Config:
        from_attributes = True


class TagStatisticsResponse(BaseModel):
    tag_id: int
    tag_text: str
    selection_count: int


class TagLibraryResponse(BaseModel):
    default_tags: List[QuestionTagResponse] = []
    your_tags: List[QuestionTagResponse] = []
    community_tags: List[QuestionTagResponse] = []


# PreStudyQuestion Schemas
class PreStudyQuestionCreate(BaseModel):
    question_id: Optional[int] = Field(None, description="ID of existing question to link (if not provided, question_text must be provided)")
    question_text: Optional[str] = Field(None, description="Text for new question (required if question_id is not provided)")
    allows_free_text: bool = Field(True, description="Whether the question allows free text (only used when creating new Question)")
    allows_tags: bool = Field(True, description="Whether the question allows tags (only used when creating new Question)")
    allows_multiple_tags: bool = Field(True, description="Whether the question allows multiple tag selection (only used when creating new Question, only valid if allows_tags is True)")
    order: int = Field(0, description="Order position for the question")
    tag_ids: Optional[List[int]] = Field(default=[], description="List of tag IDs to assign to the question")


class PreStudyQuestionResponse(BaseModel):
    id: int
    question_id: int
    study_id: int
    order: int
    created_at: datetime
    updated_at: Optional[datetime]
    question: QuestionResponse
    tags: List[QuestionTagResponse] = []

    class Config:
        from_attributes = True

