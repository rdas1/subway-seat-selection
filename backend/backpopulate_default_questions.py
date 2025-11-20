"""
One-time script to backpopulate all existing scenarios with the default question.
Run this script once to add the default question "Why did you choose this spot?" to all existing scenarios.
"""
import asyncio
from sqlalchemy import select
from database import AsyncSessionLocal, init_db, close_db
from models import TrainConfiguration, Question, PostResponseQuestion, QuestionTag, QuestionTagAssignment

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


async def backpopulate_default_questions():
    """
    Add the default question to all existing scenarios that don't have it.
    """
    # Initialize database
    await init_db()
    
    async with AsyncSessionLocal() as db:
        # Get all train configurations
        result = await db.execute(select(TrainConfiguration))
        all_configs = result.scalars().all()
        
        print(f"Found {len(all_configs)} train configurations")
        
        # Find or create the default question
        default_question_text = "Why did you choose this spot?"
        
        # Check if a default question already exists (by text)
        question_result = await db.execute(
            select(Question).where(Question.question_text == default_question_text)
        )
        existing_questions = question_result.scalars().all()
        
        default_question = None
        if existing_questions:
            # Use the first existing default question
            default_question = existing_questions[0]
            print(f"Found existing default question (ID: {default_question.id}): '{default_question_text}'")
        else:
            # Create a new default question
            default_question = Question(
                question_text=default_question_text,
                allows_free_text=True,
                allows_tags=True
            )
            db.add(default_question)
            await db.flush()
            print(f"Created new default question (ID: {default_question.id}): '{default_question_text}'")
        
        # Process each configuration
        added_count = 0
        skipped_count = 0
        
        for config in all_configs:
            # Check if this configuration already has a default question
            # (check by is_default flag, not by question_id, since different scenarios might have different question instances)
            post_q_result = await db.execute(
                select(PostResponseQuestion).where(
                    PostResponseQuestion.train_configuration_id == config.id,
                    PostResponseQuestion.is_default == True
                )
            )
            existing = post_q_result.scalar_one_or_none()
            
            if existing:
                # Get or create default tags first
                default_tags = []
                for tag_text in DEFAULT_TAGS:
                    tag_result = await db.execute(
                        select(QuestionTag).where(QuestionTag.tag_text == tag_text)
                    )
                    tag = tag_result.scalar_one_or_none()
                    
                    if not tag:
                        tag = QuestionTag(
                            tag_text=tag_text,
                            created_by_user_id=None,
                            is_default=True
                        )
                        db.add(tag)
                        await db.flush()
                    
                    default_tags.append(tag)
                
                # Check which tags are missing and add only those
                tags_added = 0
                for order, tag in enumerate(default_tags):
                    # Check if this specific assignment already exists
                    assignment_check = await db.execute(
                        select(QuestionTagAssignment).where(
                            QuestionTagAssignment.question_id == existing.question_id,
                            QuestionTagAssignment.tag_id == tag.id
                        )
                    )
                    if assignment_check.scalar_one_or_none() is None:
                        assignment = QuestionTagAssignment(
                            question_id=existing.question_id,
                            tag_id=tag.id,
                            order=order
                        )
                        db.add(assignment)
                        tags_added += 1
                
                if tags_added > 0:
                    print(f"  Scenario {config.id} ({config.name or 'unnamed'}): Added {tags_added} default tag(s) to existing question")
                    added_count += 1
                else:
                    print(f"  Scenario {config.id} ({config.name or 'unnamed'}): Already has default question with all tags, skipping")
                    skipped_count += 1
            else:
                # Create PostResponseQuestion for this configuration
                # Use the shared default question
                post_response_question = PostResponseQuestion(
                    question_id=default_question.id,
                    train_configuration_id=config.id,
                    is_required=False,
                    free_text_required=False,
                    order=0,
                    is_default=True
                )
                db.add(post_response_question)
                await db.flush()
                
                # Get or create default tags and assign them to the default question
                # Get or create default tags first
                default_tags = []
                for tag_text in DEFAULT_TAGS:
                    tag_result = await db.execute(
                        select(QuestionTag).where(QuestionTag.tag_text == tag_text)
                    )
                    tag = tag_result.scalar_one_or_none()
                    
                    if not tag:
                        tag = QuestionTag(
                            tag_text=tag_text,
                            created_by_user_id=None,
                            is_default=True
                        )
                        db.add(tag)
                        await db.flush()
                    
                    default_tags.append(tag)
                
                # Assign tags to the question (check each one individually to avoid duplicates)
                for order, tag in enumerate(default_tags):
                    # Check if this specific assignment already exists
                    assignment_check = await db.execute(
                        select(QuestionTagAssignment).where(
                            QuestionTagAssignment.question_id == default_question.id,
                            QuestionTagAssignment.tag_id == tag.id
                        )
                    )
                    if assignment_check.scalar_one_or_none() is None:
                        assignment = QuestionTagAssignment(
                            question_id=default_question.id,
                            tag_id=tag.id,
                            order=order
                        )
                        db.add(assignment)
                
                print(f"  Scenario {config.id} ({config.name or 'unnamed'}): Added default question with tags")
                added_count += 1
        
        # Commit all changes
        await db.commit()
        
        print(f"\nSummary:")
        print(f"  Added default question/tags to {added_count} scenarios")
        print(f"  Skipped {skipped_count} scenarios (already had default question with tags)")
        print(f"  Total processed: {len(all_configs)} scenarios")
    
    # Close database connections
    await close_db()


if __name__ == "__main__":
    asyncio.run(backpopulate_default_questions())

