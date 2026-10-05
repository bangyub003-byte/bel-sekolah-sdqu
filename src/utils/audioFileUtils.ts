/**
 * Audio File Upload & Format Helpers
 * Comprehensive support for Android Phone Voice Recordings (AAC, M4A, 3GP, AMR, etc.)
 * as well as standard audio formats (MP3, WAV, OGG, Opus, WebM, FLAC).
 */

export const AUDIO_FILE_ACCEPT =
  'audio/*,.aac,.acc,.m4a,.3gp,.3gpp,.amr,.mp3,.wav,.ogg,.opus,.webm,.flac,.mp4,audio/aac,audio/x-aac,audio/m4a,audio/x-m4a,audio/mp4,audio/3gpp,audio/3gpp2,audio/amr,audio/mpeg,audio/wav,audio/ogg,video/3gpp';

export const SUPPORTED_AUDIO_EXTENSIONS = [
  'aac',
  'acc',
  'm4a',
  '3gp',
  '3gpp',
  'amr',
  'mp3',
  'wav',
  'ogg',
  'opus',
  'webm',
  'flac',
  'mp4',
  'wma',
  'oga',
];

/**
 * Checks if the uploaded file is a valid audio file or mobile voice recording
 */
export function isAudioFile(file: File): boolean {
  if (!file) return false;

  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();

  // 1. Direct audio MIME check
  if (fileType.startsWith('audio/')) return true;

  // 2. Video container commonly used for voice recordings on Android (e.g., 3gp, mp4 voice memos)
  if (fileType.startsWith('video/3gpp') || fileType.startsWith('video/mp4')) return true;

  // 3. Known audio mime types or application/ogg
  const knownMimeTypes = [
    'audio/aac',
    'audio/x-aac',
    'audio/m4a',
    'audio/x-m4a',
    'audio/mp4',
    'audio/3gpp',
    'audio/3gpp2',
    'audio/amr',
    'audio/amr-wb',
    'audio/wav',
    'audio/x-wav',
    'audio/mpeg',
    'audio/mp3',
    'audio/ogg',
    'audio/opus',
    'audio/webm',
    'audio/flac',
    'application/ogg',
    'application/x-ogg',
  ];
  if (knownMimeTypes.includes(fileType)) return true;

  // 4. Check by file extension (Crucial for Android where file.type is sometimes empty or application/octet-stream)
  const extMatch = fileName.match(/\.([a-z0-9]+)$/i);
  if (extMatch && SUPPORTED_AUDIO_EXTENSIONS.includes(extMatch[1].toLowerCase())) {
    return true;
  }

  return false;
}

/**
 * Get human-readable format label
 */
export function getAudioFormatLabel(fileName: string, mimeType?: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (ext === 'aac' || ext === 'acc' || mimeType?.includes('aac')) {
    return 'AAC (Rekaman HP Android)';
  }
  if (ext === 'm4a' || mimeType?.includes('m4a')) {
    return 'M4A (Voice Recorder / iOS)';
  }
  if (ext === '3gp' || ext === '3gpp' || mimeType?.includes('3gpp')) {
    return '3GP (Perekam Android)';
  }
  if (ext === 'amr' || mimeType?.includes('amr')) {
    return 'AMR (Voice Note)';
  }
  if (ext === 'mp3' || mimeType?.includes('mpeg') || mimeType?.includes('mp3')) {
    return 'MP3 Audio';
  }
  if (ext === 'wav' || mimeType?.includes('wav')) {
    return 'WAV Audio (Studio High Quality)';
  }
  if (ext === 'ogg' || ext === 'opus' || mimeType?.includes('ogg') || mimeType?.includes('opus')) {
    return 'OGG / Opus Audio';
  }
  if (ext === 'webm' || mimeType?.includes('webm')) {
    return 'WebM Audio';
  }
  if (ext === 'flac' || mimeType?.includes('flac')) {
    return 'FLAC Lossless';
  }

  return ext ? `${ext.toUpperCase()} Audio` : 'Berkas Audio';
}

/**
 * Ensures data URL has proper audio MIME type so browser Audio element can play it without error
 */
export function normalizeAudioDataUrl(dataUrl: string, fileName: string): string {
  if (!dataUrl.startsWith('data:')) return dataUrl;

  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  // Get MIME from data URL
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return dataUrl;
  const header = dataUrl.substring(0, commaIdx);
  const base64Data = dataUrl.substring(commaIdx + 1);

  // If MIME is generic, missing, video, or octet-stream (often happens with Android file picker uploads)
  const isGeneric =
    header.includes('application/octet-stream') ||
    header.includes('binary/octet-stream') ||
    header === 'data:' ||
    header === 'data:;' ||
    header.includes('video/3gpp') ||
    header.includes('video/mp4') ||
    header.includes('audio/aac') ||
    header.includes('audio/x-aac');

  if (isGeneric || ext === 'aac' || ext === 'acc' || ext === 'm4a') {
    let mime = 'audio/aac';
    if (ext === 'aac' || ext === 'acc') mime = 'audio/aac';
    else if (ext === 'm4a' || ext === 'mp4') mime = 'audio/mp4';
    else if (ext === '3gp' || ext === '3gpp') mime = 'audio/3gpp';
    else if (ext === 'amr') mime = 'audio/amr';
    else if (ext === 'mp3') mime = 'audio/mpeg';
    else if (ext === 'wav') mime = 'audio/wav';
    else if (ext === 'ogg' || ext === 'oga') mime = 'audio/ogg';
    else if (ext === 'opus') mime = 'audio/opus';
    else if (ext === 'webm') mime = 'audio/webm';
    else if (ext === 'flac') mime = 'audio/flac';

    return `data:${mime};base64,${base64Data}`;
  }

  return dataUrl;
}

export interface ProcessedAudioResult {
  dataUrl: string;
  fileName: string;
  duration?: number;
  formatLabel: string;
  sizeBytes: number;
}

/**
 * Process and convert uploaded audio file to playable Base64 data URL
 */
export async function processAudioFile(
  file: File,
  maxSizeBytes = 25 * 1024 * 1024
): Promise<ProcessedAudioResult> {
  if (!isAudioFile(file)) {
    throw new Error(
      'Format file tidak dikenali sebagai audio. Gunakan rekaman suara HP Android (.aac, .m4a, .3gp, .amr), MP3, WAV, atau OGG.'
    );
  }

  if (file.size > maxSizeBytes) {
    const maxMb = Math.round(maxSizeBytes / (1024 * 1024));
    throw new Error(`Ukuran file terlalu besar (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maksimal ukuran adalah ${maxMb} MB.`);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Gagal membaca file dari penyimpanan perangkat.'));
    };

    reader.onload = () => {
      const rawDataUrl = reader.result as string;
      const normalizedDataUrl = normalizeAudioDataUrl(rawDataUrl, file.name);
      const formatLabel = getAudioFormatLabel(file.name, file.type);

      // Attempt to load duration in background
      try {
        const audio = new Audio(normalizedDataUrl);
        const timeout = setTimeout(() => {
          resolve({
            dataUrl: normalizedDataUrl,
            fileName: file.name,
            formatLabel,
            sizeBytes: file.size,
          });
        }, 600);

        audio.onloadedmetadata = () => {
          clearTimeout(timeout);
          const dur = audio.duration && !isNaN(audio.duration) && isFinite(audio.duration) ? Math.round(audio.duration) : undefined;
          resolve({
            dataUrl: normalizedDataUrl,
            fileName: file.name,
            duration: dur,
            formatLabel,
            sizeBytes: file.size,
          });
        };

        audio.onerror = () => {
          clearTimeout(timeout);
          // Still resolve because some browsers might load it on explicit play
          resolve({
            dataUrl: normalizedDataUrl,
            fileName: file.name,
            formatLabel,
            sizeBytes: file.size,
          });
        };
      } catch {
        resolve({
          dataUrl: normalizedDataUrl,
          fileName: file.name,
          formatLabel,
          sizeBytes: file.size,
        });
      }
    };

    reader.readAsDataURL(file);
  });
}
