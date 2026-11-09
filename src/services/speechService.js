const GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY || "").trim();

let currentAudio = null;
let activeRecognition = null;
let currentSessionId = 0; // Mengunci agar suara tidak pernah berulang / tumpang tindih
let cachedVoices = [];

// Muat daftar suara bawaan browser sejak awal tanpa memicu suara pancingan
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  const loadVoices = () => {
    cachedVoices = window.speechSynthesis.getVoices() || [];
  };
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

// Buka kunci AudioContext tanpa memanggil speechSynthesis palsu yang bikin suara mengulang
export function unlockSpeechAudio() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      if (!window.__jiwooAudioCtx) {
        window.__jiwooAudioCtx = new AudioContextClass();
      }
      if (window.__jiwooAudioCtx.state === "suspended") {
        window.__jiwooAudioCtx.resume();
      }
    }
  } catch {
    // Abaikan jika browser sudah mengizinkan audio
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

// Hentikan suara dengan melepas semua listener terlebih dahulu agar TIDAK memicu onerror/pengulangan
export function stopSpeaking() {
  currentSessionId++;
  if (currentAudio) {
    try {
      currentAudio.onplaying = null;
      currentAudio.onended = null;
      currentAudio.onerror = null;
      currentAudio.pause();
      currentAudio = null;
    } catch {
      // Abaikan
    }
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Abaikan
    }
  }
}

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

// Mengubah teks kaku menjadi ejaan lisan yang luwes saat diucapkan
function makeConversationalIndonesian(text) {
  return (text || "")
    .replace(/\[CBT:[\s\S]*?\]/gi, "")
    .replace(/[*#_~`]/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/\b(tidak)\b/gi, "nggak")
    .replace(/\b(kamu)\b/gi, "kamu")
    .replace(/\b(saya)\b/gi, "aku")
    .replace(/\s+/g, " ")
    .trim();
}

// Lapis 1: Suara Karakter Lyra ("Leda") dari Gemini 2.5 Native TTS
async function fetchGeminiLyraAudio(text, sessionId) {
  if (!GEMINI_API_KEY) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6500);

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
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
                text: `Say in a cheerful, warm, relaxed, and natural young Indonesian female voice: ${text}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Leda",
              },
            },
          },
        },
      }),
    });

    clearTimeout(timeoutId);
    if (sessionId !== currentSessionId || !response.ok) return null;

    const data = await response.json();
    const inlineData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (inlineData?.data) {
      return pcmBase64ToWavUrl(inlineData.data, 24000);
    }
  } catch {
    clearTimeout(timeoutId);
  }
  return null;
}

// Memilih suara wanita paling natural di perangkat (Tanpa memecah kalimat agar tidak mengulang)
function getBestFemaleVoice() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }
  const voices =
    cachedVoices.length > 0
      ? cachedVoices
      : window.speechSynthesis.getVoices() || [];

  const indoVoices = voices.filter((v) =>
    v.lang.toLowerCase().replace("_", "-").includes("id"),
  );
  if (indoVoices.length === 0) return null;

  return (
    indoVoices.find(
      (v) =>
        v.name.toLowerCase().includes("gadis") &&
        v.name.toLowerCase().includes("natural"),
    ) ||
    indoVoices.find((v) => v.name.toLowerCase().includes("natural")) ||
    indoVoices.find((v) => v.name.toLowerCase().includes("gadis")) ||
    indoVoices.find((v) => v.name.toLowerCase().includes("google")) ||
    indoVoices.find((v) => !v.name.toLowerCase().includes("andika")) ||
    indoVoices[0]
  );
}

// Lapis 2: Satu Utterance Utuh (Mencegah pengulangan kalimat di Chrome/Android)
function playSingleUtteranceVoice(text, sessionId, onStart, onEnd) {
  if (
    sessionId !== currentSessionId ||
    typeof window === "undefined" ||
    !("speechSynthesis" in window)
  ) {
    if (onEnd) onEnd();
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const bestVoice = getBestFemaleVoice();
  if (bestVoice) {
    utterance.voice = bestVoice;
  }
  utterance.lang = "id-ID";

  // Modulasi suara Lyra: kecepatan sedikit lebih mengalir (1.12) & nada ceria (1.18)
  utterance.rate = 1.12;
  utterance.pitch = 1.18;
  utterance.volume = 1.0;

  let finished = false;
  const finishOnce = () => {
    if (finished || sessionId !== currentSessionId) return;
    finished = true;
    if (onEnd) onEnd();
  };

  utterance.onstart = () => {
    if (sessionId !== currentSessionId) {
      window.speechSynthesis.cancel();
      return;
    }
    if (onStart) onStart();
  };

  utterance.onend = finishOnce;
  utterance.onerror = finishOnce;

  window.speechSynthesis.speak(utterance);
}

export async function speakText(text, onStart, onEnd) {
  // Hentikan suara sebelumnya dan buat ID sesi baru
  stopSpeaking();
  const mySessionId = ++currentSessionId;

  const cleanText = makeConversationalIndonesian(text);
  if (!cleanText) {
    if (onEnd) onEnd();
    return;
  }

  // 1. Coba panggil suara Gemini Native Lyra ("Leda")
  const wavUrl = await fetchGeminiLyraAudio(cleanText, mySessionId);

  // Jika pengguna sudah menekan tombol lain saat menunggu, batalkan
  if (mySessionId !== currentSessionId) {
    if (wavUrl) URL.revokeObjectURL(wavUrl);
    return;
  }

  if (wavUrl) {
    const audio = new Audio(wavUrl);
    audio.preservesPitch = true;
    audio.playbackRate = 1.04;
    currentAudio = audio;

    let fallbackTriggered = false;
    const triggerFallbackOnce = () => {
      if (fallbackTriggered || mySessionId !== currentSessionId) return;
      fallbackTriggered = true;
      URL.revokeObjectURL(wavUrl);
      playSingleUtteranceVoice(cleanText, mySessionId, onStart, onEnd);
    };

    audio.onplaying = () => {
      if (mySessionId !== currentSessionId) {
        audio.pause();
        return;
      }
      if (onStart) onStart();
    };

    audio.onended = () => {
      URL.revokeObjectURL(wavUrl);
      if (mySessionId === currentSessionId && onEnd) {
        onEnd();
      }
    };

    audio.onerror = triggerFallbackOnce;

    try {
      await audio.play();
      return;
    } catch {
      triggerFallbackOnce();
      return;
    }
  }

  // 2. Jika Gemini TTS tidak merespons, putar 1x menggunakan Single Utterance Voice
  playSingleUtteranceVoice(cleanText, mySessionId, onStart, onEnd);
}
