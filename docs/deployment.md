# Deployment Guide

## Local Development

See [README.md](../README.md) for step-by-step local setup.

Default storage: `STORAGE_BACKEND=local` — files live under `apps/api/uploads/` and `apps/api/results/`.

**Local `/static` serving** only works when `API_DEBUG=true` **and** `STORAGE_BACKEND=local`. Production (`API_DEBUG=false`) must use `STORAGE_BACKEND=supabase` or `STORAGE_BACKEND=s3` with public object URLs.

Default queue: **Celery + Redis**. Start Redis via `docker compose up -d redis`, then run API and worker in separate terminals (see README).

---

## Production: Vercel + Render

### Overview

| Component | Platform | Root Directory |
|-----------|----------|----------------|
| Frontend | Vercel | `apps/web` |
| Backend API | Render Web Service | `apps/api` |
| PostgreSQL | Render PostgreSQL | — |
| Redis | Render Key Value / Upstash / self-hosted | — |
| Celery worker | Render Background Worker | `apps/api` |
| File storage | Supabase Storage (recommended) or Cloudflare R2 / AWS S3 | — |

### Render Backend

1. Create PostgreSQL database (`genetic-contour-db`)
2. Create Web Service from repo with `rootDir: apps/api`
3. Use `apps/api/render.yaml` Blueprint or manual config
4. Migrations run automatically on start (`alembic upgrade head` in `render.yaml` startCommand for API and worker)

**Required environment variables (API + worker):**

```env
DATABASE_URL=<from Render PostgreSQL>
REDIS_URL=redis://<host>:6379/0
API_PUBLIC_URL=https://genetic-contour-platform.onrender.com
CORS_ORIGINS=https://your-app.vercel.app
SECRET_KEY=<random-64-chars>
JWT_SECRET=<random-64-chars-different-from-secret>
TRUSTED_HOSTS=your-api.onrender.com
API_DEBUG=false
```

**Start commands** (`apps/api/render.yaml`):

```bash
# Web
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT

# Worker (runs migrations first, then Celery)
alembic upgrade head && celery -A app.jobs.celery_app worker --loglevel=info --queues=experiments
```

Render health check: `GET /health/ready` (PostgreSQL + Redis when Celery + **storage read/write/delete probe**).

**Production storage is mandatory remote object storage** — `STORAGE_BACKEND=local` is rejected when `API_DEBUG=false` (startup validation + health FAIL).

#### Supabase Storage (recommended)

See [supabase-storage-migration.md](./supabase-storage-migration.md) for full migration steps.

```env
STORAGE_BACKEND=supabase
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_secret>
SUPABASE_STORAGE_BUCKET=genetic-contour-platform
SUPABASE_PUBLIC_BASE_URL=https://<project-ref>.supabase.co/storage/v1/object/public/genetic-contour-platform
```

Set `NEXT_PUBLIC_STORAGE_PUBLIC_URL` on Vercel to the same value as `SUPABASE_PUBLIC_BASE_URL` (no trailing slash).

#### S3 / Cloudflare R2 (alternative)

```env
STORAGE_BACKEND=s3
S3_ENDPOINT_URL=https://<account_id>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=<r2-access-key>
S3_SECRET_ACCESS_KEY=<r2-secret>
S3_BUCKET_NAME=genetic-contour
S3_REGION=auto
S3_PUBLIC_BASE_URL=https://pub-xxxx.r2.dev
```

Set `NEXT_PUBLIC_STORAGE_PUBLIC_URL` on Vercel to the same value as `S3_PUBLIC_BASE_URL`.

**Storage health response shape:**

```json
{
  "storage": {
    "ok": true,
    "backend": "supabase",
    "read": true,
    "write": true,
    "delete": true,
    "detail": "supabase bucket reachable; read/write/delete probe passed"
  }
}
```

**Ghost record repair API** (authenticated):

- `GET /api/storage/audit` — DB rows without storage objects
- `POST /api/storage/repair/mark-missing` — mark broken GT/original metadata
- `POST /api/storage/repair/clear-ground-truth/{image_id}` — clear GT reference when file missing
- `DELETE /api/storage/repair/images/{image_id}` — remove orphan DB row (explicit action only)

### Cloudflare R2 Setup

1. **Create bucket** in Cloudflare Dashboard → R2 → Create bucket (e.g. `genetic-contour`).
2. **Enable public access** (optional but recommended for result images):
   - R2 → bucket → Settings → Public access → Allow Access → note the `r2.dev` URL.
   - Use that URL (no trailing slash) as `S3_PUBLIC_BASE_URL`.
3. **Create API token**:
   - R2 → Manage R2 API Tokens → Create API token with Object Read & Write on the bucket.
   - Copy Access Key ID and Secret Access Key → `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
4. **Endpoint URL**:
   - Format: `https://<account_id>.r2.cloudflarestorage.com`
   - Find `<account_id>` in R2 overview page.
5. **CORS** (if browser loads images directly from R2):
   ```json
   [
     {
       "AllowedOrigins": ["https://your-app.vercel.app"],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
6. Set all `S3_*` vars on Render and redeploy.

### AWS S3 (alternative)

```env
STORAGE_BACKEND=s3
S3_BUCKET_NAME=your-bucket
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_REGION=eu-central-1
S3_PUBLIC_BASE_URL=https://your-bucket.s3.eu-central-1.amazonaws.com
# S3_ENDPOINT_URL can be omitted for native AWS S3
```

Ensure bucket policy or CloudFront allows public `GET` on `uploads/*` and `results/*` if using public URLs.

### Vercel Frontend

**Root Directory:** `apps/web`

```env
NEXT_PUBLIC_API_URL=https://genetic-contour-platform.onrender.com
NEXT_PUBLIC_STORAGE_PUBLIC_URL=https://pub-xxxx.r2.dev
```

Set in Vercel project settings **before** building. Rebuild after changes.

**`NEXT_PUBLIC_STORAGE_PUBLIC_URL` is required** when the API uses `STORAGE_BACKEND=s3` / R2. It must match backend `S3_PUBLIC_BASE_URL` exactly (hostname + path prefix) so Next.js `<Image>` can load result images from R2.

### CORS

Backend `CORS_ORIGINS` must include your Vercel domain:

```
https://genetic-contour.vercel.app
```

Multiple origins: comma-separated.

### Job queue behavior

- API enqueues experiments to Celery; worker process executes them.
- Status/progress live in PostgreSQL (not in-memory).
- **Recovery runs on worker startup only** (not API). Redis lock prevents duplicate re-enqueue across workers.
- On worker restart: `running` → `queued`, then `queued` jobs are re-enqueued.
- Duplicate Celery tasks: only one claims `queued` → `running` (`SELECT FOR UPDATE`).
- **Cancel is cooperative** for running jobs (`cancel_requested` DB flag). Queued jobs are revoked via Celery `revoke(terminate=False)`.

### Asyncio queue mode (`EXPERIMENT_QUEUE_BACKEND=asyncio`)

**Current production default on Render free tier** when Redis/Celery worker is not provisioned.

| Aspect | `asyncio` (in-process) | `celery` + Redis (recommended at scale) |
|--------|------------------------|----------------------------------------|
| Where jobs run | Same process as the API web service | Dedicated Celery worker service |
| Persistence | Experiment status in PostgreSQL | Same |
| Recovery on restart | API startup runs `run_startup_recovery_async` | Worker startup + Redis lock |
| Horizontal scaling | **Not safe** — duplicate in-process workers race | Safe with one queue consumer per job |
| `/health/ready` redis check | Reported as **skipped** (not a failure) | Must be connected |

**Scalability warning:** With `EXPERIMENT_QUEUE_BACKEND=asyncio`, long-running `compare_all` / benchmark cohort jobs share the API process event loop. This is acceptable for demos, thesis evaluation, and low concurrent load. For public beta with multiple simultaneous users, switch to:

```env
EXPERIMENT_QUEUE_BACKEND=celery
REDIS_URL=redis://<host>:6379/0
CELERY_TASK_ALWAYS_EAGER=false
```

Deploy a Render **Background Worker** (`celery -A app.jobs.celery_app worker --queues=experiments`) using the same `DATABASE_URL` and storage env as the API. Until then, `/health/ready` will show `redis: skipped (EXPERIMENT_QUEUE_BACKEND=asyncio)` — expected, not an outage.

See also: [Production status](https://genetic-contour-platform-web.vercel.app/status) · `GET /health/ready` on the API.

### Database migration

After deploying queue/storage changes, run:

```bash
cd apps/api
alembic upgrade head
```

- `003_storage_keys` — `storage_key`, `public_url`
- `004_celery_job_fields` — `cancel_requested`, `celery_task_id`

### Health Checks

Render uses `GET /health/ready` (configured in `render.yaml`). `GET /health/live` is liveness-only.

---

## Alternative: Neon PostgreSQL

```env
DATABASE_URL=postgresql+asyncpg://user:pass@ep-xxx.neon.tech/genetic_contour?sslmode=require
```

Use with Render backend — link `DATABASE_URL` manually.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Images 404 in production (local mode) | Set `API_PUBLIC_URL` to exact Render URL; add persistent disk |
| Images 404 in production (S3 mode) | Verify `S3_PUBLIC_BASE_URL`, bucket public access, and object keys |
| CORS error | Add Vercel URL to `CORS_ORIGINS` and R2 bucket CORS |
| Frontend calls localhost | Rebuild Vercel with correct `NEXT_PUBLIC_API_URL` |
| PDF generation fails | Ensure result images exist in storage; check Render logs |
| DB connection fails | Verify `DATABASE_URL`; use `postgresql+asyncpg://` format |
| Startup validation error | When `STORAGE_BACKEND=s3`, all `S3_*` required vars must be set |
