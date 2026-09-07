export default async function handler(req, res) {
  const { slug } = req.query;

  if (!slug) {
    return res.status(400).json({ error: 'Missing slug parameter. Use ?slug=YOUR_SLUG' });
  }

  try {
    // 1. Fetch folder data for validation
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

    // 2. Validate slug
    // NOTE: The folders API returns FOLDER slugs (e.g. lrV50Lkacl5h).
    // File slugs (e.g. 2UpyhbhvTRtC) are NOT in this list.
    // Add your file slugs to the whitelist below:
    const ALLOWED_FILE_SLUGS = ['2UpyhbhvTRtC'];
    
    const isValid = validSlugs.has(slug) || ALLOWED_FILE_SLUGS.includes(slug);

    if (!isValid) {
      return res.status(403).json({ 
        error: 'Invalid slug',
        message: 'Slug not found in authorized folders or file whitelist.'
      });
    }

    // 3. Build the CORRECT download URL
    const targetUrl = `https://files.koryofront.org/kfs/share/72ec96e040527caf157e69ccf703a20e/dl?slug=${encodeURIComponent(slug)}`;

    // 4. Fetch with redirect manual to capture the Location header
    const response = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    // 5. Extract the redirect URL (check both cases)
    let finalUrl = response.headers.get('location') || response.headers.get('Location');

    if (!finalUrl) {
      return res.status(404).json({ 
        error: 'Could not extract direct download URL',
        status: response.status,
        note: 'The file server did not return a Location header.'
      });
    }

    // 6. Return JSON or redirect
    if (req.query.json === 'true') {
      return res.status(200).json({ directUrl: finalUrl, slug });
    }

    return res.redirect(302, finalUrl);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
