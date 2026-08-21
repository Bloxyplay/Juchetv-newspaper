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

    const newsThumb = "https://resources-juchetv.vercel.app/News.png";
    const koryoThumb = (url) =>
      `https://koryofront.org/api/kctv/thumb?path=${encodeURIComponent(url)}&t=5`;

    const transformItems = (items, categorySlug, categoryName, thumbUrl) =>
      (items || []).map((item, index) => ({
        id: `${categorySlug}-${item.date}-${index}`,
        title: item.title,
        date: item.date,
        videoUrl: item.url,
        thumbnail: thumbUrl || koryoThumb(item.url),
        type: "video",
        source: "dropbox",
        category: categorySlug,
        categoryName,
      }));

    const newsName = "News Report 【8PM】";
    const activitiesName = raw.activitiesTitle || "Revolutionary Activities";
    const lifestyleName = "Lifestyle & Culture";

    const transformed = {
      meta: {
        totalItems:
          (raw.news?.length || 0) +
          (raw.activities?.length || 0) +
          (raw.societyAndCulture?.length || 0),
      },
      categories: [
        {
          id: "news",
          slug: "news",
          name: newsName,
          items: transformItems(raw.news, "news", newsName, newsThumb),
        },
        {
          id: "activities",
          slug: "activities",
          name: activitiesName,
          items: transformItems(raw.activities, "activities", activitiesName),
        },
        {
          id: "lifestyle-culture",
          slug: "lifestyle-culture",
          name: lifestyleName,
          items: transformItems(raw.societyAndCulture, "lifestyle-culture", lifestyleName),
        },
      ],
      feed: [
        ...transformItems(raw.news, "news", newsName, newsThumb),
        ...transformItems(raw.activities, "activities", activitiesName),
        ...transformItems(raw.societyAndCulture, "lifestyle-culture", lifestyleName),
      ].sort((a, b) => new Date(b.date) - new Date(a.date)),
    };

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
