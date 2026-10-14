import { RESPONSE_COLUMNS as C } from '../config/columnMapping.js';
import { normalizeDate, parseHour, SLOT_COUNT, nowInJakarta } from './dateUtils.js';

export const STATUS = { NORMAL: 'normal', PROBLEM: 'bermasalah', EMPTY: 'belum', VERIFY: 'verifikasi' };

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
export const slotKey = (r) => `${r.date}|${machineKey(r)}|${r.hour}`;

// Baris mentah -> laporan bernorma. null jika tanggal/jam/TID tidak valid.
export function normalizeResponse(row, i = 0) {
  const date = normalizeDate(row[C.date]); const hour = parseHour(row[C.time]);
  const tid = String(row[C.tid] ?? '').trim();
  if (!date || hour === null || !tid) return null;
  const problems = splitProblems(row[C.problems]);
  const st = String(row[C.status] ?? '').trim().toLowerCase();
  const status = st.startsWith('normal') ? STATUS.NORMAL : st.startsWith('problem') ? STATUS.PROBLEM : problems.length ? STATUS.PROBLEM : STATUS.VERIFY;
  return {
    id: `r${i}`, raw: row, timestamp: row[C.timestamp] || '', date, hour, reporter: row[C.reporter] || '',
    bo: String(row[C.branch] ?? '').trim(), lokasi: String(row[C.location] ?? '').trim(), ukerType: String(row[C.ukerType] ?? '').trim(),
    machineType: String(row[C.machineType] || '').trim().toUpperCase(), tid, vendor: row[C.vendor] || '',
    problems, detail: row[C.detail] || '', photo: row[C.photo] || '', status
  };
}
export function deriveSlotStatus(reports) {
  if (!reports || !reports.length) return STATUS.EMPTY;
  const set = new Set(reports.map((r) => r.status));
  if (set.has(STATUS.VERIFY) || set.size > 1) return STATUS.VERIFY;
  return [...set][0];
}
export function groupBySlot(reports) {
  const m = new Map();
  for (const r of reports) { const k = slotKey(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return m;
}
export function slotStats(machine, date, grouped, now = nowInJakarta()) {
  const counts = { normal: 0, bermasalah: 0, belum: 0, verifikasi: 0 };
  let filled = 0; let due = 0; let dueFilled = 0;
  for (let h = 0; h < SLOT_COUNT; h++) {
    const has = grouped.get(`${date}|${machineKey(machine)}|${h}`);
    const s = deriveSlotStatus(has); counts[s]++;
    if (s !== STATUS.EMPTY) filled++;
    if (date < now.date || (date === now.date && h <= now.hour)) { due++; if (has) dueFilled++; }
  }
  return { counts, filled, due, dailyCompleteness: filled / SLOT_COUNT, coverageToNow: due ? dueFilled / due : 0 };
}
