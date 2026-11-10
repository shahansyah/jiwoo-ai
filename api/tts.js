import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

export default async function handler(req, res) {
  try {
    const text = (req.query.text || "").trim();
    const voice = req.query.voice || "id-ID-GadisNeural";
    const rate = req.query.rate || "+12%";
    const pitch = req.query.pitch || "+6Hz";

    if (!text) return res.status(400).send("Missing text");

    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    const { audioStream } = tts.toStream(text, { rate, pitch });
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    audioStream.pipe(res);
  } catch {
    res.status(500).send("TTS Error");
  }
}
