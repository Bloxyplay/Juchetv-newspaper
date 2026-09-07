export default async function handler(req, res) {
  const { slug } = req.query;

  if (!slug) {
    return res.status(400).json({ 
      error: 'Missing slug parameter. Use ?slug=YOUR_SLUG' 
    });
  }

  try {
    // 1. Fetch and validate against folders API
    const validateRes = await fetch('https://resources-juchetv.vercel.app/api/recodings/folders.js');
    
    if (!validateRes.ok) {
      return res.status(502).json({ error: 'Failed to reach validation API' });
    }

    const validateData = await validateRes.json();
    
    // Collect all valid slugs (parent + subfolders)
    const validSlugs = new Set();
    
    if (validateData?.data?.slug) {
      validSlugs.add(validateData.data.slug);
    }
    
    const subfolders = validateData?.data?.subfolders || [];
    subfolders.forEach(folder => {
      if (folder.slug) validSlugs.add(folder.slug);
    });

    // 2. Check if requested slug is authorized
    if (!validSlugs.has(slug)) {
      return res.status(403).json({ 
        error: 'Invalid slug',
        message: `Slug "${slug}" is not in the authorized folders list.`
      });
    }

    // 3. Build the correct folder URL
    const targetUrl = `https://files.koryofront.org/kfs/share/72ec96e040527caf157e69ccf703a20e/folder/${encodeURIComponent(slug)}`;

    // 4. Fetch to extract the redirect/final URL
    const initialResponse = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    let finalUrl = initialResponse.headers.get('location');

    if (!finalUrl && initialResponse.url && initialResponse.url !== targetUrl) {
      finalUrl = initialResponse.url;
    }

    if (!finalUrl) {
      return res.status(404).json({ 
        error: 'Could not extract direct video URL' 
      });
    }

    // 5. Return JSON or redirect
    if (req.query.json === 'true') {
      return res.status(200).json({ 
        directUrl: finalUrl,
        slug: slug 
      });
    }

    return res.redirect(302, finalUrl);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
