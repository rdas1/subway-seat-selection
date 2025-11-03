# Subway Seat Selection

Full-stack application for subway seat selection with FastAPI backend and React frontend.

## Tech Stack

- **Backend**: FastAPI, PostgreSQL, SQLAlchemy (async)
- **Frontend**: React, Vite, TypeScript
- **Database**: PostgreSQL
- **Containerization**: Docker, Docker Compose

## Quick Start

### Option 1: Docker Compose (Recommended for local development)

```bash
# Start all services (backend, frontend, database)
docker-compose up --build

# Access the application:
# Frontend: http://localhost
# Backend API: http://localhost:8000
# Backend Docs: http://localhost:8000/docs
```

### Option 2: Local Development

#### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set up PostgreSQL (or use Docker Compose)
# Update .env with your database credentials
uvicorn main:app --reload --port 8000
```

#### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

## Project Structure

```
subway-seat-selection/
├── backend/           # FastAPI backend
│   ├── main.py       # FastAPI application
│   ├── database.py   # Database configuration
│   ├── models.py     # SQLAlchemy models
│   ├── Dockerfile    # Backend Docker image
│   └── requirements.txt
├── frontend/         # React frontend
│   ├── src/         # React source code
│   ├── Dockerfile   # Frontend Docker image
│   ├── nginx.conf   # Nginx configuration
│   └── package.json
├── docker-compose.yml      # Local development
├── docker-compose.prod.yml # Production setup
└── DEPLOYMENT.md     # Deployment guide
```

## Docker Commands

### Development

```bash
# Start all services
docker-compose up

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild and start
docker-compose up --build
```

### Production Build

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Start production services
docker-compose -f docker-compose.prod.yml up -d
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions on deploying to:
- Google Cloud Run
- AWS EC2

## Environment Variables

### Backend

Create `backend/.env`:
```
DATABASE_URL=postgresql+asyncpg://user:password@host:port/database
CORS_ORIGINS=http://localhost:5173,https://yourdomain.com
```

### Frontend

Create `frontend/.env`:
```
VITE_API_URL=http://localhost:8000
```

## API Documentation

Once the backend is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Development

### Adding Database Models

1. Add your model to `backend/models.py`
2. Tables are automatically created on server startup
3. Use `from database import get_db` in your routes

### Frontend Development

The frontend is configured to proxy API requests through Vite. API calls to `/api/*` are automatically forwarded to `http://localhost:8000`.

## License

MIT


## Hot Module Reloading (HMR)

Both backend and frontend support HMR:

### Backend HMR ✅
- Already configured in `docker-compose.yml`
- Uses `uvicorn --reload` flag
- Code changes in `backend/` will automatically reload the server

### Frontend HMR ✅
- Development mode uses Vite dev server with HMR
- Code changes in `frontend/src/` will automatically update in the browser
- Access frontend at: http://localhost:5173 (development) or http://localhost (production build)

**Note:** The development setup uses Vite dev server on port 5173. For production builds, use the production docker-compose file or run `npm run build` locally.
