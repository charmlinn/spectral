# Spectral

Spectral is a monorepo for an audio-reactive video editor and rendering platform. It combines a browser-based editor, a shared realtime preview runtime, a persistent project model, media storage, audio analysis, and a background export pipeline.

The repository is organized around one core idea: the editor preview and the eventual server-side renderer should consume the same project document and as much of the same render logic as possible. The browser editor is already the most complete part of the system. The export worker and render-page bootstrap are present, but the final headless rendering and encoding path is still a planned integration layer.

## Stack

- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui
- State and editor packages: Zustand-based stores plus shared timeline components
- Preview rendering: PixiJS, pixi-filters, chroma-js, fontfaceobserver
- Audio analysis: FFT-based waveform and spectrum processing
- API and persistence: Next.js Route Handlers, Prisma 7, PostgreSQL
- Queueing: BullMQ on Redis
- Object storage: Cloudflare R2-compatible API, with MinIO for local development
- Monorepo tooling: pnpm workspaces, Turbo, ESLint, Prettier

## Monorepo Layout

```text
apps/
  web/                Next.js editor app, API routes, render bootstrap routes
  render-worker/      Background export worker

packages/
  audio-analysis/     Waveform + spectrum analysis and related helpers
  config/             Shared ESLint, TS, and PostCSS config
  db/                 Prisma client bootstrap, repositories, preset seed loaders
  editor-store/       Zustand stores for project, playback, preview, UI, export
  media/              R2/MinIO adapter, asset URL resolution, upload signing
  project-schema/     Canonical VideoProject document schema and normalization
  queue/              BullMQ connection, publisher, worker helpers, job types
  render-core/        Deterministic scene graph and frame-time calculations
  render-runtime-browser/
                      Browser runtime, Pixi scene, layers, filters, media adapters
  timeline/           Timeline UI primitives and interaction hooks
  ui/                 Shared shadcn/ui-based components

infra/docker/
  compose.local.yml   Local PostgreSQL, Redis, and MinIO stack

prisma/
  schema.prisma       Database schema
```

## Architecture Overview

### 1. Canonical Project Document

`@spectral/project-schema` defines the canonical `VideoProject` shape used across the entire stack. This package is the system contract:

- editor pages read and write it
- persistence stores snapshots of it
- preview builds scene graphs from it
- export bootstrap serializes it for worker-side rendering

Important parts of the document include:

- viewport and aspect ratio
- backdrop/media sources
- visualizer configuration
- lyrics and timed segments
- text layers
- particle overlays
- audio bindings and analysis references
- export defaults

The intent is to keep the project document transportable across browser preview, API save/load, and offline rendering without format translation in each layer.

### 2. Editor Application

`apps/web` is the main product surface.

It contains:

- the editor routes under `/editor`
- project, preset, asset, audio-analysis, export, and SSE API routes
- the render bootstrap routes under `/render/export/[exportJobId]`
- client-side helpers that connect editor UI to the shared stores and runtime

The editor shell is split into familiar zones:

- top toolbar for project actions and export entry points
- left-side configuration panels for general settings, visuals, and audio
- center preview stage powered by the shared browser runtime
- bottom timeline with audio waveform and lyric timing
- right-side inspector for contextual controls

The frontend is intentionally thin around rendering logic. It owns interaction, state wiring, and API calls, while frame computation is delegated to the shared render packages.

### 3. Shared Rendering Model

The rendering stack is split into two layers:

- `@spectral/render-core`
- `@spectral/render-runtime-browser`

`render-core` is the deterministic layer. It does not own DOM, canvas, or Pixi state. Instead, it turns a `VideoProject`, a frame context, and optional analysis/history providers into a render scene graph. It is responsible for:

- frame/time conversion
- scene graph construction
- visible layer resolution
- effect timing inputs
- visualizer analysis helpers
- reusable math such as drift/simplex-noise style calculations

`render-runtime-browser` is the execution layer for the browser. It mounts onto a target element and uses PixiJS to materialize the scene graph into a realtime preview. It includes:

- the browser runtime lifecycle
- HTML media clocks and deterministic clocks
- asset resolution and media source tracking
- Pixi scene composition
- per-layer implementations for backdrop, text, lyrics, particles, and visualizer
- filter and shader helpers
- preview bootstrap helpers for both editor preview and future render-page execution

This separation is the critical architectural choice in the repository. The long-term export renderer should reuse `render-core` contracts and as much visual implementation from `render-runtime-browser` as possible, replacing only the environment-specific shell around timing, surface creation, asset IO, and final encoding.

### 4. Timeline and Editor State

Two packages support the editor experience:

- `@spectral/editor-store`
- `@spectral/timeline`

`editor-store` centralizes the reactive editing model:

- project document mutations
- undo/redo-capable patching
- playback state
- preview state
- timeline state
- editor panel/dialog state
- export status state

`timeline` provides the time-based editing UI:

- time ruler and grid
- playhead logic
- zoom and scroll hooks
- waveform track
- lyrics segment track
- markers track

The editor app consumes both packages rather than embedding this logic directly in route components.

### 5. Audio Analysis Pipeline

`@spectral/audio-analysis` converts uploaded audio into reusable analysis data for both preview and future export.

Today it provides:

- waveform overview generation
- FFT-based spectrum sampling
- magnitude normalization helpers
- snapshot and provider contracts
- array-backed providers for reuse in preview/runtime code

The intended flow is:

1. an audio asset is uploaded and completed
2. analysis is produced and stored
3. the editor and renderer load the same analysis snapshot
4. visualizer and motion layers consume that data frame-by-frame

This is important because the visual identity of the output depends less on raw FFT alone and more on the post-processing conventions applied on top of it.

### 6. API, Persistence, and Storage

The API surface lives inside `apps/web/app/api` and delegates real logic to `apps/web/src/server`.

That server layer is structured around:

- request validation schemas
- service modules
- repository wiring
- storage wiring
- queue wiring
- JSON/HTTP error handling

Persistence is centered on PostgreSQL and Prisma:

- `Project` stores project metadata
- `ProjectSnapshot` stores immutable project document snapshots
- `Preset` stores bundled preset definitions
- `MediaAsset` stores uploaded asset metadata
- `AudioAnalysis` stores waveform and spectrum results
- `ExportJob` and `ExportJobEvent` store export orchestration state
- `RenderArtifact` stores generated outputs and derivative artifacts
- `OutboxMessage` exists for future reliable delivery patterns

Media storage is abstracted by `@spectral/media`:

- signed upload generation
- object key conventions
- R2-compatible adapter
- asset URL resolution for browser/runtime use

Local development uses MinIO as the S3-compatible target.

### 7. Queue and Background Processing

`@spectral/queue` wraps BullMQ on top of Redis.

Current responsibilities:

- create Redis-backed queue connections
- enqueue export render jobs
- construct export job workers
- normalize retry and unrecoverable error handling

`apps/render-worker` consumes queued export jobs. Its current flow is:

1. read the export job from PostgreSQL
2. move it into `running`
3. fetch render bootstrap metadata from the web app
4. call a render executor
5. write status and event-log updates

The worker contract is in place, but the executor still stops before actual frame rendering and video encoding. In other words, orchestration exists, while the final rendering engine is still the next large implementation milestone.

### 8. Render Bootstrap Path

The route `/render/export/[exportJobId]` is the bridge between the editor-side runtime model and background exports.

Its bootstrap payload already includes:

- export job settings
- project metadata
- normalized snapshot data
- target surface size
- runtime fps and duration
- asset bindings
- audio analysis payload
- event stream routes

That payload is the correct integration seam for future headless rendering. It gives the worker everything needed to reconstruct the same visual state that the browser preview already knows how to display.

## Data Flow

### Project editing

1. The editor loads a project and its active snapshot.
2. The snapshot is normalized into a `VideoProject`.
3. Zustand stores drive UI interactions and document mutations.
4. The preview runtime consumes the current document and analysis providers.
5. Saving writes a new immutable snapshot.

### Asset upload and analysis

1. The editor requests a signed upload URL.
2. The file is uploaded directly to object storage.
3. The client calls the asset completion API with file metadata.
4. Audio analysis is generated or reused.
5. Preview and timeline consume the resulting waveform and spectrum data.

### Export orchestration

1. The editor creates an export job.
2. The API persists the job and appends an initial event.
3. A BullMQ message is enqueued in Redis.
4. `apps/render-worker` consumes the job.
5. The worker fetches the render bootstrap payload.
6. Final rendering and encoding are the remaining missing step.

## Local Development Infrastructure

`infra/docker/compose.local.yml` starts the services required by the app layer:

- PostgreSQL 16
- Redis 7
- MinIO

Typical local startup flow:

```bash
cp infra/docker/.env.example infra/docker/.env
docker compose --env-file infra/docker/.env -f infra/docker/compose.local.yml up -d
pnpm install
pnpm dev
```

Important environment groups:

- `DATABASE_URL` and `SHADOW_DATABASE_URL`
- `REDIS_URL` and `REDIS_QUEUE_PREFIX`
- `R2_*` object storage settings
- `WEB_BASE_URL`
- export retry and worker concurrency settings
- SSE polling and heartbeat settings

## Current Status

The browser editor and preview runtime are the most mature parts of the repository. The project already has:

- a shared project schema
- preset-backed project documents
- realtime preview rendering
- waveform and spectrum analysis
- timeline editing primitives
- asset upload and storage wiring
- export job persistence
- Redis/BullMQ orchestration
- a render worker shell

The main unfinished area is backend rendering completion:

- headless Pixi/runtime execution
- frame capture or direct GPU render output
- video encoding and muxing
- artifact generation and upload
- production-grade retry/resume semantics

## Design Principles

- Keep one canonical project document across editor, preview, and export
- Reuse the same render contracts in browser and worker contexts
- Treat audio analysis as reusable data, not a UI-only side effect
- Keep API routes thin and move logic into reusable services/repositories
- Prefer copy-first parity for mature rendering libraries and proven helper logic
- Avoid placeholder behavior in critical rendering paths

## Where To Look First

If you are onboarding to the codebase, start here:

- `apps/web/app/editor/[projectId]`
- `apps/web/src/lib/editor-runtime.ts`
- `packages/project-schema/src/schema.ts`
- `packages/render-core/src/scene/build-scene-graph.ts`
- `packages/render-runtime-browser/src/runtime/bootstrap-preview-stage-runtime.ts`
- `packages/render-runtime-browser/src/pixi/`
- `packages/audio-analysis/src/analyze-audio-buffer.ts`
- `apps/web/src/server/services/export-service.ts`
- `apps/render-worker/src/worker.ts`

These files show the current architectural center of gravity better than any earlier migration notes.
