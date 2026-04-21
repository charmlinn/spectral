# @spectral/project-schema

Shared project document model for Spectral.

Responsibilities:

- define `VideoProject`
- version project documents
- normalize editor payloads
- migrate older project documents
- adapt legacy Specterr presets into the new project shape

## Stable document contract

`VideoProject` is the persisted snapshot contract used by the data layer.
Legacy or editor-specific extra fields are stripped during normalization.

Stable top-level fields:

- `version`
- `projectId`
- `createdAt`
- `updatedAt`
- `meta`
- `timing`
- `viewport`
- `audio`
- `visualizer`
- `backdrop`
- `lyrics`
- `textLayers`
- `overlays`
- `export`
- `source`
