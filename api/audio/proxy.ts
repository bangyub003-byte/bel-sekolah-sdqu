export default async function handler(req: any, res: any) {
  try {
    const rawQueryUrl = req.query?.url;
    const rawUrl = typeof rawQueryUrl === "string" ? rawQueryUrl.trim() : "";

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
    if (host.includes("drive.google.com")) {
      const idMatch =
        rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || rawUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
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

    if (
      upstream.ok &&
      contentType.includes("text/html") &&
      (host.includes("drive.google.com") || host.includes("googleusercontent.com"))
    ) {
      const html = await upstream.text();
      const uuidMatch = html.match(/name="uuid"\s+value="([^"]+)"/);
      const idMatch =
        rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || rawUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
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
      !contentType ||
      contentType === "application/octet-stream" ||
      contentType === "binary/octet-stream"
        ? "audio/mpeg"
        : contentType;

    res.setHeader("Content-Type", safeContentType);
    res.setHeader("Content-Length", buffer.byteLength.toString());
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.status(200).send(buffer);
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message || "Gagal memuat audio dari tautan eksternal.",
    });
  }
}
