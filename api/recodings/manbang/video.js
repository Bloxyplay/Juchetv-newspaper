export default async function handler(req, res) {
  const { slug } = req.query;

  if (!slug) {
    return res.status(400).json({ error: 'Missing slug parameter. Use ?slug=YOUR_SLUG' });
  }

  try {
    // 1. Validate slug against folders API
    const validateRes = await fetch('https://resources-juchetv.vercel.app/api/recodings/folders.js');
    
    if (!validateRes.ok) {
      return res.status(502).json({ error: 'Failed to reach validation API' });
    }

    const validateData = await validateRes.json();
    const validSlugs = new Set();
    
    if (validateData?.data?.slug) validSlugs.add(validateData.data.slug);
    (validateData?.data?.subfolders || []).forEach(f => {
      if (f.slug) validSlugs.add(f.slug);
    });

    if (!validSlugs.has(slug)) {
      return res.status(403).json({ 
        error: 'Invalid slug',
        received: slug
      });
    }

    // 2. Build target URL
    const targetUrl = `https://files.koryofront.org/kfs/share/72ec96e040527caf157e69ccf703a20e/folder/${encodeURIComponent(slug)}`;

    // 3. Fetch the JSON response from file server
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/html, */*',
      },
    });

    // If it's not JSON, handle as before
    const contentType = response.headers.get('content-type') || '';
    
    if (!contentType.includes('application/json')) {
      // Fallback for HTML redirects
      let finalUrl = response.headers.get('location') || response.headers.get('Location');
      if (!finalUrl && response.url !== targetUrl) finalUrl = response.url;
      
      if (finalUrl) {
        if (req.query.json === 'true') return res.status(200).json({ directUrl: finalUrl, slug });
        return res.redirect(302, finalUrl);
      }
      
      return res.status(404).json({ error: 'Unexpected response type', contentType });
    }

    // 4. Parse JSON and extract download URL
    const data = await response.json();
    
    // Try multiple common field paths for the download URL
    let finalUrl = 
      data?.url ||
      data?.download_url ||
      data?.downloadUrl ||
      data?.direct_url ||
      data?.directUrl ||
      data?.link ||
      data?.file?.url ||
      data?.file?.download_url ||
      data?.data?.url ||
      data?.data?.download_url ||
      data?.files?.[0]?.url ||
      data?.files?.[0]?.download_url ||
      data?.result?.url ||
      data?.result?.download_url ||
      data?.cdn_url ||
      data?.cdnUrl ||
      data?.greencdn ||
      data?.green_cdn ||
      null;

    // Deep search: look for any value containing "greencdn" or common CDN domains
    if (!finalUrl) {
      const searchForUrl = (obj, depth = 0) => {
        if (depth > 5 || !obj) return null;
        for (const key of Object.keys(obj)) {
          const val = obj[key];
          if (typeof val === 'string' && (
            val.startsWith('http') && (
              val.includes('greencdn') ||
              val.includes('cdn') ||
              val.includes('download')
            )
          )) {
            return val;
          }
          if (typeof val === 'object' && val !== null) {
            const found = searchForUrl(val, depth + 1);
            if (found) return found;
          }
        }
        return null;
      };
      finalUrl = searchForUrl(data);
    }

    // 5. Return results
    if (!finalUrl) {
      return res.status(404).json({ 
        error: 'Could not extract direct video URL from JSON',
        debug: {
          targetUrl,
          status: response.status,
          contentType,
          responseKeys: Object.keys(data),
          fullResponse: data // Remove this in production
        }
      });
    }

    if (req.query.json === 'true') {
      return res.status(200).json({ 
        directUrl: finalUrl, 
        slug 
      });
    }

    return res.redirect(302, finalUrl);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
