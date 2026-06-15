# Supabase Storage Migration Guide

This guide migrates production from ephemeral Render disk (`STORAGE_BACKEND=local`) to **Supabase Storage** (`genetic-contour-platform` public bucket).

## What changes

| Area | Before | After |
|------|--------|-------|
| Uploads | Render disk `uploads/` | Supabase `uploads/…` |
| Ground truth masks | Render disk | Supabase `uploads/ground-truth/{id}.png` |
| Experiment results | Render disk | Supabase `results/{experiment_id}/{run_id}/…` |
| Reports (PDF) | Render disk | Supabase `results/{experiment_id}/reports/…` |
| Public URLs | `/static/…` or stale | Supabase public object URL |
| API contracts | unchanged | unchanged |

## Prerequisites

1. Supabase project exists.
2. Bucket **`genetic-contour-platform`** exists and is **public**.
3. Service role key available (Render env only — never expose to frontend).

## Step 1 — Configure Render (before deploy)

Set these on the **genetic-contour-api** service:

```env
STORAGE_BACKEND=supabase
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_secret>
SUPABASE_STORAGE_BUCKET=genetic-contour-platform
SUPABASE_PUBLIC_BASE_URL=https://<project-ref>.supabase.co/storage/v1/object/public/genetic-contour-platform
API_DEBUG=false
```

Keep existing `DATABASE_URL`, `SECRET_KEY`, `JWT_SECRET`, `CORS_ORIGINS`, etc.

Remove or ignore old local-only paths (`UPLOAD_DIR` / `RESULTS_DIR` are unused when backend is supabase).

## Step 2 — Configure Vercel

```env
NEXT_PUBLIC_STORAGE_PUBLIC_URL=https://<project-ref>.supabase.co/storage/v1/object/public/genetic-contour-platform
```

No trailing slash. Must match `SUPABASE_PUBLIC_BASE_URL` exactly.

Redeploy the web app after setting the variable.

## Step 3 — Deploy API

1. Merge and deploy the code containing `SupabaseStorageBackend`.
2. Confirm startup succeeds (production rejects `STORAGE_BACKEND=local`).
3. Verify readiness:

```bash
curl https://genetic-contour-platform.onrender.com/health/ready
```

Expected storage block:

```json
"storage": {
  "backend": "supabase",
  "read": true,
  "write": true,
  "delete": true
}
```

## Step 4 — Audit existing DB records

Historical files on Render disk **cannot be recovered** after redeploy. Database rows may still reference missing objects.

For each admin user:

```bash
curl -H "Authorization: Bearer <token>" \
  https://genetic-contour-platform.onrender.com/api/storage/audit
```

Review:

- `missing_originals` — upload rows without storage object
- `missing_ground_truth` — GT metadata without PNG in bucket
- `missing_results` — experiment runs referencing missing result files

UI shows `storage_status` / `ground_truth_storage_status` as `missing` or `degraded` where applicable.

## Step 5 — Repair strategy (graceful degradation)

No automatic mass delete. Choose per record:

| Situation | Action |
|-----------|--------|
| Missing original image | User re-uploads, or admin `DELETE /api/storage/repair/images/{id}` |
| Missing GT only | `POST /api/storage/repair/clear-ground-truth/{image_id}` then re-annotate |
| Missing GT + supervised experiment | Experiment fails/degrades (by design); re-run after GT restored |
| Missing result images | Re-run experiment (writes new objects to Supabase) |
| Stale `public_url` in DB | API resolves from `storage_key` when URL is stale |

Bulk metadata fix:

```bash
curl -X POST -H "Authorization: Bearer <token>" \
  https://genetic-contour-platform.onrender.com/api/storage/repair/mark-missing
```

## Step 6 — Validate end-to-end

1. Upload a new image → library shows `storage_status: ok`.
2. Add ground truth → GT page shows mask preview from Supabase URL.
3. Run an experiment → result images load via public URL and `/api/media/serve`.
4. Generate report PDF → file stored under `results/{id}/reports/`.

Optional: run `node scripts/production_e2e_ultimate.mjs`.

## Rollback plan

If Supabase misconfigured:

1. Set `STORAGE_BACKEND=s3` with working S3/R2 credentials **or** temporarily `STORAGE_BACKEND=local` + `API_DEBUG=true` (dev only — not for production).
2. Redeploy previous API image if needed.
3. Fix env vars and redeploy supabase backend.

## Notes

- **No DB schema migration required** — `storage_key` / `public_url` columns already exist.
- New writes go to Supabase immediately after deploy; old Render files are not copied automatically.
- `/api/media/serve` continues to stream bytes via service role (works for private buckets too; public bucket still benefits from CDN URLs in responses).
