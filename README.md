# Nexora — AI-Powered Financial Management for Chicago's Independent Workforce

> Modern financial infrastructure for Chicago's next generation.

Nexora is a full-stack financial management platform built for freelancers, independent contractors, and small business owners in Chicago. It connects to real bank accounts, automates tax tracking, forecasts cash flow using machine learning, and delivers personalized financial advice through a multi-agent AI system.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Overview](#api-overview)
- [ML Models](#ml-models)
- [Project Structure](#project-structure)

---

## Features

- **Bank Integration** — Connect real bank accounts via Plaid to sync live transactions
- **Smart Categorization** — AI-powered transaction categorization mapped to IRS Schedule C line items
- **Tax Automation** — Real-time quarterly estimated tax calculations with deduction tracking
- **Cash Flow Forecasting** — ML-based predictions with scenario analysis and confidence intervals
- **AI Financial Advisor** — GPT-4o multi-agent system with specialized CFO, Tax, and Cash Flow agents
- **Invoice Management** — Create, send, and track invoices with recurring billing support
- **Anomaly Detection** — Identify unusual spending patterns and flag suspicious transactions
- **Goal Tracking** — Set and monitor financial goals with progress visualization
- **Chicago Hub** — Local business resources, city tax incentives, and Chicago-specific insights

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI, SQLAlchemy, Alembic, Celery |
| Frontend | TypeScript, React 19, Vite, TailwindCSS, Recharts |
| Database | PostgreSQL 15, Redis 7 |
| AI | OpenAI GPT-4o, multi-agent orchestration |
| Banking | Plaid SDK |
| ML | scikit-learn, pandas, NumPy, MLflow |
| Infrastructure | Docker, Kubernetes, Terraform |
| Auth | JWT, bcrypt, TOTP-based 2FA |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Frontend                         │
│           React 19 + TypeScript + TailwindCSS           │
└───────────────────────┬─────────────────────────────────┘
                        │ REST API
┌───────────────────────▼─────────────────────────────────┐
│                    FastAPI Backend                       │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Auth/Users │  │  Financial   │  │  AI/ML Layer  │  │
│  │  2FA + JWT  │  │  Plaid Sync  │  │  Multi-Agent  │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
└────────┬──────────────────┬────────────────┬────────────┘
         │                  │                │
┌────────▼──────┐  ┌────────▼──────┐  ┌─────▼──────────┐
│  PostgreSQL   │  │     Redis     │  │   OpenAI API   │
│  (Primary DB) │  │  (Cache/Queue)│  │   Plaid API    │
└───────────────┘  └───────────────┘  └────────────────┘
```

### Multi-Agent AI System

Queries are routed to specialized agents based on context:

| Agent | Responsibility |
|---|---|
| Coordinator | Routes queries to the right agent |
| CFO Agent | Financial strategy and planning |
| Tax Advisor | Deduction optimization, Schedule C mapping |
| Cash Flow Manager | Forecasting and scenario analysis |
| Expense Categorizer | Smart transaction categorization |
| Invoice Agent | Invoice management and follow-ups |
| Anomaly Detector | Fraud and unusual activity detection |
| Compliance Agent | Regulatory compliance checks |

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker + Docker Compose

### 1. Clone the repository

```bash
git clone https://github.com/Dhruvachaitanya13/Nexora.git
cd Nexora
```

### 2. Set up environment variables

```bash
cp .env.example .env
# Fill in your Plaid and OpenAI credentials
```

### 3. Start the database and cache

```bash
docker compose up -d postgres redis
```

### 4. Install backend dependencies

```bash
cd backend && pip install -r requirements/dev.txt
```

### 5. Run database migrations

```bash
PYTHONPATH=. alembic upgrade head
```

### 6. Start the backend

```bash
uvicorn app.main:app --reload --port 8000
```

### 7. Start the frontend

```bash
cd frontend && npm install && npm run dev
```

The app will be available at `http://localhost:5173` and the API at `http://localhost:8000`.

### Quick Start (Docker)

```bash
make up
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `POSTGRES_HOST` | PostgreSQL host (default: `localhost`) |
| `POSTGRES_PORT` | PostgreSQL port (default: `5432`) |
| `POSTGRES_USER` | Database user |
| `POSTGRES_PASSWORD` | Database password |
| `POSTGRES_DB` | Database name |
| `REDIS_HOST` | Redis host |
| `REDIS_PORT` | Redis port |
| `PLAID_CLIENT_ID` | Plaid API client ID |
| `PLAID_SECRET` | Plaid API secret |
| `PLAID_ENV` | Plaid environment (`sandbox`, `development`, `production`) |
| `OPENAI_API_KEY` | OpenAI API key |
| `SECRET_KEY` | JWT signing secret |

---

## API Overview

All endpoints are prefixed with `/api/v1/`.

| Group | Endpoints |
|---|---|
| Auth | `/auth/register`, `/auth/login`, `/auth/2fa` |
| Users | `/users/me`, `/users/preferences` |
| Accounts | `/accounts/`, `/accounts/sync` |
| Transactions | `/transactions/`, `/transactions/categorize` |
| Plaid | `/plaid/link-token`, `/plaid/exchange-token` |
| Tax | `/tax/estimates`, `/tax/deductions`, `/tax/quarterly` |
| Invoices | `/invoices/`, `/invoices/{id}/send` |
| Cash Flow | `/cashflow/forecast`, `/cashflow/scenarios` |
| AI | `/ai/chat`, `/agents/query` |
| Insights | `/insights/`, `/insights/recommendations` |
| Dashboard | `/dashboard/summary` |

Full interactive docs available at `http://localhost:8000/docs`.

---

## ML Models

### Transaction Categorizer
Classifies raw bank transaction descriptions into categories and maps them to IRS Schedule C deduction lines using merchant patterns, amounts, and temporal features.

### Cash Flow Forecaster
Time-series model that predicts future cash flow with confidence intervals, accounting for the irregular income patterns typical of freelance work.

### Anomaly Detector
Statistical model that identifies unusual transactions — outliers in amount, frequency, or merchant category — and generates alerts.

Training pipelines are tracked with **MLflow** at `http://localhost:5001`.

---

## Project Structure

```
Nexora/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/   # API route handlers
│   │   ├── models/             # SQLAlchemy models
│   │   ├── services/
│   │   │   ├── ai/             # Multi-agent system, GPT integration
│   │   │   ├── plaid/          # Bank account sync
│   │   │   ├── tax/            # Tax calculation engine
│   │   │   └── ml/             # ML inference pipelines
│   │   └── core/               # Config, security, database
│   ├── migrations/             # Alembic migration scripts
│   └── requirements/
├── frontend/
│   ├── src/
│   │   ├── pages/              # Dashboard, Transactions, Tax, Advisor, etc.
│   │   ├── components/         # Reusable UI components
│   │   ├── store/              # Zustand state management
│   │   └── api/                # Axios API client
│   └── public/
├── ml/
│   ├── training/               # Model training scripts
│   ├── pipelines/              # Data and inference pipelines
│   ├── features/               # Feature engineering
│   └── notebooks/              # Exploratory analysis
├── infrastructure/             # Kubernetes + Terraform configs
├── docker-compose.yml
├── Makefile
└── .env.example
```

---

## Makefile Commands

```bash
make up         # Start all Docker services
make down       # Stop all Docker services
make dev        # Start dev server (Docker DB + local uvicorn)
make migrate    # Run database migrations
make logs       # Tail Docker logs
make install    # Install backend dependencies
```

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

*Built for Chicago's independent workforce — because financial clarity shouldn't be a luxury.*
