.PHONY: install engine test test-engine test-backend frontend build run dev clean

install:            ## install Python and Node dependencies
	pip install -r backend/requirements-dev.txt
	cd frontend && npm ci

engine:             ## compile the C search engine (shared library + CLI)
	$(MAKE) -C engine

test-engine:
	$(MAKE) -C engine test

test-backend: engine
	cd backend && python -m pytest -q

test: test-engine test-backend   ## run every automated test
	cd frontend && npx tsc -b

frontend:
	cd frontend && npm run build

build: engine frontend

run: build          ## one server: API + built frontend on http://localhost:8000
	cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000

dev: engine         ## backend with reload (run `cd frontend && npm run dev` in another terminal)
	cd backend && uvicorn app.main:app --reload --port 8000

clean:
	$(MAKE) -C engine clean
	rm -rf frontend/dist backend/data/*.db
