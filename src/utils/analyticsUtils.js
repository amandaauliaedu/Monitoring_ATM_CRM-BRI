import { machineKey, STATUS } from './monitoringUtils.js';
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
