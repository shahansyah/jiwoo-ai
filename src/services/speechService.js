const GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY || "").trim();

// ====== PENGATURAN SUARA (ubah di sini) ======
// Pilihan suara perempuan: "Aoede" (breezy), "Callirrhoe" (easy-going),
// "Achernar" (soft), "Vindemiatrix" (gentle), "Sulafat" (warm), "Leda" (youthful)
const VOICE_NAME = "Aoede";
const VOICE_STYLE =
  "Say this in Indonesian, softly and slowly, in a relaxed, laid-back, comforting tone, like a close friend talking to you late at night. Smile a little while speaking. Natural pauses, never in an announcer or navigation-voice style:";
// ==============================================

let currentAudio = null;
let activeRecognition = null;
let currentSessionId = 0; // Mengunci agar suara tidak pernah berulang / tumpang tindih
let cachedVoices = [];
let lastSpeak = { text: "", time: 0 }; // Guard anti panggilan ganda (StrictMode / double klik)

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  const loadVoices = () => {
    cachedVoices = window.speechSynthesis.getVoices() || [];
  };
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

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
    // Abaikan
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
  currentSessionId++;
  if (currentAudio) {
    try {
      currentAudio.onplaying = null;
      currentAudio.onended = null;
      currentAudio.onerror = null;
      currentAudio.pause();
    } catch {
      // Abaikan
    }
    currentAudio = null;
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

// Bersihkan teks supaya enak diucapkan. Jangan ubah kata di sini:
// gaya santai sudah diatur lewat prompt di geminiService.
function makeConversationalIndonesian(text) {
  return (text || "")
    .replace(/\[CBT:[\s\S]*?\]/gi, "")
    .replace(/[*#_~`]/g, "")
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "")
    .replace(/\bsaya\b/gi, "aku")
    .replace(/\s*\n+\s*/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

// Lapis 1: Gemini TTS, suara "Leda"
async function fetchGeminiLyraAudio(text, sessionId) {
  if (!GEMINI_API_KEY) return null;

  const controller = new AbortController();
  // 6,5 detik terlalu pendek untuk model TTS -> sering jatuh ke suara robot
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent";

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
                text: `${VOICE_STYLE}\n\n${text}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: VOICE_NAME },
            },
          },
        },
      }),
    });

    clearTimeout(timeoutId);
    if (sessionId !== currentSessionId) return null;

    if (!response.ok) {
      console.warn(
        "[Gemini TTS] gagal:",
        response.status,
        await response.text(),
      );
      return null;
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const inlineData = parts.find((p) => p.inlineData?.data)?.inlineData;
    if (inlineData?.data) {
      return pcmBase64ToWavUrl(inlineData.data, 24000);
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn("[Gemini TTS] error/timeout:", err?.message || err);
  }
  return null;
}

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

// Lapis 2 (fallback): satu utterance utuh
function playSingleUtteranceVoice(text, sessionId, onStart, onEnd) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    if (onEnd) onEnd();
    return;
  }
  if (sessionId !== currentSessionId) return;

  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
  const bestVoice = getBestFemaleVoice();
  if (bestVoice) utterance.voice = bestVoice;
  utterance.lang = "id-ID";

  // Dibuat mendekati normal supaya tidak terdengar seperti robot/chipmunk
  utterance.rate = 1.0;
  utterance.pitch = 1.05;
  utterance.volume = 1.0;

  let finished = false;
  const finishOnce = () => {
    if (finished || sessionId !== currentSessionId) return;
    finished = true;
    if (onEnd) onEnd();
  };

  utterance.onstart = () => {
    if (sessionId !== currentSessionId) {
      synth.cancel();
      return;
    }
    if (onStart) onStart();
  };
  utterance.onend = finishOnce;
  utterance.onerror = finishOnce;

  const speak = () => {
    if (sessionId !== currentSessionId) return;
    synth.speak(utterance);
  };

  // Chrome bug: cancel() lalu langsung speak() bikin kalimat terulang/terpotong.
  // Beri jeda kecil kalau synth masih sibuk.
  if (synth.speaking || synth.pending) {
    synth.cancel();
    setTimeout(speak, 120);
  } else {
    speak();
  }
}

export async function speakText(text, onStart, onEnd) {
  const cleanText = makeConversationalIndonesian(text);
  if (!cleanText) {
    if (onEnd) onEnd();
    return;
  }

  // Abaikan panggilan ganda untuk teks yang sama dalam waktu sangat dekat
  const now = Date.now();
  if (cleanText === lastSpeak.text && now - lastSpeak.time < 1500) {
    return;
  }
  lastSpeak = { text: cleanText, time: now };

  stopSpeaking();
  const mySessionId = ++currentSessionId;

  let wavUrl = await fetchGeminiLyraAudio(cleanText, mySessionId);
  if (!wavUrl && mySessionId === currentSessionId) {
    wavUrl = await fetchGeminiLyraAudio(cleanText, mySessionId); // coba sekali lagi
  }

  if (mySessionId !== currentSessionId) {
    if (wavUrl) URL.revokeObjectURL(wavUrl);
    return;
  }

  if (!wavUrl) {
    playSingleUtteranceVoice(cleanText, mySessionId, onStart, onEnd);
    return;
  }

  const audio = new Audio(wavUrl);
  currentAudio = audio;

  let started = false; // sudah benar-benar bunyi?
  let done = false;

  const cleanup = () => URL.revokeObjectURL(wavUrl);

  const finish = () => {
    if (done) return;
    done = true;
    cleanup();
    if (mySessionId === currentSessionId && onEnd) onEnd();
  };

  audio.onplaying = () => {
    if (mySessionId !== currentSessionId) {
      audio.pause();
      return;
    }
    if (!started) {
      started = true; // onStart hanya sekali
      if (onStart) onStart();
    }
  };

  audio.onended = finish;

  audio.onerror = () => {
    if (done || mySessionId !== currentSessionId) return;
    if (started) {
      // Sudah sempat bunyi -> JANGAN fallback (itu penyebab suara mengulang dari awal)
      finish();
      return;
    }
    done = true;
    cleanup();
    playSingleUtteranceVoice(cleanText, mySessionId, onStart, onEnd);
  };

  try {
    await audio.play();
  } catch {
    if (done || started || mySessionId !== currentSessionId) return;
    done = true;
    cleanup();
    playSingleUtteranceVoice(cleanText, mySessionId, onStart, onEnd);
  }
}
