# Backend Rendering Exploration

This document is a planning note for the next major step in Spectral: turning the existing browser preview stack into a production-grade backend rendering system.

It is based on two inputs:

- the current repository architecture
- public statements in the Paperspace interview about GPU-accelerated rendering, browser-side audio analysis, and cloud-side ML-assisted media processing

Source:

- https://blog.paperspace.com/tunebat-and-specterr-bring-machine-learning-to-the-dj/

The interview states that:

- audio-reactive visuals are driven by FFT-derived amplitude and frequency data
- a large part of the product value comes from proprietary post-processing and animation logic built on top of that signal
- GPU machines are important for timely video rendering
- ML-assisted audio processing already exists elsewhere in the broader product family

This means the backend renderer should not be planned as a generic “export page screenshotter.” It should be treated as a deterministic media pipeline that preserves the same visual behavior as the live editor while remaining open to more advanced audio and ML-assisted preprocessing later.

## What Already Exists

The current repo already contains the foundations needed for a serious render architecture:

- a canonical `VideoProject` document in `@spectral/project-schema`
- shared frame and scene logic in `@spectral/render-core`
- a PixiJS-based browser renderer in `@spectral/render-runtime-browser`
- audio analysis generation and reusable providers in `@spectral/audio-analysis`
- export job persistence and event logs in PostgreSQL
- queue orchestration via BullMQ and Redis
- a render bootstrap route that serializes the project, surface, asset bindings, and audio analysis for a given export job

This is important because the missing work is not “invent a render model.” The missing work is “execute the existing render model headlessly, reliably, and fast enough for export workloads.”

## Core Planning Principle

The backend renderer should reuse the same visual core as the browser preview whenever possible.

That means:

- the same `VideoProject` contract
- the same scene graph logic
- the same visualizer math
- the same layer ordering
- the same filter conventions
- the same asset resolution semantics
- the same timing rules

The backend renderer should replace only the environment-specific shell:

- surface creation
- clock source
- asset prefetch/materialization
- frame capture
- encoding
- job orchestration
- artifact upload

If a backend-only implementation diverges too much from preview code, the product will eventually suffer from “preview/export mismatch.” Preventing that mismatch should be treated as a hard requirement.

## Directions To Explore

### 1. Deterministic Render Session Contract

The first exploration target is a formal render session contract shared by preview and export.

The contract should include:

- project snapshot ID
- normalized project document
- render surface width/height
- fps
- duration
- frame count
- asset bindings and resolved media locations
- audio analysis snapshot or provider source
- font manifest
- runtime mode: preview or export

This contract should become the single input to both:

- browser preview bootstrap
- worker-side export bootstrap

Today the render bootstrap route is close to this already, but it should be hardened until it is the only way the worker reconstructs render state.

### 2. Headless Pixi Execution

The strongest near-term direction is to keep PixiJS as the visual engine and run it in a controlled headless environment rather than re-implementing rendering in another stack.

Options worth evaluating:

1. Headless Chromium + the existing render page
2. Node-based offscreen canvas + Pixi runtime
3. GPU-backed container execution where Pixi runs with an actual accelerated graphics context

The tradeoff is straightforward:

- Headless Chromium gives the highest compatibility with the current preview path.
- Offscreen Node rendering may become leaner later, but it usually creates more compatibility work.
- A GPU-backed browser path may be the fastest route to parity if export throughput matters more than infrastructure simplicity.

For the first production-grade version, the safest direction is usually:

- use the existing render bootstrap route
- open it in a controlled browser environment
- drive a deterministic clock frame-by-frame
- capture output frames or a direct stream

That keeps preview and export much closer.

### 3. Deterministic Clocking Instead of Realtime Playback

The export system should never depend on wall-clock playback.

Instead, every export job should use:

- a fixed fps
- an integer frame index
- derived `timeMs`
- deterministic access to analysis data at that frame

This is already aligned with `render-core` and the existing deterministic runtime concepts. The backend renderer should make this the default mode and avoid media-element-driven timing entirely.

### 4. Asset Materialization Stage

Rendering will become more stable if every export job has a preflight stage that resolves and validates all required assets before the first frame is drawn.

That stage should:

- resolve every referenced image, video, logo, font, and audio file
- verify availability and ready status
- download or cache remote objects locally when needed
- normalize font loading inputs
- compute video source dimensions up front
- validate duration mismatches before render

Without this stage, runtime failures will show up too late, after GPU or browser resources are already allocated.

## 5. Audio Analysis Strategy

The interview confirms that amplitude and frequency extraction are central to the visual system, and the repo already reflects that.

The next backend question is not whether to analyze audio, but where each level of analysis should live.

A practical split is:

- editor-safe analysis in browser or web worker for instant preview
- persisted reusable analysis snapshots for export
- optional heavier offline analysis for premium export features

The persisted analysis should be treated as the baseline render signal. For later quality upgrades, explore adding:

- beat and downbeat detection
- section segmentation
- transient/onset markers
- energy envelopes
- stem-aware analysis for vocal versus instrumental emphasis

These are not required to finish backend rendering, but they are high-leverage research directions because they can drive more sophisticated motion, cuts, pulses, and overlay timing than raw FFT alone.

### 6. Encoding Pipeline

The render executor should be split into two explicit phases:

1. visual frame production
2. media encoding and muxing

That separation matters because different export formats may want different encoders while still sharing the same frame renderer.

Questions to evaluate:

- Should frames be written to disk, piped to FFmpeg, or passed through a memory buffer?
- Should audio muxing happen only once at the end?
- Should posters, thumbnails, and preview clips be derived from the same frame pipeline?
- Should long renders be chunked into segments for retryability?

The likely direction is:

- render frames deterministically
- pipe them into FFmpeg
- mux the original or normalized audio track
- upload final artifacts back to object storage

### 7. GPU Utilization Strategy

The interview explicitly ties timely rendering to GPU-equipped cloud machines. That suggests backend planning should include GPU as a first-class concern, not an afterthought.

Areas to explore:

- whether Pixi filters and shader-heavy scenes materially benefit from GPU-backed browser execution
- what scene complexity breaks CPU-only export times
- whether frame capture throughput becomes the bottleneck before actual drawing
- whether multiple export jobs can share a GPU node safely
- whether queue scheduling should understand “GPU slots” rather than only worker counts

This affects infrastructure design:

- one queue may not be enough
- worker classes may need capability labels such as `cpu`, `gpu`, or `high-memory`
- admission control may need to account for render duration estimates

### 8. Reliability and Resume Semantics

The current queue and event model already support retries, but backend rendering will need finer-grained resilience.

Areas to plan:

- frame-range or segment checkpoints
- resumable encoding
- asset prefetch cache reuse across retries
- explicit failure classes: bootstrap, asset, render, encode, upload
- operator-visible structured logs per stage
- render diagnostics artifacts such as failed-frame captures

This matters because GPU-backed rendering failures are expensive. A system that restarts from frame zero on every failure will be operationally painful.

### 9. Artifact Model

The schema already has room for `RenderArtifact`. That should be expanded into a clear artifact policy.

Candidate artifact classes:

- final video
- poster frame
- preview thumbnail
- waveform cache
- spectrum cache
- frame samples for QA
- render logs or debug manifests

This enables both product features and debugging. It also makes it easier to cache expensive intermediate work.

### 10. Quality Assurance and Preview/Export Parity

Once backend rendering exists, the biggest product risk will be visual mismatch.

The repo should eventually support parity checks such as:

- render the same frame in preview mode and export mode
- compare pixels within a defined threshold
- compare timing-sensitive layer states at several key frames
- lock down expected outputs for a small preset corpus

This is more valuable than broad unit testing alone, because the hardest bugs here are visual and temporal.

## ML-Adjacent Directions Worth Researching

The interview does not say that the visualizer itself is ML-generated. It points much more strongly to:

- FFT/audio-feature analysis as the direct animation signal
- ML for more advanced audio tasks around decomposition and semantic analysis

So the most realistic ML exploration areas for Spectral are:

### A. Stem Separation for Render-Aware Effects

Use source separation to distinguish vocals, drums, bass, and harmonic content, then drive layer groups differently.

Examples:

- vocal-responsive text emphasis
- bass-responsive backdrop motion
- percussion-driven particles or flashes

### B. Automatic Beat and Structure Detection

Use beat/downbeat and section analysis to create smarter defaults for:

- marker generation
- lyric emphasis timing
- effect intensity curves
- camera-like motion patterns

### C. Automatic Lyric Alignment

If lyric-video workflows matter, word or segment alignment could later become a major productivity feature.

### D. Music Feature Tagging

Mood, energy, danceability, and section-level descriptors could eventually influence default visual presets, automatic styling suggestions, or export variants.

These are good future directions because they extend the current architecture rather than replacing it.

## Recommended Implementation Sequence

### Phase 1: Complete the Export Runtime

- Make the worker consume only the render bootstrap payload
- Run the Pixi-based render path in a deterministic export mode
- Produce frames and encode one supported format end-to-end
- Upload the final artifact and write job events

### Phase 2: Stabilize and Measure

- Add asset preflight
- Add structured render stages and logs
- Capture performance metrics per job
- Add preview/export parity checks on a small corpus

### Phase 3: GPU-Aware Scale-Out

- Benchmark CPU vs GPU nodes
- Introduce queue routing based on worker capability
- Add caching and better retry semantics

### Phase 4: Advanced Analysis and ML Features

- enrich analysis beyond FFT
- add structure-aware and stem-aware signals
- expose those signals to the visual engine as opt-in render inputs

## Immediate Architectural Recommendation

For the next implementation cycle, the most defensible path is:

- keep PixiJS as the render engine
- keep `render-core` as the shared deterministic scene layer
- drive export through the existing render bootstrap contract
- execute rendering in a browser-like environment first
- postpone major renderer rewrites until parity is proven

That path minimizes architectural drift and gives the backend renderer the best chance of matching the preview that already exists today.
