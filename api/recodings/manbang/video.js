export default async function handler(req, res) {
  const { slug } = req.query;

  if (!slug) {
    return res.status(400).json({ error: 'Missing slug parameter. Use ?slug=YOUR_SLUG' });
  }

  try {
    // Fetch validation data
    const validateRes = await fetch('https://resources-juchetv.vercel.app/api/recodings/folders.js');
    
    if (!validateRes.ok) {
      return res.status(502).json({ error: 'Failed to reach validation API' });
    }

    const validateData = await validateRes.json();
    
    // Collect ALL valid slugs: parent folder + all subfolders
    const validSlugs = [];
    
    // Add parent folder slug if exists
    if (validateData?.data?.slug) {
      validSlugs.push(validateData.data.slug);
    }
    
    // Add all subfolder slugs
    const subfolders = validateData?.data?.subfolders || [];
    subfolders.forEach(folder => {
      if (folder.slug) validSlugs.push(folder.slug);
    });

    // DEBUG: Show what was received vs what's valid (remove this in production)
    const debugInfo = {
      receivedSlug: slug,
      totalValidSlugs: validSlugs.length,
      validSlugs: validSlugs, // Remove this line in production for security
      parentSlug: validateData?.data?.slug || null,
      subfolderSlugs: subfolders.map(f => f.slug)
    };

    // Check if provided slug exists
    const isValidSlug = validSlugs.includes(slug);

    if (!isValidSlug) {
      return res.status(403).json({ 
        error: 'Invalid slug',
        message: `Slug "${slug}" was not found in the allowed list.`,
        debug: debugInfo // Remove this in production
      });
    }

    // Build target URL with validated slug
    const targetUrl = `https://files.koryofront.org/kfs/share/72ec96e040527caf157e69ccf703a20e/dl?slug=${encodeURIComponent(slug)}`;

    // Extract direct download link
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
      return res.status(404).json({ error: 'Could not extract direct video URL' });
    }

    if (req.query.json === 'true') {
      return res.status(200).json({ 
        directUrl: finalUrl,
        validatedSlug: slug 
      });
    }

    return res.redirect(302, finalUrl);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
