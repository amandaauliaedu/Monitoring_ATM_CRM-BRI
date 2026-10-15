import * as XLSX from 'xlsx';
import { SLOTS, nowInJakarta } from '../utils/dateUtils.js';


import { RESPONSE_COLUMNS as C } from '../config/columnMapping.js';

// Kolom sesuai header sheet Jawaban_Monitoring (tanpa Timestamp), nilai apa adanya dari sheet.
export const LIVE_COLUMNS = [['Tanggal', C.date], ['Jam', C.time], ['Nama Petugas', C.reporter], ['Branch Office', C.branch], ['Lokasi', C.location], ['TID', C.tid],
  ['Mesin', C.machineType], ['Jenis Uker', C.ukerType], ['Vendor', C.vendor], ['Status', C.status], ['Keterangan Problem', C.problems], ['Detail Kendala Lainnya', C.detail], ['Foto Mesin', C.photo]];

export function exportLiveResponses(rows) {
  if (!rows.length) throw new Error('Tidak ada data untuk diekspor.');
  const data = rows.map((r) => Object.fromEntries(LIVE_COLUMNS.map(([label, key]) => [label, r.raw?.[key] ?? ''])));
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = LIVE_COLUMNS.map(([h]) => ({ wch: Math.min(60, Math.max(h.length, ...data.map((d) => String(d[h] ?? '').length)) + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Live Response');
  XLSX.writeFile(wb, `Live_Response_ATM_CRM_${nowInJakarta().date}.xlsx`);
  return data.length;
}

export function exportAnalytics(a, rows) {
  const wb = XLSX.utils.book_new();
  const add = (name, data) => { const ws = XLSX.utils.json_to_sheet(data.length ? data : [{ Info: 'Tidak ada data' }]); ws['!cols'] = Object.keys(data[0] || { Info: 1 }).map((h) => ({ wch: Math.min(60, Math.max(h.length, ...data.map((d) => String(d[h] ?? '').length)) + 2) })); XLSX.utils.book_append_sheet(wb, ws, name); };
  const rank = (list, label) => list.map((x, i) => ({ Peringkat: i + 1, [label]: x.name, 'Jumlah Laporan': x.value }));
  add('Ringkasan KPI', [['Total laporan', a.total], ['Laporan bermasalah', a.problemReports], ['Laporan normal', a.normalReports], ['Mesin unik dilaporkan', a.uniqueMachines], ['Mesin pernah bermasalah (jumlah laporan)', a.problemReports], ['Mesin unik pernah bermasalah', a.problemMachines]].map(([k, v]) => ({ Indikator: k, Nilai: v })));
  add('Ranking BO', rank(a.byBO, 'Branch Office')); add('Ranking Lokasi', rank(a.byLokasi, 'Lokasi'));
  add('Distribusi Kendala', rank(a.byProblem, 'Jenis Kendala'));
  add('Tren Harian', a.byDay.map((d) => ({ Tanggal: d.name, 'Laporan Bermasalah': d.value })));
  add('Data Terfilter', rows.map((r) => ({ Tanggal: r.date, Jam: SLOTS[r.hour].label, BO: r.bo, Lokasi: r.lokasi, Mesin: r.machineType, TID: r.tid, Status: r.status, Vendor: r.vendor, Kendala: r.problems.join(', '), Detail: r.detail, Petugas: r.reporter })));
  XLSX.writeFile(wb, `Data_Analyst_ATM_CRM_${nowInJakarta().date}.xlsx`);
}
