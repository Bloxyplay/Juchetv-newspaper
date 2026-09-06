export default async function handler(req, res) {
  // Enable CORS so your frontend can fetch this endpoint freely
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const folderApiUrl = 'https://files.koryofront.org/kfs/share/72ec96e040527caf157e69ccf703a20e/folder/lrV50Lkacl5h';

  try {
    // 1. Fetch original JSON response from the folder API
    const apiResponse = await fetch(folderApiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!apiResponse.ok) {
      return res.status(apiResponse.status).json({ error: 'Failed to fetch source API' });
    }

    const data = await apiResponse.json();

    // Helper function to resolve the long CDN link from a download URL
    const resolveDirectLink = async (dlUrl) => {
      try {
        const response = await fetch(dlUrl, {
          method: 'GET',
          redirect: 'manual',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        
        // Grab the redirected CDN URL from the Location header
        const location = response.headers.get('location');
        return location || dlUrl;
      } catch {
        return dlUrl; // Fallback to original URL on failure
      }
    };

    // 2. Traversal helper to replace download links across array items or single objects
    const processItems = async (items) => {
      if (!Array.isArray(items)) return items;

      return Promise.all(
        items.map(async (item) => {
          const updatedItem = { ...item };

          // Checks common JSON key names for download links and resolves redirect
          for (const key of ['download_url', 'downloadUrl', 'dl_link', 'link', 'url']) {
            if (typeof updatedItem[key] === 'string' && updatedItem[key].includes('/dl?slug=')) {
              updatedItem[key] = await resolveDirectLink(updatedItem[key]);
            }
          }

          return updatedItem;
        })
      );
    };

    // 3. Process files/items list in the JSON structure
    if (Array.isArray(data)) {
      const updatedData = await processItems(data);
      return res.status(200).json(updatedData);
    } else if (data.files && Array.isArray(data.files)) {
      data.files = await processItems(data.files);
    } else if (data.items && Array.isArray(data.items)) {
      data.items = await processItems(data.items);
    }

    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
