"""
Seeder script to create sample scenarios with 20x5 grids.
Run this script to populate the database with default train configurations.
"""
import asyncio
import random
from sqlalchemy import select
from database import AsyncSessionLocal, init_db, close_db
from models import (
    TrainConfiguration, Question, PostResponseQuestion, 
    QuestionTag, QuestionTagAssignment
)

# Default tags that should be available for the default question
DEFAULT_TAGS = [
    "comfort",
    "maximizing personal space",
    "wanted to sit down",
    "wanted to stand up",
    "accessibility",
    "convenience",
    "privacy",
    "safety",
    "view",
    "proximity to door"
]


def create_default_grid_tiles(percent_filled: float = 0.6) -> list:
    """
    Create a 20x5 grid with the default subway car layout.
    Based on the pattern from frontend/src/data/sampleGrids.ts
    
    Columns 0 and 4: benches (vertical - 2 seats, gap 3, 10 seats, gap 3, 2 seats)
    Columns 1, 2, and 3: aisle (all floor tiles)
    Column 2: Middle column with stanchions (roughly every 3 rows)
    
    Args:
        percent_filled: Percentage of seats to fill (0.0 to 1.0)
    
    Returns:
        2D list of tile dictionaries
    """
    height = 20
    width = 5
    tiles = []
    
    # Create 20 rows
    for row in range(height):
        row_tiles = []
        
        # Column 0: First bench column (seats in rows 0-1, 5-14, 18-19; floor in rows 2-4, 15-17)
        if row <= 1:
            # First 2-seat bench
            row_tiles.append({"type": "seat", "occupied": False})
        elif row <= 4:
            # Door gap - left side (rows 2-4, column 0) - 3 tiles
            row_tiles.append({"type": "floor", "occupied": False, "isDoor": True})
        elif row <= 14:
            # 10-seat bench
            row_tiles.append({"type": "seat", "occupied": False})
        elif row <= 17:
            # Door gap - left side (rows 15-17, column 0) - 3 tiles
            row_tiles.append({"type": "floor", "occupied": False, "isDoor": True})
        elif row <= 19:
            # Last 2-seat bench
            row_tiles.append({"type": "seat", "occupied": False})
        
        # Column 1: Aisle (floor tile)
        row_tiles.append({"type": "floor", "occupied": False})
        
        # Column 2: Middle column with stanchions (roughly every 3 rows)
        is_stanchion_row = row % 3 == 2  # Rows 2, 5, 8, 11, 14, 17 (0-indexed)
        row_tiles.append({
            "type": "floor",
            "occupied": False,
            "isStanchion": is_stanchion_row
        })
        
        # Column 3: Aisle (floor tile)
        row_tiles.append({"type": "floor", "occupied": False})
        
        # Column 4: Last bench column (seats in rows 0-1, 5-14, 18-19; floor in rows 2-4, 15-17)
        if row <= 1:
            # First 2-seat bench
            row_tiles.append({"type": "seat", "occupied": False})
        elif row <= 4:
            # Door gap - right side (rows 2-4, column 4) - 3 tiles
            row_tiles.append({"type": "floor", "occupied": False, "isDoor": True})
        elif row <= 14:
            # 10-seat bench
            row_tiles.append({"type": "seat", "occupied": False})
        elif row <= 17:
            # Door gap - right side (rows 15-17, column 4) - 3 tiles
            row_tiles.append({"type": "floor", "occupied": False, "isDoor": True})
        elif row <= 19:
            # Last 2-seat bench
            row_tiles.append({"type": "seat", "occupied": False})
        
        tiles.append(row_tiles)
    
    # Now randomly populate seats and floor tiles based on percent_filled
    person_types = ["man", "woman"]
    seat_tiles = []
    floor_tiles = []
    
    # Collect all seat tiles and floor tiles (excluding door tiles and stanchions)
    for row in range(height):
        for col in range(width):
            tile = tiles[row][col]
            if tile["type"] == "seat":
                seat_tiles.append({"row": row, "col": col})
            elif tile["type"] == "floor" and not tile.get("isDoor") and not tile.get("isStanchion"):
                # Only non-door, non-stanchion floor tiles can be occupied
                floor_tiles.append({"row": row, "col": col})
    
    # Randomly shuffle and select seats to fill
    num_seats_to_fill = int(len(seat_tiles) * percent_filled)
    
    # Shuffle seat array using Fisher-Yates algorithm
    for i in range(len(seat_tiles) - 1, 0, -1):
        j = random.randint(0, i)
        seat_tiles[i], seat_tiles[j] = seat_tiles[j], seat_tiles[i]
    
    # Fill the selected seats with random people
    for i in range(num_seats_to_fill):
        pos = seat_tiles[i]
        random_person = random.choice(person_types)
        tiles[pos["row"]][pos["col"]]["occupied"] = True
        tiles[pos["row"]][pos["col"]]["person"] = random_person
    
    # Randomly populate some floor tiles (fewer than seats - about 10% of floor tiles)
    floor_percent_filled = 0.1  # 10% of floor tiles
    num_floor_tiles_to_fill = int(len(floor_tiles) * floor_percent_filled)
    
    # Shuffle floor array using Fisher-Yates algorithm
    for i in range(len(floor_tiles) - 1, 0, -1):
        j = random.randint(0, i)
        floor_tiles[i], floor_tiles[j] = floor_tiles[j], floor_tiles[i]
    
    # Fill the selected floor tiles with random people
    for i in range(num_floor_tiles_to_fill):
        pos = floor_tiles[i]
        random_person = random.choice(person_types)
        tiles[pos["row"]][pos["col"]]["occupied"] = True
        tiles[pos["row"]][pos["col"]]["person"] = random_person
    
    return tiles


async def get_or_create_default_question(db):
    """
    Get or create the default question "Why did you choose this spot?"
    """
    default_question_text = "Why did you choose this spot?"
    
    # Check if a default question already exists (by text)
    question_result = await db.execute(
        select(Question).where(Question.question_text == default_question_text)
    )
    existing_question = question_result.scalar_one_or_none()
    
    if existing_question:
        return existing_question
    
    # Create a new default question
    default_question = Question(
        question_text=default_question_text,
        allows_free_text=True,
        allows_tags=True,
        allows_multiple_tags=True
    )
    db.add(default_question)
    await db.flush()
    return default_question


async def get_or_create_default_tags(db):
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
                created_by_user_id=None,
                is_default=True
            )
            db.add(tag)
            await db.flush()
        
        default_tags.append(tag)
    
    return default_tags


async def create_scenario_with_defaults(db, name: str, title: str, percent_filled: float):
    """
    Create a train configuration with default question and tags.
    """
    # Create the grid tiles
    tiles = create_default_grid_tiles(percent_filled)
    
    # Create the train configuration
    train_config = TrainConfiguration(
        name=name,
        title=title,
        height=20,
        width=5,
        tiles=tiles
    )
    db.add(train_config)
    await db.flush()
    
    # Get or create default question
    default_question = await get_or_create_default_question(db)
    
    # Create PostResponseQuestion for this configuration
    post_response_question = PostResponseQuestion(
        question_id=default_question.id,
        train_configuration_id=train_config.id,
        is_required=False,
        free_text_required=False,
        order=0,
        is_default=True
    )
    db.add(post_response_question)
    await db.flush()
    
    # Get or create default tags
    default_tags = await get_or_create_default_tags(db)
    
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
    
    return train_config


async def seed_scenarios():
    """
    Seed the database with sample scenarios.
    """
    # Initialize database
    await init_db()
    
    async with AsyncSessionLocal() as db:
        # Check if scenarios already exist
        result = await db.execute(select(TrainConfiguration))
        existing_configs = result.scalars().all()
        
        if existing_configs:
            print(f"Found {len(existing_configs)} existing train configurations.")
            response = input("Do you want to create additional scenarios? (y/n): ")
            if response.lower() != 'y':
                print("Skipping scenario creation.")
                return
        
        # Define scenarios to create
        scenarios = [
            {
                "name": "Morning Rush - Crowded",
                "title": "Morning Rush - Crowded",
                "percent_filled": 0.85
            },
            {
                "name": "Midday - Moderate",
                "title": "Midday - Moderate",
                "percent_filled": 0.55
            },
            {
                "name": "Evening Commute - Busy",
                "title": "Evening Commute - Busy",
                "percent_filled": 0.75
            },
            {
                "name": "Late Night - Sparse",
                "title": "Late Night - Sparse",
                "percent_filled": 0.25
            },
            {
                "name": "Weekend - Light",
                "title": "Weekend - Light",
                "percent_filled": 0.40
            }
        ]
        
        print(f"\nCreating {len(scenarios)} scenarios...")
        
        created_count = 0
        for scenario in scenarios:
            try:
                train_config = await create_scenario_with_defaults(
                    db,
                    scenario["name"],
                    scenario["title"],
                    scenario["percent_filled"]
                )
                print(f"  ✓ Created scenario: {scenario['name']} (ID: {train_config.id}, {scenario['percent_filled']*100:.0f}% filled)")
                created_count += 1
            except Exception as e:
                print(f"  ✗ Failed to create scenario '{scenario['name']}': {e}")
        
        # Commit all changes
        await db.commit()
        
        print(f"\nSummary:")
        print(f"  Created {created_count} scenarios")
        print(f"  Total scenarios in database: {len(existing_configs) + created_count}")
    
    # Close database connections
    await close_db()


if __name__ == "__main__":
    asyncio.run(seed_scenarios())

