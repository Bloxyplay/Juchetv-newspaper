// api/media.js
const SOURCE_URL = "https://koryofront.org/api/kctv/media-list";

// GitHub raw content URL - replace with your repo details
const GITHUB_MEDIA_URL = "https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/media/media.json";

const slugify = (text) =>
  text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .slice(0, 20);

const hash5 = (str) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) & 0xfffffff;
  }
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let out = "";
  for (let i = 0; i < 5; i++) {
    out += chars[Math.abs(h + i * 31) % 26];
  }
  return out;
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    // Fetch from both sources in parallel
    const [upstream, githubMedia] = await Promise.allSettled([
      fetch(SOURCE_URL, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; KCTV-Proxy/1.0)",
          Accept: "application/json",
        },
      }),
      fetch(GITHUB_MEDIA_URL, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; KCTV-Proxy/1.0)",
          Accept: "application/json",
        },
      }),
    ]);

    // Handle upstream (koryofront) source
    let raw = { news: [], activities: [], societyAndCulture: [] };
    if (upstream.status === "fulfilled" && upstream.value.ok) {
      raw = await upstream.value.json();
    } else if (upstream.status === "fulfilled") {
      return res.status(upstream.value.status).json({
        error: "Upstream fetch failed",
        upstreamStatus: upstream.value.status,
      });
    }

    // Handle GitHub media source
    let githubData = { videos: [] };
    if (githubMedia.status === "fulfilled" && githubMedia.value.ok) {
      try {
        githubData = await githubMedia.value.json();
      } catch (e) {
        console.error("Failed to parse GitHub media JSON:", e);
      }
    }

    const newsThumb = "https://resources-juchetv.vercel.app/News.png";
    const koryoThumb = (url) =>
      `https://koryofront.org/api/kctv/thumb?path=${encodeURIComponent(url)}&t=5`;

    const transformItems = (items, categorySlug, categoryName, thumbUrl) =>
      (items || []).map((item) => ({
        id: `kctv-${slugify(item.title)}-${hash5(item.url)}`,
        title: item.title,
        date: item.date,
        videoUrl: item.url,
        thumbnail: thumbUrl || koryoThumb(item.url),
        type: "video",
        source: "dropbox",
        category: categorySlug,
        categoryName,
      }));

    // Transform GitHub media items
    const transformGithubItems = (items) =>
      (items || []).map((item) => ({
        id: `github-${slugify(item.title)}-${hash5(item.videoUrl)}`,
        title: item.title,
        date: item.date,
        videoUrl: item.videoUrl,
        thumbnail: item.thumbnail || newsThumb,
        type: "video",
        source: "github",
        category: item.category || "external",
        categoryName: item.categoryName || "External Media",
        description: item.description || "",
      }));

    const newsName = "News Report 【8PM】";
    const activitiesName = raw.activitiesTitle || "Revolutionary Activities";
    const lifestyleName = "Lifestyle & Culture";

    // Transform GitHub videos
    const githubVideos = transformGithubItems(githubData.videos);

    // Group GitHub videos by category
    const githubCategories = {};
    githubVideos.forEach((video) => {
      if (!githubCategories[video.category]) {
        githubCategories[video.category] = {
          id: video.category,
          slug: video.category,
          name: video.categoryName,
          items: [],
        };
      }
      githubCategories[video.category].items.push(video);
    });

    const transformed = {
      meta: {
        totalItems:
          (raw.news?.length || 0) +
          (raw.activities?.length || 0) +
          (raw.societyAndCulture?.length || 0) +
          githubVideos.length,
        sources: {
          koryofront: upstream.status === "fulfilled" && upstream.value.ok,
          github: githubMedia.status === "fulfilled" && githubMedia.value.ok,
        },
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
        ...Object.values(githubCategories),
      ],
      feed: [
        ...transformItems(raw.news, "news", newsName, newsThumb),
        ...transformItems(raw.activities, "activities", activitiesName),
        ...transformItems(raw.societyAndCulture, "lifestyle-culture", lifestyleName),
        ...githubVideos,
      ].sort((a, b) => new Date(b.date) - new Date(a.date)),
    };

    const { category, limit, dateFrom, dateTo, source } = req.query;

    // Filter by source if specified
    if (source) {
      transformed.feed = transformed.feed.filter((f) => f.source === source);
      transformed.categories = transformed.categories.map((cat) => ({
        ...cat,
        items: cat.items.filter((item) => item.source === source),
      }));
    }

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
