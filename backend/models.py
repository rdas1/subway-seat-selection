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

