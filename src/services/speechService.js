const GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY || "").trim();

// Daftar model TTS Gemini & prioritas karakter suara Lyra
const TTS_MODELS = ["gemini-2.5-flash-preview-tts", "gemini-2.0-flash-exp"];
const LYRA_VOICE_CANDIDATES = ["Lyra", "Leda", "Zephyr"];

let sharedAudio = null;
let audioCtx = null;
let activeRecognition = null;
let isStopped = false;
let cachedVoices = [];
let workingVoiceName = null; // Menyimpan kode suara Lyra yang diterima server agar respons berikutnya instan

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  const loadVoices = () => {
    cachedVoices = window.speechSynthesis.getVoices() || [];
  };
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

// Audio hening 1ms untuk membuka kunci autoplay browser tepat saat tombol diklik
const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

export function unlockSpeechAudio() {
  try {
    if (!sharedAudio) {
      sharedAudio = new Audio();
      sharedAudio.preload = "auto";
    }
    sharedAudio.src = SILENT_WAV;
    sharedAudio.volume = 0.01;
    const p = sharedAudio.play();
    if (p !== undefined) {
      p.then(() => {
        sharedAudio.pause();
        sharedAudio.volume = 1.0;
      }).catch(() => {});
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      if (!audioCtx) audioCtx = new AudioContextClass();
      if (audioCtx.state === "suspended") audioCtx.resume();
    }
  } catch {
    // Abaikan jika browser tidak memblokir
  }
}

export function startListening(onStart, onResult, onError) {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    if (onError) {
      onError(
        "Browser kamu belum mendukung fitur mikrofon. Gunakan Chrome atau Edge ya!",
      );
    }
    return;
  }

  if (activeRecognition) {
    try {
      activeRecognition.abort();
    } catch {
      // Abaikan
    }
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "id-ID";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  activeRecognition = recognition;

  recognition.onstart = () => {
    if (onStart) onStart();
  };

  recognition.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript || "";
    activeRecognition = null;
    if (onResult) onResult(transcript);
  };

  recognition.onerror = (event) => {
    activeRecognition = null;
    if (event.error === "aborted") {
      if (onError) onError("");
      return;
    }
    let msg = "Suaramu kurang terdengar jelas nih, coba bicara lagi yuk!";
    if (event.error === "not-allowed") {
      msg =
        "Izin mikrofon belum aktif. Klik ikon gembok di sebelah alamat web untuk mengizinkan mikrofon ya.";
    }
    if (onError) onError(msg);
  };

  recognition.onend = () => {
    activeRecognition = null;
  };

  try {
    recognition.start();
  } catch {
    if (onError)
      onError("Gagal menyalakan mikrofon. Coba klik sekali lagi ya.");
  }
}

export function stopListening() {
  if (activeRecognition) {
    try {
      activeRecognition.stop();
      activeRecognition = null;
    } catch {
      // Abaikan
    }
  }
}

export function stopSpeaking() {
  isStopped = true;
  if (sharedAudio) {
    try {
      sharedAudio.pause();
      sharedAudio.onended = null;
      sharedAudio.onerror = null;
    } catch {
      // Abaikan
    }
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

// Mengubah raw PCM 24kHz dari Gemini ke file WAV yang siap diputar browser
function pcmBase64ToWavUrl(base64Pcm, sampleRate = 24000) {
  const binaryString = window.atob(base64Pcm);
  const pcmLen = binaryString.length;
  const wavBuffer = new ArrayBuffer(44 + pcmLen);
  const view = new DataView(wavBuffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + pcmLen, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, pcmLen, true);

  const uint8 = new Uint8Array(wavBuffer, 44);
  for (let i = 0; i < pcmLen; i++) {
    uint8[i] = binaryString.charCodeAt(i);
  }

  const blob = new Blob([wavBuffer], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}

// Memanggil satu kandidat voiceName ke Gemini TTS
async function requestGeminiVoice(text, voiceName, modelName) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Kamu adalah Lyra, sahabat cewek Indonesia yang ceria, santai, hangat, dan suportif. Ucapkan kalimat berikut dengan intonasi ngobrol sehari-hari yang super luwes, ekspresif, tidak baku, dan sama sekali tidak kaku seperti robot: "${text}"`,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceName,
              },
            },
          },
        },
      }),
    });

    clearTimeout(timeoutId);
    if (!response.ok) return null;

    const data = await response.json();
    const inlineData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (inlineData?.data) {
      workingVoiceName = voiceName;
      return pcmBase64ToWavUrl(inlineData.data, 24000);
    }
  } catch {
    clearTimeout(timeoutId);
  }
  return null;
}

// Lapis 1: Suara Karakter Lyra dari Gemini Native Audio
async function fetchLyraGeminiVoice(text) {
  if (!GEMINI_API_KEY) {
    console.warn(
      "VITE_GEMINI_API_KEY kosong di .env! Menggunakan suara cadangan.",
    );
    return null;
  }

  const candidates = workingVoiceName
    ? [
        workingVoiceName,
        ...LYRA_VOICE_CANDIDATES.filter((v) => v !== workingVoiceName),
      ]
    : LYRA_VOICE_CANDIDATES;

  for (const voiceName of candidates) {
    if (isStopped) return null;
    const wavUrl = await requestGeminiVoice(text, voiceName, TTS_MODELS[0]);
    if (wavUrl) return wavUrl;
  }

  return null;
}

// Mencari suara wanita Neural Indonesia (Menghindari suara pria/robot kaku Microsoft Andika)
function getBestFemaleIndonesianVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices =
    cachedVoices.length > 0
      ? cachedVoices
      : window.speechSynthesis.getVoices() || [];

  const indoVoices = voices.filter((v) =>
    v.lang.toLowerCase().replace("_", "-").includes("id"),
  );
  if (indoVoices.length === 0) return null;

  // Prioritaskan Gadis Online (Natural) atau Google Bahasa Indonesia, hindari Andika (suara cowok kaku)
  return (
    indoVoices.find(
      (v) =>
        v.name.toLowerCase().includes("gadis") &&
        v.name.toLowerCase().includes("natural"),
    ) ||
    indoVoices.find((v) => v.name.toLowerCase().includes("gadis")) ||
    indoVoices.find((v) => v.name.toLowerCase().includes("natural")) ||
    indoVoices.find((v) => v.name.toLowerCase().includes("google")) ||
    indoVoices.find((v) => !v.name.toLowerCase().includes("andika")) ||
    null
  );
}

// Lapis 2: Web Speech API dengan karakter Lyra (Pitch & Rate remaja ceria)
function playLyraBrowserSpeech(text, onStart, onEnd, onFallbackNeeded) {
  if (!("speechSynthesis" in window)) {
    onFallbackNeeded();
    return;
  }

  const bestVoice = getBestFemaleIndonesianVoice();
  if (!bestVoice) {
    onFallbackNeeded();
    return;
  }

  window.speechSynthesis.cancel();

  const sentences = text
    .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
    ?.map((s) => s.trim())
    .filter(Boolean) || [text];

  let idx = 0;
  let started = false;

  const speakNextSentence = () => {
    if (isStopped || idx >= sentences.length) {
      if (onEnd) onEnd();
      return;
    }

    const sentence = sentences[idx];
    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.voice = bestVoice;
    utterance.lang = "id-ID";

    // Karakter Lyra: lebih cepat sedikit (1.14x) dan nada sedikit lebih tinggi/ceria (1.15)
    const isQuestion = sentence.endsWith("?");
    const isExclamation = sentence.endsWith("!");
    utterance.rate = isExclamation ? 1.16 : 1.13;
    utterance.pitch = isQuestion ? 1.2 : isExclamation ? 1.18 : 1.14;

    utterance.onstart = () => {
      if (!started) {
        started = true;
        if (onStart) onStart();
      }
    };

    utterance.onend = () => {
      idx++;
      speakNextSentence();
    };

    utterance.onerror = () => {
      if (!started) {
        onFallbackNeeded();
      } else if (onEnd) {
        onEnd();
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  speakNextSentence();
}

// Lapis 3: Streaming Audio Cadangan dengan kecepatan santai
function splitTextIntoChunks(text) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + " " + sentence).trim().length <= 165) {
      current = (current + " " + sentence).trim();
    } else {
      if (current) chunks.push(current);
      if (sentence.length <= 165) {
        current = sentence;
      } else {
        const words = sentence.split(/\s+/);
        let temp = "";
        for (const w of words) {
          if ((temp + " " + w).trim().length <= 165) {
            temp = (temp + " " + w).trim();
          } else {
            if (temp) chunks.push(temp);
            temp = w;
          }
        }
        current = temp;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function playStreamFallback(text, onStart, onEnd) {
  const chunks = splitTextIntoChunks(text);
  if (chunks.length === 0) {
    if (onEnd) onEnd();
    return;
  }

  if (!sharedAudio) {
    sharedAudio = new Audio();
  }

  let hasStarted = false;

  const playChunk = (index, serverTry = 0) => {
    if (isStopped || index >= chunks.length) {
      if (onEnd) onEnd();
      return;
    }

    const encoded = encodeURIComponent(chunks[index]);
    const urls = [
      `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=id&q=${encoded}`,
      `https://clients5.google.com/translate_tts?ie=UTF-8&client=dict-chrome-ex&tl=id&q=${encoded}`,
      `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=id&q=${encoded}`,
    ];

    sharedAudio.referrerPolicy = "no-referrer";
    sharedAudio.src = urls[serverTry];
    // Mempercepat tempo sedikit dan menjaga pitch agar tidak terdengar seperti robot mengeja
    sharedAudio.playbackRate = 1.18;
    sharedAudio.preservesPitch = false;
    sharedAudio.volume = 1.0;

    sharedAudio.onplaying = () => {
      if (!hasStarted) {
        hasStarted = true;
        if (onStart) onStart();
      }
    };

    sharedAudio.onended = () => {
      if (!isStopped) playChunk(index + 1, 0);
    };

    sharedAudio.onerror = () => {
      if (isStopped) return;
      if (serverTry < 2) {
        playChunk(index, serverTry + 1);
      } else if (onEnd) {
        onEnd();
      }
    };

    const p = sharedAudio.play();
    if (p !== undefined) {
      p.catch(() => {
        if (isStopped) return;
        if (serverTry < 2) {
          playChunk(index, serverTry + 1);
        } else if (onEnd) {
          onEnd();
        }
      });
    }
  };

  playChunk(0, 0);
}

export async function speakText(text, onStart, onEnd) {
  stopSpeaking();
  isStopped = false;

  // Bersihkan simbol markdown dan tag CBT jika tidak sengaja terbawa
  const cleanText = (text || "")
    .replace(/\[CBT:[\s\S]*?\]/gi, "")
    .replace(/[*#_~`]/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanText) {
    if (onEnd) onEnd();
    return;
  }

  if (!sharedAudio) {
    sharedAudio = new Audio();
  }

  // 1. Utamakan Suara Karakter Lyra dari Gemini Native TTS
  const wavUrl = await fetchLyraGeminiVoice(cleanText);
  if (isStopped) return;

  if (wavUrl) {
    sharedAudio.src = wavUrl;
    sharedAudio.preservesPitch = true;
    sharedAudio.playbackRate = 1.03; // Sedikit lebih gesit agar terdengar santai
    sharedAudio.volume = 1.0;

    sharedAudio.onplaying = () => {
      if (onStart) onStart();
    };

    sharedAudio.onended = () => {
      URL.revokeObjectURL(wavUrl);
      if (onEnd) onEnd();
    };

    sharedAudio.onerror = () => {
      URL.revokeObjectURL(wavUrl);
      playLyraBrowserSpeech(cleanText, onStart, onEnd, () =>
        playStreamFallback(cleanText, onStart, onEnd),
      );
    };

    try {
      await sharedAudio.play();
      return;
    } catch {
      URL.revokeObjectURL(wavUrl);
    }
  }

  // 2. Cadangan: Suara Wanita Natural Browser dengan modulasi gaya Lyra
  playLyraBrowserSpeech(cleanText, onStart, onEnd, () =>
    playStreamFallback(cleanText, onStart, onEnd),
  );
}
