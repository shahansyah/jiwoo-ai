const GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY || "").trim();
const BASE_V1BETA_URL =
  "https://generativelanguage.googleapis.com/v1beta/";

let conversationHistory = [];

export function resetJiwooMemory() {
  conversationHistory = [];
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

  // Gabungkan instruksi langsung di contents agar 100% kompatibel dengan semua versi endpoint v1beta
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

  // Hanya gunakan model Gemini 3.0 terbaru yang diminta oleh Google AI Studio
  const modelsToTry = ["gemini-3.0-flash", "gemini-3-flash-preview"];
  const errorLogs = [];

  for (const modelName of modelsToTry) {
    try {
      // Gunakan header x-goog-api-key dan query key sekaligus
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
        errorLogs.push(`${modelName}: ${msg}`);
        continue;
      }

      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (!rawText) {
        errorLogs.push(`${modelName}: Respons kosong`);
        continue;
      }

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
      errorLogs.push(`${modelName}: ${err?.message || "Network error"}`);
    }
  }

  // Coba fallback ke endpoint Interactions API baru jika key berawalan AQ. mewajibkannya
  try {
    const interactionsRes = await fetch(
      `${BASE_V1BETA_URL}interactions?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          model: "models/gemini-3.0-flash",
          input: `${systemPrompt}\n\nPengguna berkata: "${userMessage}"\nBalasan Jiwoo:`,
        }),
      },
    );

    if (interactionsRes.ok) {
      const intData = await interactionsRes.json();
      const intText =
        intData?.output?.text ||
        intData?.outputs?.[0]?.text ||
        intData?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "";

      if (intText) {
        const cleanReply = intText.replace(/[*#`]/g, "").trim();
        conversationHistory.push({
          role: "model",
          parts: [{ text: cleanReply }],
        });
        return {
          reply: cleanReply,
          distortion: null,
          reframing: null,
          mood: "friendly",
        };
      }
    }
  } catch {
    // Abaikan jika endpoint interactions belum perlu
  }

  conversationHistory.pop();

  // Tampilkan error PERTAMA (dari gemini-3.0-flash) agar tidak tertimpa model lain
  return {
    reply: `Waduh, koneksiku ke server Gemini agak terhambat nih (${errorLogs[0] || "Key tidak valid"}). Coba kirim ulang pesanmu sebentar lagi ya!`,
    distortion: null,
    reframing: null,
    mood: "friendly",
  };
}