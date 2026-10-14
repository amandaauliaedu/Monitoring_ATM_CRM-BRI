import { APP_CONFIG as A } from '../config/appConfig.js';
import { parseCSV } from '../utils/csv.js';
import { normalizeResponse } from '../utils/monitoringUtils.js';
import { normalizeMaster } from '../utils/masterUtils.js';

let seq = 0;
async function fetchRows(sheet, action, signal) {
  if (A.apiUrl) {
    const u = new URL(A.apiUrl); u.searchParams.set('action', action);
    if (A.apiToken) u.searchParams.set('token', A.apiToken);
    const res = await fetch(u, { signal });
    if (!res.ok) throw new Error(`Backend mengembalikan status ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Backend menolak permintaan');
    return json.data;
  }
  const u = `https://docs.google.com/spreadsheets/d/${A.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}&_=${Date.now()}`;
  const res = await fetch(u, { signal });
  if (!res.ok) throw new Error(`Google Sheets mengembalikan status ${res.status}`);
  const text = await res.text();
  if (/^\s*<(!doctype|html)/i.test(text)) throw new Error('Spreadsheet tidak bisa dibaca publik. Ubah akses berbagi menjadi "Siapa saja yang memiliki link: Viewer", atau pakai mode Apps Script (lihat README).');
  return parseCSV(text);
}
// Hanya hasil request terbaru yang dipakai (mencegah data lama menimpa data baru).
export async function getAllData(signal) {
  const mine = ++seq;
  const [resp, mast] = await Promise.all([fetchRows(A.responseSheet, 'responses', signal), fetchRows(A.masterSheet, 'master', signal)]);
  const responses = resp.map(normalizeResponse).filter(Boolean)
    .sort((a, b) => (b.date + String(b.hour).padStart(2, '0')).localeCompare(a.date + String(a.hour).padStart(2, '0')) || Number(b.id.slice(1)) - Number(a.id.slice(1)));
  return { stale: mine !== seq, responses, skipped: resp.length - responses.length, rowsRead: resp.length, master: normalizeMaster(mast) };
}
