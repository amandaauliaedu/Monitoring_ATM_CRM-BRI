import { describe, it, expect } from 'vitest';
import { parseHour, normalizeDate, slotLabel } from './dateUtils.js';
import { reportKey, splitProblems, normalizeResponse, deriveSlotStatus, groupBySlot, slotStats, STATUS } from './monitoringUtils.js';

const row = { Tanggal: '2026-10-13', Jam: '23:30', 'Branch Office': 'KC Bangkalan', Lokasi: 'Unit Kamal 2', TID: '161238', Mesin: 'crm', 'Jenis Uker': 'UNIT', Status: 'Problem', 'Keterangan Problem': 'Tarik Tunai (50.000), Offline' };
describe('waktu', () => {
  it('slot 23-00 dan label', () => { expect(parseHour('23:59')).toBe(23); expect(slotLabel(23)).toBe('23.00–00.00'); });
  it('jam tidak valid', () => { expect(parseHour('25:00')).toBeNull(); expect(parseHour('')).toBeNull(); });
  it('normalisasi tanggal', () => { expect(normalizeDate('13/10/2026')).toBe('2026-10-13'); });
});
describe('parsing', () => {
  it('pisah problem di luar kurung & abaikan "-"', () => { expect(splitProblems('A (1, 2), B')).toEqual(['A (1, 2)', 'B']); expect(splitProblems('-')).toEqual([]); });
  it('baris Problem -> laporan', () => { const r = normalizeResponse(row); expect(r.hour).toBe(23); expect(r.status).toBe(STATUS.PROBLEM); expect(r.problems).toHaveLength(2); expect(r.machineType).toBe('CRM'); });
  it('baris Normal -> hijau', () => { expect(normalizeResponse({ ...row, Status: 'Normal', 'Keterangan Problem': '-' }).status).toBe(STATUS.NORMAL); });
  it('tanpa TID dilewati', () => { expect(normalizeResponse({ ...row, TID: '' })).toBeNull(); });
});
describe('TL (kolom O-P)', () => {
  const r = normalizeResponse({ ...row, Timestamp: '2026-10-13 23:31:02' });
  it('tanpa Waktu TL = belum di-TL', () => { expect(r.tlDone).toBe(false); expect(reportKey(r)).toBe('2026-10-13 23:31:02|161238'); });
  it('Waktu TL terisi = sudah di-TL, status asli tetap Problem', () => {
    const t = normalizeResponse({ ...row, 'Waktu TL': '2026-10-14 08:00', 'Foto TL': 'https://drive/x' });
    expect(t.tlDone).toBe(true); expect(t.status).toBe(STATUS.PROBLEM); expect(t.tlPhoto).toBe('https://drive/x');
    expect(deriveSlotStatus([t])).toBe(STATUS.TL); expect(deriveSlotStatus([t, r])).toBe(STATUS.PROBLEM);
  });
});
describe('status & slot', () => {
  const r = normalizeResponse(row);
  it('kosong = belum diinput, bukan normal', () => { expect(deriveSlotStatus([])).toBe(STATUS.EMPTY); });
  it('konflik = verifikasi', () => { expect(deriveSlotStatus([r, { ...r, status: STATUS.NORMAL }])).toBe(STATUS.VERIFY); });
  it('banyak laporan dalam satu slot dihitung satu slot', () => {
    const s = slotStats(r, '2026-10-13', groupBySlot([r, { ...r, id: 'x' }]), { date: '2026-10-14', hour: 0 });
    expect(s.filled).toBe(1); expect(s.counts.bermasalah).toBe(1); expect(s.counts.belum).toBe(23);
  });
  it('slot masa depan tidak jatuh tempo', () => { expect(slotStats(r, '2026-10-13', new Map(), { date: '2026-10-13', hour: 9 }).due).toBe(10); });
});

import { reportsByTid, unresolvedSince, minutesSince, formatDuration } from './monitoringUtils.js';
import { byVendor } from './analyticsUtils.js';
describe('durasi belum TL', () => {
  const P = (date, hour, o = {}) => ({ tid: '12345', date, hour, timestamp: `${date} ${hour}`, status: STATUS.PROBLEM, tlDone: false, ...o });
  it('jam yang terlewat tidak memutus; hitung dari laporan pertama', () => {
    const s = unresolvedSince(reportsByTid([P('2026-10-19', 2), P('2026-10-19', 3), P('2026-10-19', 4), P('2026-10-19', 6)]).get('12345'));
    expect(minutesSince(s, { date: '2026-10-19', hour: 7, minute: 0 })).toBe(300);
  });
  it('lintas hari', () => { expect(formatDuration(minutesSince(P('2026-10-14', 8), { date: '2026-10-15', hour: 9, minute: 0 }))).toBe('1 hari 1 jam');
    expect(formatDuration(minutesSince({ date: '2026-10-19', hour: 7, minute: 15 }, { date: '2026-10-19', hour: 8, minute: 28 }))).toBe('1 jam 13 menit'); });
  it('TL atau Normal memutus rangkaian', () => {
    expect(unresolvedSince([P('2026-10-19', 2), P('2026-10-19', 3, { tlDone: true })])).toBeNull();
    expect(unresolvedSince([P('2026-10-19', 2), P('2026-10-19', 3, { status: STATUS.NORMAL }), P('2026-10-19', 5)]).hour).toBe(5);
  });
});
describe('vendor', () => {
  it('mesin unik per vendor', () => {
    const v = byVendor([{ status: 'bermasalah', vendor: 'BG Surabaya', machineType: 'CRM', tid: '1' }, { status: 'bermasalah', vendor: 'BG Surabaya', machineType: 'CRM', tid: '1' }, { status: 'bermasalah', vendor: 'BG Surabaya', machineType: 'ATM', tid: '2' }]);
    expect(v[0]).toMatchObject({ name: 'BG Surabaya', crm: 1, atm: 1, total: 2 });
    expect(v[0].items.CRM[0].tid).toBe('1');
  });
});
