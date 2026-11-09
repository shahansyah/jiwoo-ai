const GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY || "").trim();
const BASE_V1BETA_URL = "https://generativelanguage.googleapis.com/v1beta/";

let conversationHistory = [];
let cachedValidModels = null;

export function resetJiwooMemory() {
  conversationHistory = [];
}

// Mengambil daftar nama model yang benar-benar ada di server Google untuk API Key ini
async function fetchValidModelsFromGoogle() {
  if (cachedValidModels && cachedValidModels.length > 0) {
    return cachedValidModels;
  }

  try {
    const res = await fetch(
      `${BASE_V1BETA_URL}models?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      {
        headers: { "x-goog-api-key": GEMINI_API_KEY },
      },
    );
    const data = await res.json();

    if (data?.models && Array.isArray(data.models)) {
      // Ambil semua model teks yang mendukung generateContent
      const allSupported = data.models
        .filter(
          (m) =>
            m.supportedGenerationMethods?.includes("generateContent") &&
            m.name.includes("gemini") &&
            !m.name.includes("tts") &&
            !m.name.includes("image") &&
            !m.name.includes("embedding") &&
            !m.name.includes("vision"),
        )
        .map((m) => m.name.replace("models/", ""));

      // Urutkan agar model generasi 3 (gemini-3...) berada paling atas,
      // dan singkirkan model yang sudah diblokir untuk user baru (1.5, 2.0, 2.5-flash biasa)
      const gen3Models = allSupported.filter((name) =>
        name.startsWith("gemini-3"),
      );
      const otherModels = allSupported.filter(
        (name) =>
          !name.startsWith("gemini-3") &&
          !name.startsWith("gemini-1.5") &&
          !name.startsWith("gemini-2.0") &&
          name !== "gemini-2.5-flash",
      );

      const finalQueue = [...gen3Models, ...otherModels];

      if (finalQueue.length > 0) {
        cachedValidModels = finalQueue;
        return finalQueue;
      }

      if (allSupported.length > 0) {
        cachedValidModels = allSupported;
        return allSupported;
      }
    }
  } catch {
    // Abaikan jika gagal fetch list
  }

  return ["gemini-3-flash-preview", "gemini-3-pro-preview", "gemini-2.5-pro"];
}

export async function getJiwooResponse(userMessage) {
  if (!GEMINI_API_KEY) {
    return {
      reply:
        "VITE_GEMINI_API_KEY belum terbaca di browser. Pastikan di Vercel sudah diset sebagai Config dan sudah di-redeploy ya!",
      distortion: null,
      reframing: null,
      mood: "friendly",
    };
  }

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

  // Ambil daftar model asli dari akun Google AI Studio kamu
  const modelsToTry = await fetchValidModelsFromGoogle();
  const errorLogs = [];

  for (const modelName of modelsToTry) {
    try {
      const endpoint = `${BASE_V1BETA_URL}models/${modelName}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: payloadContents,
          generationConfig: {
            temperature: 0.85,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const msg = data?.error?.message || `HTTP ${response.status}`;
        errorLogs.push(`${modelName} -> ${msg}`);
        continue;
      }

      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (!rawText) continue;

      // Kunci model yang berhasil ini di urutan pertama untuk chat berikutnya agar instan
      cachedValidModels = [
        modelName,
        ...modelsToTry.filter((m) => m !== modelName),
      ];

      let cleanReply = rawText.replace(/[*#`]/g, "").trim();
      let distortion = null;
      let reframing = null;

      const cbtMatch = cleanReply.match(/\[CBT:\s*([^|]+)\|\s*([^\]]+)\]/i);
      if (cbtMatch) {
        distortion = cbtMatch[1].trim();
        reframing = cbtMatch[2].trim();
        cleanReply = cleanReply.replace(cbtMatch[0], "").trim();
      }

      conversationHistory.push({
        role: "model",
        parts: [{ text: cleanReply }],
      });

      return {
        reply: cleanReply,
        distortion,
        reframing,
        mood: "friendly",
      };
    } catch (err) {
      errorLogs.push(`${modelName} -> ${err?.message || "Network error"}`);
    }
  }

  conversationHistory.pop();

  return {
    reply: `Daftar model yang dicoba: [${modelsToTry.slice(0, 4).join(", ")}]. Detail kendala: ${errorLogs[0] || "Tidak diketahui"}`,
    distortion: null,
    reframing: null,
    mood: "friendly",
  };
}
