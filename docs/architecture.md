# Architecture

## Overview

Contour Analytics Platform is a monorepo for scientific research on multi-algorithm contour detection and edge analysis.

```
genetic-contour-platform/
├── apps/
│   ├── web/          # Next.js 15 frontend (Vercel)
│   └── api/          # FastAPI backend (Render)
├── packages/
│   └── shared/       # Shared TypeScript types & constants
├── docs/
└── docker-compose.yml
```

## Components

### Frontend (`apps/web`)

- **Framework**: Next.js 15 App Router, TypeScript strict
- **UI**: TailwindCSS, shadcn/ui-style components, dark/light mode
- **Charts**: Recharts for GA fitness evolution
- **Communication**: REST API via `services/` layer

### Backend (`apps/api`)

- **Framework**: FastAPI with async SQLAlchemy
- **Database**: PostgreSQL (asyncpg driver)
- **CV/ML**: OpenCV, NumPy, scikit-image
- **GA Core**: Isolated module under `app/core/genetic_algorithm/`

### Data Flow

```
Upload Image → Store in uploads/ → Create Experiment
    → Preprocess (grayscale, resize, blur, gradient)
    → Run Algorithm(s)
    → Save results to results/
    → Persist metrics & images to PostgreSQL
    → Frontend displays comparison
```

## Database Schema

| Table | Purpose |
|-------|---------|
| `users` | Future auth support |
| `images` | Uploaded image metadata |
| `experiments` | Experiment sessions |
| `algorithm_runs` | Per-algorithm execution records |
| `ga_parameters` | GA hyperparameters |
| `ga_generation_history` | Per-generation fitness tracking |
| `result_images` | Output image paths |
| `metrics` | Quantitative evaluation |
| `reports` | Exported report files |

## Security

- File upload: MIME validation, size limits, extension whitelist
- Path traversal protection on all file operations
- CORS restricted to configured origins
- Rate limiting via slowapi
- No hardcoded secrets — all via environment variables

## Storage Strategy

- **Development**: Local `uploads/` and `results/` directories
- **Production**: Architecture ready for S3/R2 — abstract storage behind service layer in future phase

## Deployment Topology

| Service | Platform |
|---------|----------|
| Frontend | Vercel |
| Backend API | Render Web Service |
| PostgreSQL | Render PostgreSQL / Neon / Supabase |
