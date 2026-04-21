# @spectral/media

Stable R2 and asset-resolution surface for server code.

## Entry points

- `createR2StorageAdapterFromEnv`
- `R2StorageAdapter`
- `createProjectAssetUploadPlan`
- `createAssetUploadSignature`
- `R2AssetResolver`
- `createRepositoryAssetLookup`
- storage key builders from `keys.ts`

## Upload flow

```ts
import { createProjectAssetUploadPlan, createR2StorageAdapterFromEnv } from "@spectral/media";

const storage = createR2StorageAdapterFromEnv(process.env);
const uploadPlan = await createProjectAssetUploadPlan(storage, {
  projectId,
  assetId,
  originalFilename,
  contentType,
});
```

`uploadPlan.storageKey` should be written into `media_assets.storageKey`.

## Asset resolver flow

```ts
import { R2AssetResolver, createR2StorageAdapterFromEnv, createRepositoryAssetLookup } from "@spectral/media";

const storage = createR2StorageAdapterFromEnv(process.env);
const lookup = createRepositoryAssetLookup({
  assetRepository: dataLayer.assetRepository,
  renderArtifactRepository: dataLayer.renderArtifactRepository,
});

const resolver = new R2AssetResolver({
  adapter: storage,
  lookup,
});
```

Server code should resolve object URLs through `AssetResolver` instead of concatenating R2 paths by hand.
