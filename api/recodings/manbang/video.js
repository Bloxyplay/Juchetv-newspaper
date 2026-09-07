export default async function handler(req, res) {
  // 1. Extract slug from query parameter
  const { slug } = req.query;

  if (!slug) {
    return res.status(400).json({ error: 'Missing slug parameter. Use ?slug=YOUR_SLUG' });
  }

  try {
    // 2. Validate slug against external API
    const validateRes = await fetch('https://resources-juchetv.vercel.app/api/recodings/folders.js');
    
    if (!validateRes.ok) {
      return res.status(502).json({ error: 'Failed to reach validation API' });
    }

    const validateData = await validateRes.json();
    const subfolders = validateData?.data?.subfolders || [];
    
    // Check if the provided slug exists in any subfolder
    const isValidSlug = subfolders.some(folder => folder.slug === slug);

    if (!isValidSlug) {
      return res.status(403).json({ error: 'Invalid or unauthorized slug' });
    }

    // 3. Build target URL using the validated slug
    const targetUrl = `https://files.koryofront.org/kfs/share/72ec96e040527caf157e69ccf703a20e/dl?slug=${encodeURIComponent(slug)}`;

    // 4. Send request without following redirects automatically
    const initialResponse = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    // 5. Extract the final target URL from the redirect header or response location
    let finalUrl = initialResponse.headers.get('location');

    // If fetch followed the redirect anyway or returned 200, use response.url
    if (!finalUrl && initialResponse.url && initialResponse.url !== targetUrl) {
      finalUrl = initialResponse.url;
    }

    if (!finalUrl) {
      return res.status(404).json({ error: 'Could not extract direct video URL' });
    }

    // 6. Optional query flag to just retrieve the direct link
    if (req.query.json === 'true') {
      return res.status(200).json({ directUrl: finalUrl });
    }

    // 7. Redirect the client directly to the final CDN video link
    return res.redirect(302, finalUrl);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
