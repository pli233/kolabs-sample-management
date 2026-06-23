# Kolabs Sample Management — common dev tasks. Run `make` for the list.
.DEFAULT_GOAL := help

BACKEND  := backend
FRONTEND := frontend
VENV     := $(BACKEND)/.venv
PIP      := $(VENV)/bin/pip
PORT     ?= 8000

.PHONY: help install install-backend install-frontend backend frontend dev \
        test test-backend test-frontend e2e lint build dmg docker clean

help: ## Show this help
	@grep -E '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) \
	  | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-16s\033[0m %s\n",$$1,$$2}'

install: install-backend install-frontend ## Set up backend venv + frontend deps

install-backend: ## Create backend venv and install Python deps
	python3 -m venv $(VENV)
	$(PIP) install -r $(BACKEND)/requirements.txt

install-frontend: ## Install frontend npm deps
	cd $(FRONTEND) && npm install

backend: ## Run the API on :8000 (override PORT=...; DB_URL defaults to local SQLite)
	cd $(BACKEND) && .venv/bin/uvicorn app.main:app --reload --port $(PORT)

frontend: ## Run the Vite dev server (proxies /api to :8000)
	cd $(FRONTEND) && npm run dev

dev: ## Run backend + frontend together
	@$(MAKE) -j2 backend frontend

test: test-backend test-frontend ## Run all unit/integration tests

test-backend: ## Run backend pytest (~5 min: parses the 32MB fixture)
	cd $(BACKEND) && .venv/bin/python -m pytest -q

test-frontend: ## Run frontend vitest component tests
	cd $(FRONTEND) && npm run test

e2e: ## Run Playwright end-to-end tests (builds the SPA first)
	cd $(FRONTEND) && npm run e2e

lint: ## Typecheck + eslint the frontend
	cd $(FRONTEND) && npx tsc -b --noEmit && npm run lint

build: ## Build the SPA into frontend/dist
	cd $(FRONTEND) && npm run build

dmg: ## Build the macOS .app + .dmg (Apple Silicon) -> backend/dist/
	cd $(BACKEND) && ./build_dmg.sh

docker: ## Build the production Docker image (SPA + API in one)
	docker build -t kolabs-sample-management .

clean: ## Remove build artifacts and caches
	rm -rf $(FRONTEND)/dist $(BACKEND)/build $(BACKEND)/dist \
	  "$(BACKEND)/Kolabs Sample Management.spec"
	find $(BACKEND) -name __pycache__ -type d -prune -exec rm -rf {} + 2>/dev/null || true
