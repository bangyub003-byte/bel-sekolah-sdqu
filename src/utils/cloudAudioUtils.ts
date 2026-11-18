/**
 * Cloud Audio Utilities for SD Qur'an Unggulan
 * Allows audio (VO, Intro Chime, Outro Chime) to be stored online & streamable across all devices (HP, PC, Vercel).
 */

export interface CloudStorageConfig {
  cloudName?: string;
  uploadPreset?: string;
  enabled?: boolean;
}

/**
 * Normalizes common cloud storage URLs (Google Drive, Dropbox, GitHub) into direct streaming audio links
 */
export function normalizeAudioCloudUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();

  // Google Drive Link
  // Patterns: https://drive.google.com/file/d/FILE_ID/view... or https://drive.google.com/open?id=FILE_ID
  if (trimmed.includes('drive.google.com')) {
    const fileIdMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/id=([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      return `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
    }
  }

  // Dropbox Link
  // Convert dl=0 to raw=1 for direct streaming
  if (trimmed.includes('dropbox.com')) {
    return trimmed.replace('dl=0', 'raw=1');
  }

  // GitHub Blob to Raw Link
  if (trimmed.includes('github.com') && trimmed.includes('/blob/')) {
    return trimmed.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
  }

  return trimmed;
}

/**
 * Check if a URL is an online cloud link
 */
export function isCloudAudioUrl(url?: string): boolean {
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

export function normalizeCloudinaryCloudName(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('@')) {
    const afterAt = trimmed.split('@').pop() || '';
    return afterAt.split(/[/?#\s]/)[0].trim();
  }
  const resMatch = trimmed.match(/res\.cloudinary\.com\/([a-zA-Z0-9_-]+)/i);
  if (resMatch?.[1]) return resMatch[1];
  return trimmed.replace(/^https?:\/\//i, '').split(/[/?#\s]/)[0].trim();
}

function mapCloudinaryErrorMessage(rawMsg: string, cloudName: string, preset: string): string {
  const lower = (rawMsg || '').toLowerCase();
  if (lower.includes('unknown api key')) {
    return `Cloud Name "${cloudName}" tidak ditemukan. Periksa kembali Cloud Name di Dashboard Cloudinary.`;
  }
  if (lower.includes('upload preset') || lower.includes('whitelisted')) {
    return `Preset "${preset}" belum ada / belum mode Unsigned. Di Cloudinary buka Settings > Upload > Upload presets, buat preset "${preset}" dengan Signing Mode: Unsigned.`;
  }
  return rawMsg || 'Gagal upload ke Cloudinary.';
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca data audio.'));
    reader.readAsDataURL(blob);
  });
}

async function attemptDirectCloudinaryUpload(
  fileOrBlob: File | Blob,
  fileName: string,
  cloudName: string,
  preset: string
): Promise<{ url: string; fileName: string }> {
  const formData = new FormData();
  formData.append('file', fileOrBlob, fileName);
  formData.append('upload_preset', preset);
  formData.append('resource_type', 'auto');

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/auto/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(
      mapCloudinaryErrorMessage(
        errData?.error?.message || response.statusText,
        cloudName,
        preset
      )
    );
  }

  const data = await response.json();
  const resolvedUrl = data?.secure_url || data?.url;
  if (!resolvedUrl || typeof resolvedUrl !== 'string') {
    throw new Error('Cloudinary tidak mengembalikan URL audio yang valid.');
  }

  return {
    url: resolvedUrl,
    fileName: fileName,
  };
}

/**
 * Upload an audio File or Blob directly to Cloudinary using an Unsigned Upload Preset,
 * with automatic lowercase preset retry and same-origin server relay fallback.
 */
export async function uploadAudioToCloudinary(
  fileOrBlob: File | Blob,
  fileName: string,
  cloudName: string,
  uploadPreset?: string
): Promise<{ url: string; fileName: string }> {
  const cleanCloudName = normalizeCloudinaryCloudName(cloudName);
  const cleanPreset = (uploadPreset || '').trim() || 'bel_sekolah';
  if (!cleanCloudName || !/^[a-zA-Z0-9_-]+$/.test(cleanCloudName)) {
    throw new Error(
      'Cloud Name Cloudinary tidak valid. Isi hanya nama pendek Cloud Name (misal: dxyz123abc).'
    );
  }

  try {
    try {
      return await attemptDirectCloudinaryUpload(fileOrBlob, fileName, cleanCloudName, cleanPreset);
    } catch (firstErr: any) {
      const msg = String(firstErr?.message || '').toLowerCase();
      if (
        (msg.includes('preset') || msg.includes('unsigned')) &&
        cleanPreset !== cleanPreset.toLowerCase()
      ) {
        return await attemptDirectCloudinaryUpload(
          fileOrBlob,
          fileName,
          cleanCloudName,
          cleanPreset.toLowerCase()
        );
      }
      throw firstErr;
    }
  } catch (directErr: any) {
    // Only fall back to server relay on network/CORS/fetch failure (not on explicit 4xx Cloudinary error)
    const msg = String(directErr?.message || '');
    const isNetworkBlock =
      directErr instanceof TypeError ||
      msg.toLowerCase().includes('failed to fetch') ||
      msg.toLowerCase().includes('networkerror') ||
      msg.toLowerCase().includes('load failed');

    if (!isNetworkBlock) {
      throw directErr;
    }

    // Try same-origin server relay (works up to ~3MB on Vercel serverless, 20MB on Express Preview)
    const dataUrl = await blobToDataUrl(fileOrBlob);
    const relayRes = await fetch('/api/audio/cloudinary-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cloudName: cleanCloudName,
        uploadPreset: cleanPreset,
        fileName,
        dataUrl,
      }),
    });

    const relayData = await relayRes.json().catch(() => ({}));
    if (!relayRes.ok || !relayData?.url) {
      if (relayRes.status === 413) {
        throw new Error(
          'Ukuran file terlalu besar untuk relay server (>3MB). Matikan pemblokir iklan untuk api.cloudinary.com atau pakai Link Cloud (Google Drive).'
        );
      }
      throw new Error(
        relayData?.error ||
          'Koneksi ke server Cloudinary terblokir oleh jaringan/browser. Periksa koneksi internet atau Cloud Name Anda.'
      );
    }

    return {
      url: relayData.url,
      fileName: relayData.fileName || fileName,
    };
  }
}
