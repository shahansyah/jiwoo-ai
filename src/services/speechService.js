const GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY || "").trim();

let activeAudio = null;
let activeRecognition = null;
let isStopped = false;

export function startListening(onStart, onResult, onError) {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    if (onError) {
      onError(
        "Browser kamu belum mendukung fitur suara. Gunakan Chrome atau ketik di kolom chat ya!",
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
        "Izin mikrofon belum aktif. Klik ikon pengaturan di sebelah alamat web untuk mengizinkan mikrofon ya.";
    }
    if (onError) onError(msg);
  };

  recognition.onend = () => {
    activeRecognition = null;
  };

  try {
    recognition.start();
  } catch {
    if (onError) onError("Gagal menyalakan mikrofon. Coba klik sekali lagi ya.");
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
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.removeAttribute("src");
      activeAudio = null;
    } catch {
      // Abaikan
    }
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

// Konversi PCM 24kHz dari Gemini Native Voice ke WAV
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

// Meminta suara ekspresif & santai dari Gemini Native Audio (Voice: Aoede)
async function fetchExpressiveGeminiVoice(text) {
  if (!GEMINI_API_KEY) return null;

  const controller = new AbortController();
  // Batasi maksimal 4 detik agar user tidak menunggu lama jika jaringan padat
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${GEMINI_API_KEY}`,
      {
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
                  text:
                    "Ucapkan kalimat bahasa Indonesia berikut dengan nada bicara gadis muda yang super ramah, santai, ekspresif, ceria, dan tidak kaku seperti sedang mengobrol akrab dengan sahabat:\n\n" +
                    text,
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: "Aoede",
                },
              },
            },
          },
        }),
      },
    );

    clearTimeout(timeoutId);
    if (!response.ok) return null;

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

function splitTextIntoChunks(text) {
  const clean = (text || "")
    .replace(/[*#_~`]/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return [];

  const sentences = clean.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + " " + sentence).trim().length <= 165) {
      current = (current + " " + sentence).trim();
    } else {
      if (current) chunks.push(current);
      current = sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function speakText(text, onStart, onEnd) {
  stopSpeaking();
  isStopped = false;

  const cleanText = (text || "")
    .replace(/[*#_~`]/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .trim();

  if (!cleanText) {
    if (onEnd) onEnd();
    return;
  }

  // 1. Prioritaskan Suara Ekspresif Gemini (Aoede) agar tidak terdengar kaku/robotik
  const expressiveWavUrl = await fetchExpressiveGeminiVoice(cleanText);
  if (isStopped) return;

  if (expressiveWavUrl) {
    const audio = new Audio(expressiveWavUrl);
    activeAudio = audio;

    if (onStart) onStart();

    audio.onended = () => {
      URL.revokeObjectURL(expressiveWavUrl);
      if (onEnd) onEnd();
    };

    audio.onerror = () => {
      URL.revokeObjectURL(expressiveWavUrl);
      playFastStreamFallback(cleanText, onStart, onEnd);
    };

    audio.play().catch(() => {
      playFastStreamFallback(cleanText, onStart, onEnd);
    });
    return;
  }

  // 2. Jika Gemini TTS sedang sibuk/limit, putar stream cadangan dengan tempo lebih ceria (1.12x)
  playFastStreamFallback(cleanText, onStart, onEnd);
}

function playFastStreamFallback(text, onStart, onEnd) {
  const chunks = splitTextIntoChunks(text);
  if (chunks.length === 0) {
    if (onEnd) onEnd();
    return;
  }

  let hasStarted = false;

  const playChunk = (index, useBackup = false) => {
    if (isStopped || index >= chunks.length) {
      if (onEnd) onEnd();
      return;
    }

    const encoded = encodeURIComponent(chunks[index]);
    const url = useBackup
      ? "https://clients5.google.com/translate_tts?ie=UTF-8&client=dict-chrome-ex&tl=id&q=" +
        encoded
      : "https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=id&q=" +
        encoded;

    const audio = document.createElement("audio");
    audio.referrerPolicy = "no-referrer";
    audio.src = url;
    // Tempo 1.12x menghilangkan kesan lambat/formal pada pembacaan kalimat bahasa Indonesia
    audio.playbackRate = 1.12;
    activeAudio = audio;

    audio.onplaying = () => {
      if (!hasStarted) {
        hasStarted = true;
        if (onStart) onStart();
      }
    };

    audio.onended = () => {
      if (!isStopped) playChunk(index + 1, false);
    };

    audio.onerror = () => {
      if (!useBackup) {
        playChunk(index, true);
      } else if (onEnd) {
        onEnd();
      }
    };

    audio.play().catch(() => {
      if (!useBackup) {
        playChunk(index, true);
      } else if (onEnd) {
        onEnd();
      }
    });
  };

  playChunk(0, false);
}