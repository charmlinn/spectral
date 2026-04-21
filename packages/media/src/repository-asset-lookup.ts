import type { AssetLookup, StorageObjectDescriptor } from "./contracts";

export type AssetRecordReader = {
  getAssetById(assetId: string): Promise<StorageObjectDescriptor | null>;
};

export type ArtifactRecordReader = {
  getArtifactById(artifactId: string): Promise<StorageObjectDescriptor | null>;
};

export type FontRecordReader = {
  getFontById(fontId: string): Promise<StorageObjectDescriptor | null>;
};

export type RepositoryAssetLookupInput = {
  assetRepository: AssetRecordReader;
  renderArtifactRepository?: ArtifactRecordReader;
  fontRepository?: FontRecordReader;
};

export function createRepositoryAssetLookup(
  input: RepositoryAssetLookupInput,
): AssetLookup {
  return {
    getAssetById(assetId: string): Promise<StorageObjectDescriptor | null> {
      return input.assetRepository.getAssetById(assetId);
    },
    getArtifactById(artifactId: string): Promise<StorageObjectDescriptor | null> {
      if (!input.renderArtifactRepository) {
        return Promise.resolve(null);
      }

      return input.renderArtifactRepository.getArtifactById(artifactId);
    },
    getFontById(fontId: string): Promise<StorageObjectDescriptor | null> {
      if (input.fontRepository) {
        return input.fontRepository.getFontById(fontId);
      }

      return input.assetRepository.getAssetById(fontId);
    },
  };
}
