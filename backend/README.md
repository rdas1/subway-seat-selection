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

