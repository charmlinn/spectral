import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { extname, relative, resolve, sep } from "node:path";

function isPathInsideRoot(rootDir: string, candidatePath: string): boolean {
  const relativePath = relative(rootDir, candidatePath);
  return (
    relativePath !== "" &&
    !relativePath.startsWith(`..${sep}`) &&
    relativePath !== ".."
  );
}

function encodeRelativePath(path: string): string {
  return path
    .split(sep)
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function decodeRequestPath(pathname: string): string {
  return pathname
    .replace(/^\/files\//, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment))
    .join(sep);
}

function writeCorsHeaders(response: ServerResponse) {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET,HEAD,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
}

function inferContentType(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".json":
      return "application/json; charset=utf-8";
    case ".m4a":
      return "audio/mp4";
    case ".mp3":
      return "audio/mpeg";
    case ".mp4":
      return "video/mp4";
    case ".ogg":
      return "audio/ogg";
    case ".otf":
      return "font/otf";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".ttf":
      return "font/ttf";
    case ".wav":
      return "audio/wav";
    case ".webm":
      return "video/webm";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    default:
      return "application/octet-stream";
  }
}

export type LocalAssetServer = {
  rootDir: string;
  baseUrl: string;
  urlForPath: (filePath: string) => string;
  close: () => Promise<void>;
};

export async function startLocalAssetServer(input: {
  rootDir: string;
  host?: string;
}): Promise<LocalAssetServer> {
  const rootDir = resolve(input.rootDir);
  const server = createServer(
    async (request: IncomingMessage, response: ServerResponse) => {
      writeCorsHeaders(response);

      if (request.method === "OPTIONS") {
        response.writeHead(204).end();
        return;
      }

      if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405).end("Method Not Allowed");
        return;
      }

      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      const relativePath = decodeRequestPath(requestUrl.pathname);
      const filePath = resolve(rootDir, relativePath);

      if (!isPathInsideRoot(rootDir, filePath)) {
        response.writeHead(403).end("Forbidden");
        return;
      }

      try {
        await access(filePath);
      } catch {
        response.writeHead(404).end("Not Found");
        return;
      }

      response.setHeader("content-type", inferContentType(filePath));

      if (request.method === "HEAD") {
        response.writeHead(200).end();
        return;
      }

      createReadStream(filePath)
        .on("error", () => {
          if (!response.headersSent) {
            response.writeHead(500).end("Failed to read asset");
            return;
          }

          response.destroy();
        })
        .pipe(response);
    },
  );

  await new Promise<void>((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, input.host ?? "127.0.0.1", () => {
      server.off("error", reject);
      resolvePromise();
    });
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Local asset server did not expose a TCP address.");
  }

  const baseUrl = `http://${address.address}:${address.port}`;

  return {
    rootDir,
    baseUrl,
    urlForPath(filePath: string) {
      const absolutePath = resolve(filePath);

      if (
        absolutePath === rootDir ||
        !isPathInsideRoot(rootDir, absolutePath)
      ) {
        throw new Error(
          `Cannot expose ${absolutePath} outside local asset root ${rootDir}.`,
        );
      }

      const relativePath = relative(rootDir, absolutePath);
      return `${baseUrl}/files/${encodeRelativePath(relativePath)}`;
    },
    close() {
      return new Promise<void>((resolvePromise, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolvePromise();
        });
      });
    },
  };
}
