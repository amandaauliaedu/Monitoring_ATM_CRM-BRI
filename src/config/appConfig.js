export const APP_CONFIG = {
  // Mode 1 (default, tanpa backend): baca sheet publik langsung via Google Visualization CSV.
  spreadsheetId: import.meta.env.VITE_SHEET_ID || '1MYK7y45S18uRTXxRYPkHTlXMQjgw3sOMen85GZ1B0k8',
  responseSheet: 'Jawaban_Monitoring',
  masterSheet: 'Database_Monitoring',
  // Mode 2 (opsional): jika diisi, data diambil lewat Apps Script Web App.
  apiUrl: import.meta.env.VITE_API_URL || '',
  apiToken: import.meta.env.VITE_API_TOKEN || '',
  // URL Web App Apps Script (hasil Deploy) untuk menyimpan Tindak Lanjut. Kosong = fitur TL dinonaktifkan.
  writeApiUrl: import.meta.env.VITE_WRITE_API_URL || '',
  timezone: 'Asia/Jakarta',
  pollIntervalMs: 45000,
  // false = slot tanpa laporan berstatus "Belum diinput" (abu-abu). true = dianggap normal (hijau) setelah jam lewat.
  // Setel true hanya jika kebijakan unit memang menganggap "tidak ada laporan gangguan" = normal.
  emptyAsNormal: false
};

// URL Web App Apps Script yang benar: https://script.google.com/macros/s/<ID>/exec (atau /a/macros/<domain>/s/<ID>/exec).
// Link folder Google Drive BUKAN URL yang valid untuk VITE_WRITE_API_URL.
export const WRITE_URL_OK = /^https:\/\/script\.google\.com\/(a\/macros\/[^/]+\/|macros\/)s\/[^/]+\/exec\/?$/.test(APP_CONFIG.writeApiUrl);
