import { getDataLayer } from "@spectral/db";

export function getServerRepositories() {
  return getDataLayer();
}
