const GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY || "").trim();

// Urutan prioritas suara wanita muda/santai di Gemini TTS
// ("Leda" adalah kode resmi API Gemini untuk karakter suara Lyra)
const VOICE_CANDIDATES = ["Leda", "Zephyr", "Aoede"];

let sharedAudio = null;
let audioCtx = null;
let activeRecognition = null;
let isStopped = false;
let workingVoiceName = "Leda";

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

// Memanggil Gemini 2.5 Native TTS dengan teks murni agar tidak ditolak server (400 Bad Request)
async function requestGeminiTts(text, voiceName) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

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
            parts: [{ text: text }],
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

// Lapis 1: Suara Cloud Gemini (100% Identik di Laptop & HP)
async function fetchUnifiedCloudVoice(text) {
  if (!GEMINI_API_KEY) return null;

  const candidates = [
    workingVoiceName,
    ...VOICE_CANDIDATES.filter((v) => v !== workingVoiceName),
  ];

  for (const voice of candidates) {
    if (isStopped) return null;
    const wavUrl = await requestGeminiTts(text, voice);
    if (wavUrl) return wavUrl;
  }
  return null;
}

// Lapis 2 (Cadangan): Cloud Audio Stream (Identik di Laptop & HP, tanpa memakai speechSynthesis OS)
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

function playUnifiedStreamFallback(text, onStart, onEnd) {
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
    sharedAudio.preservesPitch = true;
    sharedAudio.playbackRate = 1.12;
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

  // 1. Ambil suara Cloud Gemini (Leda/Lyra) -> Suara 100% sama di Laptop & HP
  const wavUrl = await fetchUnifiedCloudVoice(cleanText);
  if (isStopped) return;

  if (wavUrl) {
    sharedAudio.src = wavUrl;
    sharedAudio.preservesPitch = true;
    sharedAudio.playbackRate = 1.04;
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
      playUnifiedStreamFallback(cleanText, onStart, onEnd);
    };

    try {
      await sharedAudio.play();
      return;
    } catch {
      URL.revokeObjectURL(wavUrl);
    }
  }

  // 2. Jika kuota Gemini TTS penuh, gunakan Cloud Stream yang juga 100% sama di Laptop & HP
  playUnifiedStreamFallback(cleanText, onStart, onEnd);
}
