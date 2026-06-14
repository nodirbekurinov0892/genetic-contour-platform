# Contour Analytics Platform

**Ko'p algoritmli kontur va chegaralarni tahlil qilish platformasi** — ilmiy tadqiqot va dissertatsiya uchun professional web-platforma.

Dissertatsiya III bob: *"Intellektual dasturiy tizim ishlab chiqish"*

## Production Status (Phase Ultimate)

| Service | URL |
|---------|-----|
| **Web** | https://genetic-contour-platform-web.vercel.app |
| **API** | https://genetic-contour-platform.onrender.com |

- Health: `GET /health` · `GET /health/ready`
- E2E gate: `node scripts/production_e2e_ultimate.mjs` (23 checks)
- Full status: [docs/production-status.md](docs/production-status.md)
- Queue scalability (asyncio vs Celery): [docs/queue-scalability.md](docs/queue-scalability.md)

> **Current queue mode:** `EXPERIMENT_QUEUE_BACKEND=asyncio` on Render. Redis shows as *skipped* in `/health/ready` — expected for single-process deployments. Upgrade path documented in [queue-scalability.md](docs/queue-scalability.md).

## Features

- Real genetic algorithm (population, fitness, selection, crossover, mutation, elitism)
- Classical algorithms: Sobel, Prewitt, Canny
- Scientific comparison dashboard with metrics and fitness evolution
- **PDF / JSON / CSV** scientific report export
- Premium research UI with dark/light mode
- Production-ready: Vercel + Render + PostgreSQL

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| Python | 3.11+ |
| Docker | for local PostgreSQL |

---

## Local Development

### 1. Environment

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
```

### 2. PostgreSQL

```bash
docker compose up -d postgres redis
```

### 3. Backend API (Terminal 1)

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### 3b. Celery Worker (Terminal 2)

```bash
cd apps/api
.venv\Scripts\activate          # same venv as API
alembic upgrade head            # once per schema change (worker uses same DB)
celery -A app.jobs.celery_app worker --loglevel=info --queues=experiments
```

Verify API: http://localhost:8000/health/live · http://localhost:8000/health/ready · http://localhost:8000/docs

> **Required env vars** in `apps/api/.env`: `DATABASE_URL`, `SECRET_KEY`, `JWT_SECRET`, `REDIS_URL`
>
> **File storage** (default `STORAGE_BACKEND=local`): uploads/results saved under `apps/api/uploads/` and `apps/api/results/`, served at `/static/...`.
>
> Schema is managed by **Alembic** (not `create_all` on startup).

### Database migrations

```bash
cd apps/api

# Apply all migrations
alembic upgrade head

# Create a new migration after model changes
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```

### 4. Frontend (Terminal 3)

```bash
cd apps/web
npm install
npm run dev
```

Open: http://localhost:3000

### 5. Full Pipeline Test

1. **Register / Login** at http://localhost:3000/register
2. **Upload** → JPG/PNG/WebP image
3. **Experiments** → title + **Compare All** → Run
4. **Experiment Detail** → view all results, metrics, fitness chart
5. **Download PDF Report** → scientific PDF with images and conclusion

### 7. API Tests (pytest)

Create a test database (once):

```sql
CREATE DATABASE genetic_contour_test;
```

Run tests:

```bash
cd apps/api
pytest -v
```

### 6. GA Offline Test (no DB)

```bash
cd apps/api && python scripts/test_ga_pipeline.py
```

---

## Beta Deploy Checklist

Complete before inviting real users. Full variable list: [docs/production-env-checklist.md](docs/production-env-checklist.md).

### Infrastructure

- [ ] PostgreSQL (Render)
- [ ] Redis (Render Key Value / Upstash)
- [ ] Cloudflare R2 bucket + public URL + CORS
- [ ] Render **web** + **worker** services from `apps/api/render.yaml`
- [ ] Vercel frontend (`apps/web`)

### Environment

- [ ] API: `API_DEBUG=false`, `STORAGE_BACKEND=s3`, all `S3_*`, `REDIS_URL`, `CORS_ORIGINS`, `TRUSTED_HOSTS`
- [ ] Vercel: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_STORAGE_PUBLIC_URL` (set **before** build)
- [ ] Optional: `SENTRY_DSN` on API

### Verify pipeline

- [ ] `GET /health/ready` → 200
- [ ] Register → login → upload → run experiment → results → PDF
- [ ] Images load from R2 (not `/static/`)
- [ ] Celery worker logs show job execution

### Web tests (local)

```bash
cd apps/web
npm install
npx playwright install chromium
npm run dev   # separate terminal
npm run test:e2e
```

---

## Production Deployment

### Architecture

```
Vercel (Frontend)  →  Render (FastAPI API)  →  Render PostgreSQL
```

### Step 1: PostgreSQL on Render

1. Create **PostgreSQL** database on Render
2. Copy **Internal Database URL** (or External for Neon/Supabase)

### Step 2: Backend on Render

1. New **Web Service** → connect repository
2. Set **Root Directory**: `apps/api`
3. **Build Command**: `pip install -r requirements.txt`
4. **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

**Environment Variables:**

| Variable | Example | Required |
|----------|---------|----------|
| `DATABASE_URL` | `postgresql://user:pass@host/db` | Yes (auto from Render DB) |
| `API_PUBLIC_URL` | `https://genetic-contour-platform.onrender.com` | Yes |
| `CORS_ORIGINS` | `https://your-app.vercel.app` | Yes |
| `SECRET_KEY` | random 64-char string | Yes |
| `JWT_SECRET` | random 64-char string (different from SECRET_KEY) | Yes |
| `TRUSTED_HOSTS` | `your-api.onrender.com` | Yes |
| `API_DEBUG` | `false` | Yes |
| `STORAGE_BACKEND` | `local` or `s3` | Yes (use `s3` on Render) |
| `S3_ENDPOINT_URL` | R2 endpoint | When `STORAGE_BACKEND=s3` |
| `S3_ACCESS_KEY_ID` | R2/S3 access key | When `STORAGE_BACKEND=s3` |
| `S3_SECRET_ACCESS_KEY` | R2/S3 secret | When `STORAGE_BACKEND=s3` |
| `S3_BUCKET_NAME` | bucket name | When `STORAGE_BACKEND=s3` |
| `S3_REGION` | `auto` (R2) or AWS region | When `STORAGE_BACKEND=s3` |
| `S3_PUBLIC_BASE_URL` | public CDN/base URL | When `STORAGE_BACKEND=s3` |
| `REDIS_URL` | `redis://host:6379/0` | Required when `EXPERIMENT_QUEUE_BACKEND=celery` |
| `EXPERIMENT_QUEUE_BACKEND` | `asyncio` (default) or `celery` | Yes — see [queue-scalability.md](docs/queue-scalability.md) |

> `DATABASE_URL` is auto-converted from `postgresql://` to `postgresql+asyncpg://`.
>
> **Cloudflare R2** setup: see [docs/deployment.md](docs/deployment.md#cloudflare-r2-setup).

Optional: deploy via Blueprint using `apps/api/render.yaml`.

### Step 3: Frontend on Vercel

1. Import repository
2. Set **Root Directory**: `apps/web`
3. **Environment Variable** (set before build):

| Variable | Value | Required |
|----------|-------|----------|
| `NEXT_PUBLIC_API_URL` | `https://genetic-contour-platform.onrender.com` | **Yes** |
| `NEXT_PUBLIC_STORAGE_PUBLIC_URL` | Same as backend `S3_PUBLIC_BASE_URL` (e.g. `https://pub-xxxx.r2.dev`) | **Yes** when `STORAGE_BACKEND=s3` |

4. Deploy

> `NEXT_PUBLIC_*` vars are baked in at **build time**. Redeploy after changing them.

### Step 4: Verify Production

- `GET https://your-api.onrender.com/health/ready` → `{"status":"ok",...}` (503 if DB/Redis/storage down)
- Frontend loads dashboard
- Upload + experiment + PDF export works
- Images load from `S3_PUBLIC_BASE_URL/...` (production). Local `/static/` only when `API_DEBUG=true` + `STORAGE_BACKEND=local`.

### Neon / Supabase Alternative

Use connection string as `DATABASE_URL`. Add `?sslmode=require` if needed:

```
postgresql+asyncpg://user:pass@ep-xxx.neon.tech/genetic_contour?sslmode=require
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login (rate limit: 5/min) |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Revoke refresh token |
| GET | `/api/auth/me` | Current user (auth required) |
| GET | `/api/stats` | User statistics (auth required) |
| POST | `/api/images/upload` | Upload image |
| POST | `/api/experiments` | Create experiment |
| POST | `/api/experiments/{id}/run` | Queue experiment (background job) |
| GET | `/api/experiments/{id}/status` | Job status + real progress |
| POST | `/api/experiments/{id}/cancel` | Cancel queued/running job |
| GET | `/api/experiments/{id}/results` | Full results |
| GET | `/api/experiments/{id}/report` | Enriched JSON report |
| GET | `/api/experiments/{id}/report/csv` | CSV download |
| GET | `/api/experiments/{id}/report/pdf` | PDF download |

---

## PDF Report Contents

- Project title and experiment metadata
- Image information
- Preprocessing outputs (original, grayscale, gradient)
- Sobel / Prewitt / Canny / GA result images
- Metrics comparison table
- GA fitness evolution chart
- Automated scientific conclusion (Uzbek)

---

## Project Structure

```
apps/api/     FastAPI + OpenCV + GA + ReportLab PDF
apps/web/     Next.js 15 scientific dashboard
packages/shared/   Shared TypeScript types
docs/         Architecture, algorithm, API, deployment
```

## Documentation

- [Production status](docs/production-status.md)
- [Queue scalability (asyncio vs Celery)](docs/queue-scalability.md)
- [Architecture](docs/architecture.md)
- [Algorithm](docs/algorithm.md)
- [API Reference](docs/api.md)
- [Deployment](docs/deployment.md)
- [Production env checklist](docs/production-env-checklist.md)

## License

Research / academic use.
