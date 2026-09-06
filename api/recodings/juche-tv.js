// api/kfs.js — proxy for Koryo Front Storage API
// Forwards GET requests to https://files.koryofront.org/kfs/<path>?<query>

const UPSTREAM = "https://files.koryofront.org/kfs";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  // catch-all route segments (e.g. /api/kfs/share/TOKEN/folder/SLUG)
  let segs = req.query.path || "";
  if (Array.isArray(segs)) segs = segs.join("/");

  // rebuild query string, excluding internal "path" param
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) {
    if (k === "path") continue;
    if (Array.isArray(v)) v.forEach((x) => params.append(k, x));
    else params.set(k, v);
  }
  const qs = params.toString();
  const target = `${UPSTREAM}/${segs}${qs ? "?" + qs : ""}`;

  try {
    const upstream = await fetch(target, {
      method: "GET",
      headers: { "User-Agent": req.headers["user-agent"] || "kfs-proxy" },
      redirect: "follow",
    });

    res.status(upstream.status);
    const ct = upstream.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);

    if (ct && (ct.includes("application/json") || ct.startsWith("text/"))) {
      return res.send(await upstream.text());
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    return res.send(buf);
  } catch (e) {
    return res.status(502).json({ error: "Upstream fetch failed", detail: String(e) });
  }
}
