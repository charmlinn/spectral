import { baseConfig } from "./packages/config/eslint/base.mjs";
import { nextConfig } from "./packages/config/eslint/next.mjs";

export default [...baseConfig, ...nextConfig];

