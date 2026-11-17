import { GoogleGenAI } from "@google/genai";

const globalTtsAudioCache = new Map<string, string>();

function wrapPcmInWav(
  pcmBuffer: Buffer,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

async function getJsonBody(req: any): Promise<any> {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  } catch {
    return {};
  }
}

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = await getJsonBody(req);
    const { text, voiceName, language } = body || {};
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Text parameter is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured on Vercel Environment Variables.",
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

    const validVoices = ["Kore", "Puck", "Fenrir", "Zephyr", "Charon"];
    const selectedVoice = voiceName && validVoices.includes(voiceName) ? voiceName : "Fenrir";
    const isFemaleVoice = selectedVoice === "Kore" || selectedVoice === "Zephyr";
    const targetLang = language === "ar" || language === "en" || language === "jv" ? language : "id";

    const cacheKey = `${selectedVoice}:${targetLang}:${text.trim()}`;
    if (globalTtsAudioCache.has(cacheKey)) {
      return res.status(200).json({
        status: "success",
        audioDataUrl: globalTtsAudioCache.get(cacheKey),
        cached: true,
      });
    }

    const genderDesc = isFemaleVoice
      ? "warm female"
      : "authoritative, deep, warm adult male";
    const styleMap: Record<string, string> = {
      ar: `Clear, ${genderDesc} school announcer speaking fluent Standard Arabic with crisp articulation.`,
      en: `Clear, ${genderDesc} school announcer speaking fluent natural English.`,
      jv: `Clear, polite, ${genderDesc} school announcer speaking fluent Javanese (Bahasa Jawa Krama) with natural pronunciation.`,
      id: `Clear, ${genderDesc} Indonesian school announcer speaking fluent natural Indonesian.`,
    };

    const runTtsRequest = async (modelName: string) => {
      const ttsPromise = ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: "user",
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
          responseModalities: ["AUDIO"],
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
      response = await runTtsRequest("gemini-3.8-flash-lite-tts");
    } catch {
      response = await runTtsRequest("gemini-3.8-flash-tts");
    }

    const candidates = response?.candidates;
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

    const lowerMime = outputMimeType.toLowerCase();
    const rawBuffer = Buffer.from(base64Audio, "base64");
    const hasRiffHeader =
      rawBuffer.length >= 4 && rawBuffer.toString("ascii", 0, 4) === "RIFF";

    if (
      !hasRiffHeader &&
      (lowerMime.includes("pcm") || lowerMime.includes("l16") || lowerMime.includes("wav"))
    ) {
      const rateMatch = lowerMime.match(/rate=(\d+)/);
      const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
      const wavBuffer = wrapPcmInWav(rawBuffer, sampleRate, 1, 16);
      base64Audio = wavBuffer.toString("base64");
      outputMimeType = "audio/wav";
    } else if (hasRiffHeader) {
      outputMimeType = "audio/wav";
    }

    const audioDataUrl = `data:${outputMimeType};base64,${base64Audio}`;
    globalTtsAudioCache.set(cacheKey, audioDataUrl);

    return res.status(200).json({ status: "success", audioDataUrl });
  } catch (err: any) {
    const errStr = typeof err === "string" ? err : err?.message || JSON.stringify(err || "");
    const isQuotaExceeded =
      err?.status === 429 ||
      err?.code === 429 ||
      errStr.includes("429") ||
      errStr.includes("RESOURCE_EXHAUSTED") ||
      errStr.includes("Quota exceeded") ||
      errStr.includes("quota");

    if (isQuotaExceeded) {
      return res.status(200).json({
        status: "quota_exceeded",
        quotaExceeded: true,
        message:
          "Gemini TTS daily quota limit reached (Free Tier). Seamless local browser speech active.",
      });
    }

    return res.status(200).json({
      status: "fallback",
      quotaExceeded: false,
      error: err?.message || "Failed to generate AI cloned TTS audio",
    });
  }
}
