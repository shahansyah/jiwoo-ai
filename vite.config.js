import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

// Plugin lokal agar /api/tts langsung berfungsi saat npm run dev di localhost
function edgeTtsLocalPlugin() {
  return {
    name: "edge-tts-local",
    configureServer(server) {
      server.middlewares.use("/api/tts", async (req, res) => {
        try {
          const url = new URL(req.url, "http://localhost");
          const text = (url.searchParams.get("text") || "").trim();
          const voice = url.searchParams.get("voice") || "id-ID-GadisNeural";
          const rate = url.searchParams.get("rate") || "+12%";
          const pitch = url.searchParams.get("pitch") || "+6Hz";

          if (!text) {
            res.statusCode = 400;
            res.end("Missing text");
            return;
          }

          const tts = new MsEdgeTTS();
          await tts.setMetadata(
            voice,
            OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3,
          );

          const { audioStream } = tts.toStream(text, { rate, pitch });
          res.setHeader("Content-Type", "audio/mpeg");
          res.setHeader("Cache-Control", "no-store");
          audioStream.pipe(res);
        } catch (err) {
          console.error("Edge TTS Error:", err);
          res.statusCode = 500;
          res.end("TTS Error");
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), edgeTtsLocalPlugin()],
});
