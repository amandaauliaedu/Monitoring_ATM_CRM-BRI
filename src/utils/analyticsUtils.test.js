import { describe, it, expect } from 'vitest';
import { analyze, countBy, filterRange } from './analyticsUtils.js';
import { buildTree } from './treeUtils.js';
const mk = (o) => ({ date: '2026-10-13', hour: 11, bo: 'KC A', lokasi: 'U1', ukerType: 'UNIT', machineType: 'ATM', tid: '1', vendor: 'BG Surabaya', problems: ['Offline (x)', 'Lainnya'], status: 'bermasalah', ...o });
describe('analitik', () => {
  const rows = [mk({}), mk({ hour: 12 }), mk({ tid: '2', machineType: 'CRM' })];
  it('mesin unik beda dari jumlah laporan', () => { const a = analyze(rows); expect(a.total).toBe(3); expect(a.uniqueMachines).toBe(2); expect(a.problemMachines).toBe(2); });
  it('jenis kendala digabung tanpa nominal', () => { expect(analyze(rows).byProblem[0]).toEqual({ name: 'Lainnya', value: 3 }); });
  it('normal tidak dihitung sebagai gangguan', () => { expect(analyze([...rows, mk({ status: 'normal', problems: [] })]).problemReports).toBe(3); });
  it('filter', () => { expect(filterRange(rows, { type: 'CRM' })).toHaveLength(1); expect(countBy(rows, (r) => r.hour)[0].value).toBe(2); });
});
describe('tree dari Database_Monitoring', () => {
  const master = [{ tid: '1', tipe: 'ATM', bo: 'KC A', lokasi: 'U1', ukerType: 'UNIT' }, { tid: '2', tipe: 'CRM', bo: 'KC A', lokasi: 'U1', ukerType: 'UNIT' }];
  const now = { date: '2026-10-13', hour: 13 };
  const t = buildTree(master, [mk({}), mk({ hour: 12 })], '2026-10-13', now, false);
  it('mesin yang belum pernah melapor tetap muncul', () => { const ms = t[0].lokasis[0].machines; expect(ms).toHaveLength(2); expect(ms.find((m) => m.tid === '2').empty).toBe(24); });
  it('24 slot, 2 problem', () => { const m = t[0].lokasis[0].machines.find((x) => x.tid === '1'); expect(m.slots).toHaveLength(24); expect(m.problem).toBe(2); expect(t[0].problemMachines).toBe(1); });
  it('TID yang hanya ada di laporan ikut tampil', () => { expect(buildTree(master, [mk({ tid: '9' })], '2026-10-13', now, false)[0].lokasis[0].machines).toHaveLength(3); });
  it('problem yang sudah di-TL menjadi hijau, laporan asli tetap ada', () => {
    const r = mk({ timestamp: '2026-10-13 11:05:00' });
    const m = buildTree(master, [r], '2026-10-13', now, false, new Set(['2026-10-13 11:05:00|1']))[0].lokasis[0].machines.find((x) => x.tid === '1');
    expect(m.slots[11].status).toBe('normal'); expect(m.slots[11].resolved).toBe(true); expect(m.slots[11].reports).toHaveLength(1); expect(m.problem).toBe(0);
  });
  it('dua problem di satu slot: baru hijau jika keduanya di-TL', () => {
    const a = mk({ timestamp: 'A' }); const b = mk({ timestamp: 'B' });
    const one = buildTree(master, [a, b], '2026-10-13', now, false, new Set(['A|1']))[0].lokasis[0].machines.find((x) => x.tid === '1');
    expect(one.slots[11].status).toBe('bermasalah');
    const both = buildTree(master, [a, b], '2026-10-13', now, false, new Set(['A|1', 'B|1']))[0].lokasis[0].machines.find((x) => x.tid === '1');
    expect(both.slots[11].status).toBe('normal');
  });
  it('emptyAsNormal hanya untuk slot yang sudah lewat', () => { const x = buildTree(master, [mk({})], '2026-10-13', now, true)[0].lokasis[0].machines.find((m) => m.tid === '1'); expect(x.normal).toBe(13); expect(x.empty).toBe(10); });
});
