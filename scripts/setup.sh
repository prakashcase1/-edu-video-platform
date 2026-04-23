#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# EduVideo Platform — Full Local Setup Script
# Run once to set up your dev environment
# ─────────────────────────────────────────────────────────────────

set -e
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[Setup]${NC} $1"; }
warn() { echo -e "${YELLOW}[Warn]${NC} $1"; }
error() { echo -e "${RED}[Error]${NC} $1"; exit 1; }
info() { echo -e "${BLUE}[Info]${NC} $1"; }

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   EduVideo Platform — Dev Setup          ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Check prerequisites
command -v node >/dev/null 2>&1 || error "Node.js is required. Install from https://nodejs.org"
command -v docker >/dev/null 2>&1 || error "Docker is required. Install from https://docker.com"
command -v docker compose >/dev/null 2>&1 || error "Docker Compose is required."

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  error "Node.js 18+ required. Current: $(node -v)"
fi

log "Prerequisites OK (Node $(node -v), Docker $(docker -v | cut -d' ' -f3 | tr -d ','))"

# Copy env file
if [ ! -f .env ]; then
  cp .env.example .env
  log "Created .env from .env.example"
  warn "Please review .env and update secrets before production use!"
else
  info ".env already exists, skipping"
fi

# Install dependencies
log "Installing root dependencies..."
npm install

log "Installing backend dependencies..."
(cd backend && npm install)

log "Installing worker dependencies..."
(cd worker && npm install)

log "Installing frontend dependencies..."
(cd frontend && npm install)

# Start Docker services
log "Starting Docker services (PostgreSQL, Redis, MinIO)..."
docker compose up -d postgres redis minio

log "Waiting for services to be healthy..."
sleep 8

# Database setup
log "Running database migrations..."
(cd backend && npx prisma migrate dev --name init 2>/dev/null || npx prisma migrate deploy)

log "Generating Prisma client..."
(cd backend && npx prisma generate)
(cd worker && npx prisma generate)

log "Seeding database with demo data..."
(cd backend && npx ts-node prisma/seed.ts 2>/dev/null || npx prisma db seed)

# MinIO setup
log "Setting up MinIO bucket..."
bash scripts/setup-minio.sh 2>/dev/null || warn "MinIO setup skipped — run scripts/setup-minio.sh manually if needed"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   Setup Complete!                                            ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║   Start dev servers:                                         ║"
echo "║     npm run dev:backend   → http://localhost:3001            ║"
echo "║     npm run dev:worker    → Background job processor         ║"
echo "║     npm run dev:frontend  → http://localhost:3000            ║"
echo "║                                                              ║"
echo "║   Or run all at once:  npm run dev                           ║"
echo "║                                                              ║"
echo "║   Demo login:  demo@eduvideo.dev / Demo123!                  ║"
echo "║   API Docs:    http://localhost:3001/api/docs                 ║"
echo "║   MinIO:       http://localhost:9001  (minioadmin/minioadmin) ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
