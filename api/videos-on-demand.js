// api/media.js
const SOURCE_URL = "https://koryofront.org/api/kctv/media-list";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const upstream = await fetch(SOURCE_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; KCTV-Proxy/1.0)",
        Accept: "application/json",
      },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: "Upstream fetch failed",
        upstreamStatus: upstream.status,
      });
    }

    const raw = await upstream.json();

    // Title mappings
    const titleMap = {
      [raw.newsTitle]: "News Report 【8PM】",
      [raw.activitiesTitle]: raw.activitiesTitle || "Revolutionary Activities",
      [raw.societyAndCultureTitle]: "Lifestyle & Culture",
    };

    const mapTitle = (original) => titleMap[original] || original;

    const transformItems = (items, categorySlug) =>
      (items || []).map((item, index) => ({
        id: `${categorySlug}-${item.date}-${index}`,
        title: item.title,
        date: item.date,
        videoUrl: item.url,
        type: "video",
        source: "dropbox",
        category: categorySlug,
      }));

    const transformed = {
      meta: {
        source: SOURCE_URL,
        fetchedAt: new Date().toISOString(),
        totalItems:
          (raw.news?.length || 0) +
          (raw.activities?.length || 0) +
          (raw.societyAndCulture?.length || 0),
      },
      categories: [
        {
          id: "news",
          slug: "news",
          name: mapTitle(raw.newsTitle),
          items: transformItems(raw.news, "news"),
        },
        {
          id: "activities",
          slug: "activities",
          name: mapTitle(raw.activitiesTitle),
          items: transformItems(raw.activities, "activities"),
        },
        {
          id: "lifestyle-culture",
          slug: "lifestyle-culture",
          name: mapTitle(raw.societyAndCultureTitle),
          items: transformItems(raw.societyAndCulture, "lifestyle-culture"),
        },
      ],
      feed: [
        ...transformItems(raw.news, "news"),
        ...transformItems(raw.activities, "activities"),
        ...transformItems(raw.societyAndCulture, "lifestyle-culture"),
      ].sort((a, b) => new Date(b.date) - new Date(a.date)),
    };

    // Query filters
    const { category, limit, dateFrom, dateTo } = req.query;

    if (category) {
      transformed.categories = transformed.categories.filter(
        (c) => c.slug === category || c.id === category
      );
      transformed.feed = transformed.feed.filter((f) => f.category === category);
    }

    if (dateFrom || dateTo) {
      transformed.feed = transformed.feed.filter((item) => {
        const d = new Date(item.date);
        if (dateFrom && d < new Date(dateFrom)) return false;
        if (dateTo && d > new Date(dateTo)) return false;
        return true;
      });
    }

    if (limit) {
      const n = parseInt(limit, 10);
      transformed.feed = transformed.feed.slice(0, n);
      transformed.categories = transformed.categories.map((cat) => ({
        ...cat,
        items: cat.items.slice(0, n),
      }));
    }

    return res.status(200).json(transformed);
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: "Internal server error", message: err.message });
  }
}
