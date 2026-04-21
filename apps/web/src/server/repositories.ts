import { getDataLayer } from "@spectral/db";

const dataLayer = getDataLayer();

export function getServerRepositories() {
  return dataLayer;
}
