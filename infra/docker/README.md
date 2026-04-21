# Local Docker Compose

This directory provides the local infrastructure needed by `@spectral/web`, `@spectral/render-worker`, `@spectral/db`, and `@spectral/queue` during development.

It starts only:

- PostgreSQL 16
- Redis 7

It does not provide object storage. `Cloudflare R2` should continue using real remote credentials.

## Files

- `compose.local.yml`: local Docker Compose for Postgres and Redis
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

## Quick start

1. Copy the example env file:

```bash
cp infra/docker/.env.example infra/docker/.env
```

2. Fill in the real `R2_*` values in `infra/docker/.env`.

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
- `R2_PUBLIC_BASE_URL`

## Connection targets

### apps/web

`apps/web` should read these values:

```env
DATABASE_URL=postgresql://spectral:spectral@127.0.0.1:5432/spectral?schema=public
REDIS_URL=redis://:spectral@127.0.0.1:6379/0
REDIS_QUEUE_PREFIX=spectral
```

It also needs the real `R2_*` values because local compose does not provide object storage.

### apps/render-worker

`apps/render-worker` should read these values:

```env
DATABASE_URL=postgresql://spectral:spectral@127.0.0.1:5432/spectral?schema=public
REDIS_URL=redis://:spectral@127.0.0.1:6379/0
REDIS_QUEUE_PREFIX=spectral
WEB_BASE_URL=http://127.0.0.1:3000
EXPORT_WORKER_CONCURRENCY=1
```

## Prisma compatibility

`packages/db/prisma.config.ts` already expects `DATABASE_URL`, and it optionally reads `SHADOW_DATABASE_URL`.

The provided example keeps those names unchanged so it stays compatible with codex3's database layer.

If codex3 wants a different host, port, database name, or shadow database convention, only the env values should need to change. The variable names themselves should not need renaming.
