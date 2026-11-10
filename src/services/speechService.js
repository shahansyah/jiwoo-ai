let currentAudio = null;
let activeRecognition = null;
let currentSessionId = 0; // Mencegah suara tumpang tindih atau berulang
let cachedVoices = [];

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  const loadVoices = () => {
    cachedVoices = window.speechSynthesis.getVoices() || [];
  };
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

// Membuka izin AudioContext browser saat tombol Kirim / Mic / Putar diklik
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

// Membersihkan simbol markdown, emoji, dan tag CBT agar tidak ikut terbaca
function cleanTextForTts(text) {
  return (text || "")
    .replace(/\[CBT:[\s\S]*?\]/gi, "")
    .replace(/[*#_~`]/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Memecah kalimat menjadi potongan <= 180 karakter agar diterima oleh TikTok TTS API
function splitTextIntoChunks(text, maxLength = 180) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + " " + sentence).trim().length <= maxLength) {
      current = (current + " " + sentence).trim();
    } else {
      if (current) chunks.push(current);
      if (sentence.length <= maxLength) {
        current = sentence;
      } else {
        const words = sentence.split(/\s+/);
        let temp = "";
        for (const w of words) {
          if ((temp + " " + w).trim().length <= maxLength) {
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

// Mengambil audio MP3 Base64 dari TikTok TTS Proxy (Voice: id_001 - Gadis Indonesia)
async function fetchTikTokChunkAudio(chunkText, sessionId) {
  // Daftar endpoint proxy TikTok TTS publik
  const endpoints = [
    {
      url: "https://tiktok-tts.weilnet.workers.dev/api/generation",
      parse: async (res) => {
        const json = await res.json();
        return json?.data ? `data:audio/mp3;base64,${json.data}` : null;
      },
    },
    {
      url: "https://gesserit.co/api/tiktok-tts",
      parse: async (res) => {
        const json = await res.json();
        return json?.base64
          ? `data:audio/mp3;base64,${json.base64}`
          : json?.data
            ? `data:audio/mp3;base64,${json.data}`
            : null;
      },
    },
  ];

  for (const ep of endpoints) {
    if (sessionId !== currentSessionId) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    try {
      const response = await fetch(ep.url, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: chunkText,
          voice: "id_001", // Kode resmi suara wanita Indonesia TikTok
        }),
      });

      clearTimeout(timeoutId);
      if (response.ok) {
        const audioDataUrl = await ep.parse(response);
        if (audioDataUrl) return audioDataUrl;
      }
    } catch {
      clearTimeout(timeoutId);
    }
  }

  return null;
}

// Cadangan jika seluruh server TikTok sedang sibuk
function playFallbackBrowserVoice(text, sessionId, onStart, onEnd) {
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

  const voices =
    cachedVoices.length > 0
      ? cachedVoices
      : window.speechSynthesis.getVoices() || [];
  const indoVoices = voices.filter((v) =>
    v.lang.toLowerCase().replace("_", "-").includes("id"),
  );

  const femaleVoice =
    indoVoices.find((v) => v.name.toLowerCase().includes("gadis")) ||
    indoVoices.find((v) => v.name.toLowerCase().includes("google")) ||
    indoVoices.find((v) => !v.name.toLowerCase().includes("andika")) ||
    indoVoices[0];

  if (femaleVoice) utterance.voice = femaleVoice;
  utterance.lang = "id-ID";
  utterance.rate = 1.12;
  utterance.pitch = 1.15;

  let finished = false;
  const done = () => {
    if (finished || sessionId !== currentSessionId) return;
    finished = true;
    if (onEnd) onEnd();
  };

  utterance.onstart = () => {
    if (sessionId === currentSessionId && onStart) onStart();
  };
  utterance.onend = done;
  utterance.onerror = done;

  window.speechSynthesis.speak(utterance);
}

export async function speakText(text, onStart, onEnd) {
  stopSpeaking();
  const mySessionId = ++currentSessionId;

  const cleanText = cleanTextForTts(text);
  if (!cleanText) {
    if (onEnd) onEnd();
    return;
  }

  const chunks = splitTextIntoChunks(cleanText, 180);
  if (chunks.length === 0) {
    if (onEnd) onEnd();
    return;
  }

  // Ambil potongan kalimat pertama terlebih dahulu untuk mengecek ketersediaan TikTok TTS
  const firstAudioSrc = await fetchTikTokChunkAudio(chunks[0], mySessionId);
  if (mySessionId !== currentSessionId) return;

  // Jika server TikTok TTS gagal/down, langsung gunakan fallback sekali saja (anti-looping)
  if (!firstAudioSrc) {
    playFallbackBrowserVoice(cleanText, mySessionId, onStart, onEnd);
    return;
  }

  let hasStarted = false;

  const playChunkAt = async (index, preloadedSrc = null) => {
    if (mySessionId !== currentSessionId || index >= chunks.length) {
      if (mySessionId === currentSessionId && onEnd) onEnd();
      return;
    }

    const audioSrc =
      preloadedSrc || (await fetchTikTokChunkAudio(chunks[index], mySessionId));

    if (mySessionId !== currentSessionId) return;

    if (!audioSrc) {
      if (mySessionId === currentSessionId && onEnd) onEnd();
      return;
    }

    const audio = new Audio(audioSrc);
    audio.playbackRate = 1.02; // Kecepatan natural khas TikTok
    currentAudio = audio;

    audio.onplaying = () => {
      if (mySessionId !== currentSessionId) {
        audio.pause();
        return;
      }
      if (!hasStarted) {
        hasStarted = true;
        if (onStart) onStart();
      }
    };

    audio.onended = () => {
      if (mySessionId === currentSessionId) {
        playChunkAt(index + 1, null);
      }
    };

    audio.onerror = () => {
      if (mySessionId === currentSessionId && onEnd) onEnd();
    };

    try {
      await audio.play();
    } catch {
      if (!hasStarted && mySessionId === currentSessionId) {
        playFallbackBrowserVoice(cleanText, mySessionId, onStart, onEnd);
      } else if (mySessionId === currentSessionId && onEnd) {
        onEnd();
      }
    }
  };

  playChunkAt(0, firstAudioSrc);
}
