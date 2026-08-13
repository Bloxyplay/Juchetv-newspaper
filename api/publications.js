// /api/publications.js
// Vercel Serverless Function — Myanmar-key proxy for koryofront publications
// Links stay English | Code structure & keys in Myanmar | Data stays English

const_upstream_url = "https://koryofront.org/api/publications";
const ရုပ်ပုံအခြေခံ = "https://koryofront.org/api/periodicals";

const အမှတ်စဉ်မြေပုံ = {
  id:            "အမှတ်",
  title:         "ခေါင်းစဉ်",
  description:   "ဖော်ပြချက်",
  category:      "အမျိုးအစား",
  coverPath:     "အဖုံးလမ်း",
  coverMimeType: "အဖုံးအမျိုးအစား",
  coverUrl:      "အဖုံး_URL",
  filePath:      "ဖိုင်လမ်း",
  fileName:      "ဖိုင်နာမည်",
  fileMimeType:  "ဖိုင်အမျိုးအစား",
  content:       "အကြောင်းအရာ",
  publishedYear: "ထုတ်ဝေသည့်နှစ်",
  createdAt:     "ဖန်တီးသည့်အချိန်",
  fileSize:      "ဖိုင်အရွယ်အစား",
};

function အင်္ဂလိပ်မှမြန်မာသို့(အင်္ဂလိပ်အရာ) {
  const မြန်မာအရာ = {};
  for (const [အင်္ဂလိပ်ကီး, တန်ဖိုး] of Object.entries(အင်္ဂလိပ်အရာ)) {
    const မြန်မာကီး = အမှတ်စဉ်မြေပုံ[အင်္ဂလိပ်ကီး] || အင်္ဂလိပ်ကီး;
    မြန်မာအရာ[မြန်မာကီး] = တန်ဖိုး;
  }
  // Add thumbnail URL from id
  if (အင်္ဂလိပ်အရာ.id) {
    မြန်မာအရာ["အဖုံး_URL"] = `${ရုပ်ပုံအခြေခံ}/${အင်္ဂလိပ်အရာ.id}/thumb`;
  }
  return မြန်မာအရာ;
}

export default async function ကိုင်တွယ်သူ(request, တုံ့ပြန်မှု) {
  // CORS headers
  တုံ့ပြန်မှု.setHeader("Access-Control-Allow-Origin", "*");
  တုံ့ပြန်မှု.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  တုံ့ပြန်မှု.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (request.method === "OPTIONS") {
    return တုံ့ပြန်မှု.status(200).end();
  }

  try {
    const တုံ့ပြန်ခြင်း = await fetch(const_upstream_url, {
      headers: { "Accept": "application/json" },
    });

    if (!တုံ့ပြန်ခြင်း.ok) {
      return တုံ့ပြန်မှု.status(တုံ့ပြန်ခြင်း.status).json({
        အမှား: "အဝင်ဒေတာရယူရန် မအောင်မြင်ပါ",
        အခြေအနေ: တုံ့ပြန်ခြင်း.status,
      });
    }

    const အင်္ဂလိပ်စာရင်း = await တုံ့ပြန်ခြင်း.json();
    const မြန်မာစာရင်း = Array.isArray(အင်္ဂလိပ်စာရင်း)
      ? အင်္ဂလိပ်စာရင်း.map(အင်္ဂလိပ်မှမြန်မာသို့)
      : အင်္ဂလိပ်မှမြန်မာသို့(အင်္ဂလိပ်စာရင်း);

    return တုံ့ပြန်မှု.status(200).json({
      အောင်မြင်ခြင်း: true,
      ရင်းမြစ်: "https://koryofront.org/api/publications",
      အရေအတွက်: Array.isArray(မြန်မာစာရင်း) ? မြန်မာစာရင်း.length : 1,
      အချက်အလက်များ: မြန်မာစာရင်း,
    });

  } catch (အမှား) {
    return တုံ့ပြန်မှု.status(500).json({
      အောင်မြင်ခြင်း: false,
      အမှား: အမှား.message,
    });
  }
}
