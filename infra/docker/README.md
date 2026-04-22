# Local Docker Compose

This directory provides the local infrastructure needed by `@spectral/web`, `@spectral/render-worker`, `@spectral/db`, and `@spectral/queue` during development.

It starts only:

- PostgreSQL 16
- Redis 7
- MinIO

## Files

- `compose.local.yml`: local Docker Compose for Postgres, Redis, and MinIO
- `.env.example`: example variables for Docker and app processes

## Default local services

### PostgreSQL

- Container name: `spectral-postgres-local`
- Image: `postgres:16-alpine`
- Host port: `5432`
- Default user: `spectral`
- Default password: `spectral`
- Default database: `spectral`
- Persistent volume: `spectral-postgres-data`
- Health check: `pg_isready`

### Redis

- Container name: `spectral-redis-local`
- Image: `redis:7-alpine`
- Host port: `6379`
- Default password: `spectral`
- Persistent volume: `spectral-redis-data`
- Health check: `redis-cli -a $REDIS_PASSWORD ping`
- Persistence mode: `appendonly yes`

### MinIO

- Container name: `spectral-minio-local`
- Image: `minio/minio`
- API host port: `9000`
- Console host port: `9001`
- Default root user: `minioadmin`
- Default root password: `minioadmin`
- Persistent volume: `spectral-minio-data`
- Health check: `GET /minio/health/live`
- Bucket bootstrap: `minio-init` creates the configured `R2_BUCKET` and applies browser CORS for the editor

## Quick start

1. Copy the example env file:

```bash
cp infra/docker/.env.example infra/docker/.env
```

2. Adjust ports or credentials in `infra/docker/.env` if they conflict with existing local services.

3. Start local infrastructure:

```bash
docker compose --env-file infra/docker/.env -f infra/docker/compose.local.yml up -d
```

4. Check service status:

```bash
docker compose --env-file infra/docker/.env -f infra/docker/compose.local.yml ps
```

5. Stop local infrastructure:

```bash
docker compose --env-file infra/docker/.env -f infra/docker/compose.local.yml down
```

To also remove persistent data:

```bash
docker compose --env-file infra/docker/.env -f infra/docker/compose.local.yml down -v
```

## Application environment

The app processes should use the same env names already consumed by the repo:

- `DATABASE_URL`
- `SHADOW_DATABASE_URL`
- `REDIS_URL`
- `REDIS_QUEUE_PREFIX`
- `WEB_BASE_URL`
- `EXPORT_MAX_ATTEMPTS`
- `EXPORT_RETRY_DELAY_MS`
- `EXPORT_WORKER_CONCURRENCY`
- `SSE_POLL_INTERVAL_MS`
- `SSE_HEARTBEAT_INTERVAL_MS`
- `R2_BUCKET`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_ACCOUNT_ID`
- `R2_REGION`
- `R2_ENDPOINT`
- `R2_FORCE_PATH_STYLE`
- `R2_PUBLIC_BASE_URL`

## Connection targets

### apps/web

`apps/web` should read these values:

```env
DATABASE_URL=postgresql://spectral:spectral@127.0.0.1:5432/spectral?schema=public
REDIS_URL=redis://:spectral@127.0.0.1:6379/0
REDIS_QUEUE_PREFIX=spectral
```

It should point `R2_*` to the local MinIO endpoint during local development:

```env
R2_BUCKET=spectral-local
R2_ACCESS_KEY_ID=minioadmin
R2_SECRET_ACCESS_KEY=minioadmin
R2_REGION=us-east-1
R2_ENDPOINT=http://127.0.0.1:9000
R2_FORCE_PATH_STYLE=true
R2_PUBLIC_BASE_URL=http://127.0.0.1:9000/spectral-local
```

### apps/render-worker

`apps/render-worker` should read these values:

```env
DATABASE_URL=postgresql://spectral:spectral@127.0.0.1:5432/spectral?schema=public
REDIS_URL=redis://:spectral@127.0.0.1:6379/0
REDIS_QUEUE_PREFIX=spectral
WEB_BASE_URL=http://127.0.0.1:3000
EXPORT_WORKER_CONCURRENCY=1
```

## MinIO access

- API endpoint: `http://127.0.0.1:9000`
- Console: `http://127.0.0.1:9001`
- Default login: `minioadmin` / `minioadmin`

The `minio-init` helper container creates the bucket named by `R2_BUCKET` and applies CORS for:
The `minio-init` helper container waits for MinIO, creates the bucket named by `R2_BUCKET`, and enables anonymous download so preview/runtime reads can use `R2_PUBLIC_BASE_URL`.

## Prisma compatibility

`packages/db/prisma.config.ts` already expects `DATABASE_URL`, and it optionally reads `SHADOW_DATABASE_URL`.

The provided example keeps those names unchanged so it stays compatible with codex3's database layer.

If codex3 wants a different host, port, database name, or shadow database convention, only the env values should need to change. The variable names themselves should not need renaming.
