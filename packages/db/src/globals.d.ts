declare const process: {
  env: Record<string, string | undefined>;
  exitCode?: number;
};

declare module "node:fs/promises" {
  export function readFile(path: URL | string, encoding: string): Promise<string>;
}
