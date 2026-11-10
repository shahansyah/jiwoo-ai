const LOCAL_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY || "").trim();
const BASE_V1BETA_URL = "https://generativelanguage.googleapis.com/v1beta/";

let conversationHistory = [];

export function resetJiwooMemory() {
  conversationHistory = [];
}

function parseJiwooOutput(rawText) {
  let cleanReply = rawText.replace(/[*#`]/g, "").trim();
  let distortion = null;
  let reframing = null;

  const cbtMatch = cleanReply.match(/\[CBT:\s*([^|]+)\|\s*([^\]]+)\]/i);
  if (cbtMatch) {
    distortion = cbtMatch[1].trim();
    reframing = cbtMatch[2].trim();
    cleanReply = cleanReply.replace(cbtMatch[0], "").trim();
  }

  return {
    reply: cleanReply,
    distortion,
    reframing,
    mood: "friendly",
  };
}

export async function getJiwooResponse(userMessage) {
  const systemPrompt = `Kamu adalah Jiwoo, sahabat curhat sekaligus konselor sebaya (peer counselor) yang asik, hangat, ekspresif, dan suportif.

ATURAN GAYA BICARA:
1. Gunakan bahasa percakapan sehari-hari anak muda Indonesia yang santai, akrab, dan tidak kaku/formal (gunakan "aku-kamu", "banget", "nggak", "kok", "yuk").
2. Jawab setiap sapaan atau cerita pengguna secara spesifik, relevan, dan nyambung. Kalau pengguna mengetik "p" atau "halo", sapa balik dengan ceria dan tanyakan apa yang lagi dia rasakan atau pikirkan hari ini.
3. Buat kalimat yang ringkas dan enak didengar (2-3 kalimat saja per balasan) seperti sedang mengobrol langsung di telepon.
4. Hanya jika pengguna jelas mengalami overthinking berat, tambahkan baris baru di paling akhir:
[CBT: Nama Pola Pikir | Satu kalimat sudut pandang baru yang menenangkan]
Jika sapaan atau obrolan biasa, jangan tulis tag [CBT: ...] sama sekali.`;

  conversationHistory.push({
    role: "user",
    parts: [{ text: userMessage }],
  });

  const recentHistory = conversationHistory.slice(-8);

  const payloadContents = [
    {
      role: "user",
      parts: [{ text: "INSTRUKSI PERAN JIWOO:\n" + systemPrompt }],
    },
    {
      role: "model",
      parts: [
        {
          text: "Siap! Aku bakal ngobrol dengan gaya santai, akrab, dan ekspresif.",
        },
      ],
    },
    ...recentHistory,
  ];

  // 1. PRIORITAS UTAMA: Panggil Serverless Backend (/api/chat) agar API Key tersembunyi dengan aman
  try {
    const serverRes = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: payloadContents }),
    });

    if (serverRes.ok) {
      const serverData = await serverRes.json();
      if (serverData?.text) {
        const result = parseJiwooOutput(serverData.text);
        conversationHistory.push({
          role: "model",
          parts: [{ text: result.reply }],
        });
        return result;
      }
    }
  } catch {
    // Jika dijalankan di npm run dev lokal (tanpa vercel dev), lanjut ke fallback lokal di bawah
  }

  // 2. FALLBACK LOKAL (Hanya untuk npm run dev di laptop)
  if (!LOCAL_API_KEY) {
    conversationHistory.pop();
    return {
      reply:
        "Koneksi ke server AI sedang disiapkan. Pastikan variabel GEMINI_API_KEY sudah terpasang di Vercel ya!",
      distortion: null,
      reframing: null,
      mood: "friendly",
    };
  }

  try {
    const listRes = await fetch(
      `${BASE_V1BETA_URL}models?key=${encodeURIComponent(LOCAL_API_KEY)}`,
      { headers: { "x-goog-api-key": LOCAL_API_KEY } },
    );
    const listData = await listRes.json();
    const models = (listData?.models || [])
      .filter(
        (m) =>
          m.supportedGenerationMethods?.includes("generateContent") &&
          m.name.includes("gemini-3"),
      )
      .map((m) => m.name.replace("models/", ""));

    const targetModel = models[0] || "gemini-3-flash-preview";
    const endpoint = `${BASE_V1BETA_URL}models/${targetModel}:generateContent?key=${encodeURIComponent(LOCAL_API_KEY)}`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": LOCAL_API_KEY,
      },
      body: JSON.stringify({
        contents: payloadContents,
        generationConfig: { temperature: 0.85 },
      }),
    });

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (rawText) {
      const result = parseJiwooOutput(rawText);
      conversationHistory.push({
        role: "model",
        parts: [{ text: result.reply }],
      });
      return result;
    }
  } catch {
    // Abaikan
  }

  conversationHistory.pop();
  return {
    reply:
      "Maaf ya, koneksiku lagi agak terhambat sebentar. Coba kirim ulang pesanmu ya!",
    distortion: null,
    reframing: null,
    mood: "friendly",
  };
}
