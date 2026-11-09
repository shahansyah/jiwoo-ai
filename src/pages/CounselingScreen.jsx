import { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Send,
  Sparkles,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import JiwooInteractiveMascot from "../components/JiwooInteractiveMascot";
import BottomNavbar from "../components/BottomNavbar";
import { getJiwooResponse, resetJiwooMemory } from "../services/geminiService";
import {
  startListening,
  stopListening,
  speakText,
  stopSpeaking,
  unlockSpeechAudio,
} from "../services/speechService";
import { getCurrentUser } from "../services/authService";

export default function CounselingScreen({ setScreen }) {
  const currentUser = getCurrentUser();
  const firstName = (currentUser.name || "Teman").split(" ")[0].toUpperCase();
  const initialGreeting = `Hai ${firstName}! Aku Jiwoo, teman curhatmu. Lagi ada cerita seru atau lagi ada yang bikin kepikiran hari ini? Ceritain aja yuk!`;

  const [messages, setMessages] = useState([
    {
      id: "welcome-msg",
      sender: "jiwoo",
      text: initialGreeting,
      distortion: null,
      reframing: null,
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const fallbackTimerRef = useRef(null);
  const chatContainerRef = useRef(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isLoading]);

  const triggerJiwooSpeech = (text) => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);

    if (isMuted) {
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    const startTime = Date.now();
    const words = (text || "").trim().split(/\s+/).length;
    const minDurationMs = Math.min(Math.max(words * 380, 3500), 18000);

    fallbackTimerRef.current = setTimeout(() => {
      setIsSpeaking(false);
    }, minDurationMs);

    speakText(
      text,
      () => setIsSpeaking(true),
      () => {
        const elapsed = Date.now() - startTime;
        if (elapsed > 1800) {
          if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
          setIsSpeaking(false);
        }
      }
    );
  };

  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      stopSpeaking();
      stopListening();
    };
  }, []);

  const isUserTyping = inputText.trim().length > 0 && !isLoading;

  const getJiwooInteractiveState = () => {
    if (isListening || isUserTyping) {
      return {
        mode: "listening",
        statusText: isListening
          ? "Mendengarkan Suaramu..."
          : "Menyimak Curhatanmu...",
        badgeText: isListening
          ? "Aku sedang menyimak suaramu..."
          : "Aku menyimak tulisanmu...",
        badgeColor: isListening
          ? "bg-red-500 text-white"
          : "bg-[#F4A950] text-[#4A3525]",
        ringColor: isListening
          ? "border-red-500 bg-red-400/25"
          : "border-[#F4A950] bg-[#F4A950]/20",
      };
    }
    if (isLoading) {
      return {
        mode: "thinking",
        statusText: "Merangkai Nasihat & Saran Terbaik...",
        badgeText: "Hmm, merangkai saran...",
        badgeColor: "bg-white text-[#4A3525]",
        ringColor: "border-[#4A3525]/40 bg-[#F6E4CE]/40",
      };
    }
    if (isSpeaking) {
      return {
        mode: "explaining",
        statusText: "Jiwoo Sedang Menjelaskan Nasihat",
        badgeText: "Sedang berbicara & menasihati...",
        badgeColor: "bg-green-600 text-white",
        ringColor: "border-green-500 bg-green-300/25",
      };
    }
    return {
      mode: "greeting",
      statusText:
        messages.length > 1
          ? "Siap Mendengarkan Cerita Lanjutan"
          : "Menyapa & Siap Mendengarkan",
      badgeText:
        messages.length > 1 ? "Ceritakan lagi yuk!" : `Hai ${firstName}!`,
      badgeColor: "bg-[#FDF3E7] text-[#4A3525]",
      ringColor: "",
    };
  };

  const uiState = getJiwooInteractiveState();

  const sendMessageToJiwoo = async (rawText) => {
    const trimmed = (rawText || "").trim();
    if (!trimmed || isLoading) return;

    // Buka kunci autoplay audio browser tepat saat aksi pengguna terjadi
    unlockSpeechAudio();
    stopSpeaking();
    setIsSpeaking(false);

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);

    try {
      const response = await getJiwooResponse(trimmed);
      const jiwooMsg = {
        id: `jiwoo-${Date.now()}`,
        sender: "jiwoo",
        text: response.reply,
        distortion: response.distortion,
        reframing: response.reframing,
      };
      setMessages((prev) => [...prev, jiwooMsg]);
      setIsLoading(false);
      triggerJiwooSpeech(response.reply);
    } catch {
      const fallbackReply =
        "Maaf ya, koneksi lagi agak kurang stabil nih. Tarik napas pelan-pelan, terus coba kirim lagi ceritamu ya!";
      setMessages((prev) => [
        ...prev,
        {
          id: `jiwoo-err-${Date.now()}`,
          sender: "jiwoo",
          text: fallbackReply,
          distortion: null,
          reframing: null,
        },
      ]);
      setIsLoading(false);
      triggerJiwooSpeech(fallbackReply);
    }
  };

  const handleTextSubmit = async (e) => {
    e.preventDefault();
    await sendMessageToJiwoo(inputText);
  };

  const handleMicClick = () => {
    if (isLoading) return;
    unlockSpeechAudio();

    if (isListening) {
      stopListening();
      setIsListening(false);
      return;
    }

    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    stopSpeaking();
    setIsSpeaking(false);

    startListening(
      () => setIsListening(true),
      async (transcript) => {
        setIsListening(false);
        if (transcript && transcript.trim()) {
          await sendMessageToJiwoo(transcript);
        }
      },
      (errMessage) => {
        setIsListening(false);
        if (errMessage) {
          setMessages((prev) => [
            ...prev,
            {
              id: `jiwoo-mic-info-${Date.now()}`,
              sender: "jiwoo",
              text: errMessage,
              distortion: null,
              reframing: null,
            },
          ]);
        }
      }
    );
  };

  const handleResetSession = () => {
    unlockSpeechAudio();
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    stopSpeaking();
    stopListening();
    resetJiwooMemory();
    setIsListening(false);
    setIsSpeaking(false);
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: "jiwoo",
        text: initialGreeting,
        distortion: null,
        reframing: null,
      },
    ]);
    triggerJiwooSpeech(initialGreeting);
  };

  const toggleMute = () => {
    unlockSpeechAudio();
    if (!isMuted) {
      stopSpeaking();
      setIsSpeaking(false);
    }
    setIsMuted(!isMuted);
  };

  const lastJiwooMessage =
    [...messages].reverse().find((m) => m.sender === "jiwoo") || messages[0];

  const handleReplayLastMessage = () => {
    unlockSpeechAudio();
    triggerJiwooSpeech(lastJiwooMessage.text);
  };

  return (
    <div className="relative z-10 flex flex-col justify-center w-full max-w-6xl mx-auto h-[calc(100dvh-56px)] md:h-dvh overflow-hidden px-3 sm:px-6 pt-1 pb-18.5 max-md:landscape:pb-17 md:py-5">
      <div className="flex-1 min-h-0 w-full flex flex-col max-md:landscape:flex-row md:grid md:grid-cols-12 gap-1.5 max-md:landscape:gap-3 md:gap-6 items-center md:items-stretch">
        {/* PANEL KIRI: Panggung Maskot Interaktif Jiwoo */}
        <div className="shrink-0 max-md:landscape:w-[38%] md:col-span-5 flex flex-col items-center justify-center bg-transparent md:bg-[#F6E4CE]/85 md:border-2 md:border-[#4A3525] md:rounded-3xl py-0.5 md:p-5 text-center md:shadow-md">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FDF3E7] border border-[#4A3525]/25 text-[10px] font-bold text-[#4A3525] mb-1 shadow-2xs">
            <Sparkles className="text-[#F4A950] shrink-0" size={12} />
            <span className="truncate">Status Jiwoo: {uiState.statusText}</span>
          </span>

          <div className="relative flex flex-col items-center justify-center my-1">
            {(uiState.mode === "listening" ||
              uiState.mode === "explaining") && (
              <div
                className={`absolute w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 rounded-full border-2 animate-ping opacity-35 pointer-events-none ${uiState.ringColor}`}
              />
            )}

            <div
              className={`mb-1 z-20 px-3 py-0.5 rounded-full border-2 border-[#4A3525] text-[9.5px] sm:text-[10px] font-bold shadow-2xs transition-all duration-300 flex items-center gap-1.5 ${uiState.badgeColor}`}
            >
              {uiState.mode === "explaining" && (
                <Volume2 className="animate-bounce" size={11} />
              )}
              <span>{uiState.badgeText}</span>
            </div>

            <JiwooInteractiveMascot
              mode={uiState.mode}
              onClick={handleReplayLastMessage}
              className="relative z-10 w-32 h-28 sm:w-40 sm:h-36 max-md:landscape:w-28 max-md:landscape:h-24 md:w-56 md:h-52"
            />

            {uiState.mode === "explaining" && (
              <div className="mt-1 flex items-end gap-1 h-3.5">
                <span className="w-1.5 h-2.5 bg-[#F4A950] border border-[#4A3525] rounded-full animate-bounce" />
                <span className="w-1.5 h-3.5 bg-[#4A3525] rounded-full animate-pulse" />
                <span className="w-1.5 h-2 bg-[#F4A950] border border-[#4A3525] rounded-full animate-bounce" />
                <span className="w-1.5 h-3.5 bg-[#4A3525] rounded-full animate-pulse" />
                <span className="w-1.5 h-2.5 bg-[#F4A950] border border-[#4A3525] rounded-full animate-bounce" />
              </div>
            )}
          </div>

          <p className="hidden md:block mt-3 text-xs text-[#4A3525]/75 max-w-xs leading-relaxed">
            Klik ikon mikrofon untuk berbicara langsung atau ketikkan curhatanmu
            di ruang chat sebelah kanan.
          </p>

          <div className="hidden md:flex flex-wrap items-center justify-center gap-2.5 mt-4">
            <button
              type="button"
              onClick={handleResetSession}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-[#FDF3E7] border border-[#4A3525]/35 text-xs font-bold text-[#4A3525] transition-all cursor-pointer shadow-2xs"
            >
              <RotateCcw size={12} /> Bersihkan Obrolan
            </button>
            <button
              type="button"
              onClick={toggleMute}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-[#FDF3E7] border border-[#4A3525]/35 text-xs font-bold text-[#4A3525] transition-all cursor-pointer shadow-2xs"
            >
              {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
              {isMuted ? "Suara Mati" : "Suara Aktif"}
            </button>
          </div>
        </div>

        {/* PANEL KANAN: Ruang Chat Fleksibel */}
        <div className="flex-1 min-h-0 max-md:landscape:w-[62%] md:col-span-7 flex flex-col justify-between w-full max-w-md md:max-w-none mx-auto bg-transparent md:bg-[#FDF3E7]/90 md:border-2 md:border-[#4A3525] md:rounded-3xl md:p-5 md:shadow-md overflow-hidden">
          <div
            ref={chatContainerRef}
            className="flex-1 min-h-0 overflow-y-auto px-1 sm:px-2 pt-2 pb-4 space-y-5"
          >
            {messages.map((msg) =>
              msg.sender === "jiwoo" ? (
                <div key={msg.id} className="w-full space-y-3 animate-pop-1">
                  <div className="relative w-[96%] mb-5">
                    <div
                      className="absolute inset-0 translate-x-1.5 translate-y-1.5 bg-[#1E1B18]"
                      style={{ borderRadius: "28px" }}
                    />
                    <div
                      className="relative bg-white border-[3px] border-[#1E1B18] px-4 py-3 sm:px-6 sm:py-4 text-left"
                      style={{ borderRadius: "28px" }}
                    >
                      <svg
                        className="absolute top-2.5 right-3.5 w-7 h-7 sm:w-10 sm:h-10 pointer-events-none"
                        viewBox="0 0 60 60"
                        fill="none"
                      >
                        <path
                          d="M 10 8 C 34 8, 48 22, 48 46"
                          stroke="#1E1B18"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                        />
                      </svg>

                      <div className="flex items-center justify-between pr-7 mb-1">
                        <span className="text-[9.5px] sm:text-[10px] font-extrabold uppercase tracking-wider text-[#F4A950]">
                          Nasihat & Konseling Jiwoo
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            unlockSpeechAudio();
                            triggerJiwooSpeech(msg.text);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-[#4A3525]/80 hover:text-[#4A3525] cursor-pointer"
                        >
                          <Volume2 size={12} /> Putar Suara
                        </button>
                      </div>

                      <p className="text-xs sm:text-sm font-bold text-[#1E1B18] leading-relaxed pr-2 whitespace-pre-line">
                        {msg.text}
                      </p>
                    </div>

                    <svg
                      className="absolute -bottom-5 left-8 w-11 h-6 pointer-events-none z-10"
                      viewBox="0 0 70 42"
                      fill="none"
                    >
                      <path
                        d="M 22 4 C 24 20, 32 32, 45 40 C 38 26, 40 12, 46 4 Z"
                        fill="#1E1B18"
                      />
                      <path
                        d="M 10 0 C 13 18, 24 31, 38 38 C 30 24, 30 11, 35 0 Z"
                        fill="#FFFFFF"
                      />
                      <path
                        d="M 10 2 C 13 18, 24 31, 38 38 C 30 24, 30 11, 35 2"
                        stroke="#1E1B18"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  {msg.reframing &&
                    msg.distortion &&
                    msg.distortion !== "Mode Offline" && (
                      <div className="w-[96%] bg-[#F4A950]/90 border-2 border-[#4A3525] rounded-2xl p-3 text-left shadow-xs">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#4A3525] underline mb-0.5">
                          <Sparkles size={13} />
                          Pola Pikir Terdeteksi: {msg.distortion}
                        </div>
                        <p className="text-[11px] sm:text-xs text-[#4A3525] leading-relaxed">
                          <strong>Saran & Nasihat CBT:</strong> {msg.reframing}
                        </p>
                      </div>
                    )}
                </div>
              ) : (
                <div key={msg.id} className="flex justify-end w-full pr-1">
                  <div className="bg-[#4A3525] text-[#FDF3E7] border-2 border-[#1E1B18] rounded-3xl rounded-tr-xs px-4 py-2.5 max-w-[85%] text-xs sm:text-sm font-medium text-left shadow-xs">
                    {msg.text}
                  </div>
                </div>
              )
            )}

            {isLoading && (
              <div className="w-fit bg-white border-2 border-[#1E1B18] rounded-full px-4 py-2 text-xs font-bold text-[#4A3525] animate-pulse">
                Jiwoo sedang merangkai saran & nasihat untukmu...
              </div>
            )}
          </div>

          {/* Form Input Suara (Mic) & Ketikan Chat */}
          <form
            onSubmit={handleTextSubmit}
            className="w-full pt-2.5 pb-1 md:pb-0 md:border-t-2 md:border-[#4A3525]/15 flex items-center gap-1.5 sm:gap-2 shrink-0 bg-transparent"
          >
            <button
              type="button"
              onClick={toggleMute}
              title={isMuted ? "Aktifkan Suara Jiwoo" : "Matikan Suara Jiwoo"}
              className="md:hidden p-2.5 rounded-full bg-white border-2 border-[#1E1B18] text-[#1E1B18] shrink-0 shadow-2xs"
            >
              {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>

            <button
              type="button"
              onClick={handleMicClick}
              disabled={isLoading}
              title={
                isListening
                  ? "Klik untuk berhenti mendengarkan"
                  : "Klik untuk bicara langsung ke Jiwoo"
              }
              aria-label="Bicara menggunakan mikrofon"
              className={`p-2.5 sm:px-3.5 sm:py-2.5 rounded-full border-2 border-[#1E1B18] font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-2xs ${
                isListening
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-white hover:bg-[#F6E4CE] text-[#1E1B18] active:scale-95"
              }`}
            >
              {isListening ? <MicOff size={15} /> : <Mic size={15} />}
              <span className="hidden sm:inline">
                {isListening ? "Mendengarkan..." : "Bicara"}
              </span>
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                isListening
                  ? "Silakan bicara, Jiwoo sedang mendengarkan..."
                  : "Bicara lewat mic atau ketik di sini..."
              }
              className="flex-1 min-w-0 bg-white border-2 border-[#1E1B18] rounded-full px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-[#1E1B18] placeholder:text-[#4A3525]/50 focus:outline-none focus:ring-2 focus:ring-[#F4A950]"
            />

            <button
              type="submit"
              disabled={isLoading || !inputText.trim()}
              aria-label="Kirim Pesan"
              className="bg-[#F4A950] hover:bg-[#e5983e] disabled:opacity-50 border-2 border-[#1E1B18] text-[#1E1B18] p-2.5 sm:p-3 rounded-full transition-all cursor-pointer shrink-0 shadow-2xs"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      </div>

      <BottomNavbar
        activeScreen={5}
        setScreen={setScreen}
        onCenterClick={handleMicClick}
      />
    </div>
  );
}