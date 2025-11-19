from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, UniqueConstraint, Index
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
    title = Column(String, nullable=True)
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


class User(Base):
    """
    Model for storing user accounts.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, nullable=False, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    created_scenario_groups = relationship("ScenarioGroup", back_populates="created_by_user", foreign_keys="ScenarioGroup.created_by_user_id")
    scenario_group_editors = relationship("ScenarioGroupEditor", back_populates="user", cascade="all, delete-orphan")
    created_studies = relationship("Study", back_populates="created_by_user", foreign_keys="Study.created_by_user_id")


class EmailVerification(Base):
    """
    Model for storing email verification tokens and codes.
    """
    __tablename__ = "email_verifications"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, nullable=False, index=True)
    token = Column(String, nullable=True, unique=True, index=True)  # For magic link
    verification_code = Column(String, nullable=True, index=True)  # 6-digit code
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    used_at = Column(DateTime(timezone=True), nullable=True)
    verification_type = Column(String, nullable=False)  # "magic_link", "token", or "both"
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ScenarioGroup(Base):
    """
    Model for storing ordered sets of scenarios for users.
    """
    __tablename__ = "scenario_groups"

    id = Column(Integer, primary_key=True, index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    created_by_user = relationship("User", back_populates="created_scenario_groups", foreign_keys=[created_by_user_id])
    items = relationship("ScenarioGroupItem", back_populates="scenario_group", cascade="all, delete-orphan", order_by="ScenarioGroupItem.order")
    editors = relationship("ScenarioGroupEditor", back_populates="scenario_group", cascade="all, delete-orphan")
    studies = relationship("Study", back_populates="scenario_group", cascade="all, delete-orphan")


class ScenarioGroupEditor(Base):
    """
    Junction table for many-to-many relationship between users and scenario groups (editors).
    """
    __tablename__ = "scenario_group_editors"

    id = Column(Integer, primary_key=True, index=True)
    scenario_group_id = Column(Integer, ForeignKey("scenario_groups.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    scenario_group = relationship("ScenarioGroup", back_populates="editors")
    user = relationship("User", back_populates="scenario_group_editors")
    
    # Unique constraint to prevent duplicate editor assignments
    __table_args__ = (
        UniqueConstraint('scenario_group_id', 'user_id', name='uq_scenario_group_editor'),
    )


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


class Study(Base):
    """
    Model for storing studies (which consist of a scenario group, title, description, and email).
    """
    __tablename__ = "studies"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False, index=True)
    description = Column(String, nullable=True)
    email = Column(String, nullable=False, index=True)  # Email for the study participants
    scenario_group_id = Column(Integer, ForeignKey("scenario_groups.id"), nullable=False, index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    scenario_group = relationship("ScenarioGroup", back_populates="studies")
    created_by_user = relationship("User", back_populates="created_studies", foreign_keys=[created_by_user_id])

