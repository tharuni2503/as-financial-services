/**
 * Minimal zero-dependency static server for local development.
 *
 * Usage:
 *   node server.js
 *   PORT=3000 node server.js
 *
 * It serves the project directory, resolves directory requests to index.html,
 * blocks path traversal outside the project root and sets sensible MIME types.
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const port = Number(process.env.PORT) || 5173;
const host = process.env.HOST || "127.0.0.1";

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, {
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  res.end(body);
};

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname);
  } catch {
    return send(res, 400, "Bad request");
  }

  if (pathname.includes("\0")) return send(res, 400, "Bad request");

  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(root, requested));

  if (!filePath.startsWith(root + path.sep) && filePath !== path.join(root, "index.html")) {
    return send(res, 403, "Forbidden");
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError) return send(res, 404, "Not found");
    if (stats.isDirectory()) {
      const indexFile = path.join(filePath, "index.html");
      return fs.readFile(indexFile, (indexError, indexData) => {
        if (indexError) return send(res, 404, "Not found");
        send(res, 200, indexData, { "Content-Type": mime[".html"] });
      });
    }

    const ext = path.extname(filePath).toLowerCase();
    fs.readFile(filePath, (readError, data) => {
      if (readError) return send(res, 500, "Unable to read file");
      send(res, 200, data, { "Content-Type": mime[ext] || "application/octet-stream" });
    });
  });
});

server.listen(port, host, () => {
  console.log(`AS Financial site running at http://${host}:${port}/`);
  console.log("Press Ctrl+C to stop.");
});

const shutdown = () => server.close(() => process.exit(0));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
