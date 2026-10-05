import { ScheduleItem } from '../types';

export const DEFAULT_GLOBAL_PREFIX = "Perhatian kepada seluruh murid SD QUR'AN UNGGULAN, saatnya ";

export const INITIAL_SCHEDULES: ScheduleItem[] = [
  // HARI SENIN - SABTU (PAGI / APEL)
  {
    id: 's-0700-senin',
    time: '07:00',
    label: 'Upacara Bendera Pagi (Senin)',
    category: 'assembly',
    speechText: 'memasuki waktu Upacara Bendera Pagi. Mohon seluruh siswa dan guru segera berkumpul di lapangan.',
    chimeType: 'westminster',
    days: [1],
    enabled: true,
    volume: 1.0,
  },
  {
    id: 's-0700-regular',
    time: '07:00',
    label: 'Pembiasaan Imtaq & Sholat Dhuha (Selasa - Kamis)',
    category: 'assembly',
    speechText: 'memasuki waktu Pembiasaan Imtaq dan Sholat Dhuha bersama. Mari menuju tempat ibadah.',
    chimeType: 'islamic_duo',
    days: [2, 3, 4],
    enabled: true,
    volume: 1.0,
  },
  {
    id: 's-0700-jumat',
    time: '07:00',
    label: 'Senam Pagi & Imtaq Jumat',
    category: 'assembly',
    speechText: 'memasuki waktu Senam Pagi dan Imtaq Jumat. Selamat beraktivitas.',
    chimeType: 'classic_3tone',
    days: [5],
    enabled: true,
    volume: 1.0,
  },
  {
    id: 's-0700-sabtu',
    time: '07:00',
    label: 'Apel Pagi & Ekstrakurikuler (Sabtu)',
    category: 'assembly',
    speechText: 'memasuki waktu Apel Pagi dan Kegiatan Ekstrakurikuler.',
    chimeType: 'classic_3tone',
    days: [6],
    enabled: true,
    volume: 1.0,
  },

  // JAM KE-1 (07:20 - 07:55)
  {
    id: 's-0720',
    time: '07:20',
    label: "Jam Pelajaran ke-1 (Tahfidzul Qur'an)",
    category: 'lesson',
    speechText: "memasuki jam pelajaran ke-1, Tahfidzul Qur'an.",
    chimeType: 'westminster',
    days: [1, 2, 3, 4, 5, 6],
    enabled: true,
    volume: 1.0,
  },

  // JAM KE-2 (07:55 - 08:30)
  {
    id: 's-0755',
    time: '07:55',
    label: 'Jam Pelajaran ke-2',
    category: 'lesson',
    speechText: 'memasuki jam pelajaran ke-2.',
    chimeType: 'westminster',
    days: [1, 2, 3, 4, 5, 6],
    enabled: true,
    volume: 1.0,
  },

  // JAM KE-3 (08:30 - 09:05)
  {
    id: 's-0830',
    time: '08:30',
    label: 'Jam Pelajaran ke-3',
    category: 'lesson',
    speechText: 'memasuki jam pelajaran ke-3.',
    chimeType: 'westminster',
    days: [1, 2, 3, 4, 5, 6],
    enabled: true,
    volume: 1.0,
  },

  // ISTIRAHAT PERTAMA (09:05 - 09:25)
  {
    id: 's-0905',
    time: '09:05',
    label: 'Istirahat Pertama',
    category: 'break',
    speechText: 'memasuki waktu istirahat pertama. Selamat beristirahat dan tetap menjaga kebersihan.',
    chimeType: 'tube_chime',
    days: [1, 2, 3, 4, 5, 6],
    enabled: true,
    volume: 1.0,
  },

  // JAM KE-4 (09:25 - 10:00)
  {
    id: 's-0925',
    time: '09:25',
    label: 'Jam Pelajaran ke-4',
    category: 'lesson',
    speechText: 'memasuki jam pelajaran ke-4. Waktu istirahat pertama telah selesai.',
    chimeType: 'westminster',
    days: [1, 2, 3, 4, 5, 6],
    enabled: true,
    volume: 1.0,
  },

  // JAM KE-5 (10:00 - 10:35)
  {
    id: 's-1000',
    time: '10:00',
    label: 'Jam Pelajaran ke-5',
    category: 'lesson',
    speechText: 'memasuki jam pelajaran ke-5.',
    chimeType: 'westminster',
    days: [1, 2, 3, 4, 5, 6],
    enabled: true,
    volume: 1.0,
  },

  // JAM KE-6 (10:35 - 11:10)
  {
    id: 's-1035',
    time: '10:35',
    label: 'Jam Pelajaran ke-6',
    category: 'lesson',
    speechText: 'memasuki jam pelajaran ke-6.',
    chimeType: 'westminster',
    days: [1, 2, 3, 4, 5, 6],
    enabled: true,
    volume: 1.0,
  },

  // JAM KE-7 (11:10 - 11:45) - Senin s/d Kamis
  {
    id: 's-1110-senin-kamis',
    time: '11:10',
    label: 'Jam Pelajaran ke-7',
    category: 'lesson',
    speechText: 'memasuki jam pelajaran ke-7.',
    chimeType: 'westminster',
    days: [1, 2, 3, 4],
    enabled: true,
    volume: 1.0,
  },

  // JUMAT PULANG / PERSIAPAN JUMATAN (11:10)
  {
    id: 's-1110-jumat',
    time: '11:10',
    label: 'Jam Pulang Hari Jumat & Persiapan Sholat Jumat',
    category: 'dismissal',
    speechText: 'jam pelajaran hari Jumat telah selesai. Saatnya persiapan Sholat Jumat dan selamat pulang.',
    chimeType: 'tube_chime',
    days: [5],
    enabled: true,
    volume: 1.0,
  },

  // SABTU PULANG (10:35)
  {
    id: 's-1035-sabtu',
    time: '10:35',
    label: 'Jam Pulang Hari Sabtu',
    category: 'dismissal',
    speechText: 'kegiatan hari Sabtu telah selesai. Selamat berlibur dan hati-hati di jalan.',
    chimeType: 'tube_chime',
    days: [6],
    enabled: true,
    volume: 1.0,
  },

  // ISTIRAHAT KEDUA (11:45 - 12:05) - Senin s/d Kamis
  {
    id: 's-1145',
    time: '11:45',
    label: 'Istirahat Kedua & Persiapan Sholat Dzuhur',
    category: 'break',
    speechText: 'memasuki waktu istirahat kedua dan persiapan Sholat Dzuhur.',
    chimeType: 'tube_chime',
    days: [1, 2, 3, 4],
    enabled: true,
    volume: 1.0,
  },

  // SHOLAT DZUHUR BERJAMAAH (12:05 - 12:35)
  {
    id: 's-1205',
    time: '12:05',
    label: 'Sholat Dzuhur Berjamaah',
    category: 'prayer',
    speechText: 'memasuki waktu Sholat Dzuhur Berjamaah. Mari menuju musholla sekolah.',
    chimeType: 'islamic_duo',
    days: [1, 2, 3, 4],
    enabled: true,
    volume: 1.0,
  },

  // JAM KE-8 (12:35 - 13:10)
  {
    id: 's-1235',
    time: '12:35',
    label: 'Jam Pelajaran ke-8',
    category: 'lesson',
    speechText: 'memasuki jam pelajaran ke-8.',
    chimeType: 'westminster',
    days: [1, 2, 3, 4],
    enabled: true,
    volume: 1.0,
  },

  // JAM KE-9 (13:10 - 13:45)
  {
    id: 's-1310',
    time: '13:10',
    label: 'Jam Pelajaran ke-9',
    category: 'lesson',
    speechText: 'memasuki jam pelajaran ke-9.',
    chimeType: 'westminster',
    days: [1, 2, 3, 4],
    enabled: true,
    volume: 1.0,
  },

  // JAM PULANG SEKOLAH (13:45) - Senin s/d Kamis
  {
    id: 's-1345',
    time: '13:45',
    label: 'Jam Pulang Sekolah',
    category: 'dismissal',
    speechText: 'seluruh kegiatan belajar mengajar hari ini telah selesai. Persiapkan peralatan Anda dan mari berdoa sebelum pulang. Hati-hati di jalan.',
    chimeType: 'tube_chime',
    days: [1, 2, 3, 4],
    enabled: true,
    volume: 1.0,
  },
];
