# Subway Seat Selection Backend

FastAPI backend for the Subway Seat Selection application.

## Prerequisites

- Python 3.8+
- PostgreSQL 12+
- pip

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up PostgreSQL database:
```bash
# Create a new database (using psql)
createdb subway_seat_selection

# Or using SQL
psql -U postgres
CREATE DATABASE subway_seat_selection;
```

4. Configure environment variables:
   - Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   - Update `.env` with your PostgreSQL credentials:
   ```
   DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/subway_seat_selection
   ```
   Replace `postgres:postgres` with your PostgreSQL username and password.

## Running the Server

```bash
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`

API documentation is available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Database

The database connection is automatically initialized when the server starts. Tables are created automatically based on models defined in `models.py`.

Test the database connection:
```bash
curl http://localhost:8000/db-test
```

### Backpopulate Default Questions

To add the default question "Why did you choose this spot?" to all existing scenarios, run:

```bash
python backpopulate_default_questions.py
```

Or if using Python 3 explicitly:

```bash
python3 backpopulate_default_questions.py
```

This is a one-time operation that will:
- Find or create the default question
- Add it to all scenarios that don't already have it
- Skip scenarios that already have the default question

**Note:** Make sure your database is running and the `DATABASE_URL` environment variable is set correctly before running this script.

## API Endpoints

### Train Configurations

- **POST `/train-configurations`** - Create a new train configuration
  - Body: `TrainConfigurationCreate` (name, height, width, tiles)
  - Returns: `TrainConfigurationResponse`

- **GET `/train-configurations`** - List all train configurations
  - Query params: `skip` (default: 0), `limit` (default: 100)
  - Returns: List of `TrainConfigurationResponse`

- **GET `/train-configurations/{config_id}`** - Get a specific train configuration
  - Returns: `TrainConfigurationResponse`

- **GET `/train-configurations/{config_id}/statistics`** - Get response statistics for a configuration
  - Returns: `ResponseStatistics` (total responses, seat/floor counts, heatmap)

### User Responses

- **POST `/user-responses`** - Submit a user response (where they chose to sit/stand)
  - Body: `UserResponseCreate` (train_configuration_id, row, col, selection_type, user_session_id, user_id)
  - Returns: `UserResponseResponse`

- **GET `/user-responses`** - List user responses with optional filtering
  - Query params: `train_configuration_id`, `user_session_id`, `user_id`, `skip`, `limit`
  - Returns: List of `UserResponseResponse`

- **GET `/user-responses/{response_id}`** - Get a specific user response
  - Returns: `UserResponseResponse`

## Data Models

### TrainConfiguration
Stores train grid configurations with:
- `id`: Unique identifier
- `name`: Optional name/description
- `height`: Grid height (rows)
- `width`: Grid width (columns)
- `tiles`: 2D array of tiles stored as JSON
- `created_at`, `updated_at`: Timestamps

### UserResponse
Stores individual user selections with:
- `id`: Unique identifier
- `train_configuration_id`: Reference to the train configuration
- `row`, `col`: Position of the selection
- `selection_type`: "seat" or "floor"
- `user_session_id`: Optional session identifier
- `user_id`: Optional user identifier
- `created_at`: Timestamp

