from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base


class TrainConfiguration(Base):
    """
    Model for storing train configuration grids.
    """
    __tablename__ = "train_configurations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=True)
    height = Column(Integer, nullable=False)
    width = Column(Integer, nullable=False)
    tiles = Column(JSON, nullable=False)  # 2D array of tiles
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationship to user responses
    user_responses = relationship("UserResponse", back_populates="train_configuration", cascade="all, delete-orphan")


class UserResponse(Base):
    """
    Model for storing user seat/floor selection responses.
    """
    __tablename__ = "user_responses"

    id = Column(Integer, primary_key=True, index=True)
    train_configuration_id = Column(Integer, ForeignKey("train_configurations.id"), nullable=False, index=True)
    row = Column(Integer, nullable=False)
    col = Column(Integer, nullable=False)
    selection_type = Column(String, nullable=False)  # "seat" or "floor"
    user_session_id = Column(String, nullable=True, index=True)
    user_id = Column(String, nullable=True, index=True)
    gender = Column(String, nullable=True, index=True)  # "man", "woman", "neutral"
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship to train configuration
    train_configuration = relationship("TrainConfiguration", back_populates="user_responses")


class ScenarioGroup(Base):
    """
    Model for storing ordered sets of scenarios for users.
    """
    __tablename__ = "scenario_groups"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, nullable=False, index=True)  # Required email field
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationship to scenario group items (ordered by order field)
    items = relationship("ScenarioGroupItem", back_populates="scenario_group", cascade="all, delete-orphan", order_by="ScenarioGroupItem.order")


class ScenarioGroupItem(Base):
    """
    Junction table for linking scenarios to groups with ordering.
    """
    __tablename__ = "scenario_group_items"

    id = Column(Integer, primary_key=True, index=True)
    scenario_group_id = Column(Integer, ForeignKey("scenario_groups.id"), nullable=False, index=True)
    train_configuration_id = Column(Integer, ForeignKey("train_configurations.id"), nullable=False, index=True)
    order = Column(Integer, nullable=False)  # Order within the group (0-indexed or 1-indexed)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    scenario_group = relationship("ScenarioGroup", back_populates="items")
    train_configuration = relationship("TrainConfiguration")

