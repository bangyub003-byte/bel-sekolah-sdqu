import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Upload,
  Mic,
  Plus,
  Play,
  Pause,
  Trash2,
  CheckCircle2,
  Music,
  Sparkles,
  Volume2,
  Sliders,
  Radio,
  FileAudio,
  Download,
  AlertCircle,
  X,
  VolumeX,
  Layers,
  Info,
  Check,
  Smartphone,
  Globe,
  Scissors,
  Square,
  Clock,
} from 'lucide-react';
import { AudioSettings, CustomChime, BuiltinChimeType, ChimeType, ScheduleItem, PostBellTrack } from '../types';
import {
  playChimeTone,
  playBellSequence,
  playPostBellTrack,
  BellPlaybackState,
  subscribeBellPlaybackState,
  togglePauseBellPlayback,
  stopAllBellAudio,
} from '../utils/audioSynth';
import { playUniversalAudio, stopAllCustomAudio } from '../utils/universalAudioPlayer';
import {
  AUDIO_FILE_ACCEPT,
  processAudioFile,
  getAudioFormatLabel,
  isAudioFile,
} from '../utils/audioFileUtils';
import { normalizeAudioCloudUrl, isCloudAudioUrl, uploadAudioToCloudinary } from '../utils/cloudAudioUtils';
import {
  saveAudioBlobToIDB,
  getAudioBlobFromIDB,
  deleteAudioBlobFromIDB,
  IDB_AUDIO_PREFIX,
} from '../utils/audioBlobStore';
import { AudioTrimmerModal } from './AudioTrimmerModal';

interface ChimeManagerProps {
  settings: AudioSettings;
  onUpdateSettings: (newSettings: AudioSettings) => void;
  onLogBell?: (label: string, text: string) => void;
  schedules?: ScheduleItem[];
}

export const ChimeManager: React.FC<ChimeManagerProps> = ({
  settings,
  onUpdateSettings,
  onLogBell,
  schedules = [],
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'record' | 'url'>('upload');
  const [cloudUrlInput, setCloudUrlInput] = useState('');

  // Form State
  const [chimeName, setChimeName] = useState('');
  const [chimeCategory, setChimeCategory] = useState<'classic' | 'islamic' | 'modern' | 'jingle' | 'custom'>('custom');
  const [chimeDesc, setChimeDesc] = useState('');
  const [audioDataUrl, setAudioDataUrl] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string>('');
  const [audioDuration, setAudioDuration] = useState<number | undefined>(undefined);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);

  // Playback testing state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Full Sequence Test
  const [testText, setTestText] = useState('waktu istirahat telah tiba. Selamat beristirahat.');
  const [isTestingSequence, setIsTestingSequence] = useState(false);
  const [selectedChimeForTest, setSelectedChimeForTest] = useState<ChimeType>(
    settings.defaultChimeId || 'westminster'
  );
  const [selectedOutroForTest, setSelectedOutroForTest] = useState<ChimeType | 'none' | 'same_as_intro'>('none');
  const [enableOutroForTest, setEnableOutroForTest] = useState<boolean>(false);

  const customChimes = settings.customChimes || [];
  const postBellTracks = settings.postBellTracks || [];
  const defaultChimeId = settings.defaultChimeId;
  const useCustomDefaultChime = settings.useCustomDefaultChime ?? false;

  const [bellPlayback, setBellPlayback] = useState<BellPlaybackState | null>(null);

  useEffect(() => {
    return subscribeBellPlaybackState((s) => {
      setBellPlayback(s);
      if (!s.isPlaying) {
        setIsTestingSequence(false);
      }
    });
  }, []);

  // Audio Trimmer modal state (for saved custom chimes, post-bell tracks, and drafts)
  const [trimmerTarget, setTrimmerTarget] = useState<{
    mode: 'draft' | 'existing' | 'post_bell_draft' | 'post_bell_existing';
    chime?: CustomChime;
    postBellTrack?: PostBellTrack;
    audioUrl: string;
    title: string;
    fileName: string;
  } | null>(null);

  // Modal & Form State for Section 4: Post-Bell Scheduled Tracks
  const [isPostBellModalOpen, setIsPostBellModalOpen] = useState(false);
  const [postBellInputTab, setPostBellInputTab] = useState<'upload' | 'url'>('upload');
  const [postBellName, setPostBellName] = useState('');
  const [postBellTargetKey, setPostBellTargetKey] = useState<string>('custom_time'); // 'all' | 'custom_time' | scheduleId
  const [postBellCustomTime, setPostBellCustomTime] = useState('13:45');
  const [postBellAudioUrl, setPostBellAudioUrl] = useState<string | null>(null);
  const [postBellAudioName, setPostBellAudioName] = useState('');
  const [postBellDuration, setPostBellDuration] = useState<number | undefined>(undefined);
  const [postBellCloudUrlInput, setPostBellCloudUrlInput] = useState('');
  const [postBellVolume, setPostBellVolume] = useState(1.0);
  const [isUploadingPostBell, setIsUploadingPostBell] = useState(false);
  const [postBellUploadError, setPostBellUploadError] = useState<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  // Builtin chime presets
  const builtinChimes: { id: BuiltinChimeType; name: string; desc: string; category: string }[] = [
    {
      id: 'westminster',
      name: 'Westminster 8-Tone Chime (6.8s - Bel Masuk)',
      desc: 'Melodi lonceng 8 nada Westminster (durasi 6.8 detik), standar internasional bel masuk sekolah terdengar agung & jelas.',
      category: 'Masuk & Pelajaran',
    },
    {
      id: 'classic_3tone',
      name: '6-Tone Ascending Chime (5.8s - Ganti Jam)',
      desc: 'Melodi tangga nada ceria 6 ketuk Do-Mi-Sol (durasi 5.8 detik) untuk tanda pergantian jam pelajaran murid.',
      category: 'Harmoni & Jam Baru',
    },
    {
      id: 'tube_chime',
      name: 'Tubular Chime Lembut (5.8s - Istirahat)',
      desc: 'Resonansi lonceng tabung akustik 4 ketuk lembut (durasi 5.8 detik) untuk waktu istirahat dan perpustakaan.',
      category: 'Istirahat & Tenang',
    },
    {
      id: 'islamic_duo',
      name: 'Melodi Islami Maqam (6.2s - Sholat/Tilawah)',
      desc: 'Harmoni nada syahdu Islami 5 ketuk (durasi 6.2 detik) untuk waktu tahfidz, dzuhur berjamaah, dan murottal.',
      category: 'Islami & Sholat',
    },
    {
      id: 'school_dismissal',
      name: 'Melodi Pulang Ceria (6.2s - Siswa Senang)',
      desc: 'Fanfare lonceng riang 8 ketukan kepulangan sekolah (durasi 6.2 detik) membuat murid senang menyambut waktu pulang.',
      category: 'Pulang Sekolah',
    },
    {
      id: 'electric_bell',
      name: 'Bel Listrik Sekolah Kencang (10s - 3x Dering)',
      desc: 'Dering lonceng listrik mekanik sekolah bergetar kencang 10 detik dengan 3 siklus dering tanda pulang / alarm tegas.',
      category: 'Bel Pulang / Alarm',
    },
    {
      id: 'fire_bell',
      name: 'Bel Alarm Pemadam / Gong (10s - 3x Dentang)',
      desc: 'Gong lonceng alarm pemadam kebakaran nyaring kencang 10 detik (3 siklus dentang) tanda pulang atau darurat.',
      category: 'Bel Pulang / Alarm',
    },
  ];

  const stopPreviewFnRef = useRef<(() => void) | null>(null);

  // Play audio preview with universal decoder (solves AAC, M4A, 3GP, AMR playback)
  const handlePlayPreview = async (id: string, url?: string, isBuiltin = false) => {
    if (playingId === id) {
      // Stop
      if (stopPreviewFnRef.current) {
        stopPreviewFnRef.current();
        stopPreviewFnRef.current = null;
      }
      stopAllCustomAudio();
      setPlayingId(null);
      return;
    }

    // Stop previous playing
    if (stopPreviewFnRef.current) {
      stopPreviewFnRef.current();
      stopPreviewFnRef.current = null;
    }
    stopAllCustomAudio();

    setPlayingId(id);

    if (isBuiltin) {
      playChimeTone(id as BuiltinChimeType, settings.chimeVolume || 1.0).finally(() => {
        setPlayingId(null);
      });
    } else if (url) {
      try {
        const stopFn = await playUniversalAudio(url, settings.chimeVolume || 1.0, () => {
          setPlayingId(null);
          stopPreviewFnRef.current = null;
        });
        stopPreviewFnRef.current = stopFn;
      } catch (err: any) {
        console.warn('Audio preview warning in ChimeManager:', err?.message || err);
        setUploadError(err?.message || 'Gagal memutar audio nada dering. Pastikan file valid atau link bersifat publik.');
        setPlayingId(null);
      }
    }
  };

  const openTrimmer = (target: {
    mode: 'draft' | 'existing' | 'post_bell_draft' | 'post_bell_existing';
    chime?: CustomChime;
    postBellTrack?: PostBellTrack;
    audioUrl: string;
    title: string;
    fileName: string;
  }) => {
    if (stopPreviewFnRef.current) {
      stopPreviewFnRef.current();
      stopPreviewFnRef.current = null;
    }
    stopAllCustomAudio();
    setPlayingId(null);
    setTrimmerTarget(target);
  };

  // Upload large/long audio for Post-Bell Scheduled Playback (uses Cloudinary or IndexedDB automatically)
  const handlePostBellFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setPostBellUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isAudioFile(file)) {
      setPostBellUploadError(
        'Format file tidak dikenali sebagai audio. Gunakan MP3, WAV, M4A, AAC, OGG, atau rekaman HP.'
      );
      e.target.value = '';
      return;
    }

    setIsUploadingPostBell(true);
    try {
      const cleanDefaultName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
      if (!postBellName.trim()) {
        setPostBellName(
          cleanDefaultName
            ? cleanDefaultName.charAt(0).toUpperCase() + cleanDefaultName.slice(1)
            : 'Rekaman Setelah Bel'
        );
      }

      if (settings.cloudinaryCloudName?.trim()) {
        try {
          const uploaded = await uploadAudioToCloudinary(
            file,
            file.name,
            settings.cloudinaryCloudName,
            settings.cloudinaryUploadPreset
          );
          setPostBellAudioName(uploaded.fileName);
          setPostBellAudioUrl(uploaded.url);
          const dur = await probeDurationSec(file);
          if (dur) setPostBellDuration(dur);
          return;
        } catch (cloudErr: any) {
          console.warn('Cloudinary upload fallback to local IndexedDB for post-bell audio:', cloudErr);
          setPostBellUploadError(
            `Upload ke Cloudinary gagal (${cloudErr?.message || 'periksa Cloud Name / Unsigned Preset'}). Rekaman tetap disimpan secara lokal.`
          );
        }
      }

      // Extract duration cleanly
      const dur = await probeDurationSec(file);
      if (dur) setPostBellDuration(dur);

      // Files <= 150KB can stay inline dataUrl, larger files go straight to IndexedDB
      if (file.size <= 150 * 1024) {
        const processed = await processAudioFile(file, 2 * 1024 * 1024);
        setPostBellAudioName(processed.fileName);
        setPostBellAudioUrl(processed.dataUrl);
        if (processed.duration) setPostBellDuration(processed.duration);
      } else {
        const idbKey = `postbell_${Date.now()}`;
        const idbRef = await saveAudioBlobToIDB(idbKey, file);
        setPostBellAudioName(file.name);
        setPostBellAudioUrl(idbRef);
      }
    } catch (err: any) {
      setPostBellUploadError(err?.message || 'Gagal memuat file rekaman tambahan.');
    } finally {
      setIsUploadingPostBell(false);
      e.target.value = '';
    }
  };

  const handleSavePostBellTrack = (e: React.FormEvent) => {
    e.preventDefault();
    setPostBellUploadError(null);
    if (!postBellAudioUrl) {
      setPostBellUploadError('Mohon pilih file audio atau masukkan Link Cloud terlebih dahulu.');
      return;
    }

    const resolvedName =
      postBellName.trim() ||
      postBellAudioName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim() ||
      'Rekaman Setelah Bel';

    let resolvedScheduleId: string | undefined = undefined;
    let resolvedScheduleTime: string | undefined = undefined;

    if (postBellTargetKey === 'all') {
      resolvedScheduleId = 'all';
    } else if (postBellTargetKey === 'custom_time') {
      resolvedScheduleTime = postBellCustomTime || '13:45';
    } else {
      const matched = schedules.find((s) => s.id === postBellTargetKey);
      resolvedScheduleId = postBellTargetKey;
      resolvedScheduleTime = matched?.time;
    }

    const newTrack: PostBellTrack = {
      id: `postbell_${Date.now()}`,
      name: resolvedName,
      audioUrl: postBellAudioUrl,
      audioName: postBellAudioName || 'Rekaman Tambahan',
      scheduleId: resolvedScheduleId,
      scheduleTime: resolvedScheduleTime,
      volume: postBellVolume,
      enabled: true,
      durationSec: postBellDuration,
      createdAt: Date.now(),
    };

    onUpdateSettings({
      ...settings,
      postBellTracks: [newTrack, ...postBellTracks],
    });

    setIsPostBellModalOpen(false);
    setPostBellName('');
    setPostBellAudioUrl(null);
    setPostBellAudioName('');
    setPostBellDuration(undefined);
    setPostBellCloudUrlInput('');
    setPostBellVolume(1.0);
  };

  const handleTogglePostBellTrack = (id: string) => {
    onUpdateSettings({
      ...settings,
      postBellTracks: postBellTracks.map((t) =>
        t.id === id ? { ...t, enabled: !t.enabled } : t
      ),
    });
  };

  const handleDeletePostBellTrack = (track: PostBellTrack) => {
    if (!confirm(`Hapus rekaman tambahan "${track.name}"?`)) return;
    if (bellPlayback?.postBellTrackId === track.id) {
      stopAllBellAudio();
    }
    deleteAudioBlobFromIDB(track.audioUrl);
    onUpdateSettings({
      ...settings,
      postBellTracks: postBellTracks.filter((t) => t.id !== track.id),
    });
  };

  const formatDurationLabel = (secs?: number) => {
    if (!secs || secs <= 0) return null;
    if (secs >= 60) {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${m}m ${String(s).padStart(2, '0')}d`;
    }
    return `${secs}d`;
  };

  // Handle File Upload (Supports AAC, M4A, 3GP, AMR, MP3, WAV, OGG, etc.)
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [cloudinaryWarning, setCloudinaryWarning] = useState<string | null>(null);

  const probeDurationSec = async (source: File | Blob | string): Promise<number | undefined> => {
    let createdObjUrl: string | null = null;
    try {
      const targetUrl =
        typeof source === 'string' ? source : (createdObjUrl = URL.createObjectURL(source));
      const audio = new Audio(targetUrl);
      return await new Promise<number | undefined>((resolve) => {
        const done = (val?: number) => {
          if (createdObjUrl) URL.revokeObjectURL(createdObjUrl);
          resolve(val);
        };
        const timer = setTimeout(() => done(undefined), 2000);
        audio.onloadedmetadata = () => {
          clearTimeout(timer);
          done(isFinite(audio.duration) && audio.duration > 0 ? Math.round(audio.duration) : undefined);
        };
        audio.onerror = () => {
          clearTimeout(timer);
          done(undefined);
        };
      });
    } catch {
      if (createdObjUrl) URL.revokeObjectURL(createdObjUrl);
      return undefined;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setCloudinaryWarning(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isAudioFile(file)) {
      setUploadError(
        'Format file tidak dikenali sebagai audio. Gunakan rekaman HP (.aac, .m4a, .3gp, .amr), MP3, WAV, atau OGG.'
      );
      e.target.value = '';
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setUploadError(
        `Ukuran file terlalu besar (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maksimal ukuran adalah 25 MB.`
      );
      e.target.value = '';
      return;
    }

    setIsProcessingUpload(true);
    try {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
      const autoTitle = cleanName ? cleanName.charAt(0).toUpperCase() + cleanName.slice(1) : 'Nada Dering Kustom';

      if (settings.cloudinaryCloudName?.trim()) {
        try {
          const uploaded = await uploadAudioToCloudinary(
            file,
            file.name,
            settings.cloudinaryCloudName,
            settings.cloudinaryUploadPreset
          );
          setAudioFileName(uploaded.fileName);
          setAudioDataUrl(uploaded.url);
          const dur = await probeDurationSec(file);
          if (dur) setAudioDuration(dur);
          if (!chimeName.trim()) {
            setChimeName(autoTitle);
          }
          return;
        } catch (cloudErr: any) {
          console.warn('Cloudinary upload fallback to local storage:', cloudErr);
          setCloudinaryWarning(
            `Upload ke Cloudinary gagal (${cloudErr?.message || 'periksa Cloud Name / Unsigned Preset'}). Audio tetap siap disimpan lokal di perangkat ini.`
          );
        }
      }

      if (file.size <= 150 * 1024) {
        const processed = await processAudioFile(file, 25 * 1024 * 1024);
        setAudioFileName(processed.fileName);
        setAudioDataUrl(processed.dataUrl);
        if (processed.duration) {
          setAudioDuration(processed.duration);
        }
      } else {
        // Store audio files > 150KB cleanly in IndexedDB so localStorage quota is never exceeded
        const dur = await probeDurationSec(file);
        const idbRef = await saveAudioBlobToIDB(`chime_${Date.now()}`, file);
        setAudioFileName(file.name);
        setAudioDataUrl(idbRef);
        if (dur) setAudioDuration(dur);
      }

      if (!chimeName.trim()) {
        setChimeName(autoTitle);
      }
    } catch (err: any) {
      console.error('File upload error:', err);
      setUploadError(err.message || 'Gagal memproses file audio.');
    } finally {
      setIsProcessingUpload(false);
      e.target.value = '';
    }
  };

  // Microphone Recording
  const startRecording = async () => {
    setUploadError(null);
    setCloudinaryWarning(null);
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Always release microphone tracks immediately
        stream.getTracks().forEach((track) => track.stop());

        const actualMime = mediaRecorder.mimeType || audioChunksRef.current[0]?.type || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });
        if (audioBlob.size < 64) {
          setUploadError('Rekaman terlalu singkat atau kosong. Silakan rekam ulang.');
          return;
        }

        const ext = actualMime.includes('mp4') ? 'm4a' : actualMime.includes('ogg') ? 'ogg' : 'webm';
        const generatedName = `Rekaman_Nada_${new Date().toISOString().slice(11, 19).replace(/:/g, '')}.${ext}`;
        if (!chimeName.trim()) {
          setChimeName('Rekaman Nada Bel');
        }

        if (settings.cloudinaryCloudName?.trim()) {
          setIsProcessingUpload(true);
          try {
            const uploaded = await uploadAudioToCloudinary(
              audioBlob,
              generatedName,
              settings.cloudinaryCloudName,
              settings.cloudinaryUploadPreset
            );
            setAudioDataUrl(uploaded.url);
            setAudioFileName(generatedName);
            setAudioDuration(recordingSeconds);
            return;
          } catch (cloudErr: any) {
            console.warn('Cloudinary upload fallback to local for recorded chime:', cloudErr);
            setCloudinaryWarning(
              `Upload ke Cloudinary gagal (${cloudErr?.message || 'periksa preset Unsigned'}). Rekaman tetap siap disimpan lokal di perangkat ini.`
            );
          } finally {
            setIsProcessingUpload(false);
          }
        }

        if (audioBlob.size > 150 * 1024) {
          try {
            const idbRef = await saveAudioBlobToIDB(`chime_rec_${Date.now()}`, audioBlob);
            setAudioDataUrl(idbRef);
            setAudioFileName(generatedName);
            setAudioDuration(recordingSeconds);
            return;
          } catch (idbErr: any) {
            setUploadError(idbErr?.message || 'Gagal menyimpan hasil rekaman.');
            return;
          }
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          setAudioDataUrl(base64data);
          setAudioFileName(generatedName);
          setAudioDuration(recordingSeconds);
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone error:', err);
      setUploadError('Tidak dapat mengakses mikrofon. Pastikan izin mikrofon telah diberikan di peramban Anda.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  };

  // Save New Custom Chime
  const handleSaveCustomChime = (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    if (!audioDataUrl) {
      setUploadError('Mohon pilih file audio, rekam suara, atau tempel Link Cloud terlebih dahulu.');
      return;
    }

    const resolvedName =
      chimeName.trim() ||
      audioFileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim() ||
      'Nada Dering Kustom';

    const newChime: CustomChime = {
      id: `custom_${Date.now()}`,
      name: resolvedName,
      description: chimeDesc.trim() || undefined,
      audioUrl: audioDataUrl,
      audioName: audioFileName || 'Custom Nada Dering',
      category: chimeCategory,
      durationSec: audioDuration,
      createdAt: Date.now(),
    };

    const updatedList = [newChime, ...customChimes];

    onUpdateSettings({
      ...settings,
      customChimes: updatedList,
      // If no default chime set, set this one
      defaultChimeId: defaultChimeId || newChime.id,
      useCustomDefaultChime: true,
    });

    // Reset Form
    setIsModalOpen(false);
    setChimeName('');
    setChimeDesc('');
    setAudioDataUrl(null);
    setAudioFileName('');
    setAudioDuration(undefined);
    setCloudUrlInput('');
    setCloudinaryWarning(null);
    setUploadError(null);
    setRecordingSeconds(0);
  };

  // Set as Global Default Chime
  const handleSetDefaultChime = (id: string) => {
    onUpdateSettings({
      ...settings,
      defaultChimeId: id,
      useCustomDefaultChime: true,
    });
  };

  // Toggle Use Custom Default Chime
  const handleToggleUseCustomDefault = (enabled: boolean) => {
    onUpdateSettings({
      ...settings,
      useCustomDefaultChime: enabled,
    });
  };

  // Delete Custom Chime
  const handleDeleteCustomChime = (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus nada dering kustom ini?')) return;

    const target = customChimes.find((c) => c.id === id);
    if (target?.audioUrl) {
      deleteAudioBlobFromIDB(target.audioUrl);
    }

    const updated = customChimes.filter((c) => c.id !== id);
    const newDefault = defaultChimeId === id ? updated[0]?.id || 'westminster' : defaultChimeId;

    onUpdateSettings({
      ...settings,
      customChimes: updated,
      defaultChimeId: newDefault,
      useCustomDefaultChime: updated.length > 0 ? settings.useCustomDefaultChime : false,
    });
  };

  // Download Audio File
  const handleDownloadAudio = async (chime: CustomChime) => {
    const fileName = chime.audioName || `${chime.name.replace(/\s+/g, '_')}.mp3`;
    if (chime.audioUrl.startsWith(IDB_AUDIO_PREFIX)) {
      try {
        const blob = await getAudioBlobFromIDB(chime.audioUrl);
        if (!blob) return;
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(objUrl), 2000);
      } catch (err) {
        console.error('Download IDB audio error:', err);
      }
      return;
    }
    const a = document.createElement('a');
    a.href = chime.audioUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Test Full Sequence
  const handleTestFullSequence = async () => {
    if (isTestingSequence) return;
    setIsTestingSequence(true);

    try {
      const full = `${settings.globalPrefix}${testText}`;
      await playBellSequence(
        selectedChimeForTest,
        full,
        settings,
        1.0,
        undefined,
        settings.useClonedVoice ? 'cloned' : 'tts',
        undefined,
        undefined,
        enableOutroForTest,
        selectedOutroForTest
      );
      if (onLogBell) {
        onLogBell('Uji Coba Nada Dering & Bel', full);
      }
    } catch (err) {
      console.error('Test full sequence error:', err);
    } finally {
      setIsTestingSequence(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner & Header */}
      <div className="bg-white border border-blue-100 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        {/* Ambient background blur */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-100/50 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-sky-50/50 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold uppercase tracking-wider shadow-xs">
              <Music className="w-3.5 h-3.5 text-blue-600" />
              <span>Kustomisasi Nada Dering Bel Sekolah</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <span>Menu Ubah Suara Nada Dering Bel</span>
              <span className="text-xs bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-lg font-bold uppercase">
                MP3 / WAV / Rekaman
              </span>
            </h2>

            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              Pilih dari koleksi nada dering standar atau masukkan/unggah file nada dering bel unik buatan Anda sendiri (lagu mars sekolah, jingle Islami, lonceng gamelan, sirine MP3, dsb).
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTab('upload');
                setIsModalOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-3 rounded-2xl text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-blue-500/25 active:scale-95 transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4 stroke-[2.5]" />
              <span>Unggah File Nada Bel</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('record');
                setIsModalOpen(true);
              }}
              className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              <Mic className="w-4 h-4 text-blue-600" />
              <span>Rekam dari Mikrofon</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global Default Ringtone Setting Card */}
      <div className="bg-white border border-blue-100 rounded-3xl p-6 space-y-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-blue-600" />
              <span>Pengaturan Nada Dering Utama (Global Default)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Tentukan nada dering yang berbunyi secara otomatis sebelum pengumuman suara bel dibacakan.
            </p>
          </div>

          <label className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-2xl cursor-pointer hover:border-blue-300 transition-all">
            <input
              type="checkbox"
              checked={useCustomDefaultChime && customChimes.length > 0}
              disabled={customChimes.length === 0}
              onChange={(e) => handleToggleUseCustomDefault(e.target.checked)}
              className="w-4 h-4 accent-blue-600 cursor-pointer disabled:opacity-40"
            />
            <span className="text-xs font-bold text-slate-800">
              {useCustomDefaultChime ? 'Pakai Nada Kustom Sendiri' : 'Pakai Nada Sintesis Bawaan'}
            </span>
          </label>
        </div>

        {/* Volume Slider for Chime Tone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                Volume Nada Dering Bel
              </span>
              <span className="font-mono text-emerald-400 font-bold">
                {Math.round((settings.chimeVolume ?? 1.0) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.chimeVolume ?? 1.0}
              onChange={(e) =>
                onUpdateSettings({ ...settings, chimeVolume: parseFloat(e.target.value) })
              }
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
            <span className="text-xs font-bold text-slate-300 block">Status Nada Dering Aktif:</span>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-bold text-emerald-300">
                {useCustomDefaultChime && defaultChimeId
                  ? customChimes.find((c) => c.id === defaultChimeId)?.name || 'Nada Kustom Aktif'
                  : 'Westminster Quarters (4-Nada Bawaan)'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              {useCustomDefaultChime
                ? 'Semua bel otomatis akan menggunakan file nada dering yang Anda tentukan.'
                : 'Bel menggunakan sintesis nada lonceng digital Web Audio offline.'}
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 1: Custom Uploaded & Recorded Chimes Library */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <FileAudio className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Koleksi Nada Dering Bel Kustom Anda ({customChimes.length})
              </h3>
              <p className="text-xs text-slate-400">
                File audio yang telah Anda masukkan ke dalam aplikasi
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setActiveTab('upload');
              setIsModalOpen(true);
            }}
            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Nada Baru</span>
          </button>
        </div>

        {customChimes.length === 0 ? (
          <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-3xl p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
              <Music className="w-7 h-7" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h4 className="text-sm font-bold text-white">Belum Ada Nada Dering Kustom</h4>
              <p className="text-xs text-slate-400">
                Anda dapat memasukkan file MP3/WAV lagu bel sekolah Anda, sirine, suara tabuh bedug/lonceng asli, atau merekam nada dering langsung dari mikrofon.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('upload');
                  setIsModalOpen(true);
                }}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer transition-all"
              >
                <Upload className="w-4 h-4" />
                <span>Unggah File Audio (MP3/WAV)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('record');
                  setIsModalOpen(true);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all"
              >
                <Mic className="w-4 h-4 text-emerald-400" />
                <span>Rekam Suara Nada</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customChimes.map((chime) => {
              const isDefault = defaultChimeId === chime.id && useCustomDefaultChime;
              const isPlaying = playingId === chime.id;

              return (
                <div
                  key={chime.id}
                  className={`p-5 rounded-2xl border transition-all space-y-4 relative ${
                    isDefault
                      ? 'bg-emerald-950/25 border-emerald-500 text-white ring-1 ring-emerald-500/50 shadow-lg shadow-emerald-950/40'
                      : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-white leading-tight">
                          {chime.name}
                        </h4>
                        {isDefault && (
                          <span className="bg-emerald-500 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                            <CheckCircle2 className="w-3 h-3" />
                            Default Utama
                          </span>
                        )}
                      </div>

                      {chime.description && (
                        <p className="text-xs text-slate-400 line-clamp-1">{chime.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 pt-1 font-mono">
                        <span className="bg-slate-800 px-2 py-0.5 rounded text-emerald-300">
                          {chime.category.toUpperCase()}
                        </span>
                        {isCloudAudioUrl(chime.audioUrl) ? (
                          <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded text-[9px] font-sans font-bold flex items-center gap-1">
                            <Globe className="w-2.5 h-2.5" />
                            Cloud Online
                          </span>
                        ) : (
                          chime.audioName && (
                            <span className="bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.5 rounded text-[9px] font-sans font-bold">
                              {getAudioFormatLabel(chime.audioName)}
                            </span>
                          )
                        )}
                        {chime.durationSec && (
                          <span>~{chime.durationSec}d</span>
                        )}
                        <span className="truncate max-w-[120px]">{chime.audioName}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          openTrimmer({
                            mode: 'existing',
                            chime,
                            audioUrl: chime.audioUrl,
                            title: chime.name,
                            fileName: chime.audioName || `${chime.name}.mp3`,
                          })
                        }
                        className="text-slate-400 hover:text-emerald-300 p-1.5 rounded-lg hover:bg-emerald-950/40 transition-colors cursor-pointer"
                        title="Potong / Cut Audio Nada Dering"
                      >
                        <Scissors className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadAudio(chime)}
                        className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Unduh File Audio"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomChime(chime.id)}
                        className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Hapus Nada Dering"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Play & Set Default Toolbar */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => handlePlayPreview(chime.id, chime.audioUrl, false)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isPlaying
                          ? 'bg-rose-500 text-white animate-pulse'
                          : 'bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/30'
                      }`}
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-3.5 h-3.5 fill-current" />
                          <span>Hentikan</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Dengarkan Nada</span>
                        </>
                      )}
                    </button>

                    {!isDefault && (
                      <button
                        type="button"
                        onClick={() => handleSetDefaultChime(chime.id)}
                        className="text-xs font-bold text-slate-300 hover:text-emerald-300 bg-slate-800 hover:bg-slate-750 px-3 py-2 rounded-xl transition-all cursor-pointer"
                      >
                        Jadikan Nada Utama
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: Built-in Precision Chimes */}
      <div className="space-y-4 pt-4 border-t border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">
              Nada Dering Digital Bawaan Sistem (5 Pilihan Sintesis)
            </h3>
            <p className="text-xs text-slate-400">
              Nada dering lonceng digital yang di-generate langsung oleh Web Audio API (100% offline & anti gagal)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {builtinChimes.map((preset) => {
            const isPlaying = playingId === preset.id;
            const isDefault = defaultChimeId === preset.id && !useCustomDefaultChime;

            return (
              <div
                key={preset.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 hover:border-slate-700 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[9px] bg-slate-800 text-cyan-400 px-2 py-0.5 rounded font-mono uppercase font-bold">
                      {preset.category}
                    </span>
                    <h4 className="text-sm font-black text-white mt-1">{preset.name}</h4>
                  </div>
                  {isDefault && (
                    <span className="bg-cyan-500 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-full">
                      Aktif
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-400">{preset.desc}</p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => handlePlayPreview(preset.id, undefined, true)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      isPlaying
                        ? 'bg-rose-500 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-cyan-300'
                    }`}
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5 fill-current" />
                        <span>Berhenti</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Tes Bunyi</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onUpdateSettings({
                        ...settings,
                        defaultChimeId: preset.id,
                        useCustomDefaultChime: false,
                      });
                    }}
                    className="text-[11px] font-bold text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                  >
                    Gunakan Preset Ini
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: Live Test & Sequence Simulator */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h3 className="text-base sm:text-lg font-extrabold text-white">
            Simulator Urutan Bel Lengkap (Nada Pembuka ➔ Pengumuman VO ➔ Nada Penutup)
          </h3>
        </div>
        <p className="text-xs text-slate-400">
          Simulasikan urutan suara bel seperti saat mengudara di speaker sekolah (Nada Dering Pembuka ➔ Jeda ➔ Suara Pengumuman ➔ Nada Dering Penutup ➔ Selesai).
        </p>

        {/* Workflow Diagram */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-2 text-xs">
          <div className="flex-1 text-center bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-2">
            <span className="text-[9px] text-emerald-400 font-bold block">1. Pembuka</span>
            <span className="text-white font-extrabold text-[11px] truncate block">
              {selectedChimeForTest}
            </span>
          </div>
          <span className="text-slate-500 font-bold">➜</span>
          <div className="flex-1 text-center bg-cyan-950/40 border border-cyan-500/30 rounded-xl p-2">
            <span className="text-[9px] text-cyan-400 font-bold block">2. Suara VO</span>
            <span className="text-white font-extrabold text-[11px] truncate block">
              Pengumuman
            </span>
          </div>
          <span className="text-slate-500 font-bold">➜</span>
          <div className={`flex-1 text-center rounded-xl p-2 border transition-all ${
            enableOutroForTest && selectedOutroForTest !== 'none'
              ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
              : 'bg-slate-900 border-slate-800 text-slate-500'
          }`}>
            <span className={`text-[9px] font-bold block ${enableOutroForTest && selectedOutroForTest !== 'none' ? 'text-amber-400' : 'text-slate-500'}`}>
              3. Penutup
            </span>
            <span className="font-extrabold text-[11px] truncate block">
              {enableOutroForTest && selectedOutroForTest !== 'none' ? selectedOutroForTest : 'Tanpa Outro'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          {/* 1. Intro Chime */}
          <div>
            <label className="block text-xs font-bold text-emerald-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>1. Nada Pembuka</span>
            </label>
            <select
              value={selectedChimeForTest}
              onChange={(e) => setSelectedChimeForTest(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <optgroup label="Nada Dering Kustom Buatan Anda">
                {customChimes.map((c) => (
                  <option key={c.id} value={c.id}>
                    ✨ {c.name} ({c.audioName})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Nada Dering Digital Bawaan">
                {builtinChimes.map((b) => (
                  <option key={b.id} value={b.id}>
                    🔔 {b.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* 3. Outro Chime */}
          <div>
            <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              <span>3. Nada Penutup (Outro)</span>
            </label>
            <select
              value={enableOutroForTest ? selectedOutroForTest : 'none'}
              onChange={(e) => {
                const val = e.target.value as any;
                if (val === 'none') {
                  setEnableOutroForTest(false);
                  setSelectedOutroForTest('none');
                } else {
                  setEnableOutroForTest(true);
                  setSelectedOutroForTest(val);
                }
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value="none">🚫 Tanpa Nada Penutup</option>
              <option value="same_as_intro">🔄 Sama Nada Pembuka</option>
              <optgroup label="Nada Digital Penutup">
                <option value="classic_3tone">🔔 6-Tone Ascending Melodi (5.8s)</option>
                <option value="tube_chime">🔔 Tubular Chime Lembut (5.8s)</option>
                <option value="westminster">🔔 Westminster 8-Tone (6.8s)</option>
                <option value="islamic_duo">🔔 Melodi Islami Maqam (6.2s)</option>
                <option value="school_dismissal">🔔 Melodi Pulang Ceria (6.2s)</option>
                <option value="electric_bell">🔔 Bel Listrik Kencang (10s - 3x Dering)</option>
                <option value="fire_bell">🔔 Bel Alarm Pemadam / Gong (10s)</option>
              </optgroup>
              <optgroup label="Nada Kustom Buatan Anda">
                {customChimes.map((c) => (
                  <option key={c.id} value={c.id}>
                    ✨ {c.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Text & Play button */}
          <div>
            <label className="block text-xs font-bold text-cyan-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              <span>2. Teks Pengumuman</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="memasuki jam pelajaran ke-1."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={isTestingSequence}
                  onClick={handleTestFullSequence}
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{isTestingSequence ? 'Memutar...' : 'Putar Urutan'}</span>
                </button>
                {(isTestingSequence || bellPlayback?.isPlaying) && (
                  <>
                    <button
                      type="button"
                      onClick={togglePauseBellPlayback}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-3 py-2 rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                    >
                      {bellPlayback?.isPaused ? (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Lanjut</span>
                        </>
                      ) : (
                        <>
                          <Pause className="w-3.5 h-3.5 fill-current" />
                          <span>Pause</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={stopAllBellAudio}
                      className="bg-rose-600 hover:bg-rose-500 text-white font-black px-3 py-2 rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Square className="w-3 h-3 fill-current" />
                      <span>Berhenti</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: Rekaman / Audio Tambahan Otomatis Setelah Bel (Sesuai Jadwal) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <Radio className="w-4 h-4" />
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-white">
                Rekaman Tambahan Otomatis Setelah Bel ({postBellTracks.length})
              </h3>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
              Putar rekaman panjang secara otomatis tepat setelah pengumuman bel berbunyi sesuai jadwal yang dipilih (misalnya rekaman 8 menit setelah bel pulang jam 13:45), lengkap dengan kontrol Pause &amp; Berhenti.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setPostBellUploadError(null);
              setIsPostBellModalOpen(true);
            }}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Rekaman Setelah Bel</span>
          </button>
        </div>

        {postBellTracks.length === 0 ? (
          <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-2xl p-6 text-center space-y-2">
            <p className="text-xs font-bold text-slate-300">
              Belum ada rekaman tambahan setelah bel
            </p>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
              Cocok untuk memutar nasehat pulang, lagu, atau rekaman berdurasi panjang (misal 8 menit) setelah jadwal bel tertentu seperti 13:45. Bisa di-Pause atau dihentikan kapan saja.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {postBellTracks.map((track) => {
              const matchedSchedule = track.scheduleId && track.scheduleId !== 'all'
                ? schedules.find((s) => s.id === track.scheduleId)
                : undefined;
              const isTrackActive =
                bellPlayback?.isPlaying && bellPlayback.postBellTrackId === track.id;
              const durLabel = formatDurationLabel(track.durationSec);

              return (
                <div
                  key={track.id}
                  className={`p-4 rounded-2xl border space-y-3 transition-all ${
                    isTrackActive
                      ? 'bg-amber-950/30 border-amber-400 ring-1 ring-amber-400/40'
                      : track.enabled
                      ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-950/60 border-slate-800/60 opacity-65'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-black text-white truncate">
                          {track.name}
                        </h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            track.enabled
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {track.enabled ? 'Otomatis Aktif' : 'Nonaktif'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                        <span className="bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-sans font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {track.scheduleId === 'all'
                            ? 'Setelah Semua Jadwal Bel'
                            : matchedSchedule
                            ? `${matchedSchedule.time} • ${matchedSchedule.label}`
                            : track.scheduleTime
                            ? `Setelah Bel ${track.scheduleTime} WIB`
                            : 'Jadwal Kustom'}
                        </span>
                        {durLabel && (
                          <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
                            ~{durLabel}
                          </span>
                        )}
                        {track.audioUrl.startsWith(IDB_AUDIO_PREFIX) ? (
                          <span className="bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.5 rounded font-sans font-bold">
                            Lokal Besar (IDB)
                          </span>
                        ) : isCloudAudioUrl(track.audioUrl) ? (
                          <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded font-sans font-bold">
                            Cloud Online
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          openTrimmer({
                            mode: 'post_bell_existing',
                            postBellTrack: track,
                            audioUrl: track.audioUrl,
                            title: track.name,
                            fileName: track.audioName || `${track.name}.wav`,
                          })
                        }
                        className="text-slate-400 hover:text-emerald-300 p-1.5 rounded-lg hover:bg-emerald-950/40 transition-colors cursor-pointer"
                        title="Potong / Cut Audio"
                      >
                        <Scissors className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePostBellTrack(track)}
                        className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Hapus Rekaman"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Per-track volume */}
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <Volume2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={track.volume ?? 1.0}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        onUpdateSettings({
                          ...settings,
                          postBellTracks: postBellTracks.map((t) =>
                            t.id === track.id ? { ...t, volume: val } : t
                          ),
                        });
                      }}
                      className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                    />
                    <span className="font-mono w-9 text-right text-amber-300">
                      {Math.round((track.volume ?? 1.0) * 100)}%
                    </span>
                  </div>

                  {/* Play / Pause / Stop / Enable Toggle */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center gap-1.5">
                      {isTrackActive ? (
                        <>
                          <button
                            type="button"
                            onClick={togglePauseBellPlayback}
                            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                          >
                            {bellPlayback?.isPaused ? (
                              <>
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>Lanjut</span>
                              </>
                            ) : (
                              <>
                                <Pause className="w-3.5 h-3.5 fill-current" />
                                <span>Pause</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={stopAllBellAudio}
                            className="bg-rose-600 hover:bg-rose-500 text-white font-black px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <Square className="w-3 h-3 fill-current" />
                            <span>Berhenti</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => playPostBellTrack(track, 1.0)}
                          className="bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Putar Tes</span>
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleTogglePostBellTrack(track.id)}
                      className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                        track.enabled
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      {track.enabled ? 'Aktif' : 'Nonaktifkan'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: Upload or Record Custom Bell Chime */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl relative">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Music className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">
                    {activeTab === 'upload' ? 'Unggah File Nada Dering Bel' : 'Rekam Nada Dering Baru'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Tambahkan suara nada dering unik ke dalam sistem bel sekolah
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  if (isRecording) stopRecording();
                }}
                className="text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Selector */}
            <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'upload'
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span className="truncate">Upload File</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('record')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'record'
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span className="truncate">Rekam Mic</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('url')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'url'
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="truncate">Link Cloud</span>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveCustomChime} className="space-y-4">
              {/* Tab 1: Upload */}
              {activeTab === 'upload' && (
                <div className="space-y-3">
                  {/* Android format guide badges */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                    <Smartphone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="font-semibold text-slate-300">Format Rekaman Didukung:</span>
                    <span className="bg-cyan-500/20 text-cyan-300 font-bold px-1.5 py-0.5 rounded border border-cyan-500/30">
                      AAC (.aac) HP Android
                    </span>
                    <span className="bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.5 rounded border border-emerald-500/30">
                      M4A (Voice Recorder)
                    </span>
                    <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">3GP / AMR</span>
                    <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">MP3 / WAV / OGG</span>
                  </div>

                  {uploadError && (
                    <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-2xl p-6 text-center bg-slate-950/60 transition-colors relative cursor-pointer group">
                    <input
                      type="file"
                      accept={AUDIO_FILE_ACCEPT}
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      disabled={isProcessingUpload}
                    />
                    <div className="space-y-2 pointer-events-none">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-bold text-white">
                        {isProcessingUpload ? 'Memproses Berkas Audio...' : 'Klik untuk memilih file audio atau seret file ke sini'}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Mendukung format Rekaman Android (AAC, M4A, 3GP, AMR), MP3, WAV, OGG (Maks. 25MB)
                      </p>
                    </div>
                  </div>

                  {audioDataUrl && (
                    <div className="bg-emerald-950/20 border border-emerald-500/40 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        <div className="truncate">
                          <span className="text-xs font-bold text-emerald-200 block truncate">
                            {audioFileName}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-mono">
                            {getAudioFormatLabel(audioFileName)} {audioDuration ? `• Durasi: ~${audioDuration} detik` : '• Audio siap disimpan'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            openTrimmer({
                              mode: 'draft',
                              audioUrl: audioDataUrl,
                              title: chimeName || audioFileName || 'Audio Unggahan',
                              fileName: audioFileName || 'nada_dering.mp3',
                            })
                          }
                          className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                          title="Potong / Cut durasi audio"
                        >
                          <Scissors className="w-3.5 h-3.5" />
                          <span>Potong</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePlayPreview('modal_preview', audioDataUrl, false)}
                          className="bg-emerald-500 text-slate-950 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Tes Putar</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Cloud Link (Google Drive / Web) */}
              {activeTab === 'url' && (
                <div className="space-y-3 bg-slate-950/80 p-4 sm:p-5 rounded-2xl border border-blue-500/30">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-300">
                    <Globe className="w-4 h-4 text-blue-400" />
                    <span>Tautan Audio Online (Bisa Diputar di Semua HP & Laptop)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Tempel link file audio online dari Google Drive, Dropbox, Cloudinary, atau web. Tautan ini otomatis dapat didengar di seluruh perangkat saat website dibuka di Vercel.
                  </p>

                  <div className="space-y-2">
                    <input
                      type="text"
                      inputMode="url"
                      placeholder="https://drive.google.com/... atau https://.../nada-bel.mp3"
                      value={cloudUrlInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCloudUrlInput(val);
                        const norm = normalizeAudioCloudUrl(val);
                        setAudioDataUrl(norm || null);
                        const filePart = val.split('/').pop()?.split('?')[0] || 'Nada_Cloud_Online.mp3';
                        setAudioFileName(filePart);
                        if (norm && !chimeName.trim()) {
                          const cleanTitle = filePart.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
                          setChimeName(cleanTitle && cleanTitle !== 'view' && cleanTitle !== 'uc' ? cleanTitle : 'Nada Dering Cloud');
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 font-mono"
                    />

                    {audioDataUrl && (
                      <div className="bg-blue-950/30 border border-blue-500/40 rounded-xl p-3 flex items-center justify-between gap-2">
                        <span className="text-xs text-blue-200 font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          Link Siap Digunakan
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              openTrimmer({
                                mode: 'draft',
                                audioUrl: audioDataUrl,
                                title: chimeName || audioFileName || 'Audio Link Cloud',
                                fileName: audioFileName || 'nada_cloud.mp3',
                              })
                            }
                            className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                            title="Potong / Cut audio dari link ini"
                          >
                            <Scissors className="w-3.5 h-3.5" />
                            <span>Potong</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePlayPreview('modal_preview', audioDataUrl, false)}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition shadow-xs"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Tes Putar Link</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Record */}
              {activeTab === 'record' && (
                <div className="space-y-3 bg-slate-950/80 p-5 rounded-2xl border border-slate-800 text-center">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-300 block">
                      Perekam Nada Dering Mikrofon
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Bunyikan lonceng, alat musik, atau instrumen sekolah di dekat mikrofon.
                    </p>
                  </div>

                  <div className="py-4">
                    <div className="text-3xl font-mono font-black text-emerald-400">
                      00:{recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds}
                    </div>
                    {isRecording && (
                      <p className="text-[11px] text-rose-400 font-bold animate-pulse mt-1">
                        ● Sedang Merekam Suara...
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-center gap-3">
                    {!isRecording ? (
                      <button
                        type="button"
                        onClick={startRecording}
                        className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-rose-600/30 cursor-pointer"
                      >
                        <Mic className="w-4 h-4" />
                        <span>Mulai Merekam</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 cursor-pointer"
                      >
                        <Pause className="w-4 h-4" />
                        <span>Selesai Merekam</span>
                      </button>
                    )}
                  </div>

                  {audioDataUrl && (
                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                      <span className="text-xs text-emerald-300 font-bold">
                        Hasil Rekaman Tersedia ({audioDuration ?? recordingSeconds}s)
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            openTrimmer({
                              mode: 'draft',
                              audioUrl: audioDataUrl,
                              title: chimeName || 'Rekaman Nada Dering',
                              fileName: audioFileName || 'rekaman_nada.webm',
                            })
                          }
                          className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                          title="Potong / Cut hasil rekaman"
                        >
                          <Scissors className="w-3.5 h-3.5" />
                          <span>Potong</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePlayPreview('modal_preview', audioDataUrl, false)}
                          className="bg-emerald-500 text-slate-950 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Putar Ulang</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {cloudinaryWarning && (
                <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 p-3 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{cloudinaryWarning}</span>
                </div>
              )}

              {uploadError && activeTab !== 'upload' && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Name Field */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Nama Nada Dering Bel *
                </label>
                <input
                  type="text"
                  value={chimeName}
                  onChange={(e) => setChimeName(e.target.value)}
                  placeholder="misal: Lagu Mars SD Qur'an / Jingle 4-Ketuk"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Kategori Nada
                </label>
                <select
                  value={chimeCategory}
                  onChange={(e) => setChimeCategory(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="custom">Kustom / Buatan Sendiri</option>
                  <option value="jingle">Jingle & Lagu Sekolah</option>
                  <option value="islamic">Islami / Rebana / Bedug</option>
                  <option value="classic">Klasik / Lonceng Gamelan</option>
                  <option value="modern">Modern & Harmoni</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Catatan / Keterangan (Opsional)
                </label>
                <input
                  type="text"
                  value={chimeDesc}
                  onChange={(e) => setChimeDesc(e.target.value)}
                  placeholder="misal: Khusus jam masuk kelas pagi dan penutupan pulang"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!audioDataUrl || isProcessingUpload}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Music className="w-4 h-4" />
                  <span>{isProcessingUpload ? 'Mengunggah...' : 'Simpan Nada Dering'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Tambah Rekaman Tambahan Otomatis Setelah Bel */}
      {isPostBellModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    Tambah Rekaman Setelah Bel Berbunyi
                  </h3>
                  <p className="text-xs text-slate-400">
                    Audio diputar otomatis setelah pengumuman bel jadwal yang dipilih selesai
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPostBellModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800 hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setPostBellInputTab('upload')}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                  postBellInputTab === 'upload'
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload File Audio</span>
              </button>
              <button
                type="button"
                onClick={() => setPostBellInputTab('url')}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                  postBellInputTab === 'url'
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Link Cloud (Drive / URL)</span>
              </button>
            </div>

            <form onSubmit={handleSavePostBellTrack} className="space-y-4">
              {postBellInputTab === 'upload' ? (
                <div className="space-y-2.5">
                  {postBellUploadError && (
                    <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{postBellUploadError}</span>
                    </div>
                  )}
                  <div className="border-2 border-dashed border-slate-700 hover:border-amber-500 rounded-2xl p-5 text-center bg-slate-950/60 relative cursor-pointer">
                    <input
                      type="file"
                      accept={AUDIO_FILE_ACCEPT}
                      onChange={handlePostBellFileUpload}
                      disabled={isUploadingPostBell}
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    />
                    <Upload className="w-7 h-7 text-amber-400 mx-auto mb-1.5" />
                    <p className="text-xs font-bold text-white">
                      {isUploadingPostBell
                        ? 'Memproses Berkas Rekaman...'
                        : 'Klik atau seret file rekaman panjang (MP3, WAV, M4A, AAC, OGG)'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Mendukung rekaman panjang 8+ menit (disimpan lokal IndexedDB / Cloudinary)
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 bg-slate-950/80 p-4 rounded-2xl border border-blue-500/30">
                  <label className="text-xs font-bold text-blue-300 block">
                    Tautan File Audio Online (Google Drive / Cloudinary / URL):
                  </label>
                  <input
                    type="text"
                    inputMode="url"
                    placeholder="https://drive.google.com/... atau https://.../rekaman-pulang.mp3"
                    value={postBellCloudUrlInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPostBellCloudUrlInput(val);
                      const norm = normalizeAudioCloudUrl(val);
                      setPostBellAudioUrl(norm || null);
                      const filePart = val.split('/').pop()?.split('?')[0] || 'Rekaman_Cloud.mp3';
                      setPostBellAudioName(filePart);
                      if (norm && !postBellName.trim()) {
                        const cleanTitle = filePart.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
                        setPostBellName(cleanTitle && cleanTitle !== 'view' && cleanTitle !== 'uc' ? cleanTitle : 'Rekaman Cloud');
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-blue-400"
                  />
                </div>
              )}

              {postBellAudioUrl && (
                <div className="bg-amber-950/20 border border-amber-500/40 rounded-2xl p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-amber-200 block truncate">
                      {postBellAudioName}
                    </span>
                    <span className="text-[10px] text-amber-400 font-mono">
                      {formatDurationLabel(postBellDuration) ? `Durasi ~${formatDurationLabel(postBellDuration)}` : 'Audio siap diputar'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        openTrimmer({
                          mode: 'post_bell_draft',
                          audioUrl: postBellAudioUrl,
                          title: postBellName || postBellAudioName || 'Rekaman Tambahan',
                          fileName: postBellAudioName || 'rekaman.wav',
                        })
                      }
                      className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Scissors className="w-3.5 h-3.5" />
                      <span>Potong</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePlayPreview('post_bell_draft_preview', postBellAudioUrl, false)}
                      className="bg-amber-500 text-slate-950 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Tes</span>
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Judul / Nama Rekaman *
                </label>
                <input
                  type="text"
                  value={postBellName}
                  onChange={(e) => setPostBellName(e.target.value)}
                  placeholder="misal: Nasehat / Musik Pulang 8 Menit (13:45)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Diputar Otomatis Setelah Jadwal Bel:
                </label>
                <select
                  value={postBellTargetKey}
                  onChange={(e) => setPostBellTargetKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="custom_time">🕒 Berdasarkan Jam Bel Tertentu (contoh: 13:45)</option>
                  <option value="all">🔔 Setelah Semua Jadwal Bel Berbunyi</option>
                  {schedules.length > 0 && (
                    <optgroup label="Pilih Jadwal Bel Spesifik">
                      {Array.from(new Map(schedules.map((s) => [`${s.time}-${s.label}`, s])).values())
                        .sort((a, b) => a.time.localeCompare(b.time))
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.time} WIB — {s.label}
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {postBellTargetKey === 'custom_time' && (
                <div>
                  <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider mb-1.5">
                    Jam Bel Target (WIB):
                  </label>
                  <input
                    type="time"
                    value={postBellCustomTime}
                    onChange={(e) => setPostBellCustomTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-slate-300">Volume Rekaman Tambahan:</span>
                  <span className="font-mono text-amber-300 font-bold">{Math.round(postBellVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={postBellVolume}
                  onChange={(e) => setPostBellVolume(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPostBellModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!postBellAudioUrl || isUploadingPostBell}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isUploadingPostBell ? 'Mengunggah...' : 'Simpan Rekaman Setelah Bel'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Pemotong Audio Nada Dering */}
      {trimmerTarget && (
        <AudioTrimmerModal
          isOpen={true}
          onClose={() => setTrimmerTarget(null)}
          audioUrl={trimmerTarget.audioUrl}
          audioTitle={trimmerTarget.title}
          fileName={trimmerTarget.fileName}
          isExistingChime={
            trimmerTarget.mode === 'existing' || trimmerTarget.mode === 'post_bell_existing'
          }
          cloudinaryCloudName={settings.cloudinaryCloudName}
          cloudinaryUploadPreset={settings.cloudinaryUploadPreset}
          onApplyTrim={async (res) => {
            if (trimmerTarget.mode === 'draft') {
              let storedUrl = res.audioUrl;
              if (storedUrl.startsWith('data:') && storedUrl.length > 150 * 1024) {
                storedUrl = await saveAudioBlobToIDB(`chime_trim_${Date.now()}`, storedUrl);
              }
              setAudioDataUrl(storedUrl);
              setAudioFileName(res.fileName);
              setAudioDuration(res.durationSec);
              if (storedUrl.startsWith('http')) {
                setCloudUrlInput(storedUrl);
              }
            } else if (trimmerTarget.mode === 'post_bell_draft') {
              let storedUrl = res.audioUrl;
              if (storedUrl.startsWith('data:') && storedUrl.length > 150 * 1024) {
                storedUrl = await saveAudioBlobToIDB(`postbell_${Date.now()}`, storedUrl);
              }
              setPostBellAudioUrl(storedUrl);
              setPostBellAudioName(res.fileName);
              setPostBellDuration(res.durationSec);
              if (storedUrl.startsWith('http')) {
                setPostBellCloudUrlInput(storedUrl);
              }
            } else if (trimmerTarget.mode === 'post_bell_existing' && trimmerTarget.postBellTrack) {
              const targetTrack = trimmerTarget.postBellTrack;
              let storedUrl = res.audioUrl;
              if (storedUrl.startsWith('data:') && storedUrl.length > 150 * 1024) {
                storedUrl = await saveAudioBlobToIDB(`postbell_${Date.now()}`, storedUrl);
              }
              if (res.saveMode === 'replace') {
                onUpdateSettings({
                  ...settings,
                  postBellTracks: postBellTracks.map((t) =>
                    t.id === targetTrack.id
                      ? { ...t, audioUrl: storedUrl, audioName: res.fileName, durationSec: res.durationSec }
                      : t
                  ),
                });
              } else {
                const newTrack: PostBellTrack = {
                  ...targetTrack,
                  id: `postbell_${Date.now()}`,
                  name: `${targetTrack.name} (Potongan)`,
                  audioUrl: storedUrl,
                  audioName: res.fileName,
                  durationSec: res.durationSec,
                  createdAt: Date.now(),
                };
                onUpdateSettings({
                  ...settings,
                  postBellTracks: [newTrack, ...postBellTracks],
                });
              }
            } else if (trimmerTarget.mode === 'existing' && trimmerTarget.chime) {
              const targetChime = trimmerTarget.chime;
              let storedUrl = res.audioUrl;
              if (storedUrl.startsWith('data:') && storedUrl.length > 150 * 1024) {
                storedUrl = await saveAudioBlobToIDB(`chime_trim_${Date.now()}`, storedUrl);
              }
              if (res.saveMode === 'replace') {
                const updated = customChimes.map((c) =>
                  c.id === targetChime.id
                    ? {
                        ...c,
                        audioUrl: storedUrl,
                        audioName: res.fileName,
                        durationSec: res.durationSec,
                      }
                    : c
                );
                onUpdateSettings({
                  ...settings,
                  customChimes: updated,
                });
              } else {
                const newChime: CustomChime = {
                  id: `custom_${Date.now()}`,
                  name: `${targetChime.name} (Potongan)`,
                  description: targetChime.description,
                  audioUrl: storedUrl,
                  audioName: res.fileName,
                  category: targetChime.category,
                  durationSec: res.durationSec,
                  createdAt: Date.now(),
                };
                onUpdateSettings({
                  ...settings,
                  customChimes: [newChime, ...customChimes],
                });
              }
            }
            setTrimmerTarget(null);
          }}
        />
      )}
    </div>
  );
};
