import { ScheduleItem } from '../types';

/**
 * Jadwal Bel Khusus ASAS (Asesmen Akhir Semester)
 * Mengikuti pola jam resmi ASAS dari jam masuk (07:00) hingga pulang (12:30)
 * tanpa menyebutkan nama mata pelajaran/kegiatan spesifik per hari, dan tetap
 * dapat diedit, ditambah, maupun dihapus sebagaimana jadwal biasa.
 */
export const DEFAULT_ASAS_SCHEDULES: ScheduleItem[] = [
  {
    id: 'asas-0700',
    time: '07:00',
    label: 'Bel Masuk Pagi (ASAS)',
    category: 'assembly',
    speechText:
      'memasuki waktu masuk pagi Asesmen Akhir Semester. Mohon seluruh peserta memasuki ruang dengan tertib dan berdoa sebelum memulai kegiatan.',
    chimeType: 'westminster',
    days: [1, 2, 3, 4, 5],
    enabled: true,
    volume: 1.0,
  },
  {
    id: 'asas-0730',
    time: '07:30',
    label: 'Jam Asesmen ke-1 (ASAS)',
    category: 'lesson',
    speechText:
      'memasuki waktu pelaksanaan Asesmen Akhir Semester jam pertama. Selamat mengerjakan dengan jujur dan teliti.',
    chimeType: 'westminster',
    days: [1, 2, 3, 4, 5],
    enabled: true,
    volume: 1.0,
  },
  {
    id: 'asas-0840',
    time: '08:40',
    label: 'Istirahat Pertama (ASAS)',
    category: 'break',
    speechText:
      'waktu jam pertama telah selesai, saatnya memasuki waktu istirahat pertama. Selamat beristirahat dan tetap menjaga ketertiban.',
    chimeType: 'tube_chime',
    days: [1, 2, 3, 4, 5],
    enabled: true,
    volume: 1.0,
  },
  {
    id: 'asas-0915',
    time: '09:15',
    label: 'Jam Asesmen ke-2 (ASAS)',
    category: 'lesson',
    speechText:
      'waktu istirahat pertama telah selesai. Memasuki waktu pelaksanaan Asesmen Akhir Semester jam kedua. Selamat mengerjakan dengan jujur dan teliti.',
    chimeType: 'westminster',
    days: [1, 2, 3, 4, 5],
    enabled: true,
    volume: 1.0,
  },
  {
    id: 'asas-1030',
    time: '10:30',
    label: 'Jam Asesmen ke-3 (ASAS)',
    category: 'lesson',
    speechText:
      'memasuki waktu pelaksanaan Asesmen Akhir Semester jam ketiga. Selamat mengerjakan dengan tertib dan fokus.',
    chimeType: 'westminster',
    days: [1, 2, 3, 4, 5],
    enabled: true,
    volume: 1.0,
  },
  {
    id: 'asas-1130',
    time: '11:30',
    label: 'Istirahat Kedua (ASAS)',
    category: 'break',
    speechText:
      'waktu jam ketiga telah selesai, saatnya memasuki waktu istirahat kedua. Selamat beristirahat.',
    chimeType: 'tube_chime',
    days: [1, 2, 3, 4, 5],
    enabled: true,
    volume: 1.0,
  },
  {
    id: 'asas-1150',
    time: '11:50',
    label: 'Jam Terakhir Sebelum Pulang (ASAS)',
    category: 'custom',
    speechText:
      'waktu istirahat kedua telah selesai. Memasuki jam kegiatan terakhir sebelum waktu pulang sekolah.',
    chimeType: 'westminster',
    days: [1, 2, 3, 4, 5],
    enabled: true,
    volume: 1.0,
  },
  {
    id: 'asas-1230',
    time: '12:30',
    label: 'Jam Pulang Sekolah (ASAS)',
    category: 'dismissal',
    speechText:
      'seluruh rangkaian kegiatan Asesmen Akhir Semester hari ini telah selesai. Persiapkan peralatan Anda dan mari berdoa sebelum pulang. Hati-hati di jalan.',
    chimeType: 'school_dismissal',
    days: [1, 2, 3, 4, 5],
    enabled: true,
    volume: 1.0,
  },
];
