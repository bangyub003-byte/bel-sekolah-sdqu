import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

// In-memory cache for synthesized voice TTS audio (sub-millisecond instant replay)
const globalTtsAudioCache = new Map<string, string>();
// In-memory cache for AI translations (id -> ar/en/jv)
const globalTranslateCache = new Map<string, string>();

function wrapPcmInWav(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "25mb" }));

  // AI Translation Endpoint (Indonesian -> Arabic / English / Javanese) using gemini-4-hydrogen
  app.post("/api/voice/translate", async (req, res) => {
    try {
      const { text, targetLanguage } = req.body || {};
      if (!text || typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ error: "Teks sumber wajib diisi." });
      }

      const lang = targetLanguage === "ar" || targetLanguage === "en" || targetLanguage === "jv" ? targetLanguage : "id";
      if (lang === "id") {
        return res.json({ status: "success", translatedText: text.trim() });
      }

      const cacheKey = `${lang}:${text.trim()}`;
      if (globalTranslateCache.has(cacheKey)) {
        return res.json({
          status: "success",
          translatedText: globalTranslateCache.get(cacheKey),
          cached: true,
        });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY belum terkonfigurasi di server.",
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const languageInstructions: Record<"ar" | "en" | "jv", string> = {
        ar: "You are a strict translator. Translate the following Indonesian school bell announcement into fluent, polite Modern Standard Arabic (Fusha) for Islamic elementary school students. ALWAYS output ONLY the Arabic translation with full harakat/tasykil (التشكيل الكامل), never keep Indonesian words, and include no quotes or explanations.",
        en: "You are a strict translator. Translate the following Indonesian school bell announcement into clear, warm, formal English for an elementary school PA announcement. Even if the input is short or includes school names (e.g. 'SD Qur'an Unggulan' or 'Tahfidzul Qur'an'), translate the announcement sentences completely into natural English. Output ONLY the English translation, with no Indonesian words, no quotes, and no explanations.",
        jv: "You are a strict translator. Translate the following Indonesian school bell announcement into polite Javanese (Bahasa Jawa Krama Inggil / Krama Alus) using clear standard Latin spelling. Output ONLY the Javanese translation with no quotes or explanations.",
      };

      let translatedText = "";
      let lastTranslateErr: any = null;

      // Try primary model gemini-4-hydrogen, then fallback to gemini-3.1-flash-lite on spike/503/timeout
      const translateAttempts: Array<{ model: string; thinkingLevel: ThinkingLevel }> = [
        { model: "gemini-4-hydrogen", thinkingLevel: ThinkingLevel.LOW },
        { model: "gemini-3.1-flash-lite", thinkingLevel: ThinkingLevel.MINIMAL },
      ];

      for (const attempt of translateAttempts) {
        try {
          const translatePromise = ai.models.generateContent({
            model: attempt.model,
            contents: text.trim(),
            config: {
              systemInstruction: languageInstructions[lang],
              thinkingConfig: { thinkingLevel: attempt.thinkingLevel },
            },
          });

          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Translation timeout")), 10000)
          );

          const response = await Promise.race([translatePromise, timeoutPromise]);
          const candidate = (response.text || "").trim().replace(/^["']|["']$/g, "");
          if (candidate) {
            translatedText = candidate;
            break;
          }
        } catch (err: any) {
          lastTranslateErr = err;
          console.warn(`[Translate] ${attempt.model} fallback trigger:`, (err?.message || "").slice(0, 100));
        }
      }

      if (!translatedText) {
        throw lastTranslateErr || new Error("AI tidak mengembalikan teks terjemahan.");
      }

      globalTranslateCache.set(cacheKey, translatedText);
      return res.json({ status: "success", translatedText });
    } catch (err: any) {
      const errStr = typeof err === "string" ? err : err?.message || "";
      console.warn("[Translate] Error:", errStr.slice(0, 120));
      return res.status(500).json({
        status: "error",
        error: err?.message || "Gagal menerjemahkan teks dengan AI.",
      });
    }
  });

  // AI Voice Cloning & TTS Generation Endpoint using Gemini API
  app.post("/api/voice/clone-tts", async (req, res) => {
    try {
      const { text, voiceName, language } = req.body;
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

      // Prebuilt voices valid for gemini-3.8-flash-lite-tts: 'Fenrir', 'Charon', 'Puck', 'Kore', 'Zephyr'
      const validVoices = ['Kore', 'Puck', 'Fenrir', 'Zephyr', 'Charon'];
      const selectedVoice = voiceName && validVoices.includes(voiceName) ? voiceName : 'Fenrir';
      const isFemaleVoice = selectedVoice === 'Kore' || selectedVoice === 'Zephyr';
      const targetLang = language === 'ar' || language === 'en' || language === 'jv' ? language : 'id';

      // Check server memory cache for instant response (under 5ms)
      const cacheKey = `${selectedVoice}:${targetLang}:${text.trim()}`;
      if (globalTtsAudioCache.has(cacheKey)) {
        return res.json({
          status: "success",
          audioDataUrl: globalTtsAudioCache.get(cacheKey),
          cached: true
        });
      }

      const genderDesc = isFemaleVoice ? "warm female" : "authoritative, deep, warm adult male";
      const styleMap: Record<string, string> = {
        ar: `Clear, ${genderDesc} school announcer speaking fluent Standard Arabic with crisp articulation.`,
        en: `Clear, ${genderDesc} school announcer speaking fluent natural English.`,
        jv: `Clear, polite, ${genderDesc} school announcer speaking fluent Javanese (Bahasa Jawa Krama) with natural pronunciation.`,
        id: `Clear, ${genderDesc} Indonesian school announcer speaking fluent natural Indonesian.`,
      };

      // Fast studio-quality TTS generation with gemini-3.8-flash-lite-tts, falling back to gemini-3.8-flash-tts on quota/transient error
      const runTtsRequest = async (modelName: string) => {
        const ttsPromise = ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: text.trim(),
                  speechMetadata: {
                    style: styleMap[targetLang] || styleMap.id,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: selectedVoice },
              },
            },
          },
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Gemini TTS request timeout (13s)")), 13000)
        );

        return Promise.race([ttsPromise, timeoutPromise]);
      };

      let response: any;
      try {
        response = await runTtsRequest('gemini-3.8-flash-lite-tts');
      } catch (_firstErr: any) {
        response = await runTtsRequest('gemini-3.8-flash-tts');
      }

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

      // Wrap raw headerless PCM in RIFF/WAVE if needed; never double-wrap valid RIFF WAV
      const lowerMime = outputMimeType.toLowerCase();
      const rawBuffer = Buffer.from(base64Audio, 'base64');
      const hasRiffHeader = rawBuffer.length >= 4 && rawBuffer.toString('ascii', 0, 4) === 'RIFF';

      if (!hasRiffHeader && (lowerMime.includes('pcm') || lowerMime.includes('l16') || lowerMime.includes('wav'))) {
        const rateMatch = lowerMime.match(/rate=(\d+)/);
        const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
        const wavBuffer = wrapPcmInWav(rawBuffer, sampleRate, 1, 16);
        base64Audio = wavBuffer.toString('base64');
        outputMimeType = 'audio/wav';
      } else if (hasRiffHeader) {
        outputMimeType = 'audio/wav';
      }

      const audioDataUrl = `data:${outputMimeType};base64,${base64Audio}`;
      
      // Store in memory cache
      globalTtsAudioCache.set(cacheKey, audioDataUrl);

      return res.json({ status: "success", audioDataUrl });
    } catch (err: any) {
      const errStr = typeof err === "string" ? err : (err?.message || JSON.stringify(err || ""));
      const isQuotaExceeded =
        err?.status === 429 ||
        err?.code === 429 ||
        errStr.includes("429") ||
        errStr.includes("RESOURCE_EXHAUSTED") ||
        errStr.includes("Quota exceeded") ||
        errStr.includes("quota");

      if (isQuotaExceeded) {
        return res.json({
          status: "quota_exceeded",
          quotaExceeded: true,
          message: "Gemini TTS daily quota limit reached (Free Tier). Seamless local browser speech active."
        });
      }

      console.log("[TTS] Note: AI generation fallback to local engine:", err?.message?.slice(0, 100) || "Service unavailable");
      return res.status(200).json({
        status: "fallback",
        quotaExceeded: false,
        error: err?.message || "Failed to generate AI cloned TTS audio"
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

  // Cloud Audio Proxy endpoint for Google Drive, Dropbox, and external links (handles redirects & CORS)
  app.get("/api/audio/proxy", async (req, res) => {
    try {
      const rawUrl = typeof req.query.url === "string" ? req.query.url.trim() : "";
      if (!rawUrl || (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://"))) {
        return res.status(400).json({ error: "URL audio tidak valid." });
      }

      let parsed: URL;
      try {
        parsed = new URL(rawUrl);
      } catch {
        return res.status(400).json({ error: "Format URL tidak valid." });
      }

      const host = parsed.hostname.toLowerCase();
      if (
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "::1" ||
        host.startsWith("10.") ||
        host.startsWith("192.168.") ||
        host.startsWith("169.254.")
      ) {
        return res.status(403).json({ error: "Akses ke alamat lokal tidak diizinkan." });
      }

      let targetUrl = rawUrl;
      // Handle Google Drive file URLs -> direct usercontent download link
      if (host.includes("drive.google.com")) {
        const idMatch = rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || rawUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (idMatch && idMatch[1]) {
          targetUrl = `https://drive.usercontent.google.com/download?id=${idMatch[1]}&export=download&confirm=t`;
        }
      }

      const fetchAudio = async (urlToFetch: string) =>
        fetch(urlToFetch, {
          redirect: "follow",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept: "audio/*,*/*;q=0.9",
          },
        });

      let upstream = await fetchAudio(targetUrl);
      let contentType = (upstream.headers.get("content-type") || "").toLowerCase();

      // If Google Drive returned an HTML confirmation page, extract the download form or confirm link
      if (upstream.ok && contentType.includes("text/html") && (host.includes("drive.google.com") || host.includes("googleusercontent.com"))) {
        const html = await upstream.text();
        const uuidMatch = html.match(/name="uuid"\s+value="([^"]+)"/);
        const idMatch = rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || rawUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (idMatch && idMatch[1]) {
          const confirmUrl = uuidMatch
            ? `https://drive.usercontent.google.com/download?id=${idMatch[1]}&export=download&confirm=t&uuid=${uuidMatch[1]}`
            : `https://drive.google.com/uc?export=download&confirm=t&id=${idMatch[1]}`;
          upstream = await fetchAudio(confirmUrl);
          contentType = (upstream.headers.get("content-type") || "").toLowerCase();
        }
      }

      if (!upstream.ok) {
        return res.status(502).json({
          error: `Gagal mengambil file audio dari server sumber (HTTP ${upstream.status}).`,
        });
      }

      if (contentType.includes("text/html")) {
        return res.status(422).json({
          error:
            "Tautan mengarah ke halaman web/HTML (kemungkinan file Google Drive masih Privat). Ubah akses berbagi menjadi 'Siapa saja yang memiliki link'.",
        });
      }

      const arrayBuf = await upstream.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);
      if (buffer.byteLength === 0) {
        return res.status(422).json({ error: "File audio dari tautan kosong (0 byte)." });
      }
      if (buffer.byteLength > 25 * 1024 * 1024) {
        return res.status(413).json({ error: "Ukuran file audio terlalu besar (maksimal 25MB)." });
      }

      const safeContentType =
        !contentType || contentType === "application/octet-stream" || contentType === "binary/octet-stream"
          ? "audio/mpeg"
          : contentType;

      res.setHeader("Content-Type", safeContentType);
      res.setHeader("Content-Length", buffer.byteLength.toString());
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.send(buffer);
    } catch (err: any) {
      return res.status(500).json({
        error: err?.message || "Gagal memuat audio dari tautan eksternal.",
      });
    }
  });

  // Server-side Cloudinary Unsigned Upload Relay (bypasses browser CORS/adblocker/iframe fetch blocks)
  app.post("/api/audio/cloudinary-upload", async (req, res) => {
    try {
      const { cloudName, uploadPreset, fileName, dataUrl } = req.body || {};
      const raw = String(cloudName || "").trim();
      let cleanCloudName = raw;
      if (raw.includes("@")) {
        cleanCloudName = (raw.split("@").pop() || "").split(/[/?#\s]/)[0].trim();
      } else {
        const resMatch = raw.match(/res\.cloudinary\.com\/([a-zA-Z0-9_-]+)/i);
        cleanCloudName = resMatch?.[1] || raw.replace(/^https?:\/\//i, "").split(/[/?#\s]/)[0].trim();
      }
      const cleanPreset = String(uploadPreset || "").trim() || "bel_sekolah";

      if (!cleanCloudName || !/^[a-zA-Z0-9_-]+$/.test(cleanCloudName)) {
        return res.status(400).json({
          error:
            "Cloud Name Cloudinary tidak valid. Salin hanya nama pendek Cloud Name dari Dashboard Cloudinary (misal: dxyz123abc).",
        });
      }

      if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
        return res.status(400).json({ error: "Data file audio tidak valid." });
      }

      const commaIdx = dataUrl.indexOf(",");
      if (commaIdx === -1) {
        return res.status(400).json({ error: "Format data audio tidak valid." });
      }

      const header = dataUrl.slice(5, commaIdx);
      const mimeType = header.split(";")[0] || "audio/mpeg";
      const base64 = dataUrl.slice(commaIdx + 1);
      const buffer = Buffer.from(base64, "base64");

      const postToCloudinary = async (presetToTry: string) => {
        const formData = new FormData();
        const blob = new Blob([buffer], { type: mimeType });
        formData.append("file", blob, String(fileName || "audio.mp3"));
        formData.append("upload_preset", presetToTry);
        formData.append("resource_type", "auto");

        const upstream = await fetch(
          `https://api.cloudinary.com/v1_1/${encodeURIComponent(cleanCloudName)}/auto/upload`,
          {
            method: "POST",
            body: formData,
          }
        );
        const data: any = await upstream.json().catch(() => ({}));
        return { upstream, data };
      };

      let { upstream, data } = await postToCloudinary(cleanPreset);
      if (
        !upstream.ok &&
        cleanPreset !== cleanPreset.toLowerCase() &&
        String(data?.error?.message || "").toLowerCase().includes("preset")
      ) {
        ({ upstream, data } = await postToCloudinary(cleanPreset.toLowerCase()));
      }

      if (!upstream.ok) {
        const rawMsg = String(data?.error?.message || upstream.statusText || "");
        let friendly = rawMsg;
        if (rawMsg.toLowerCase().includes("unknown api key") || upstream.status === 401) {
          friendly = `Cloud Name "${cleanCloudName}" tidak ditemukan di Cloudinary. Pastikan Anda menyalin Cloud Name (bukan API Key).`;
        } else if (rawMsg.toLowerCase().includes("upload preset") || rawMsg.toLowerCase().includes("whitelisted")) {
          friendly = `Preset "${cleanPreset}" belum ada / belum mode Unsigned. Di Cloudinary buka Settings > Upload > Upload presets, buat preset "${cleanPreset}" dengan Signing Mode: Unsigned.`;
        }
        return res.status(upstream.status || 400).json({ error: friendly });
      }

      const resolvedUrl = data?.secure_url || data?.url;
      if (!resolvedUrl) {
        return res.status(502).json({ error: "Cloudinary tidak mengembalikan URL audio." });
      }

      return res.json({
        url: resolvedUrl,
        fileName: String(fileName || "audio.mp3"),
      });
    } catch (err: any) {
      return res.status(500).json({
        error: err?.message || "Gagal menghubungi server Cloudinary.",
      });
    }
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
