// Local server for checks and phone testing (python http.server serves .mjs
// with the wrong type on some machines). No caching, so a phone reload always
// gets the latest files.
//
//   node scripts/research-checks/serve.mjs            127.0.0.1:4173
//   node scripts/research-checks/serve.mjs 0.0.0.0    reachable from a phone on the LAN
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const host = process.argv[2] || "127.0.0.1";
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".woff": "font/woff"
};

http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(req.url.split("?")[0]); } catch { res.writeHead(400); res.end(); return; }
  if (p.endsWith("/")) p += "index.html";
  const file = path.resolve(root, "." + p);
  // only files inside the project, never anything above it
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(data);
  });
}).listen(4173, host, () => console.log(`serving ${root} on http://${host}:4173`));
