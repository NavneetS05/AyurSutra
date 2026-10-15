# AyurSutra — root README

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env        # edit DATABASE_URL if using PostgreSQL
python seed.py              # create tables + demo data
uvicorn app.main:app --reload --port 8000
```
API docs → http://localhost:8000/docs

### Frontend
```bash
cd frontend
npm install
npm run dev
```
App → http://localhost:5173

### Run tests
```bash
cd backend
pytest tests/unit/ -v
```

## Project Structure
```
ayursutra/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/   # FastAPI routers
│   │   ├── core/               # config, security, dependencies
│   │   ├── db/                 # session, base
│   │   ├── models/             # SQLAlchemy models
│   │   └── services/           # scheduler, PDF generation
│   ├── tests/
│   ├── seed.py
│   └── requirements.txt
└── frontend/
    └── src/
        ├── pages/
        ├── components/
        └── lib/
```
