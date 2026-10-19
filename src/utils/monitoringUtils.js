import { RESPONSE_COLUMNS as C } from '../config/columnMapping.js';
import { normalizeDate, parseHour, SLOT_COUNT, nowInJakarta } from './dateUtils.js';

export const STATUS = { NORMAL: 'normal', PROBLEM: 'bermasalah', EMPTY: 'belum', VERIFY: 'verifikasi', TL: 'sudah_tl' };

// Pisah koma hanya di luar tanda kurung; "-" (tanda kosong dari form) diabaikan.
export function splitProblems(v) {
  const out = []; let depth = 0; let cur = '';
  for (const ch of String(v ?? '')) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  out.push(cur.trim());
  return out.filter((x) => x && x !== '-');
}
// TID unik per mesin (dipilih dari Database_Monitoring oleh form).
export const machineKey = (r) => String(r.tid ?? '').trim();
// Kunci laporan untuk mencocokkan Tindak Lanjut: Timestamp laporan + TID.
export const reportKey = (r) => `${String(r.timestamp ?? '').trim()}|${String(r.tid ?? '').trim()}`;
export const slotKey = (r) => `${r.date}|${machineKey(r)}|${r.hour}`;

// Baris mentah -> laporan bernorma. null jika tanggal/jam/TID tidak valid.
export function normalizeResponse(row, i = 0) {
  const date = normalizeDate(row[C.date]); const hour = parseHour(row[C.time]);
  const tid = String(row[C.tid] ?? '').trim();
  if (!date || hour === null || !tid) return null;
  const minute = Number((/^\s*\d{1,2}[:.](\d{2})/.exec(String(row[C.time] ?? '')) || [])[1] ?? 0);
  const problems = splitProblems(row[C.problems]);
  const st = String(row[C.status] ?? '').trim().toLowerCase();
  const status = st.startsWith('normal') ? STATUS.NORMAL : st.startsWith('problem') ? STATUS.PROBLEM : problems.length ? STATUS.PROBLEM : STATUS.VERIFY;
  return {
    id: `r${i}`, raw: row, timestamp: row[C.timestamp] || '', date, hour, minute, reporter: row[C.reporter] || '',
    bo: String(row[C.branch] ?? '').trim(), lokasi: String(row[C.location] ?? '').trim(), ukerType: String(row[C.ukerType] ?? '').trim(),
    machineType: String(row[C.machineType] || '').trim().toUpperCase(), tid, vendor: row[C.vendor] || '',
    problems, detail: row[C.detail] || '', photo: row[C.photo] || '', status,
    tlTime: String(row[C.tlTime] ?? '').trim(), tlPhoto: String(row[C.tlPhoto] ?? '').trim(), tlDone: String(row[C.tlTime] ?? '').trim() !== ''
  };
}
// Problem yang sudah di-TL dihitung "sudah TL" (biru). Problem yang belum di-TL tetap merah.
export const effectiveStatus = (r) => (r.status === STATUS.PROBLEM && r.tlDone ? STATUS.TL : r.status);
export function deriveSlotStatus(reports) {
  if (!reports || !reports.length) return STATUS.EMPTY;
  const set = new Set(reports.map(effectiveStatus));
  if (set.has(STATUS.VERIFY)) return STATUS.VERIFY;
  if (set.has(STATUS.PROBLEM)) return set.has(STATUS.NORMAL) ? STATUS.VERIFY : STATUS.PROBLEM;
  if (set.has(STATUS.TL)) return STATUS.TL;
  return STATUS.NORMAL;
}
export function groupBySlot(reports) {
  const m = new Map();
  for (const r of reports) { const k = slotKey(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return m;
}
export function slotStats(machine, date, grouped, now = nowInJakarta()) {
  const counts = { normal: 0, bermasalah: 0, belum: 0, verifikasi: 0, sudah_tl: 0 };
  let filled = 0; let due = 0; let dueFilled = 0;
  for (let h = 0; h < SLOT_COUNT; h++) {
    const has = grouped.get(`${date}|${machineKey(machine)}|${h}`);
    const s = deriveSlotStatus(has); counts[s]++;
    if (s !== STATUS.EMPTY) filled++;
    if (date < now.date || (date === now.date && h <= now.hour)) { due++; if (has) dueFilled++; }
  }
  return { counts, filled, due, dailyCompleteness: filled / SLOT_COUNT, coverageToNow: due ? dueFilled / due : 0 };
}

// ---- Durasi mesin problem yang belum di-TL ----
export const reportOrder = (a, b) => a.date.localeCompare(b.date) || a.hour - b.hour || (a.minute ?? 0) - (b.minute ?? 0) || String(a.timestamp).localeCompare(String(b.timestamp));
// Kelompokkan semua laporan per TID (urut waktu naik) untuk menghitung durasi lintas tanggal.
export function reportsByTid(reports) {
  const m = new Map();
  for (const r of reports) { const k = machineKey(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  for (const list of m.values()) list.sort(reportOrder);
  return m;
}
// Laporan Problem pertama dari rangkaian problem yang masih berjalan (belum di-TL).
// Jam laporan yang terlewat tidak memutus rangkaian; rangkaian berhenti hanya jika ada laporan Normal atau laporan yang sudah di-TL.
export function unresolvedSince(list) {
  let start = null;
  for (const r of list || []) {
    if (r.status === STATUS.PROBLEM && !r.tlDone) { if (!start) start = r; }
    else if (r.status === STATUS.NORMAL || (r.status === STATUS.PROBLEM && r.tlDone)) start = null;
  }
  return start;
}
// Selisih menit dari waktu kirim laporan pertama (Tanggal + Jam pada form, lengkap dengan menit) sampai sekarang (Asia/Jakarta); bisa lintas hari.
export function minutesSince(start, now = nowInJakarta()) {
  const t = (d, h, mi) => { const [y, m, dd] = d.split('-').map(Number); return Date.UTC(y, m - 1, dd, h, mi) / 60000; };
  return Math.max(0, Math.round(t(now.date, now.hour, now.minute ?? 0) - t(start.date, start.hour, start.minute ?? 0)));
}
// Contoh: 73 menit -> "1 jam 13 menit"; 1500 menit -> "1 hari 1 jam"
export function formatDuration(min) {
  if (min < 1) return '< 1 menit';
  const d = Math.floor(min / 1440); const j = Math.floor((min % 1440) / 60); const n = min % 60;
  return [d && `${d} hari`, j && `${j} jam`, n && `${n} menit`].filter(Boolean).join(' ');
}
export const clock = (r) => `${String(r.hour).padStart(2, '0')}.${String(r.minute ?? 0).padStart(2, '0')}`;
