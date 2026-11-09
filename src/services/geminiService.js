const GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY || "").trim();
const BASE_V1BETA_URL = "https://generativelanguage.googleapis.com/v1beta/";

let conversationHistory = [];
let cachedValidModels = null;

export function resetJiwooMemory() {
  conversationHistory = [];
}

// Balasan ini akan DIUCAPKAN, jadi prompt dibuat supaya tulisannya seperti orang ngomong
const SYSTEM_PROMPT = `Kamu adalah Jiwoo, sahabat curhat sekaligus konselor sebaya yang asik, hangat, dan suportif. Balasanmu akan DIUCAPKAN lewat suara, jadi tulis persis seperti orang ngomong, bukan seperti orang nulis.

GAYA BICARA:
- Santai ala anak muda Indonesia: pakai "aku-kamu", "nggak", "banget", "sih", "deh", "kok", "yuk", "tuh", "ya".
- DILARANG pakai kata baku/formal seperti "tidak", "saya", "Anda", "memahami", "tentu saja", "sebaiknya", "merupakan", "mengenai".
- Maksimal 2-3 kalimat pendek. Satu ide per kalimat. Boleh pakai "hehe", "hmm", "wah", "duh" secukupnya.
- Respons dulu perasaannya, baru tanya satu hal ringan. Jangan menggurui, jangan bikin daftar.
- Jangan pakai emoji, tanda bintang, atau markdown.
- Jangan mengulang kalimat atau pertanyaan yang sudah kamu ucapkan di balasan sebelumnya.
- Kalau user cuma nyapa ("p", "halo"), sapa balik dengan ceria dan tanya lagi ngerasain apa hari ini.

CONTOH:
User: halo
Jiwoo: Hai hai! Gimana hari kamu? Lagi ada yang pengen diceritain nggak?
User: aku capek banget, kayaknya semua orang benci aku
Jiwoo: Duh, pasti berat banget ya ngerasa begitu. Emang tadi ada kejadian apa sih sampai kamu mikir gitu?

Hanya jika user jelas mengalami overthinking berat, tambahkan satu baris di paling akhir:
[CBT: Nama Pola Pikir | Satu kalimat sudut pandang baru yang menenangkan]
Kalau obrolan biasa, jangan tulis tag [CBT: ...] sama sekali.`;

function modelScore(name) {
  // Model flash lebih cepat -> cocok untuk chat suara. Pro paling belakang.
  let score = 0;
  if (name.startsWith("gemini-3")) score -= 10;
  if (name.includes("flash")) score -= 5;
  if (name.includes("lite")) score += 1;
  if (name.includes("pro")) score += 5;
  return score;
}

async function fetchValidModelsFromGoogle() {
  if (cachedValidModels && cachedValidModels.length > 0) {
    return cachedValidModels;
  }

  try {
    const res = await fetch(`${BASE_V1BETA_URL}models`, {
      headers: { "x-goog-api-key": GEMINI_API_KEY },
    });
    const data = await res.json();

    if (data?.models && Array.isArray(data.models)) {
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

      const usable = allSupported.filter(
        (name) =>
          name.startsWith("gemini-3") ||
          (!name.startsWith("gemini-1.5") &&
            !name.startsWith("gemini-2.0") &&
            name !== "gemini-2.5-flash"),
      );

      const finalQueue = (usable.length > 0 ? usable : allSupported).sort(
        (a, b) => modelScore(a) - modelScore(b),
      );

      if (finalQueue.length > 0) {
        cachedValidModels = finalQueue;
        return finalQueue;
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

  conversationHistory.push({
    role: "user",
    parts: [{ text: userMessage }],
  });

  const recentHistory = conversationHistory.slice(-8);
  // Pastikan riwayat selalu diawali giliran "user"
  while (recentHistory.length > 0 && recentHistory[0].role !== "user") {
    recentHistory.shift();
  }

  const modelsToTry = await fetchValidModelsFromGoogle();
  const errorLogs = [];

  for (const modelName of modelsToTry) {
    try {
      const endpoint = `${BASE_V1BETA_URL}models/${modelName}:generateContent`;

      const generationConfig = {
        // Gemini 3 disarankan pakai temperature default (1.0)
        temperature: 1.0,
        maxOutputTokens: 1024, // longgar, karena token "thinking" ikut terhitung
      };
      // Kurangi waktu "berpikir" supaya balasan cepat untuk chat suara
      if (modelName.startsWith("gemini-3")) {
        generationConfig.thinkingConfig = { thinkingLevel: "low" };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: recentHistory,
          generationConfig,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const msg = data?.error?.message || `HTTP ${response.status}`;
        errorLogs.push(`${modelName} -> ${msg}`);
        continue;
      }

      const parts = data?.candidates?.[0]?.content?.parts || [];
      const rawText = parts
        .filter((p) => p.text && !p.thought)
        .map((p) => p.text)
        .join(" ");
      if (!rawText.trim()) continue;

      // Kunci model yang berhasil di urutan pertama
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

      return { reply: cleanReply, distortion, reframing, mood: "friendly" };
    } catch (err) {
      errorLogs.push(`${modelName} -> ${err?.message || "Network error"}`);
    }
  }

  conversationHistory.pop();
  console.error("[Jiwoo] semua model gagal:", errorLogs);

  return {
    reply:
      "Duh, aku lagi susah nyambung nih. Coba kirim lagi sebentar lagi ya!",
    distortion: null,
    reframing: null,
    mood: "friendly",
  };
}
