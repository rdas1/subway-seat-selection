"""add_pre_and_post_study_question_responses

Revision ID: 4aaa2d6aa9e3
Revises: 998d7e542684
Create Date: 2025-11-21 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4aaa2d6aa9e3'
down_revision: Union[str, None] = '998d7e542684'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create pre_study_question_responses table
    op.create_table('pre_study_question_responses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('pre_study_question_id', sa.Integer(), nullable=False),
        sa.Column('user_session_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('free_text_response', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['pre_study_question_id'], ['pre_study_questions.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('pre_study_question_id', 'user_session_id', name='uq_pre_study_question_response')
    )
    op.create_index(op.f('ix_pre_study_question_responses_id'), 'pre_study_question_responses', ['id'], unique=False)
    op.create_index(op.f('ix_pre_study_question_responses_pre_study_question_id'), 'pre_study_question_responses', ['pre_study_question_id'], unique=False)
    op.create_index(op.f('ix_pre_study_question_responses_user_session_id'), 'pre_study_question_responses', ['user_session_id'], unique=False)
    op.create_index(op.f('ix_pre_study_question_responses_user_id'), 'pre_study_question_responses', ['user_id'], unique=False)

    # Create pre_study_question_response_tags table
    op.create_table('pre_study_question_response_tags',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('pre_study_question_response_id', sa.Integer(), nullable=False),
        sa.Column('tag_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['pre_study_question_response_id'], ['pre_study_question_responses.id'], ),
        sa.ForeignKeyConstraint(['tag_id'], ['question_tags.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('pre_study_question_response_id', 'tag_id', name='uq_pre_study_question_response_tag')
    )
    op.create_index(op.f('ix_pre_study_question_response_tags_id'), 'pre_study_question_response_tags', ['id'], unique=False)
    op.create_index(op.f('ix_pre_study_question_response_tags_pre_study_question_response_id'), 'pre_study_question_response_tags', ['pre_study_question_response_id'], unique=False)
    op.create_index(op.f('ix_pre_study_question_response_tags_tag_id'), 'pre_study_question_response_tags', ['tag_id'], unique=False)

    # Create post_study_question_responses table
    op.create_table('post_study_question_responses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('post_study_question_id', sa.Integer(), nullable=False),
        sa.Column('user_session_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('free_text_response', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['post_study_question_id'], ['post_study_questions.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('post_study_question_id', 'user_session_id', name='uq_post_study_question_response')
    )
    op.create_index(op.f('ix_post_study_question_responses_id'), 'post_study_question_responses', ['id'], unique=False)
    op.create_index(op.f('ix_post_study_question_responses_post_study_question_id'), 'post_study_question_responses', ['post_study_question_id'], unique=False)
    op.create_index(op.f('ix_post_study_question_responses_user_session_id'), 'post_study_question_responses', ['user_session_id'], unique=False)
    op.create_index(op.f('ix_post_study_question_responses_user_id'), 'post_study_question_responses', ['user_id'], unique=False)

    # Create post_study_question_response_tags table
    op.create_table('post_study_question_response_tags',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('post_study_question_response_id', sa.Integer(), nullable=False),
        sa.Column('tag_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['post_study_question_response_id'], ['post_study_question_responses.id'], ),
        sa.ForeignKeyConstraint(['tag_id'], ['question_tags.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('post_study_question_response_id', 'tag_id', name='uq_post_study_question_response_tag')
    )
    op.create_index(op.f('ix_post_study_question_response_tags_id'), 'post_study_question_response_tags', ['id'], unique=False)
    op.create_index(op.f('ix_post_study_question_response_tags_post_study_question_response_id'), 'post_study_question_response_tags', ['post_study_question_response_id'], unique=False)
    op.create_index(op.f('ix_post_study_question_response_tags_tag_id'), 'post_study_question_response_tags', ['tag_id'], unique=False)


def downgrade() -> None:
    # Drop tables in reverse order (tags first, then responses)
    op.drop_index(op.f('ix_post_study_question_response_tags_tag_id'), table_name='post_study_question_response_tags')
    op.drop_index(op.f('ix_post_study_question_response_tags_post_study_question_response_id'), table_name='post_study_question_response_tags')
    op.drop_index(op.f('ix_post_study_question_response_tags_id'), table_name='post_study_question_response_tags')
    op.drop_table('post_study_question_response_tags')

    op.drop_index(op.f('ix_post_study_question_responses_user_id'), table_name='post_study_question_responses')
    op.drop_index(op.f('ix_post_study_question_responses_user_session_id'), table_name='post_study_question_responses')
    op.drop_index(op.f('ix_post_study_question_responses_post_study_question_id'), table_name='post_study_question_responses')
    op.drop_index(op.f('ix_post_study_question_responses_id'), table_name='post_study_question_responses')
    op.drop_table('post_study_question_responses')

    op.drop_index(op.f('ix_pre_study_question_response_tags_tag_id'), table_name='pre_study_question_response_tags')
    op.drop_index(op.f('ix_pre_study_question_response_tags_pre_study_question_response_id'), table_name='pre_study_question_response_tags')
    op.drop_index(op.f('ix_pre_study_question_response_tags_id'), table_name='pre_study_question_response_tags')
    op.drop_table('pre_study_question_response_tags')

    op.drop_index(op.f('ix_pre_study_question_responses_user_id'), table_name='pre_study_question_responses')
    op.drop_index(op.f('ix_pre_study_question_responses_user_session_id'), table_name='pre_study_question_responses')
    op.drop_index(op.f('ix_pre_study_question_responses_pre_study_question_id'), table_name='pre_study_question_responses')
    op.drop_index(op.f('ix_pre_study_question_responses_id'), table_name='pre_study_question_responses')
    op.drop_table('pre_study_question_responses')

