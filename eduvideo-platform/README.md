# EduVideo Platform

AI-powered educational video generation platform with no-face (slides + TTS) and avatar presenter modes.

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local development)
- FFmpeg (local dev only — included in Docker)

---

## Run with Docker (Recommended)

```bash
# 1. Clone and enter directory
git clone <repo> edu-video-platform
cd edu-video-platform

# 2. Copy and configure environment
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET and JWT_REFRESH_SECRET

# 3. Start all services
docker compose up -d

# 4. Run database migrations + seed
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma db seed

# 5. Create MinIO bucket (local S3)
docker compose exec minio mc alias set local http://localhost:9000 minioadmin minioadmin123
docker compose exec minio mc mb local/eduvideo
docker compose exec minio mc anonymous set public local/eduvideo
```

**Access:**
| Service      | URL                          |
|--------------|------------------------------|
| Frontend     | http://localhost:3000        |
| Backend API  | http://localhost:3001/api/v1 |
| Swagger Docs | http://localhost:3001/api/docs |
| MinIO Console| http://localhost:9001        |
| Redis        | localhost:6379               |
| PostgreSQL   | localhost:5432               |

**Demo Credentials:**
- Admin: `admin@eduvideo.dev` / `Admin123!`
- User:  `demo@eduvideo.dev` / `Demo123!`

---

## Local Development

### Backend
```bash
cd backend
npm install
cp ../.env.example .env  # configure DB + Redis locally
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

### Worker
```bash
cd worker
npm install
npm run start:dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Next.js   │────▶│  NestJS Backend  │────▶│   PostgreSQL    │
│  Frontend   │     │   REST API/JWT   │     │   (Prisma ORM)  │
└─────────────┘     └────────┬─────────┘     └─────────────────┘
                             │
                    ┌────────▼─────────┐
                    │  BullMQ + Redis  │
                    │   Job Queue      │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐     ┌─────────────────┐
                    │  Worker Service  │────▶│  FFmpeg Pipeline│
                    │  (Background)    │     │  TTS + Rendering│
                    └────────┬─────────┘     └─────────────────┘
                             │
                    ┌────────▼─────────┐
                    │  S3 / MinIO      │
                    │  Video Storage   │
                    └──────────────────┘
```

## Video Pipeline

```
User submits project
       │
       ▼
1. Script parsed into scenes (OpenAI / regex fallback)
       │
       ▼
2. TTS per scene (ElevenLabs → Google TTS → Silence fallback)
       │
       ▼
3a. NO_FACE: image + audio → video clip per scene (FFmpeg)
3b. AVATAR:  mock/D-ID avatar + audio → overlay on slide per scene
       │
       ▼
4. Concatenate all clips (FFmpeg concat demuxer)
       │
       ▼
5. Add fade in/out (FFmpeg)
       │
       ▼
6. Upload final MP4 to S3/MinIO
       │
       ▼
7. Update Rendering record → COMPLETED + video URL
```

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register |
| POST | `/api/v1/auth/login` | Login |
| GET  | `/api/v1/projects` | List projects |
| POST | `/api/v1/projects` | Create project |
| GET  | `/api/v1/projects/:id` | Get project |
| PUT  | `/api/v1/projects/:id/scripts` | Save script |
| POST | `/api/v1/projects/:id/scripts/parse` | AI parse script |
| POST | `/api/v1/projects/:id/slides` | Upload slides |
| POST | `/api/v1/projects/:id/render/start` | Start render |
| GET  | `/api/v1/projects/:id/render/status` | Render status |
| GET  | `/api/v1/ai/voices` | List voices |
| GET  | `/api/v1/ai/avatars` | List avatars |

Full docs: http://localhost:3001/api/docs

## AI Service Keys (Optional)

| Service | Purpose | Fallback |
|---------|---------|---------|
| `OPENAI_API_KEY` | Smart script parsing | Regex paragraph splitter |
| `ELEVENLABS_API_KEY` | Premium TTS voices | Google Translate TTS |
| `DID_API_KEY` | Real avatar videos | Mock colored placeholder |

All AI services have graceful fallbacks — the platform works without any API keys.

## Production Checklist

- [ ] Set strong `JWT_SECRET` and `JWT_REFRESH_SECRET`
- [ ] Configure real AWS S3 (`STORAGE_TYPE=s3`, real credentials)
- [ ] Set `NODE_ENV=production`
- [ ] Configure a reverse proxy (nginx/Caddy) with SSL
- [ ] Set `FRONTEND_URL` to your domain
- [ ] Add `OPENAI_API_KEY` for better script parsing
- [ ] Add `ELEVENLABS_API_KEY` for higher quality voices
