# API Reference

Base URL: `http://localhost:8000` (development)

Interactive docs: `/docs` (Swagger UI)

## Health

### `GET /health`

```json
{ "status": "ok", "service": "genetic-contour-api" }
```

## Authentication

All protected endpoints require `Authorization: Bearer <access_token>`.

### `POST /api/auth/register`

```json
{ "email": "user@example.com", "password": "securepass123", "name": "Optional" }
```

### `POST /api/auth/login` (rate limit: 5/minute)

```json
{ "email": "user@example.com", "password": "securepass123" }
```

Returns `access_token` and `refresh_token`.

### `POST /api/auth/refresh`

```json
{ "refresh_token": "<refresh_token>" }
```

### `POST /api/auth/logout`

```json
{ "refresh_token": "<refresh_token>" }
```

### `GET /api/auth/me`

Returns current user profile.

## Images

### `POST /api/images/upload`

Upload an image file (multipart/form-data).

**Field**: `file` — JPG, PNG, or WebP, max 10MB

**Response**:
```json
{
  "image": {
    "id": "uuid",
    "original_name": "photo.jpg",
    "file_path": "uploads/abc123.jpg",
    "width": 800,
    "height": 600,
    "size": 125000,
    "mime_type": "image/jpeg",
    "created_at": "2026-06-05T12:00:00Z"
  },
  "message": "Image uploaded successfully"
}
```

### `GET /api/images`

List uploaded images.

### `GET /api/images/{id}`

Get image by ID.

## Experiments

### `POST /api/experiments`

```json
{
  "image_id": "uuid",
  "title": "Experiment title",
  "description": "optional"
}
```

### `GET /api/experiments`

List all experiments.

### `GET /api/experiments/{id}`

Get experiment by ID.

### `POST /api/experiments/{id}/run`

Queue contour detection for **background execution**. Returns immediately:

```json
{ "job_id": "uuid", "status": "queued" }
```

Request body:

```json
{
  "algorithm": "compare_all",
  "params": {
    "threshold": 0.5,
    "blur_kernel": 5,
    "resize_width": 256,
    "canny_low": 50,
    "canny_high": 150
  },
  "ga_params": {
    "population_size": 50,
    "generations": 30,
    "mutation_rate": 0.05,
    "crossover_rate": 0.7,
    "elitism_count": 2,
    "threshold": 0.5,
    "blur_kernel": 5,
    "resize_width": 256
  }
}
```

**Algorithm values**: `sobel`, `prewitt`, `canny`, `genetic`, `compare_all`

### `GET /api/experiments/{id}/status`

Job status with real progress from preprocessing steps and GA generations:

```json
{
  "job_id": "uuid",
  "status": "running",
  "progress_percent": 42.5,
  "current_generation": 12,
  "started_at": "...",
  "finished_at": null,
  "error_message": null
}
```

### `POST /api/experiments/{id}/cancel`

Cancel a `queued` or `running` experiment.

### `GET /api/experiments/{id}/results`

Full results with algorithm runs, metrics, images, and GA history.

### `GET /api/stats`

Platform statistics for dashboard.

```json
{
  "total_experiments": 5,
  "completed_experiments": 4,
  "failed_experiments": 1,
  "total_images": 3,
  "best_ga_fitness": 0.4521,
  "algorithms_count": 4
}
```

### `GET /api/experiments/{id}/report`

Enriched JSON report with metadata, metrics, GA history, and scientific conclusion.

### `GET /api/experiments/{id}/report/csv`

CSV download with experiment metadata, metrics table, GA history, and conclusion.

### `GET /api/experiments/{id}/report/pdf`

PDF scientific report (completed experiments only). Contains images, metrics, fitness chart, and conclusion.

### `DELETE /api/experiments/{id}`

Delete experiment and associated data.

## Static Files

- Uploads: `GET /static/uploads/{filename}`
- Results: `GET /static/results/{experiment_id}/{run_id}/{filename}`

## Error Responses

```json
{ "detail": "Error message" }
```

| Status | Meaning |
|--------|---------|
| 400 | Validation error |
| 404 | Resource not found |
| 413 | File too large |
| 429 | Rate limit exceeded |
| 500 | Server error |
