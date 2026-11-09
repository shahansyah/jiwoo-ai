let activeAudio = null;
let activeRecognition = null;
let isStopped = false;

export function startListening(onStart, onResult, onError) {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    if (onError) {
      onError(
        "Browser kamu belum mendukung fitur pengenalan suara. Gunakan Google Chrome atau ketik di kolom chat ya!",
      );
    }
    return;
  }

  // Hentikan sesi mic sebelumnya jika masih menggantung
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
    let msg = "Maaf, suaramu kurang terdengar jelas. Coba bicara lagi ya!";
    if (event.error === "not-allowed") {
      msg =
        "Izin mikrofon belum aktif. Klik ikon gembok/pengaturan di samping alamat web untuk mengizinkan mikrofon ya.";
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

function buildTtsUrl(chunkText, serverIndex = 0) {
  const encoded = encodeURIComponent(chunkText);
  if (serverIndex === 0) {
    return (
      "https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=id&q=" +
      encoded
    );
  }
  if (serverIndex === 1) {
    return (
      "https://clients5.google.com/translate_tts?ie=UTF-8&client=dict-chrome-ex&tl=id&q=" +
      encoded
    );
  }
  return (
    "https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=id&q=" +
    encoded
  );
}

export function speakText(text, onStart, onEnd) {
  stopSpeaking();
  isStopped = false;

  const chunks = splitTextIntoChunks(text);
  if (chunks.length === 0) {
    if (onEnd) onEnd();
    return;
  }

  let hasStartedCallback = false;

  const playChunk = (index, serverTry = 0) => {
    if (isStopped || index >= chunks.length) {
      if (onEnd) onEnd();
      return;
    }

    const audio = document.createElement("audio");
    audio.referrerPolicy = "no-referrer";
    audio.preload = "auto";
    audio.src = buildTtsUrl(chunks[index], serverTry);
    audio.playbackRate = 1.06;
    activeAudio = audio;

    if (index + 1 < chunks.length) {
      const nextPreload = document.createElement("audio");
      nextPreload.referrerPolicy = "no-referrer";
      nextPreload.preload = "auto";
      nextPreload.src = buildTtsUrl(chunks[index + 1], 0);
    }

    audio.onplaying = () => {
      if (!hasStartedCallback) {
        hasStartedCallback = true;
        if (onStart) onStart();
      }
    };

    audio.onended = () => {
      if (!isStopped) {
        playChunk(index + 1, 0);
      }
    };

    audio.onerror = () => {
      if (isStopped) return;
      if (serverTry < 2) {
        playChunk(index, serverTry + 1);
      } else {
        fallbackBrowserSpeech(text, hasStartedCallback ? null : onStart, onEnd);
      }
    };

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        if (isStopped) return;
        if (serverTry < 2) {
          playChunk(index, serverTry + 1);
        } else {
          fallbackBrowserSpeech(
            text,
            hasStartedCallback ? null : onStart,
            onEnd,
          );
        }
      });
    }
  };

  const fallbackBrowserSpeech = (fullText, startCb, endCb) => {
    if (!("speechSynthesis" in window)) {
      if (endCb) endCb();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      fullText.replace(/[\u{1F300}-\u{1FAFF}]/gu, ""),
    );
    utterance.lang = "id-ID";
    utterance.rate = 1.05;
    utterance.pitch = 1.05;

    const voices = window.speechSynthesis.getVoices() || [];
    const indoVoice =
      voices.find(
        (v) =>
          v.lang.toLowerCase().includes("id") &&
          v.name.toLowerCase().includes("google"),
      ) || voices.find((v) => v.lang.toLowerCase().includes("id"));

    if (indoVoice) {
      utterance.voice = indoVoice;
    }

    utterance.onstart = () => {
      if (startCb) startCb();
    };
    utterance.onend = () => {
      if (endCb) endCb();
    };
    utterance.onerror = () => {
      if (endCb) endCb();
    };

    window.speechSynthesis.speak(utterance);
  };

  playChunk(0, 0);
}