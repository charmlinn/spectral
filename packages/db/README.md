# @spectral/db

Stable data-layer contract for the server side.

## Entry points

- `getDataLayer()` / `createDataLayer()` from `@spectral/db`
- `withTransaction()` from `@spectral/db`
- preset import helpers from `@spectral/db/presets`

## Repositories

- `projectRepository`
  - `createProject`
  - `getProjectById`
  - `updateProjectMetadata`
  - `saveSnapshot`
  - `listSnapshots`
  - `getSnapshotById`
  - `getProjectWithActiveSnapshot`
  - `getActiveProjectDocument`
- `presetRepository`
  - `listEnabledPresets`
  - `getPresetById`
  - `upsertPreset`
  - `importLegacyPresets`
- `assetRepository`
  - `createPendingAsset`
  - `completeAsset`
  - `failAsset`
  - `getAssetById`
  - `getAssetByStorageKey`
  - `findAssetBySha256`
- `audioAnalysisRepository`
  - `getAnalysisById`
  - `getLatestByAssetId`
  - `upsertAnalysis`
- `exportJobRepository`
  - `createQueuedJob`
  - `appendEvent`
  - `updateJobStatus`
  - `getJobById`
  - `listJobsByProjectId`
  - `listEventsByJobId`
  - `listEventsByProjectId`
- `renderArtifactRepository`
  - `createArtifact`
  - `getArtifactById`
  - `getArtifactByStorageKey`
  - `listArtifactsByExportJobId`

## Server usage

```ts
import { getDataLayer } from "@spectral/db";

const dataLayer = getDataLayer();

const project = await dataLayer.projectRepository.createProject({
  name: "Untitled Project",
});

const snapshot = await dataLayer.projectRepository.saveSnapshot({
  projectId: project.id,
  projectData,
  source: "editor",
  reason: "manual-save",
});
```

All repository return types come from `src/contracts.ts`. Server code should depend on those contracts and should not import Prisma types directly.
