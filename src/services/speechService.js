const GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY || "").trim();

let currentAudio = null;
let activeRecognition = null;
let isStopped = false;
let cachedVoices = [];
let geminiTtsAvailable = true; // Otomatis dinonaktifkan jika API Key terkena limit kuota TTS

// Muat daftar suara bawaan browser sejak awal
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  const loadVoices = () => {
    cachedVoices = window.speechSynthesis.getVoices() || [];
  };
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

// Membuka kunci izin suara di Chrome/Safari tepat saat tombol diklik
export function unlockSpeechAudio() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      if (ctx.state === "suspended") ctx.resume();
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const silentUtterance = new SpeechSynthesisUtterance("");
      silentUtterance.volume = 0;
      window.speechSynthesis.speak(silentUtterance);
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
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.src = "";
      currentAudio = null;
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

// Lapis 1: Gemini TTS ("Leda" / Lyra) dengan batas waktu cepat (2.5 detik) agar tidak pernah gantung
async function fetchQuickGeminiLyra(text) {
  if (!GEMINI_API_KEY || !geminiTtsAvailable) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2800);

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
        contents: [{ parts: [{ text: text }] }],
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
    if (!response.ok) {
      // Jika kuota habis (429) atau model ditolak (400/403/404), matikan percobaan berikutnya agar langsung instan
      if (response.status >= 400) {
        geminiTtsAvailable = false;
      }
      return null;
    }

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

// Memilih suara perempuan Bahasa Indonesia terbaik (Menolak suara pria/kaku Andika)
function getBestFemaleIndoVoice() {
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
    indoVoices.find((v) => v.name.toLowerCase().includes("google")) ||
    indoVoices.find((v) => v.name.toLowerCase().includes("gadis")) ||
    indoVoices.find((v) => !v.name.toLowerCase().includes("andika")) ||
    indoVoices[0]
  );
}

// Lapis Pengaman Pasti Bunyi: Web Speech API dengan prosodi ceria/santai gaya Lyra
function playBrowserLyraVoice(text, onStart, onEnd) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    if (onEnd) onEnd();
    return;
  }

  window.speechSynthesis.cancel();

  const sentences = text
    .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
    ?.map((s) => s.trim())
    .filter(Boolean) || [text];

  const bestVoice = getBestFemaleIndoVoice();
  let idx = 0;
  let hasStarted = false;

  const speakNext = () => {
    if (isStopped || idx >= sentences.length) {
      if (onEnd) onEnd();
      return;
    }

    const sentence = sentences[idx];
    const utterance = new SpeechSynthesisUtterance(sentence);
    if (bestVoice) utterance.voice = bestVoice;
    utterance.lang = "id-ID";

    // Intonasi santai & ekspresif ala remaja (tidak datar/kaku)
    const isQuestion = sentence.endsWith("?");
    const isExclamation = sentence.endsWith("!");
    utterance.rate = isExclamation ? 1.15 : 1.12;
    utterance.pitch = isQuestion ? 1.18 : isExclamation ? 1.16 : 1.12;

    utterance.onstart = () => {
      if (!hasStarted) {
        hasStarted = true;
        if (onStart) onStart();
      }
    };

    utterance.onend = () => {
      idx++;
      speakNext();
    };

    utterance.onerror = () => {
      idx++;
      speakNext();
    };

    window.speechSynthesis.speak(utterance);
  };

  speakNext();
}

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

// Lapis 2: Streaming Google Voice (Dengan fallback instan ke Browser Lyra Voice jika diblokir)
function playCloudStreamWithFallback(text, onStart, onEnd) {
  const chunks = splitTextIntoChunks(text);
  if (chunks.length === 0) {
    if (onEnd) onEnd();
    return;
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
    ];

    const audio = new Audio(urls[serverTry]);
    audio.referrerPolicy = "no-referrer";
    audio.playbackRate = 1.14; // Lebih luwes & tidak mengeja kaku
    currentAudio = audio;

    audio.onplaying = () => {
      if (!hasStarted) {
        hasStarted = true;
        if (onStart) onStart();
      }
    };

    audio.onended = () => {
      if (!isStopped) playChunk(index + 1, 0);
    };

    audio.onerror = () => {
      if (isStopped) return;
      if (serverTry < 1) {
        playChunk(index, serverTry + 1);
      } else if (!hasStarted) {
        // Jika streaming diblokir jaringan/browser, langsung gunakan suara browser
        playBrowserLyraVoice(text, onStart, onEnd);
      } else if (onEnd) {
        onEnd();
      }
    };

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        if (isStopped) return;
        if (!hasStarted) {
          playBrowserLyraVoice(text, onStart, onEnd);
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

  // 1. Coba Gemini Lyra/Leda (Maksimal 2.8 detik, jika gagal langsung lewati)
  const wavUrl = await fetchQuickGeminiLyra(cleanText);
  if (isStopped) return;

  if (wavUrl) {
    const audio = new Audio(wavUrl);
    audio.playbackRate = 1.04;
    currentAudio = audio;

    audio.onplaying = () => {
      if (onStart) onStart();
    };

    audio.onended = () => {
      URL.revokeObjectURL(wavUrl);
      if (onEnd) onEnd();
    };

    audio.onerror = () => {
      URL.revokeObjectURL(wavUrl);
      playCloudStreamWithFallback(cleanText, onStart, onEnd);
    };

    try {
      await audio.play();
      return;
    } catch {
      URL.revokeObjectURL(wavUrl);
    }
  }

  // 2. Jika Gemini TTS limit, jalankan Cloud Stream + Pengaman Browser Lyra Voice
  playCloudStreamWithFallback(cleanText, onStart, onEnd);
}
