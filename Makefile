# Kolabs Sample Management — common dev tasks. Run `make` for the list.
.DEFAULT_GOAL := help

BACKEND  := backend
FRONTEND := frontend
DESKTOP  := desktop
VENV     := $(BACKEND)/.venv
PIP      := $(VENV)/bin/pip
PORT     ?= 8000

.PHONY: help install install-backend install-frontend install-desktop \
        backend frontend dev desktop electron electron-install \
        test test-backend test-frontend e2e lint build dmg dmg-intel dmg-all \
        docker clean

help: ## Show this help
	@grep -E '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) \
	  | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-16s\033[0m %s\n",$$1,$$2}'

install: install-backend install-frontend install-desktop ## Set up backend, frontend, and desktop deps

install-backend: ## Create backend venv and install Python deps
	python3 -m venv $(VENV)
	$(PIP) install -r $(BACKEND)/requirements.txt

install-frontend: ## Install frontend npm deps
	cd $(FRONTEND) && npm install

install-desktop: ## Install Electron desktop deps
	cd $(DESKTOP) && npm install

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

desktop: build ## Run the Electron desktop app in dev (Electron + Python sidecar)
	cd $(DESKTOP) && npm start

electron-install: install-desktop ## Alias for install-desktop

electron: desktop ## Alias for desktop

dmg: ## Build the Electron .dmg (Apple Silicon) -> desktop/dist/
	./$(DESKTOP)/build-dmg.sh arm64

dmg-intel: ## Build the Electron .dmg (Intel/x86_64, via Rosetta) -> desktop/dist/
	./$(DESKTOP)/build-dmg.sh x64

# Sequential (not prerequisites) so a parallel `make -j` can't race the shared
# backend/dist + frontend/dist that build-dmg.sh wipes each run.
dmg-all: ## Build both .dmgs (Apple Silicon + Intel) -> desktop/dist/
	./$(DESKTOP)/build-dmg.sh arm64
	./$(DESKTOP)/build-dmg.sh x64

docker: ## Build the production Docker image (SPA + API in one)
	docker build -t kolabs-sample-management .

clean: ## Remove build artifacts, caches, and stale runtime cruft (keeps app.db)
	rm -rf $(FRONTEND)/dist $(BACKEND)/build $(BACKEND)/dist $(DESKTOP)/dist \
	  $(BACKEND)/uploads $(BACKEND)/.e2e $(BACKEND)/*.oldschema $(BACKEND)/*.spec
	find . -name .DS_Store -not -path './.git/*' -delete 2>/dev/null || true
	find $(BACKEND) -name __pycache__ -type d -prune -exec rm -rf {} + 2>/dev/null || true
