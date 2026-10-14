import { MASTER_COLUMNS as M } from '../config/columnMapping.js';
const t = (v) => String(v ?? '').trim();
// Satu baris master = satu mesin.
export function normalizeMaster(rows) {
  return rows.map((r) => ({ tid: t(r[M.tid]), tipe: t(r[M.type]).toUpperCase(), bo: t(r[M.branch]), lokasi: t(r[M.location]), ukerType: t(r[M.ukerType]) }))
    .filter((r) => r.tid && r.bo && r.lokasi);
}
