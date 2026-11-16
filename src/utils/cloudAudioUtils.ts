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

/**
 * Upload an audio File or Blob directly to Cloudinary using an Unsigned Upload Preset
 */
export async function uploadAudioToCloudinary(
  fileOrBlob: File | Blob,
  fileName: string,
  cloudName: string,
  uploadPreset: string = 'bel_sekolah'
): Promise<{ url: string; fileName: string }> {
  const formData = new FormData();
  formData.append('file', fileOrBlob, fileName);
  formData.append('upload_preset', uploadPreset);
  formData.append('resource_type', 'auto');

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Gagal upload ke Cloudinary (${response.statusText})`);
  }

  const data = await response.json();
  return {
    url: data.secure_url || data.url,
    fileName: fileName,
  };
}
