import { createServer, type Server } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

/**
 * Joining then normalizing collapses any ".." segments in the request path
 * against rootDir; the startsWith check afterwards is what actually catches
 * an escape (join+normalize alone can still resolve outside rootDir given
 * enough ".." segments — it does not clamp to a base).
 */
function resolveRequestPath(rootDir: string, urlPath: string): string | null {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const requested = path.normalize(path.join(rootDir, decoded));

  if (requested !== rootDir && !requested.startsWith(rootDir + path.sep)) {
    return null;
  }

  if (existsSync(requested) && statSync(requested).isDirectory()) {
    return path.join(requested, "index.html");
  }

  return requested;
}

export function createStaticServer(rootDir: string): Server {
  return createServer((req, res) => {
    const filePath = resolveRequestPath(rootDir, req.url || "/");

    if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "content-type": MIME_TYPES[ext] || "application/octet-stream" });
    createReadStream(filePath).pipe(res);
  });
}

export interface ListenResult {
  port: number;
  host: string;
}

export function listen(
  server: Server,
  startPort: number,
  host = "127.0.0.1",
  maxAttempts = 20,
): Promise<ListenResult> {
  return new Promise((resolve, reject) => {
    let port = startPort;
    let attempts = 0;

    const onError = (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE" && attempts < maxAttempts) {
        attempts += 1;
        port += 1;
        server.listen(port, host);
        return;
      }
      reject(error);
    };

    server.on("error", onError);
    server.on("listening", () => {
      server.off("error", onError);
      resolve({ port, host });
    });

    server.listen(port, host);
  });
}
