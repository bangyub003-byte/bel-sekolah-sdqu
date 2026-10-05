import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "25mb" }));

  // AI Voice Cloning & TTS Generation Endpoint using Gemini API
  app.post("/api/voice/clone-tts", async (req, res) => {
    try {
      const { text, sampleAudioDataUrl, voiceName, voiceDescription } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Text parameter is required" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY is not configured on server. Please check environment variables."
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });

      let selectedVoice = voiceName || "Kore"; // Prebuilt voices: 'Kore', 'Puck', 'Fenrir', 'Zephyr', 'Aoede'
      let analyzedToneStyle = voiceDescription || "";

      // Step 1: If audio sample is provided, analyze it using gemini-3.6-flash to extract voice profile & select best voice
      if (sampleAudioDataUrl && typeof sampleAudioDataUrl === "string" && sampleAudioDataUrl.includes("base64,")) {
        try {
          const mimeType =
            sampleAudioDataUrl.substring(
              sampleAudioDataUrl.indexOf(":") + 1,
              sampleAudioDataUrl.indexOf(";")
            ) || "audio/webm";
          const base64Data = sampleAudioDataUrl.split("base64,")[1];

          const analysisResponse = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              },
              {
                text: `Analisis sampel suara audio ini. Tentukan gender pembicara (pria/wanita), intonasi (berwibawa/ramah/lembut), dan karakter vokal. Pilih satu nama voice terbaik dari [Kore, Puck, Fenrir, Zephyr, Aoede]. Jawab dalam format JSON: {"recommendedVoice": "Kore", "styleDescription": "pria berwibawa dengan intonasi jelas"}`
              }
            ],
            config: {
              responseMimeType: "application/json"
            }
          });

          if (analysisResponse.text) {
            const parsed = JSON.parse(analysisResponse.text);
            if (parsed.recommendedVoice && ["Kore", "Puck", "Fenrir", "Zephyr", "Aoede"].includes(parsed.recommendedVoice)) {
              selectedVoice = parsed.recommendedVoice;
            }
            if (parsed.styleDescription) {
              analyzedToneStyle = parsed.styleDescription;
            }
          }
        } catch (analysisErr) {
          console.warn("Audio voice analysis skipped/failed:", analysisErr);
        }
      }

      // Step 2: Build Text-Only Prompt for gemini-3.1-flash-tts-preview (TTS model only accepts text input)
      let ttsPrompt = "";
      if (analyzedToneStyle) {
        ttsPrompt += `Gaya dan karakter vokal pembaca: ${analyzedToneStyle}.\n\n`;
      }
      ttsPrompt += `Bacakan pesan bel sekolah berikut secara jelas, fasih, dan berwibawa dalam Bahasa Indonesia:\n"${text}"`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ text: ttsPrompt }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice }
            }
          }
        }
      });

      const candidates = response.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error("No response candidates received from Gemini TTS");
      }

      const candidateParts = candidates[0]?.content?.parts;
      let base64Audio: string | undefined;
      let outputMimeType = "audio/wav";

      if (candidateParts) {
        for (const part of candidateParts) {
          if (part.inlineData?.data) {
            base64Audio = part.inlineData.data;
            if (part.inlineData.mimeType) {
              outputMimeType = part.inlineData.mimeType;
            }
            break;
          }
        }
      }

      if (!base64Audio) {
        throw new Error("Gemini TTS response did not return audio inline data");
      }

      const audioDataUrl = `data:${outputMimeType};base64,${base64Audio}`;
      return res.json({ status: "success", audioDataUrl });
    } catch (err: any) {
      console.error("Error in /api/voice/clone-tts:", err);
      return res.status(500).json({
        error: err.message || "Failed to generate AI cloned TTS audio"
      });
    }
  });

  // High-precision Time API endpoint for real-time clock synchronization
  app.get("/api/time", (req, res) => {
    const now = new Date();
    // UTC timestamp and Indonesian WIB (UTC+7) representation
    const timestamp = now.getTime();
    
    // Provide server time details for client offset calculation
    res.json({
      status: "success",
      timestamp: timestamp,
      iso: now.toISOString(),
      timezone: "Asia/Jakarta (WIB)",
      timeFormatted: now.toLocaleTimeString("id-ID", {
        timeZone: "Asia/Jakarta",
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }),
      dateFormatted: now.toLocaleDateString("id-ID", {
        timeZone: "Asia/Jakarta",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      }),
      serverOffsetMs: 0
    });
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", app: "Bel Sekolah SD QUR'AN UNGGULAN" });
  });

  // Vite middleware in development mode
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[BEL SEKOLAH SD QUR'AN UNGGULAN] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
