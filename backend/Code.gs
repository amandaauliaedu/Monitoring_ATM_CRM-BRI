/**
 * Web App read-only. Deploy: Execute as "Me", akses sesuai kebijakan organisasi.
 * Script Properties: SPREADSHEET_ID, API_TOKEN (opsional).
 * Uji: <WEB_APP_URL>?action=responses  |  ?action=master
 */
const TZ = 'Asia/Jakarta';
const SHEETS = { responses: 'Jawaban_Monitoring', master: 'Database_Monitoring' };

function doGet(e) {
  const props = PropertiesService.getScriptProperties();
  const need = props.getProperty('API_TOKEN');
  if (need && (e.parameter.token || '') !== need) return out_({ success: false, message: 'Token tidak valid' });
  const name = SHEETS[e.parameter.action];
  if (!name) return out_({ success: false, message: 'action harus responses atau master' });
  try {
    const sh = SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID')).getSheetByName(name);
    if (!sh) return out_({ success: false, message: 'Sheet tidak ditemukan: ' + name });
    const [head, ...rows] = sh.getDataRange().getValues();
    const data = rows.filter(r => r.some(c => c !== '')).map(r => {
      const o = {};
      head.forEach((h, i) => { o[h] = fmt_(h, r[i]); });
      return o;
    });
    return out_({ success: true, data, message: 'Data berhasil diambil', lastUpdated: new Date().toISOString() });
  } catch (err) { return out_({ success: false, message: String(err) }); }
}
function fmt_(h, v) {
  if (!(v instanceof Date)) return v;
  if (h === 'Jam') return Utilities.formatDate(v, TZ, 'HH:mm');
  if (h === 'Tanggal') return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return Utilities.formatDate(v, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
