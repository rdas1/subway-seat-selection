from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, UniqueConstraint, Index, Boolean, Text
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
    # Relationship to post-response questions
    post_response_questions = relationship("PostResponseQuestion", back_populates="train_configuration", cascade="all, delete-orphan")


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
    # Relationship to question responses
    question_responses = relationship("QuestionResponse", back_populates="user_response", cascade="all, delete-orphan")


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
    created_tags = relationship("QuestionTag", back_populates="created_by_user", foreign_keys="QuestionTag.created_by_user_id")


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
    pre_study_questions = relationship("PreStudyQuestion", back_populates="study", cascade="all, delete-orphan")
    post_study_questions = relationship("PostStudyQuestion", back_populates="study", cascade="all, delete-orphan")


class Question(Base):
    """
    Base model for storing questions (used by PostResponseQuestion, PreStudyQuestion, PostStudyQuestion, etc.).
    """
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    question_text = Column(String, nullable=False)
    allows_free_text = Column(Boolean, nullable=False, default=True)
    allows_tags = Column(Boolean, nullable=False, default=True)
    allows_multiple_tags = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    post_response_questions = relationship("PostResponseQuestion", back_populates="question", cascade="all, delete-orphan")
    pre_study_questions = relationship("PreStudyQuestion", back_populates="question", cascade="all, delete-orphan")
    post_study_questions = relationship("PostStudyQuestion", back_populates="question", cascade="all, delete-orphan")
    tag_assignments = relationship("QuestionTagAssignment", back_populates="question", cascade="all, delete-orphan")


class PostResponseQuestion(Base):
    """
    Model for storing post-response questions linked to train configurations.
    """
    __tablename__ = "post_response_questions"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False, index=True)
    train_configuration_id = Column(Integer, ForeignKey("train_configurations.id"), nullable=False, index=True)
    is_required = Column(Boolean, nullable=False, default=False)
    free_text_required = Column(Boolean, nullable=False, default=False)
    order = Column(Integer, nullable=False, default=0)
    is_default = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    question = relationship("Question", back_populates="post_response_questions")
    train_configuration = relationship("TrainConfiguration", back_populates="post_response_questions")
    question_responses = relationship("QuestionResponse", back_populates="post_response_question", cascade="all, delete-orphan")
    
    # Unique constraint to prevent duplicate question assignments
    __table_args__ = (
        UniqueConstraint('question_id', 'train_configuration_id', name='uq_post_response_question'),
    )


class PreStudyQuestion(Base):
    """
    Model for storing pre-study questions linked to studies.
    """
    __tablename__ = "pre_study_questions"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False, index=True)
    study_id = Column(Integer, ForeignKey("studies.id"), nullable=False, index=True)
    is_required = Column(Boolean, nullable=False, default=False)
    order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    question = relationship("Question", back_populates="pre_study_questions")
    study = relationship("Study", back_populates="pre_study_questions")
    question_responses = relationship("PreStudyQuestionResponse", back_populates="pre_study_question", cascade="all, delete-orphan")
    
    # Unique constraint to prevent duplicate question assignments
    __table_args__ = (
        UniqueConstraint('question_id', 'study_id', name='uq_pre_study_question'),
    )


class PostStudyQuestion(Base):
    """
    Model for storing post-study questions linked to studies.
    """
    __tablename__ = "post_study_questions"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False, index=True)
    study_id = Column(Integer, ForeignKey("studies.id"), nullable=False, index=True)
    is_required = Column(Boolean, nullable=False, default=False)
    order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    question = relationship("Question", back_populates="post_study_questions")
    study = relationship("Study", back_populates="post_study_questions")
    question_responses = relationship("PostStudyQuestionResponse", back_populates="post_study_question", cascade="all, delete-orphan")
    
    # Unique constraint to prevent duplicate question assignments
    __table_args__ = (
        UniqueConstraint('question_id', 'study_id', name='uq_post_study_question'),
    )


class QuestionTag(Base):
    """
    Model for storing question tags (global tag library).
    """
    __tablename__ = "question_tags"

    id = Column(Integer, primary_key=True, index=True)
    tag_text = Column(String, nullable=False, unique=True, index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    is_default = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    created_by_user = relationship("User", back_populates="created_tags", foreign_keys=[created_by_user_id])
    tag_assignments = relationship("QuestionTagAssignment", back_populates="tag", cascade="all, delete-orphan")
    question_response_tags = relationship("QuestionResponseTag", back_populates="tag", cascade="all, delete-orphan")
    pre_study_question_response_tags = relationship("PreStudyQuestionResponseTag", back_populates="tag", cascade="all, delete-orphan")
    post_study_question_response_tags = relationship("PostStudyQuestionResponseTag", back_populates="tag", cascade="all, delete-orphan")


class QuestionTagAssignment(Base):
    """
    Junction table for linking tags to questions.
    """
    __tablename__ = "question_tag_assignments"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False, index=True)
    tag_id = Column(Integer, ForeignKey("question_tags.id"), nullable=False, index=True)
    order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    question = relationship("Question", back_populates="tag_assignments")
    tag = relationship("QuestionTag", back_populates="tag_assignments")
    
    # Unique constraint to prevent duplicate tag assignments
    __table_args__ = (
        UniqueConstraint('question_id', 'tag_id', name='uq_question_tag_assignment'),
    )


class QuestionResponse(Base):
    """
    Model for storing user responses to questions.
    """
    __tablename__ = "question_responses"

    id = Column(Integer, primary_key=True, index=True)
    user_response_id = Column(Integer, ForeignKey("user_responses.id"), nullable=False, index=True)
    post_response_question_id = Column(Integer, ForeignKey("post_response_questions.id"), nullable=False, index=True)
    free_text_response = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user_response = relationship("UserResponse", back_populates="question_responses")
    post_response_question = relationship("PostResponseQuestion", back_populates="question_responses")
    selected_tags = relationship("QuestionResponseTag", back_populates="question_response", cascade="all, delete-orphan")


class QuestionResponseTag(Base):
    """
    Junction table for linking selected tags to question responses.
    """
    __tablename__ = "question_response_tags"

    id = Column(Integer, primary_key=True, index=True)
    question_response_id = Column(Integer, ForeignKey("question_responses.id"), nullable=False, index=True)
    tag_id = Column(Integer, ForeignKey("question_tags.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    question_response = relationship("QuestionResponse", back_populates="selected_tags")
    tag = relationship("QuestionTag", back_populates="question_response_tags")
    
    # Unique constraint to prevent duplicate tag selections
    __table_args__ = (
        UniqueConstraint('question_response_id', 'tag_id', name='uq_question_response_tag'),
    )


class PreStudyQuestionResponse(Base):
    """
    Model for storing user responses to pre-study questions.
    """
    __tablename__ = "pre_study_question_responses"

    id = Column(Integer, primary_key=True, index=True)
    pre_study_question_id = Column(Integer, ForeignKey("pre_study_questions.id"), nullable=False, index=True)
    user_session_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=True, index=True)
    free_text_response = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    pre_study_question = relationship("PreStudyQuestion", back_populates="question_responses")
    selected_tags = relationship("PreStudyQuestionResponseTag", back_populates="question_response", cascade="all, delete-orphan")
    
    # Unique constraint to prevent duplicate responses from same session
    __table_args__ = (
        UniqueConstraint('pre_study_question_id', 'user_session_id', name='uq_pre_study_question_response'),
    )


class PreStudyQuestionResponseTag(Base):
    """
    Junction table for linking selected tags to pre-study question responses.
    """
    __tablename__ = "pre_study_question_response_tags"

    id = Column(Integer, primary_key=True, index=True)
    pre_study_question_response_id = Column(Integer, ForeignKey("pre_study_question_responses.id"), nullable=False, index=True)
    tag_id = Column(Integer, ForeignKey("question_tags.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    question_response = relationship("PreStudyQuestionResponse", back_populates="selected_tags")
    tag = relationship("QuestionTag", back_populates="pre_study_question_response_tags")
    
    # Unique constraint to prevent duplicate tag selections
    __table_args__ = (
        UniqueConstraint('pre_study_question_response_id', 'tag_id', name='uq_pre_study_question_response_tag'),
    )


class PostStudyQuestionResponse(Base):
    """
    Model for storing user responses to post-study questions.
    """
    __tablename__ = "post_study_question_responses"

    id = Column(Integer, primary_key=True, index=True)
    post_study_question_id = Column(Integer, ForeignKey("post_study_questions.id"), nullable=False, index=True)
    user_session_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=True, index=True)
    free_text_response = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    post_study_question = relationship("PostStudyQuestion", back_populates="question_responses")
    selected_tags = relationship("PostStudyQuestionResponseTag", back_populates="question_response", cascade="all, delete-orphan")
    
    # Unique constraint to prevent duplicate responses from same session
    __table_args__ = (
        UniqueConstraint('post_study_question_id', 'user_session_id', name='uq_post_study_question_response'),
    )


class PostStudyQuestionResponseTag(Base):
    """
    Junction table for linking selected tags to post-study question responses.
    """
    __tablename__ = "post_study_question_response_tags"

    id = Column(Integer, primary_key=True, index=True)
    post_study_question_response_id = Column(Integer, ForeignKey("post_study_question_responses.id"), nullable=False, index=True)
    tag_id = Column(Integer, ForeignKey("question_tags.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    question_response = relationship("PostStudyQuestionResponse", back_populates="selected_tags")
    tag = relationship("QuestionTag", back_populates="post_study_question_response_tags")
    
    # Unique constraint to prevent duplicate tag selections
    __table_args__ = (
        UniqueConstraint('post_study_question_response_id', 'tag_id', name='uq_post_study_question_response_tag'),
    )

