// /api/publications.js
// Vercel Serverless Function — Myanmar-key proxy for koryofront publications
// URL stays English | JSON keys in Myanmar | Data values stay English

const UPSTREAM_URL = "https://koryofront.org/api/publications";
const THUMB_BASE = "https://koryofront.org/api/periodicals";

const KEY_MAP = {
  id:            "အမှတ်",
  title:         "ခေါင်းစဉ်",
  description:   "ဖော်ပြချက်",
  category:      "အမျိုးအစား",
  coverPath:     "အဖုံးလမ်း",
  coverMimeType: "အဖုံးအမျိုးအစား",
  filePath:      "ဖိုင်လမ်း",
  fileName:      "ဖိုင်နာမည်",
  fileMimeType:  "ဖိုင်အမျိုးအစား",
  content:       "အကြောင်းအရာ",
  publishedYear: "ထုတ်ဝေသည့်နှစ်",
  createdAt:     "ဖန်တီးသည့်အချိန်",
  fileSize:      "ဖိုင်အရွယ်အစား",
};

function transformToMyanmar(enItem) {
  const mmItem = {};
  for (const [enKey, value] of Object.entries(enItem)) {
    const mmKey = KEY_MAP[enKey] || enKey;
    mmItem[mmKey] = value;
  }
  // Add thumbnail URL from id
  if (enItem.id) {
    mmItem["အဖုံး_URL"] = `${THUMB_BASE}/${enItem.id}/thumb`;
  }
  return mmItem;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const response = await fetch(UPSTREAM_URL, {
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        အောင်မြင်ခြင်း: false,
        အမှား: "အဝင်ဒေတာရယူရန် မအောင်မြင်ပါ",
        အခြေအနေ: response.status,
      });
    }

    const enData = await response.json();
    const mmData = Array.isArray(enData)
      ? enData.map(transformToMyanmar)
      : transformToMyanmar(enData);

    return res.status(200).json({
      အောင်မြင်ခြင်း: true,
      ရင်းမြစ်: UPSTREAM_URL,
      အရေအတွက်: Array.isArray(mmData) ? mmData.length : 1,
      အချက်အလက်များ: mmData,
    });

  } catch (err) {
    return res.status(500).json({
      အောင်မြင်ခြင်း: false,
      အမှား: err.message,
    });
  }
}
