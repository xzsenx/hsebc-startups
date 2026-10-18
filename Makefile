.PHONY: up down fresh logs test audit

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

audit:
	cd backend && .venv/bin/pip-audit -r requirements.txt
	cd frontend && npm audit
