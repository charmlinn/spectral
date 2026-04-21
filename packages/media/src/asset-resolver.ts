import type { AssetLookup, AssetResolver, StorageAdapter } from "./contracts";

async function getRequiredObjectUrl(
  adapter: StorageAdapter,
  key: string,
  expiresInSeconds?: number,
): Promise<string> {
  const publicUrl = adapter.resolvePublicUrl(key);

  if (publicUrl) {
    return publicUrl;
  }

  return adapter.createSignedReadUrl({
    key,
    expiresInSeconds,
  });
}

export type AssetResolverOptions = {
  adapter: StorageAdapter;
  lookup: AssetLookup;
  expiresInSeconds?: number;
};

export class R2AssetResolver implements AssetResolver {
  readonly #adapter: StorageAdapter;
  readonly #lookup: AssetLookup;
  readonly #expiresInSeconds?: number;

  constructor(options: AssetResolverOptions) {
    this.#adapter = options.adapter;
    this.#lookup = options.lookup;
    this.#expiresInSeconds = options.expiresInSeconds;
  }

  async resolveImage(assetId: string): Promise<string> {
    const asset = await this.#lookup.getAssetById(assetId);

    if (!asset) {
      throw new Error(`Image asset not found: ${assetId}`);
    }

    return getRequiredObjectUrl(this.#adapter, asset.storageKey, this.#expiresInSeconds);
  }

  async resolveVideo(assetId: string): Promise<string> {
    const asset = await this.#lookup.getAssetById(assetId);

    if (!asset) {
      throw new Error(`Video asset not found: ${assetId}`);
    }

    return getRequiredObjectUrl(this.#adapter, asset.storageKey, this.#expiresInSeconds);
  }

  async resolveAudio(assetId: string): Promise<string> {
    const asset = await this.#lookup.getAssetById(assetId);

    if (!asset) {
      throw new Error(`Audio asset not found: ${assetId}`);
    }

    return getRequiredObjectUrl(this.#adapter, asset.storageKey, this.#expiresInSeconds);
  }

  async resolveFont(fontId: string): Promise<string | null> {
    const font = this.#lookup.getFontById
      ? await this.#lookup.getFontById(fontId)
      : await this.#lookup.getAssetById(fontId);

    if (!font) {
      return null;
    }

    return getRequiredObjectUrl(this.#adapter, font.storageKey, this.#expiresInSeconds);
  }

  async resolveArtifact(objectId: string): Promise<string> {
    const artifact = this.#lookup.getArtifactById
      ? await this.#lookup.getArtifactById(objectId)
      : await this.#lookup.getAssetById(objectId);

    if (!artifact) {
      throw new Error(`Artifact not found: ${objectId}`);
    }

    return getRequiredObjectUrl(this.#adapter, artifact.storageKey, this.#expiresInSeconds);
  }
}
