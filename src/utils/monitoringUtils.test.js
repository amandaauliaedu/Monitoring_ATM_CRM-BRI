import { describe, it, expect } from 'vitest';
import { parseHour, normalizeDate, slotLabel } from './dateUtils.js';
import { splitProblems, normalizeResponse, deriveSlotStatus, groupBySlot, slotStats, STATUS } from './monitoringUtils.js';

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
