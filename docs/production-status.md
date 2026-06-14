# Production Status — Phase Ultimate

Last verified: **2026-06-14**

## Live services

| Service | URL | Status |
|---------|-----|--------|
| Frontend (Vercel) | https://genetic-contour-platform-web.vercel.app | Live |
| API (Render) | https://genetic-contour-platform.onrender.com | Live |
| PostgreSQL (Render) | Internal | Connected |

## Health endpoints

| Endpoint | Expected |
|----------|----------|
| `GET /health` | `200` — `{"status":"ok"}` |
| `GET /health/ready` | `200` — PostgreSQL + storage OK; Redis skipped (asyncio queue) |
| `GET /openapi.json` | Ultimate routes present |

Quick check:

```bash
curl -s https://genetic-contour-platform.onrender.com/health
curl -s https://genetic-contour-platform.onrender.com/health/ready
```

## Frontend routes (Ultimate)

| Route | Purpose |
|-------|---------|
| `/ground-truth` | Ground truth manager |
| `/benchmarks` | Benchmark datasets & cohort runs |
| `/help` | Help center |
| `/onboarding` | First-run onboarding |
| `/legal/terms` | Terms of service |
| `/legal/privacy` | Privacy policy |
| `/legal/cookies` | Cookie policy |

## Auth (SMTP degraded mode)

Production runs **without SMTP**. Registration and login work with auto-verified email.

| Endpoint | Behavior |
|----------|----------|
| `GET /api/auth/config` | `degraded_auth_mode: true` |
| `POST /api/auth/register` | Works |
| `POST /api/auth/login` | Works |
| Password reset / email verify | `503` — SMTP not configured |

## Scientific pipeline

- Comparison protocol default: **`fair_v1`**
- PDF reports: **v3** (methodology, GT validation, reproducibility)
- Ground truth validation visible on upload
- Benchmark API: create dataset, start run, aggregate metrics

## Verification scripts

```bash
# Production E2E (23 checks)
node scripts/production_e2e_ultimate.mjs

# API unit tests (local, requires PostgreSQL)
cd apps/api && pytest -q
```

## CI

![CI](https://github.com/nodirbekurinov0892/genetic-contour-platform/actions/workflows/ci.yml/badge.svg)

GitHub Actions workflow `.github/workflows/ci.yml`:

- `api-tests` — PostgreSQL 16 service + pytest
- `web-lint-build` — lint + Next.js build
- `deployment-gate` — both must pass

## Known operational notes

- **Queue**: `EXPERIMENT_QUEUE_BACKEND=asyncio` on Render — see [queue-scalability.md](queue-scalability.md)
- **SMTP**: optional; degraded mode is intentional until mail credentials are added
- **Migrations**: `alembic upgrade head` on deploy (`006_ultimate_platform` consolidated)

## Repository

https://github.com/nodirbekurinov0892/genetic-contour-platform
