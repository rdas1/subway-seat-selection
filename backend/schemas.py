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
    gender: Optional[Literal["man", "woman", "neutral"]] = Field(None, description="User gender: 'man', 'woman', or 'neutral'")


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

