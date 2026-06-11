# Production Environment Checklist

Use before every beta/production deploy. All values must be set unless marked optional.

## Render — API (`genetic-contour-api`)

| Variable | Required | Example / notes |
|----------|----------|-----------------|
| `DATABASE_URL` | Yes | From Render PostgreSQL |
| `REDIS_URL` | Yes | `redis://` or `rediss://` |
| `API_DEBUG` | Yes | `false` |
| `API_PUBLIC_URL` | Yes | `https://genetic-contour-platform.onrender.com` |
| `CORS_ORIGINS` | Yes | Vercel URL(s), comma-separated |
| `TRUSTED_HOSTS` | Yes | Render hostname |
| `SECRET_KEY` | Yes | Random 64+ chars |
| `JWT_SECRET` | Yes | Different from `SECRET_KEY` |
| `STORAGE_BACKEND` | Yes | `s3` (not `local`) |
| `S3_ENDPOINT_URL` | Yes (R2) | `https://<account>.r2.cloudflarestorage.com` |
| `S3_ACCESS_KEY_ID` | Yes | R2/S3 key |
| `S3_SECRET_ACCESS_KEY` | Yes | R2/S3 secret |
| `S3_BUCKET_NAME` | Yes | Bucket name |
| `S3_REGION` | Yes | `auto` for R2 |
| `S3_PUBLIC_BASE_URL` | Yes | Public CDN URL, no trailing slash |
| `SENTRY_DSN` | Optional | Sentry project DSN |
| `SENTRY_ENVIRONMENT` | Optional | `production` / `beta` |
| `LOG_JSON` | Optional | `true` forces JSON logs (default on when `API_DEBUG=false`) |

**Do not set** `STORAGE_BACKEND=local` with `API_DEBUG=false` — `/static` serving is disabled in production.

## Render — Worker (`genetic-contour-worker`)

Same as API for: `DATABASE_URL`, `REDIS_URL`, `STORAGE_BACKEND`, all `S3_*`, `API_DEBUG=false`.

Worker does not need `CORS_ORIGINS` or `API_PUBLIC_URL` when using S3.

## Vercel — Frontend

| Variable | Required | Set before build |
|----------|----------|------------------|
| `NEXT_PUBLIC_API_URL` | Yes | `https://genetic-contour-platform.onrender.com` |
| `NEXT_PUBLIC_STORAGE_PUBLIC_URL` | Yes | Same as `S3_PUBLIC_BASE_URL` |

## Infrastructure

- [ ] PostgreSQL provisioned and reachable
- [ ] Redis provisioned and reachable from API + worker
- [ ] R2 bucket public access + CORS for Vercel origin
- [ ] Migrations: `alembic upgrade head` (auto in `render.yaml` startCommand)

## Post-deploy verification

- [ ] `GET /health/ready` → 200
- [ ] Register + login
- [ ] Upload image
- [ ] Run experiment → worker completes job
- [ ] Result images load from R2 URL
- [ ] PDF export downloads
- [ ] Sentry receives a test error (if configured)
