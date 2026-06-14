# Experiment Queue — Scalability Notes

## Current production default: `EXPERIMENT_QUEUE_BACKEND=asyncio`

Render free/starter tier runs a **single API process** with an in-process asyncio task queue. Jobs are scheduled on the same event loop as HTTP requests.

### What works today

- Single-user and low-concurrency research workloads
- `compare_all` and benchmark cohort runs at modest scale
- Startup recovery re-enqueues interrupted `queued` / stale `running` experiments on API boot
- `/health/ready` reports Redis as **skipped** when `asyncio` backend is active (expected, not an outage)

### Scalability limits (asyncio backend)

| Limit | Impact |
|-------|--------|
| Single process | No horizontal worker scaling; CPU-bound GA runs block other requests on the same instance |
| Memory | Long cohorts / large images increase RAM pressure in one process |
| Restarts | In-flight asyncio tasks are lost; DB `queued` rows are recovered on next startup |
| No distributed lock | Recovery lock is bypassed for asyncio; only one API instance should run recovery |

### When to upgrade to Celery + Redis

Set on Render API **and** a dedicated worker service:

```env
EXPERIMENT_QUEUE_BACKEND=celery
REDIS_URL=redis://...
CELERY_TASK_ALWAYS_EAGER=false
```

Benefits:

- Dedicated worker process(es) for experiment execution
- API remains responsive under load
- Redis-backed recovery lock prevents duplicate re-enqueue across replicas
- `/health/ready` expects Redis **connected**

### Health check interpretation

```json
{
  "checks": {
    "postgresql": { "ok": true },
    "redis": { "ok": true, "detail": "skipped (EXPERIMENT_QUEUE_BACKEND=asyncio)" },
    "storage": { "ok": true }
  }
}
```

`redis.ok: true` with `skipped` is **normal** for asyncio mode — not a misconfiguration.

### Operational recommendation

| Stage | Backend |
|-------|---------|
| Demo / thesis / low traffic | `asyncio` (current) |
| Public beta with concurrent users | `celery` + Redis + worker |
| Production research platform | `celery` + Redis + worker + S3/R2 |

See also: [production-env-checklist.md](production-env-checklist.md), [deployment.md](deployment.md).
