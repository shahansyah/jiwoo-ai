import { useState } from "react";
import jiwooMascot from "../assets/jiwoo.svg";
import { Sparkles, CheckCircle2, Loader2 } from "lucide-react";

export default function WelcomeScreen({ onNext, isLoggedIn }) {
  const [senderName, setSenderName] = useState("");
  const [category, setCategory] = useState(
    "Konsultasi Lanjut & Curhat Langsung",
  );
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [message, setMessage] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const ratingLabels = {
    1: "Perlu Banyak Perbaikan",
    2: "Cukup Membantu",
    3: "Bagus & Nyaman",
    4: "Sangat Membantu!",
    5: "Luar Biasa! Sangat Direkomendasikan",
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      // Menggunakan Web3Forms API (Gratis & langsung masuk ke Email kamu)
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          apikey: "34c64c96-f181-4cf4-8f94-227401d9f548",
          subject: `[Jiwoo AI Feedback] - ${category}`,
          from_name: senderName.trim() || "Sahabat Jiwoo (Anonim)",
          name: senderName.trim() || "Sahabat Jiwoo (Anonim)",
          category: category,
          rating: `${rating} / 5 (${ratingLabels[rating]})`,
          message: message.trim(),
        }),
      });

      const result = await response.json();
      if (result.success) {
        setIsSubmitted(true);
        setMessage("");
      } else {
        setErrorMsg("Gagal mengirim pesan. Coba beberapa saat lagi.");
      }
    } catch {
      setErrorMsg("Terjadi kesalahan jaringan. Periksa koneksi internetmu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 py-6 md:px-14 md:py-12">
      <div className="max-w-5xl mx-auto flex flex-col gap-8 md:gap-12 pb-16">
        {/* 1. HERO SECTION */}
        <section className="bg-[#F6E4CE]/90 border-2 border-[#4A3525] rounded-3xl p-5 sm:p-6 md:p-10 shadow-[0_6px_0_#4A3525] flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8">
          <div className="flex-1 text-center md:text-left space-y-3.5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FDF3E7] border border-[#4A3525] text-xs font-bold text-[#4A3525]">
              <Sparkles size={14} className="text-[#F4A950]" />
              <span>Teman Cerita & Konseling Virtual Berbasis CBT</span>
            </div>

            <h1 className="text-xl sm:text-2xl md:text-4xl font-bold text-[#4A3525] leading-tight">
              Ruang Aman untuk Meredakan{" "}
              <span className="underline decoration-[#F4A950] decoration-4">
                Overthinking
              </span>{" "}
              & Beban Pikiranmu.
            </h1>

            <p className="text-xs md:text-sm text-[#4A3525]/80 font-sans leading-relaxed">
              Tidak semua beban harus kamu pikul sendirian. Jiwoo hadir 24 jam
              sebagai teman cerita yang siap mendengarkan, menjadi penengah yang
              objektif, serta memberikan saran dan motivasi kapan pun kamu
              membutuhkannya.
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-3">
              <button
                type="button"
                onClick={onNext}
                className="flex items-center gap-2 bg-[#F4A950] hover:bg-[#e5983e] text-[#4A3525] font-bold text-xs md:text-sm px-6 py-3.5 rounded-2xl border-2 border-[#4A3525] shadow-[0_4px_0_#4A3525] active:translate-y-0.5 active:shadow-[0_2px_0_#4A3525] transition-all cursor-pointer"
              >
                <span>
                  {isLoggedIn
                    ? "Kembali ke Ruang Konseling →"
                    : "Mulai Sesi Bersama Jiwoo →"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => scrollToSection("konsultasi-lanjut")}
                className="flex items-center gap-2 bg-[#FDF3E7] hover:bg-[#efe0ce] text-[#4A3525] font-bold text-xs md:text-sm px-5 py-3.5 rounded-2xl border-2 border-[#4A3525] transition-all cursor-pointer"
              >
                <span>💬 Konsultasi Lanjut & Rating</span>
              </button>
            </div>
          </div>

          <div className="w-36 h-36 sm:w-44 sm:h-44 md:w-56 md:h-56 rounded-full bg-[#FDF3E7] border-2 border-[#4A3525] flex items-center justify-center p-5 shadow-inner shrink-0">
            <img
              src={jiwooMascot}
              alt="Maskot Jiwoo AI"
              className="w-full h-full object-contain drop-shadow-md"
            />
          </div>
        </section>

        {/* 2. TUJUAN & LATAR BELAKANG JIWOO AI */}
        <section className="space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#F4A950] bg-[#4A3525] px-3 py-1 rounded-full">
              Mengapa Jiwoo Diciptakan?
            </span>
            <h2 className="text-xl md:text-2xl font-bold text-[#4A3525]">
              Latar Belakang & Tujuan Jiwoo AI
            </h2>
          </div>

          <div className="bg-[#FDF3E7] border-2 border-[#4A3525] rounded-3xl p-5 sm:p-6 md:p-8 shadow-[0_4px_0_#4A3525] space-y-5">
            <p className="text-xs md:text-sm text-[#4A3525]/90 font-sans leading-relaxed">
              Aplikasi berbasis web <strong>Jiwoo AI</strong> dikembangkan
              berangkat dari pengamatan nyata terhadap kondisi masyarakat saat
              ini—khususnya kalangan <strong>Gen Z</strong>—yang semakin rentan
              mengalami <em>overthinking</em>. Tekanan tersebut muncul dari
              berbagai faktor kehidupan, terutama kecemasan berlebih dalam
              memikirkan masa depan, akademik, maupun karier, yang diperberat
              oleh sulitnya menemukan teman cerita yang bisa dipercaya tanpa
              rasa takut dihakimi.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="bg-[#F6E4CE]/70 p-4 rounded-2xl border border-[#4A3525]/30 space-y-2">
                <div className="w-9 h-9 rounded-xl bg-[#F4A950] border border-[#4A3525] flex items-center justify-center text-base">
                  🤝
                </div>
                <h3 className="text-sm font-bold text-[#4A3525]">
                  Teman Cerita & Penengah
                </h3>
                <p className="text-xs text-[#4A3525]/80 font-sans leading-relaxed">
                  Hadir bagi mereka yang tidak memiliki tempat berbagi cerita,
                  menjadi penengah yang menenangkan di tengah keramaian pikiran.
                </p>
              </div>

              <div className="bg-[#F6E4CE]/70 p-4 rounded-2xl border border-[#4A3525]/30 space-y-2">
                <div className="w-9 h-9 rounded-xl bg-[#F4A950] border border-[#4A3525] flex items-center justify-center text-base">
                  🧠
                </div>
                <h3 className="text-sm font-bold text-[#4A3525]">
                  Saran & Motivasi Konseling
                </h3>
                <p className="text-xs text-[#4A3525]/80 font-sans leading-relaxed">
                  Memberikan tanggapan empatik, saran rasional berbasis{" "}
                  <em>Cognitive Behavioral Therapy (CBT)</em>, serta dorongan
                  motivasi yang membangun.
                </p>
              </div>

              <div className="bg-[#F6E4CE]/70 p-4 rounded-2xl border border-[#4A3525]/30 space-y-2">
                <div className="w-9 h-9 rounded-xl bg-[#F4A950] border border-[#4A3525] flex items-center justify-center text-base">
                  🛡️
                </div>
                <h3 className="text-sm font-bold text-[#4A3525]">
                  Meringankan Beban Masalah
                </h3>
                <p className="text-xs text-[#4A3525]/80 font-sans leading-relaxed">
                  Diharapkan mampu membantu mengurai benang kusut di kepala dan
                  meringankan beban emosional pengguna secara aman dan rahasia.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 3. PROFIL PENGEMBANG (ABOUT DEVELOPER) */}
        <section className="space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#F4A950] bg-[#4A3525] px-3 py-1 rounded-full">
              About Developer
            </span>
            <h2 className="text-xl md:text-2xl font-bold text-[#4A3525]">
              Sosok di Balik Pengembangan Jiwoo AI
            </h2>
          </div>
          {/* batas profil */}
          <div className="bg-[#F6E4CE] border-2 border-[#4A3525] rounded-3xl p-5 sm:p-6 md:p-8 shadow-[0_5px_0_#4A3525] flex flex-col md:flex-row items-center gap-6 md:gap-8">
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="w-28 h-28 md:w-32 md:h-32 rounded-3xl bg-[#FDF3E7] border-2 border-[#4A3525] overflow-hidden shadow-md flex items-center justify-center">
                <img
                  src="https://github.com/shahansyah.png"
                  alt="Muhammad Shahan Syah Naufal Abdullah"
                  onError={(e) => {
                    e.currentTarget.src = jiwooMascot;
                  }}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-[#F4A950] border border-[#4A3525]">
                HanCodes
              </span>
            </div>

            <div className="flex-1 text-center md:text-left space-y-3">
              <div>
                <h3 className="text-base sm:text-lg md:text-xl font-bold text-[#4A3525]">
                  Muhammad Shahan Syah Naufal Abdullah
                </h3>
                <p className="text-xs font-bold text-[#4A3525]/70 font-sans">
                  Full-Stack Web & Mobile Developer • Informatics Engineering
                </p>
              </div>

              <p className="text-xs md:text-sm text-[#4A3525]/85 font-sans leading-relaxed">
                Aplikasi <strong>Jiwoo AI</strong> dirancang dan dikembangkan
                secara penuh oleh{" "}
                <strong>Muhammad Shahan Syah Naufal Abdullah</strong>. Lahir di{" "}
                <strong>Garut pada tanggal 7 April 2005</strong>, saat ini
                beliau sedang menempuh pendidikan sarjana pada program studi{" "}
                <strong>
                  Teknik Informatika di Universitas Darussalam Gontor (UNIDA
                  Gontor)
                </strong>
                . Melalui proyek ini, ia menggabungkan teknologi kecerdasan
                buatan modern dengan kepedulian terhadap kesehatan mental
                generasi muda.
              </p>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1 font-sans">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-[#FDF3E7] px-3 py-1.5 rounded-xl border border-[#4A3525]/30">
                  📍 Garut, 7 April 2005
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-[#FDF3E7] px-3 py-1.5 rounded-xl border border-[#4A3525]/30">
                  🎓 Teknik Informatika - UNIDA Gontor
                </span>
                <a
                  href="https://github.com/shahansyah"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-[#4A3525] text-[#FDF3E7] hover:bg-[#352519] px-3 py-1.5 rounded-xl transition-all"
                >
                  💻 github.com/shahansyah
                </a>
              </div>
            </div>
          </div>

          {/* batasnnya */}
          <div className="bg-[#F6E4CE] border-2 border-[#4A3525] rounded-3xl p-5 sm:p-6 md:p-8 shadow-[0_5px_0_#4A3525] flex flex-col md:flex-row items-center gap-6 md:gap-8">
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="w-28 h-28 md:w-32 md:h-32 rounded-3xl bg-[#FDF3E7] border-2 border-[#4A3525] overflow-hidden shadow-md flex items-center justify-center">
                <img
                  src="https://github.com/Ortega35.png"
                  alt="Muhammad Ibnu Nafis"
                  onError={(e) => {
                    e.currentTarget.src = jiwooMascot;
                  }}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-[#F4A950] border border-[#4A3525]">
                Ortega
              </span>
            </div>

            <div className="flex-1 text-center md:text-left space-y-3">
              <div>
                <h3 className="text-base sm:text-lg md:text-xl font-bold text-[#4A3525]">
                  Muhammad Ibnu Nafis
                </h3>
                <p className="text-xs font-bold text-[#4A3525]/70 font-sans">
                  Full-Stack Web & Mobile Developer • Informatics Engineering
                </p>
              </div>

              <p className="text-xs md:text-sm text-[#4A3525]/85 font-sans leading-relaxed">
                Aplikasi <strong>Jiwoo AI</strong> dirancang dan dikembangkan
                secara penuh oleh <strong>Muhammad Ibnu Nafis</strong>. Lahir di{" "}
                <strong>Tegal</strong>, saat ini beliau sedang menempuh
                pendidikan sarjana pada program studi{" "}
                <strong>
                  Teknik Informatika di Universitas Darussalam Gontor (UNIDA
                  Gontor)
                </strong>
                . Melalui proyek ini, ia menggabungkan teknologi kecerdasan
                buatan modern dengan kepedulian terhadap kesehatan mental
                generasi muda.
              </p>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1 font-sans">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-[#FDF3E7] px-3 py-1.5 rounded-xl border border-[#4A3525]/30">
                  📍 Tegal
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-[#FDF3E7] px-3 py-1.5 rounded-xl border border-[#4A3525]/30">
                  🎓 Teknik Informatika - UNIDA Gontor
                </span>
                <a
                  href="https://github.com/Ortega35"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-[#4A3525] text-[#FDF3E7] hover:bg-[#352519] px-3 py-1.5 rounded-xl transition-all"
                >
                  💻 github.com/Ortega35
                </a>
              </div>
            </div>
          </div>

            {/* batasnnya */}
          <div className="bg-[#F6E4CE] border-2 border-[#4A3525] rounded-3xl p-5 sm:p-6 md:p-8 shadow-[0_5px_0_#4A3525] flex flex-col md:flex-row items-center gap-6 md:gap-8">
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="w-28 h-28 md:w-32 md:h-32 rounded-3xl bg-[#FDF3E7] border-2 border-[#4A3525] overflow-hidden shadow-md flex items-center justify-center">
                <img
                  src="https://github.com/ramahdidayah.png"
                  alt="Muhammad Ibnu Nafis"
                  onError={(e) => {
                    e.currentTarget.src = jiwooMascot;
                  }}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-[#F4A950] border border-[#4A3525]">
                Ramah Hidayah
              </span>
            </div>

            <div className="flex-1 text-center md:text-left space-y-3">
              <div>
                <h3 className="text-base sm:text-lg md:text-xl font-bold text-[#4A3525]">
                  Ramah Hidayah
                </h3>
                <p className="text-xs font-bold text-[#4A3525]/70 font-sans">
                  Frontend Developer • Informatics Engineering
                </p>
              </div>

              <p className="text-xs md:text-sm text-[#4A3525]/85 font-sans leading-relaxed">
                Aplikasi <strong>Jiwoo AI</strong> dirancang dan dikembangkan
                secara penuh oleh <strong>Ramah Hidayah</strong>. Lahir di{" "}
                <strong>Jambi</strong>, saat ini beliau sedang menempuh
                pendidikan sarjana pada program studi{" "}
                <strong>
                  Teknik Informatika di Universitas Darussalam Gontor (UNIDA
                  Gontor)
                </strong>
                . Melalui proyek ini, ia menggabungkan teknologi kecerdasan
                buatan modern dengan kepedulian terhadap kesehatan mental
                generasi muda.
              </p>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1 font-sans">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-[#FDF3E7] px-3 py-1.5 rounded-xl border border-[#4A3525]/30">
                  📍 Jambi
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-[#FDF3E7] px-3 py-1.5 rounded-xl border border-[#4A3525]/30">
                  🎓 Teknik Informatika - UNIDA Gontor
                </span>
                <a
                  href="https://github.com/Ortega35"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-[#4A3525] text-[#FDF3E7] hover:bg-[#352519] px-3 py-1.5 rounded-xl transition-all"
                >
                  💻 github.com/Ortega35
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* 4. LAYANAN KONSULTASI LANJUT & PENILAIAN */}
        <section id="konsultasi-lanjut" className="space-y-6 pt-2">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#F4A950] bg-[#4A3525] px-3 py-1 rounded-full">
              Layanan Lanjutan & Ulasan
            </span>
            <h2 className="text-xl md:text-2xl font-bold text-[#4A3525]">
              Konsultasi Lanjut & Penilaian Aplikasi
            </h2>
            <p className="text-xs text-[#4A3525]/75 font-sans">
              Merasa butuh teman diskusi manusia secara langsung atau ingin
              memberikan ulasan dan masukan untuk pengembangan Jiwoo AI?
              Kirimkan melalui formulir di bawah ini.
            </p>
          </div>

          <div className="bg-[#FDF3E7] border-2 border-[#4A3525] rounded-3xl p-5 sm:p-6 md:p-8 shadow-[0_6px_0_#4A3525]">
            {isSubmitted ? (
              <div className="py-12 flex flex-col items-center text-center space-y-4 animate-pop-1">
                <div className="w-16 h-16 rounded-full bg-green-100 text-green-700 flex items-center justify-center border-2 border-green-700">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-lg font-bold text-[#4A3525]">
                  Pesan & Penilaian Berhasil Terkirim!
                </h3>
                <p className="text-xs text-[#4A3525]/80 max-w-md font-sans leading-relaxed">
                  Terima kasih banyak atas ulasan dan masukan berhargamu.
                  Pesanmu telah langsung diterima oleh pengembang Jiwoo AI. 🐾
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsSubmitted(false);
                    setMessage("");
                  }}
                  className="mt-2 px-6 py-2.5 rounded-full bg-[#F4A950] hover:bg-[#e5983e] text-[#4A3525] text-xs font-bold border border-[#4A3525] cursor-pointer transition-all"
                >
                  Kirim Pesan Lainnya
                </button>
              </div>
            ) : (
              <form onSubmit={handleFormSubmit} className="space-y-6">
                <div className="bg-[#F6E4CE]/80 border border-[#4A3525]/30 rounded-2xl p-4 sm:p-5 text-center space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#4A3525]/70">
                    Beri Penilaian Pengalamanmu Menggunakan Jiwoo AI
                  </p>
                  <div className="flex items-center justify-center gap-2 py-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 text-2xl transition-transform hover:scale-125 cursor-pointer"
                      >
                        {star <= (hoverRating || rating) ? "⭐" : "☆"}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs font-bold text-[#4A3525]">
                    {rating} / 5 Bintang —{" "}
                    <span className="text-[#4A3525]/80 font-sans">
                      {ratingLabels[hoverRating || rating]}
                    </span>
                  </p>
                </div>

                {errorMsg && (
                  <div className="px-4 py-2.5 rounded-xl bg-red-100 border border-red-400 text-red-700 text-xs font-bold">
                    {errorMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans">
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-bold text-[#4A3525]">
                      Nama Panggilan (Opsional / Boleh Anonim)
                    </label>
                    <input
                      type="text"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Contoh: Raka / Hamba Allah"
                      className="w-full px-4 py-3 rounded-2xl bg-white border-2 border-[#4A3525]/40 focus:border-[#4A3525] text-xs outline-none"
                    />
                  </div>

                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-bold text-[#4A3525]">
                      Tujuan Pesan
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-white border-2 border-[#4A3525]/40 focus:border-[#4A3525] text-xs outline-none cursor-pointer"
                    >
                      <option value="Konsultasi Lanjut & Curhat Langsung">
                        Konsultasi Lanjut & Curhat (Kurang Puas dengan AI)
                      </option>
                      <option value="Ulasan & Saran Pengembangan Aplikasi Jiwoo AI">
                        Ulasan & Saran Pengembangan Aplikasi Jiwoo AI
                      </option>
                      <option value="Laporan Kendala Teknis / Bug">
                        Laporan Kendala Teknis / Bug
                      </option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5 text-left font-sans">
                  <label className="text-xs font-bold text-[#4A3525]">
                    Tuliskan Keluhan, Cerita Lanjutan, atau Ulasanmu *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Ceritakan keluhan atau masalah yang ingin kamu konsultasikan lebih lanjut, atau tuliskan masukanmu untuk Jiwoo AI di sini..."
                    className="w-full p-4 rounded-2xl bg-white border-2 border-[#4A3525]/40 focus:border-[#4A3525] text-xs outline-none resize-none leading-relaxed"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-[#F4A950] hover:bg-[#e5983e] text-[#4A3525] font-bold text-xs md:text-sm py-4 rounded-2xl border-2 border-[#4A3525] shadow-[0_4px_0_#4A3525] active:translate-y-0.5 active:shadow-[0_2px_0_#4A3525] transition-all cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Mengirimkan Pesan...</span>
                    </>
                  ) : (
                    <span>🚀 Kirim Keluhan & Penilaian Langsung</span>
                  )}
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
