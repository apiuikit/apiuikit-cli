import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import http, { type Server } from "node:http";
import net from "node:net";
import { createStaticServer, listen } from "./server.js";

/**
 * listen() only re-resolves the *actual* bound port on an EADDRINUSE retry —
 * asking it for port 0 (the usual "give me any free port" convention) just
 * returns 0 back, since the OS-assigned port is never read from the socket.
 * So tests ask the OS for a free port up front instead, the same way any
 * other caller of this function has to.
 */
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

async function get(baseUrl: string, urlPath: string): Promise<{ status: number; body: string; contentType: string | null }> {
  const res = await fetch(new URL(urlPath, baseUrl));
  const body = await res.text();
  return { status: res.status, body, contentType: res.headers.get("content-type") };
}

/**
 * fetch()/the URL spec normalize ".." segments out of a request path before
 * it ever reaches the server, so it can't be used to exercise the server's
 * own traversal guard. A raw http.request with an explicit `path` sends the
 * literal string on the wire instead, the way a real attacker's client would.
 */
function rawGet(baseUrl: string, rawPath: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl);
    const req = http.request(
      { host: url.hostname, port: url.port, path: rawPath, method: "GET" },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

describe("createStaticServer", () => {
  let parent: string;
  let dir: string;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    // The served root and the "secret" file live as siblings inside a
    // private parent dir, so a traversal attempt has something real outside
    // the root to reach for without touching the shared OS tmp directory.
    parent = mkdtempSync(path.join(tmpdir(), "apiuikit-serve-"));
    dir = path.join(parent, "root");
    mkdirSync(dir);
    writeFileSync(path.join(dir, "index.html"), "<h1>home</h1>");
    writeFileSync(path.join(dir, "style.css"), "body { color: red; }");
    mkdirSync(path.join(dir, "nested"));
    writeFileSync(path.join(dir, "nested", "index.html"), "<h1>nested</h1>");
    writeFileSync(path.join(parent, "secret.txt"), "top secret");

    server = createStaticServer(dir);
    const freePort = await getFreePort();
    const { port, host } = await listen(server, freePort);
    baseUrl = `http://${host}:${port}/`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(parent, { recursive: true, force: true });
  });

  it("serves index.html at the root", async () => {
    const { status, body, contentType } = await get(baseUrl, "/");
    expect(status).toBe(200);
    expect(body).toBe("<h1>home</h1>");
    expect(contentType).toBe("text/html; charset=utf-8");
  });

  it("serves a nested file's index.html when the path resolves to a directory", async () => {
    const { status, body } = await get(baseUrl, "/nested/");
    expect(status).toBe(200);
    expect(body).toBe("<h1>nested</h1>");
  });

  it("serves static assets with the correct content type", async () => {
    const { status, contentType } = await get(baseUrl, "/style.css");
    expect(status).toBe(200);
    expect(contentType).toBe("text/css; charset=utf-8");
  });

  it("falls back to application/octet-stream for unknown extensions", async () => {
    writeFileSync(path.join(dir, "data.bin"), "binary");
    const { status, contentType } = await get(baseUrl, "/data.bin");
    expect(status).toBe(200);
    expect(contentType).toBe("application/octet-stream");
  });

  it("returns 404 for a missing file", async () => {
    const { status, body } = await get(baseUrl, "/does-not-exist.html");
    expect(status).toBe(404);
    expect(body).toBe("404 Not Found");
  });

  it("blocks a raw path traversal attempt from escaping the root directory", async () => {
    const { status, body } = await rawGet(baseUrl, "/../secret.txt");
    expect(status).toBe(404);
    expect(body).not.toContain("top secret");
  });

  it("blocks a URL-encoded traversal sequence from escaping the root directory", async () => {
    const { status, body } = await rawGet(baseUrl, "/..%2fsecret.txt");
    expect(status).toBe(404);
    expect(body).not.toContain("top secret");
  });
});

describe("listen", () => {
  it("resolves with the requested port when it is free", async () => {
    const freePort = await getFreePort();
    const server = createStaticServer(process.cwd());
    const { port, host } = await listen(server, freePort);
    expect(host).toBe("127.0.0.1");
    expect(port).toBe(freePort);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("falls back to the next port when the preferred one is already in use", async () => {
    const takenPort = await getFreePort();
    const blocker = createStaticServer(process.cwd());
    await listen(blocker, takenPort);

    const server = createStaticServer(process.cwd());
    const { port } = await listen(server, takenPort);

    expect(port).not.toBe(takenPort);
    expect(port).toBeGreaterThanOrEqual(takenPort);

    await Promise.all([
      new Promise<void>((resolve) => server.close(() => resolve())),
      new Promise<void>((resolve) => blocker.close(() => resolve())),
    ]);
  });
});
