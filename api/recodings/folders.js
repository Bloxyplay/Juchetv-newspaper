export default async function handler(req, res) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const folderApiUrl = 'https://files.koryofront.org/kfs/share/72ec96e040527caf157e69ccf703a20e/folder/lrV50Lkacl5h';

  try {
    // 1. Fetch original JSON response from folder API
    const apiResponse = await fetch(folderApiUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });

    if (!apiResponse.ok) return res.status(apiResponse.status).json({ error: 'Folder API request failed' });
    const data = await apiResponse.json();

    // 2. Extract initial download link from JSON response
    let dlUrl = null;
    const items = Array.isArray(data) ? data : data.files || data.items || [];
    
    for (const item of items) {
      for (const key of ['download_url', 'downloadUrl', 'dl_link', 'link', 'url']) {
        if (typeof item[key] === 'string' && item[key].includes('/dl?slug=')) {
          dlUrl = item[key];
          break;
        }
      }
      if (dlUrl) break;
    }

    if (!dlUrl) return res.status(404).json({ error: 'Download link not found in API payload' });

    // 3. Resolve direct CDN URL via redirect manual inspect
    const redirectRes = await fetch(dlUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });

    const directCdnUrl = redirectRes.headers.get('location') || dlUrl;

    // 4. Forward incoming Range header (enables video scrubbing/seeking)
    const forwardHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    };
    if (req.headers.range) forwardHeaders['Range'] = req.headers.range;

    // 5. Fetch raw media stream from CDN
    const videoStreamRes = await fetch(directCdnUrl, {
      method: req.method,
      headers: forwardHeaders,
    });

    // 6. Pipe headers and stream direct binary payload to client
    const passthroughHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
    passthroughHeaders.forEach((header) => {
      const val = videoStreamRes.headers.get(header);
      if (val) res.setHeader(header, val);
    });

    res.status(videoStreamRes.status);

    if (req.method === 'HEAD') return res.end();

    // Convert Web Stream to Node.js Readable Stream for Vercel Pipe
    const reader = videoStreamRes.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    return res.end();

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
