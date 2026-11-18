function normalizeCloudName(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  if (trimmed.includes("@")) {
    const afterAt = trimmed.split("@").pop() || "";
    return afterAt.split(/[/?#\s]/)[0].trim();
  }
  const resMatch = trimmed.match(/res\.cloudinary\.com\/([a-zA-Z0-9_-]+)/i);
  if (resMatch?.[1]) return resMatch[1];
  return trimmed.replace(/^https?:\/\//i, "").split(/[/?#\s]/)[0].trim();
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { cloudName, uploadPreset, fileName, dataUrl } = req.body || {};
    const cleanCloudName = normalizeCloudName(String(cloudName || ""));
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

    return res.status(200).json({
      url: resolvedUrl,
      fileName: String(fileName || "audio.mp3"),
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message || "Gagal menghubungi server Cloudinary.",
    });
  }
}
