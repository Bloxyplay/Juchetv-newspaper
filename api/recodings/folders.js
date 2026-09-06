export default async function handler(req, res) {
  const targetUrl = 'https://files.koryofront.org/kfs/share/72ec96e040527caf157e69ccf703a20e/dl?slug=2UpyhbhvTRtC';

  try {
    // 1. Send request without following redirects automatically
    const initialResponse = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    // 2. Extract the final target URL from the redirect header or response location
    let finalUrl = initialResponse.headers.get('location');

    // If fetch followed the redirect anyway or returned 200, use response.url
    if (!finalUrl && initialResponse.url && initialResponse.url !== targetUrl) {
      finalUrl = initialResponse.url;
    }

    if (!finalUrl) {
      return res.status(404).json({ error: 'Could not extract direct video URL' });
    }

    // 3. Optional query flag to just retrieve the direct link
    if (req.query.json === 'true') {
      return res.status(200).json({ directUrl: finalUrl });
    }

    // 4. Redirect the client directly to the final CDN video link
    return res.redirect(302, finalUrl);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
