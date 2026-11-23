import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const globalTranslateCache = new Map<string, string>();

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
    const { text, targetLanguage } = body || {};
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Teks sumber wajib diisi." });
    }

    const lang =
      targetLanguage === "ar" || targetLanguage === "en" || targetLanguage === "jv"
        ? targetLanguage
        : "id";
    if (lang === "id") {
      return res.status(200).json({ status: "success", translatedText: text.trim() });
    }

    const cacheKey = `${lang}:${text.trim()}`;
    if (globalTranslateCache.has(cacheKey)) {
      return res.status(200).json({
        status: "success",
        translatedText: globalTranslateCache.get(cacheKey),
        cached: true,
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY belum terkonfigurasi di Vercel Environment Variables.",
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

    const translateAttempts: Array<{ model: string; thinkingLevel: ThinkingLevel; delayMs: number }> = [
      { model: "gemini-3.1-flash-lite", thinkingLevel: ThinkingLevel.MINIMAL, delayMs: 0 },
      { model: "gemini-4-hydrogen", thinkingLevel: ThinkingLevel.LOW, delayMs: 0 },
      { model: "gemini-3.1-flash-lite", thinkingLevel: ThinkingLevel.MINIMAL, delayMs: 500 },
      { model: "gemini-4-hydrogen", thinkingLevel: ThinkingLevel.LOW, delayMs: 800 },
    ];

    for (const attempt of translateAttempts) {
      try {
        if (attempt.delayMs > 0) {
          await new Promise((r) => setTimeout(r, attempt.delayMs));
        }
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
      }
    }

    if (!translatedText) {
      throw lastTranslateErr || new Error("AI tidak mengembalikan teks terjemahan.");
    }

    globalTranslateCache.set(cacheKey, translatedText);
    return res.status(200).json({ status: "success", translatedText });
  } catch (err: any) {
    const errStr = typeof err === "string" ? err : err?.message || "";
    const isBusy =
      err?.status === 503 ||
      err?.code === 503 ||
      errStr.includes("503") ||
      errStr.toLowerCase().includes("high demand") ||
      errStr.toLowerCase().includes("unavailable");
    return res.status(isBusy ? 503 : 500).json({
      status: "error",
      error: isBusy
        ? "Layanan terjemahan AI sedang sibuk sementara. Silakan coba beberapa detik lagi."
        : err?.message || "Gagal menerjemahkan teks dengan AI.",
    });
  }
}
