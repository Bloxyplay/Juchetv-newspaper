// api/recordings/folders.js
const { Readable } = require("node:stream");

const UPSTREAM = "https://files.koryofront.org";
const ALLOWED_PREFIX = "/kfs/";

const HOP_BY_HOP = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailer", "transfer-encoding", "upgrade",
  "host", "content-length", "expect",
]);

function cors(res) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS");
  res.setHeader("access-control-allow-headers", "*");
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const stripped = req.url.replace(/^\/api\/proxy/, "");
  const qIndex = stripped.indexOf("?");
  const pathname = qIndex === -1 ? stripped : stripped.slice(0, qIndex);
  const query = qIndex === -1 ? "" : stripped.slice(qIndex);

  if (!pathname.startsWith(ALLOWED_PREFIX)) {
    return res.status(403).json({ error: `Only paths under ${ALLOWED_PREFIX} may be proxied` });
  }

  const headers = { host: new URL(UPSTREAM).host };
  for (const [k, v] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) headers[k] = v;
  }

  const hasBody = !["GET", "HEAD"].includes(req.method) &&
    (Number(req.headers["content-length"] || 0) > 0 || req.headers["transfer-encoding"]);

  let upstreamRes;
  try {
    upstreamRes = await fetch(UPSTREAM + pathname + query, {
      method: req.method,
      headers,
      redirect: "manual",
      ...(hasBody ? { body: Readable.toWeb(req), duplex: "half" } : {}),
    });
  } catch (err) {
    return res.status(502).json({ error: "Upstream fetch failed", detail: String(err) });
  }

  res.status(upstreamRes.status);
  upstreamRes.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (HOP_BY_HOP.has(k)) return;
    if (k === "location") {
      try {
        const loc = new URL(value);
        if (loc.origin === UPSTREAM) {
          res.setHeader("location", "/api/proxy" + loc.pathname + loc.search);
          return;
        }
      } catch {}
    }
    res.setHeader(key, value);
  });
  cors(res);

  if (req.method === "HEAD" || !upstreamRes.body ||
      upstreamRes.status === 204 || upstreamRes.status === 304) {
    return res.end();
  }

  Readable.fromWeb(upstreamRes.body).on("error", () => {
    if (!res.writableEnded) res.end();
  }).pipe(res);
};

module.exports.config = { api: { bodyParser: false } };
