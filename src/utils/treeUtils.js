import { groupBySlot, deriveSlotStatus, STATUS } from './monitoringUtils.js';
import { SLOT_COUNT } from './dateUtils.js';
import { APP_CONFIG } from '../config/appConfig.js';

const byName = (a, b) => a.name.localeCompare(b.name, 'id', { numeric: true });

// Branch Office -> Lokasi -> mesin (daftar mesin dari Database_Monitoring, ditambah TID yang hanya ada di laporan).
export function buildTree(master, responses, date, now, emptyAsNormal = APP_CONFIG.emptyAsNormal) {
  const grouped = groupBySlot(responses);
  const bos = new Map();
  const lok = (bo, l, type) => {
    if (!bos.has(bo)) bos.set(bo, new Map());
    const m = bos.get(bo);
    if (!m.has(l)) m.set(l, { name: l, type: type || '', machines: new Map() });
    const x = m.get(l); if (!x.type && type) x.type = type; return x;
  };
  const add = (x, tid, type, vendor) => {
    if (!x.machines.has(tid)) x.machines.set(tid, { tid, type: type || '', vendor: vendor || '' });
    else { const m = x.machines.get(tid); if (!m.vendor && vendor) m.vendor = vendor; if (!m.type && type) m.type = type; }
  };
  for (const m of master) add(lok(m.bo, m.lokasi, m.ukerType), m.tid, m.tipe, '');
  for (const r of responses) add(lok(r.bo, r.lokasi, r.ukerType), r.tid, r.machineType, r.vendor);

  return [...bos.entries()].map(([name, lokMap]) => {
    const lokasis = [...lokMap.values()].map((l) => {
      const machines = [...l.machines.values()].map((m) => {
        const slots = Array.from({ length: SLOT_COUNT }, (_, hour) => {
          const reports = grouped.get(`${date}|${m.tid}|${hour}`) || [];
          const due = date < now.date || (date === now.date && hour <= now.hour);
          let status = deriveSlotStatus(reports); let inferred = false;
          if (status === STATUS.EMPTY && emptyAsNormal && due) { status = STATUS.NORMAL; inferred = true; }
          return { hour, status, reports, due, inferred };
        });
        const count = (s) => slots.filter((x) => x.status === s).length;
        return { ...m, key: m.tid, slots, problem: count(STATUS.PROBLEM), tl: count(STATUS.TL), normal: count(STATUS.NORMAL), verify: count(STATUS.VERIFY), empty: count(STATUS.EMPTY),
          reportsToday: slots.reduce((n, x) => n + x.reports.length, 0) };
      }).sort((a, b) => a.type.localeCompare(b.type) || a.tid.localeCompare(b.tid, 'id', { numeric: true }));
      return { name: l.name, type: l.type, machines, problemMachines: machines.filter((m) => m.problem > 0).length };
    }).sort(byName);
    const ms = lokasis.flatMap((l) => l.machines);
    return { name, lokasis, machines: ms.length, problemMachines: ms.filter((m) => m.problem > 0).length,
      reportsToday: ms.reduce((n, m) => n + m.reportsToday, 0), atm: ms.filter((m) => m.type === 'ATM').length, crm: ms.filter((m) => m.type === 'CRM').length };
  }).sort(byName);
}
