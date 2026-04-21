import type { SpectralDataLayer, SpectralRepositories } from "./contracts";

export async function withTransaction<T>(
  dataLayer: Pick<SpectralDataLayer, "transaction">,
  fn: (repositories: SpectralRepositories) => Promise<T>,
): Promise<T> {
  return dataLayer.transaction(fn);
}
