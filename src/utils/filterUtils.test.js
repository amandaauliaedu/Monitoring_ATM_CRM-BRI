import { describe, it, expect } from 'vitest';
import { applyFilters, EMPTY_FILTERS, lokasiOptions, boOptions } from './filterUtils.js';
const mk = (o) => ({ ukerType: 'KC', date: '2026-10-13', bo: 'KC A', lokasi: 'U1', machineType: 'ATM', tid: '1', vendor: '', reporter: '', detail: '', problems: ['Offline'], status: 'bermasalah', ...o });
const rows = [mk({}), mk({ date: '2026-10-14', machineType: 'CRM', bo: 'KC B', lokasi: 'U2', ukerType: 'UNIT' })];
describe('filter', () => {
  it('tanggal inklusif', () => { expect(applyFilters(rows, { ...EMPTY_FILTERS, start: '2026-10-14' })).toHaveLength(1); expect(applyFilters(rows, { ...EMPTY_FILTERS, end: '2026-10-13' })).toHaveLength(1); });
  it('hari/bulan/tahun dan jenis uker', () => { expect(applyFilters(rows, { ...EMPTY_FILTERS, day: '14', month: '10', year: '2026' })).toHaveLength(1); expect(applyFilters(rows, { ...EMPTY_FILTERS, month: '09' })).toHaveLength(0); expect(applyFilters(rows, { ...EMPTY_FILTERS, ukerType: 'UNIT' })).toHaveLength(1); });
  it('jenis mesin', () => { expect(applyFilters(rows, { ...EMPTY_FILTERS, type: 'CRM' })[0].bo).toBe('KC B'); });
  it('pencarian', () => { expect(applyFilters(rows, { ...EMPTY_FILTERS, search: 'kc b' })).toHaveLength(1); });
  it('lokasi dibatasi BO', () => { expect(lokasiOptions(rows, 'KC A')).toEqual(['U1']); expect(boOptions(rows)).toHaveLength(2); });
});
