export const mediaSourceDimensions: Record<
  string,
  {
    height: number;
    width: number;
  }
> = {};

const DEFAULT_BACKGROUND_IMAGE_URL = "https://specterr.b-cdn.net/bg-default.jpg";

mediaSourceDimensions[DEFAULT_BACKGROUND_IMAGE_URL] = {
  height: 1296,
  width: 2304,
};

