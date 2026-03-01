.PHONY: help up down logs dev test install migrate

help:
	@echo "make up      - Start Docker services"
	@echo "make down    - Stop Docker services"  
	@echo "make dev     - Start dev server"
	@echo "make install - Install dependencies"
	@echo "make migrate - Run migrations"

up:
	docker-compose up -d

down:
	docker-compose down

logs:
	docker-compose logs -f

dev:
	docker-compose up -d postgres redis
	@sleep 3
	cd backend && uvicorn app.main:app --reload --port 8000

install:
	cd backend && pip install -r requirements/dev.txt

migrate:
	cd backend && alembic upgrade head

migrate-new:
	cd backend && alembic revision --autogenerate -m "$(msg)"
