let currentAudio = null;
let activeRecognition = null;
let currentSessionId = 0;

// Pilih karakter suara Neural:
// "id-ID-GadisNeural" (Cewek muda/santai) atau "id-ID-ArdiNeural" (Cowok santai)
const VOICE_NAME = "id-ID-GadisNeural";
const VOICE_RATE = "+14%"; // Kecepatan ngobrol santai
const VOICE_PITCH = "+8Hz"; // Nada sedikit lebih muda/ceria

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
      currentAudio = null;
    } catch {
      // Abaikan
    }
  }
}

function cleanTextForSpeech(text) {
  return (text || "")
    .replace(/\[CBT:[\s\S]*?\]/gi, "")
    .replace(/[*#_~`]/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function speakText(text, onStart, onEnd) {
  stopSpeaking();
  const mySessionId = ++currentSessionId;

  const cleanText = cleanTextForSpeech(text);
  if (!cleanText) {
    if (onEnd) onEnd();
    return;
  }

  const params = new URLSearchParams({
    text: cleanText,
    voice: VOICE_NAME,
    rate: VOICE_RATE,
    pitch: VOICE_PITCH,
  });

  const audio = new Audio(`/api/tts?${params.toString()}`);
  currentAudio = audio;

  audio.onplaying = () => {
    if (mySessionId !== currentSessionId) {
      audio.pause();
      return;
    }
    if (onStart) onStart();
  };

  audio.onended = () => {
    if (mySessionId === currentSessionId && onEnd) {
      onEnd();
    }
  };

  audio.onerror = () => {
    if (mySessionId === currentSessionId && onEnd) {
      onEnd();
    }
  };

  try {
    await audio.play();
  } catch (err) {
    console.warn("Gagal memutar /api/tts:", err);
    if (mySessionId === currentSessionId && onEnd) {
      onEnd();
    }
  }
}
