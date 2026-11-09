const GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY || "").trim();
const BASE_V1BETA_URL =
  "https://generativelanguage.googleapis.com/v1beta/";

let conversationHistory = [];
let workingModelCache = null;

export function resetJiwooMemory() {
  conversationHistory = [];
}

// Cari otomatis model Gemini yang diizinkan untuk API Key kamu
async function getActiveModel() {
  if (workingModelCache) return workingModelCache;

  try {
    const res = await fetch(
      `${BASE_V1BETA_URL}models?key=${GEMINI_API_KEY}`,
      {
        headers: { "x-goog-api-key": GEMINI_API_KEY },
      },
    );
    const data = await res.json();

    if (data?.models && Array.isArray(data.models)) {
      const available = data.models
        .filter(
          (m) =>
            m.supportedGenerationMethods?.includes("generateContent") &&
            m.name.includes("gemini") &&
            !m.name.includes("tts") &&
            !m.name.includes("image") &&
            !m.name.includes("embedding"),
        )
        .map((m) => m.name.replace("models/", ""));

      const priority = [
        "gemini-3.0-flash",
        "gemini-3-flash-preview",
        "gemini-2.5-flash",
        "gemini-2.0-flash",
      ];

      for (const p of priority) {
        const found = available.find((a) => a === p || a.startsWith(p));
        if (found) {
          workingModelCache = found;
          return found;
        }
      }

      if (available.length > 0) {
        workingModelCache = available[0];
        return available[0];
      }
    }
  } catch {
    // Lanjut ke default
  }

  return "gemini-3.0-flash";
}

export async function getJiwooResponse(userMessage) {
  if (!GEMINI_API_KEY) {
    return {
      reply:
        "Hmm, sepertinya VITE_GEMINI_API_KEY belum terbaca di browser. Pastikan di Vercel tipenya sudah 'Config' (bukan Secret) lalu klik Redeploy ya!",
      distortion: null,
      reframing: null,
      mood: "friendly",
    };
  }

  // Karakter Jiwoo: Santai, Akrab, Ekspresif, Tidak Kaku/Formal
  const systemPrompt = `Kamu adalah Jiwoo, sahabat curhat sekaligus konselor sebaya (peer counselor) yang asik, hangat, ekspresif, dan suportif.

ATURAN GAYA BICARA (SANGAT PENTING):
1. JANGAN gunakan bahasa yang kaku, baku, atau terlalu formal. Gunakan bahasa percakapan sehari-hari anak muda Indonesia yang sopan tapi akrab dan santai (gunakan kata seperti "aku-kamu", "banget", "nggak", "kok", "sih", "yuk", "wajar banget").
2. Jawablah setiap pesan pengguna secara SPESIFIK dan NYAMBUNG. Kalau pengguna menyapa "Halo Jiwo" atau "hloi apa", balas sapaannya dengan ceria dan tanyakan kabar atau kesibukannya hari ini.
3. Buat kalimat yang pendek, enak didengar saat diucapkan dengan suara (maksimal 2-3 kalimat saja per balasan) supaya obrolan terasa hidup dua arah seperti teleponan sama sahabat dekat.
4. Kalau pengguna lagi curhat masalah berat atau minta saran, dengarkan dengan tulus, kasih validasi yang menenangkan, lalu berikan saran praktis yang membumi.
5. OPSIONAL: Hanya jika pengguna benar-benar menunjukkan pikiran negatif berlebih (overthinking parah), tambahkan di baris paling bawah:
[CBT: Nama Pola Pikir | Satu kalimat sudut pandang baru yang lebih tenang]
Untuk sapaan atau obrolan biasa, JANGAN sertakan tag [CBT: ...] sama sekali.`;

  conversationHistory.push({
    role: "user",
    parts: [{ text: userMessage }],
  });

  const recentHistory = conversationHistory.slice(-10);

  const primaryModel = await getActiveModel();
  const modelsToTry = [
    ...new Set([
      primaryModel,
      "gemini-3.0-flash",
      "gemini-3-flash-preview",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
    ]),
  ];

  let lastError = "";

  for (const modelName of modelsToTry) {
    try {
      const endpoint = `${BASE_V1BETA_URL}models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: recentHistory,
          generationConfig: {
            temperature: 0.85,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        lastError = data?.error?.message || `HTTP ${response.status}`;
        continue;
      }

      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (!rawText) continue;

      workingModelCache = modelName;

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
      lastError = err?.message || "Network error";
    }
  }

  conversationHistory.pop();

  return {
    reply: `Waduh, koneksiku ke server Gemini agak terhambat nih (${lastError}). Coba kirim ulang pesanmu sebentar lagi ya!`,
    distortion: null,
    reframing: null,
    mood: "friendly",
  };
}