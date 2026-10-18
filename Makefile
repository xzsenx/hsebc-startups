.PHONY: up down logs test fresh

up:
	docker compose up --build

down:
	docker compose down

fresh:
	docker compose down -v && docker compose up --build

logs:
	docker compose logs -f backend

test:
	cd backend && .venv/bin/python -m pytest -q
