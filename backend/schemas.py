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
    height: int = Field(..., gt=0, description="Height of the grid (number of rows)")
    width: int = Field(..., gt=0, description="Width of the grid (number of columns)")
    tiles: List[List[TileSchema]] = Field(..., description="2D array of tiles representing the grid")


class TrainConfigurationResponse(BaseModel):
    id: int
    name: Optional[str]
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

