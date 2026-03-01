"""
Nexora - Main Application Entry Point
"""

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.api.v1.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    import os
    print("🚀 Starting Nexora Backend...")
    key = os.environ.get("OPENAI_API_KEY", "")
    if key:
        print(f"✅ OpenAI API key loaded (ends with ...{key[-6:]})")
    else:
        print("❌ WARNING: OPENAI_API_KEY not found in environment!")
    yield
    print("👋 Shutting down Nexora Backend...")


app = FastAPI(
    title="Nexora",
    description="AI-powered financial management for freelancers",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS Configuration - Allow all origins in development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Health check at root level
@app.get("/")
async def root():
    return {"message": "Welcome to Nexora API", "docs": "/docs"}


@app.get("/health")
async def health():
    return {"status": "ok", "service": "nexora"}


# Include API router with prefix
app.include_router(api_router, prefix="/api/v1")
