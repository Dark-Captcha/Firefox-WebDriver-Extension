# Firefox WebDriver Extension
# Node.js 20+

.PHONY: help install build dev lint type-check all clean nuke check-deps xpi format

help:
	@echo "Extension"
	@echo ""
	@echo "  make install    - Install dependencies"
	@echo "  make build      - Production build"
	@echo "  make xpi        - Build and package as .xpi"
	@echo "  make dev        - Watch mode (development)"
	@echo ""
	@echo "Quality"
	@echo ""
	@echo "  make format     - Format code with Prettier"
	@echo "  make lint       - Run ESLint"
	@echo "  make type-check - Run TypeScript type checker"
	@echo "  make all        - Format + type check + lint + build"
	@echo ""
	@echo "Clean"
	@echo ""
	@echo "  make clean      - Remove build output"
	@echo "  make nuke       - Remove node_modules and dist"

# Setup

install: check-deps
	@npm install

# Build

build: check-deps
	@npm run build

xpi: check-deps
	@npm run xpi

dev: check-deps
	@npm run dev

# Quality

format: check-deps
	@npm run format

lint: check-deps
	@npm run lint

type-check: check-deps
	@npm run type-check

all: check-deps
	@npm run format && npm run type-check && npm run lint && npm run build

# Clean

clean:
	@rm -rf dist
	@echo "Build output removed!"

nuke:
	@rm -rf node_modules dist
	@echo "node_modules and dist removed!"

# Utility

check-deps:
	@if [ ! -d "node_modules" ]; then \
		echo "Installing dependencies..."; \
		npm install; \
	fi