export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { slug, json } = req.query;

  if (!slug) {
    return res.status(400).json({ error: 'Missing slug parameter. Usage: /api/get-link?slug=YOUR_SLUG' });
  }

  // The base download URL that triggers the redirect
  const dlUrl = `https://files.koryofront.org/kfs/share/72ec96e040527caf157e69ccf703a20e/dl?slug=${slug}`;

  try {
    // Fetch the URL manually to intercept the CDN redirect link
    const response = await fetch(dlUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' 
      },
    });

    // Grab the long greencdn.link URL from the Location header
    const directUrl = response.headers.get('location');

    if (!directUrl) {
      return res.status(404).json({ error: 'Could not extract direct CDN URL' });
    }

    // Optional: Return as a JSON string if you add ?json=true to your request
    if (json === 'true') {
      return res.status(200).json({ directUrl });
    }

    // Default behavior: Redirect directly to the greencdn.link
    // This allows you to use <video src="/api/get-link?slug=2UpyhbhvTRtC"> perfectly
    return res.redirect(302, directUrl);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
