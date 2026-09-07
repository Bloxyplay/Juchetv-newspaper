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
        validSlugs: Array.from(validSlugs), // Remove in production
        received: slug
      });
    }

    // 2. Build target URL
    const targetUrl = `https://files.koryofront.org/kfs/share/72ec96e040527caf157e69ccf703a20e/folder/${encodeURIComponent(slug)}`;

    // 3. Fetch with multiple fallback strategies
    const response = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow', // Let it follow redirects
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
    });

    // Strategy 1: If fetch followed redirect, response.url is the final URL
    let finalUrl = null;
    
    if (response.url && response.url !== targetUrl) {
      finalUrl = response.url;
    }
    
    // Strategy 2: Check location header manually (case-insensitive)
    if (!finalUrl) {
      const location = response.headers.get('location') || 
                       response.headers.get('Location') ||
                       response.headers.get('LOCATION');
      if (location) finalUrl = location;
    }

    // Strategy 3: If response is HTML, parse for meta refresh or download links
    if (!finalUrl && response.headers.get('content-type')?.includes('text/html')) {
      const html = await response.text();
      
      // Look for meta refresh
      const metaMatch = html.match(/content=["']?\d*;\s*url=(.*?)["']?\s*\/?>/i);
      if (metaMatch) finalUrl = metaMatch[1];
      
      // Look for download links
      if (!finalUrl) {
        const linkMatch = html.match(/href=["'](https?:\/\/[^"']+(?:download|dl)[^"']*)["']/i);
        if (linkMatch) finalUrl = linkMatch[1];
      }
    }

    // Strategy 4: If response is JSON, look for url fields
    if (!finalUrl && response.headers.get('content-type')?.includes('application/json')) {
      const json = await response.json();
      finalUrl = json.url || json.downloadUrl || json.directUrl || json.link;
    }

    // 4. Return results
    if (!finalUrl) {
      return res.status(404).json({ 
        error: 'Could not extract direct video URL',
        debug: {
          targetUrl,
          finalStatus: response.status,
          finalUrlFromFetch: response.url,
          contentType: response.headers.get('content-type'),
          // Include first 500 chars of body if HTML for debugging
          bodyPreview: response.headers.get('content-type')?.includes('text/html') 
            ? (await response.clone().text()).slice(0, 500) 
            : null
        }
      });
    }

    if (req.query.json === 'true') {
      return res.status(200).json({ directUrl: finalUrl, slug });
    }

    return res.redirect(302, finalUrl);

  } catch (error) {
    return res.status(500).json({ error: error.message, stack: error.stack });
  }
}
