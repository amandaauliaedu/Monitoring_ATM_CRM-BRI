import { machineKey, STATUS, reportOrder } from './monitoringUtils.js';
import { SLOTS } from './dateUtils.js';

const base = (p) => p.replace(/\s*\(.*\)\s*$/, '').trim();
export function countBy(rows, fn) {
  const m = new Map();
  for (const r of rows) for (const k of [].concat(fn(r))) if (k !== null && k !== undefined && k !== '') m.set(k, (m.get(k) || 0) + 1);
  return [...m].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value || String(a.name).localeCompare(String(b.name)));
}
export function filterRange(rows, { start, end, bo, type }) {
  return rows.filter((r) => (!start || r.date >= start) && (!end || r.date <= end) && (!bo || r.bo === bo) && (!type || r.machineType === type));
}
export function analyze(rows) {
  const prob = rows.filter((r) => r.status === STATUS.PROBLEM);
  return {
    total: rows.length, problemReports: prob.length, normalReports: rows.filter((r) => r.status === STATUS.NORMAL).length,
    uniqueMachines: new Set(rows.map(machineKey)).size, problemMachines: new Set(prob.map(machineKey)).size,
    byDay: countBy(prob, (r) => r.date).sort((a, b) => a.name.localeCompare(b.name)),
    byType: countBy(prob, (r) => r.machineType),
    byHour: SLOTS.map((s) => ({ name: String(s.hour).padStart(2, '0'), value: prob.filter((r) => r.hour === s.hour).length })),
    byBO: countBy(prob, (r) => r.bo),
    byLokasi: countBy(prob, (r) => r.lokasi),
    byMachine: countBy(prob, (r) => `${r.machineType} ${r.tid} · ${r.lokasi}`),
    byProblem: countBy(prob, (r) => r.problems.map(base))
  };
}

// Mesin bermasalah per vendor (mesin unik = TID unik dengan laporan Problem pada data terfilter).
export const VENDORS = ['BG Surabaya', 'BG Pamekasan', 'Advantage', 'SSI Bojonegoro'];
const vkey = (v) => String(v ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
export function byVendor(rows) {
  const prob = rows.filter((r) => r.status === STATUS.PROBLEM);
  const names = [...VENDORS];
  for (const r of prob) { const v = String(r.vendor ?? '').trim().replace(/\s+/g, ' '); if (v && !names.some((n) => vkey(n) === vkey(v))) names.push(v); }
  return names.map((name) => {
    const mine = prob.filter((r) => vkey(r.vendor) === vkey(name));
    // Satu entri per TID; target = laporan problem terakhir yang belum di-TL (jika tidak ada, laporan problem terakhir) untuk tautan ke Monitoring Dashboard.
    const group = (pred) => {
      const m = new Map();
      for (const r of mine.filter(pred)) { const k = machineKey(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
      return [...m].map(([tid, list]) => {
        list.sort(reportOrder);
        const target = [...list].reverse().find((r) => !r.tlDone) || list[list.length - 1];
        return { tid, type: target.machineType, bo: target.bo, lokasi: target.lokasi, count: list.length, target };
      }).sort((a, b) => a.tid.localeCompare(b.tid, 'id', { numeric: true }));
    };
    const items = { CRM: group((r) => r.machineType === 'CRM'), ATM: group((r) => r.machineType === 'ATM'), ALL: group(() => true) };
    return { name, crm: items.CRM.length, atm: items.ATM.length, total: items.ALL.length, items };
  });
}
