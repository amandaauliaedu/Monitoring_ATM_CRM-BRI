/**
 * Monitoring ATM & CRM Onsite RO Surabaya
 *
 * Sheet Database_Monitoring (A:E):  TID | Tipe Mesin | Branch Office | Lokasi | Jenis
 * Sheet Jawaban_Monitoring  (A:N):  Timestamp | Tanggal | Jam | Nama Petugas | Branch Office | Lokasi | TID |
 *                                   Mesin | Jenis Uker | Vendor | Status | Keterangan Problem |
 *                                   Detail Kendala Lainnya | Foto Mesin
 */

const CONFIG = {
  TIMEZONE: 'Asia/Jakarta',
  DATABASE_SHEET: 'Database_Monitoring',
  RESPONSE_SHEET: 'Jawaban_Monitoring',
  PHOTO_FOLDER: 'Foto_Monitoring_ATM_CRM',
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  // false = foto hanya bisa dibuka akun yang punya akses ke folder Drive.
  // true  = siapa pun yang memegang link bisa melihat foto (cek kebijakan organisasi dulu).
  SHARE_PHOTO_WITH_LINK: false,

  // Tindak Lanjut (TL)
  TL_SHEET: 'Tindak_Lanjut',
  TL_PHOTO_FOLDER_ID: '1IlWOb72vux7RoGdQUZRSPY1vx-ZIWYkf', // folder Drive untuk foto TL
  TL_PHOTO_REQUIRED: true
};

const TL_HEADERS = [
  'Timestamp TL', 'Timestamp Laporan', 'Tanggal Monitoring', 'Jam Monitoring', 'TID', 'Branch Office', 'Lokasi',
  'Petugas TL', 'Tanggal TL', 'Jam TL', 'Foto TL'
];

const DB_HEADERS = ['TID', 'Tipe Mesin', 'Branch Office', 'Lokasi', 'Jenis'];

const RESPONSE_HEADERS = [
  'Timestamp', 'Tanggal', 'Jam', 'Nama Petugas', 'Branch Office', 'Lokasi', 'TID',
  'Mesin', 'Jenis Uker', 'Vendor', 'Status', 'Keterangan Problem',
  'Detail Kendala Lainnya', 'Foto Mesin'
];

const VENDORS = ['BG Surabaya', 'BG Pamekasan', 'Advantage', 'SSI Bojonegoro'];
const STATUSES = ['Normal', 'Problem'];
const OTHER_PROBLEM = 'Lainnya';
const PROBLEMS = [
  'Setor Tunai (50.000)', 'Setor Tunai (100.000)',
  'Tarik Tunai (50.000)', 'Tarik Tunai (100.000)',
  'Transaksi Non Tunai', 'Kertas Struk', 'Transaksi Tanpa Kartu',
  'Offline', 'Dispenser Failure (DF)', OTHER_PROBLEM
];

/* ------------------------------------------------------------------ */
/* Web app                                                             */
/* ------------------------------------------------------------------ */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Form')
    .setTitle('Monitoring ATM & CRM Onsite RO Surabaya')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/**
 * API tulis untuk website dashboard (JSON, POST).
 * Body: { action: 'followUp', ... }. Website memanggil tanpa header khusus agar tidak memicu preflight CORS.
 * Deploy Web app dengan akses "Siapa saja" agar bisa dipanggil dari website.
 */
function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return jsonOut_({ success: false, message: 'Permintaan tidak valid.' });
  }
  if (body.action === 'followUp') return jsonOut_(saveFollowUp(body));
  return jsonOut_({ success: false, message: 'Aksi tidak dikenal.' });
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Satu panggilan untuk semua data yang dibutuhkan form. */
function getFormData() {
  return { rows: readDatabase_(), vendors: VENDORS, problems: PROBLEMS };
}

/* ------------------------------------------------------------------ */
/* Akses sheet                                                         */
/* ------------------------------------------------------------------ */

function getSpreadsheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Spreadsheet tidak terhubung. Buka Apps Script lewat Extensions > Apps Script di spreadsheet yang benar.');
  }
  return ss;
}

function assertHeaders_(sheet, expected) {
  const actual = sheet.getRange(1, 1, 1, expected.length).getDisplayValues()[0]
    .map(function (h) { return String(h).trim(); });
  if (actual.join('|') !== expected.join('|')) {
    throw new Error('Header sheet "' + sheet.getName() + '" tidak sesuai. Harus: ' + expected.join(' | '));
  }
}

function getDatabaseSheet_() {
  const sheet = getSpreadsheet_().getSheetByName(CONFIG.DATABASE_SHEET);
  if (!sheet) throw new Error('Sheet "' + CONFIG.DATABASE_SHEET + '" tidak ditemukan.');
  assertHeaders_(sheet, DB_HEADERS);
  return sheet;
}

function getResponseSheet_() {
  const ss = getSpreadsheet_();
  // Agar Timestamp tampil dalam WIB (sebelumnya terbaca selisih 7 jam dari kolom Jam).
  if (ss.getSpreadsheetTimeZone() !== CONFIG.TIMEZONE) ss.setSpreadsheetTimeZone(CONFIG.TIMEZONE);

  let sheet = ss.getSheetByName(CONFIG.RESPONSE_SHEET);
  if (!sheet) sheet = ss.insertSheet(CONFIG.RESPONSE_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, RESPONSE_HEADERS.length).setValues([RESPONSE_HEADERS]);
    sheet.setFrozenRows(1);
  }
  assertHeaders_(sheet, RESPONSE_HEADERS);
  return sheet;
}

function readDatabase_() {
  const sheet = getDatabaseSheet_();
  const last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, 5).getDisplayValues()
    .map(function (r) {
      return {
        tid: String(r[0]).trim(),
        tipe: String(r[1]).trim().toUpperCase(),
        branch: String(r[2]).trim(),
        lokasi: String(r[3]).trim(),
        jenis: String(r[4]).trim()
      };
    })
    .filter(function (r) { return r.tid && r.branch && r.lokasi; });
}

/** Menulis satu baris sebagai teks (kecuali kolom pertama) agar tanggal/jam/TID tidak diubah otomatis. */
function writeRow_(sheet, values, firstColumnFormat) {
  const row = sheet.getLastRow() + 1;
  const range = sheet.getRange(row, 1, 1, values.length);
  const formats = values.map(function (_, i) { return i === 0 ? firstColumnFormat : '@'; });
  range.setNumberFormats([formats]);
  range.setValues([values]);
}

/* ------------------------------------------------------------------ */
/* Validasi                                                            */
/* ------------------------------------------------------------------ */

function clean_(value, max) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max || 500);
}

function validate_(f, db) {
  if (!f) throw new Error('Data form tidak ditemukan.');

  const tanggal = clean_(f.tanggal, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal) ||
      new Date(tanggal + 'T00:00:00Z').toISOString().slice(0, 10) !== tanggal) {
    throw new Error('Tanggal monitoring tidak valid.');
  }

  const jam = clean_(f.jam, 5);
  const jm = /^(\d{2}):(\d{2})$/.exec(jam);
  if (!jm || Number(jm[1]) > 23 || Number(jm[2]) > 59) throw new Error('Jam harus berformat 24 jam (HH:MM).');

  const nama = clean_(f.namaPetugas, 100);
  if (nama.length < 2) throw new Error('Nama Petugas wajib diisi.');

  const branch = clean_(f.branch, 100);
  const lokasi = clean_(f.lokasi, 100);
  const locRows = db.filter(function (r) { return r.branch === branch && r.lokasi === lokasi; });
  if (!branch || !lokasi) throw new Error('Branch Office dan Lokasi wajib dipilih.');
  if (!locRows.length) throw new Error('Lokasi tidak sesuai dengan Branch Office yang dipilih.');
  const jenis = locRows[0].jenis;

  // TID & mesin
  let tid = clean_(f.tid, 30);
  let mesin = '';
  let newTid = false;
  if (!tid) throw new Error('TID wajib dipilih atau diisi.');

  if (f.tidBaru) {
    tid = tid.toUpperCase();
    if (!/^[A-Z0-9]{3,20}$/.test(tid)) throw new Error('TID hanya boleh huruf/angka (3-20 karakter).');
    const existing = db.find(function (r) { return r.tid === tid; });
    if (existing && !(existing.branch === branch && existing.lokasi === lokasi)) {
      throw new Error('TID ' + tid + ' sudah terdaftar di ' + existing.branch + ' / ' + existing.lokasi +
        '. Pilih lokasi tersebut atau periksa kembali TID.');
    }
    if (existing) {
      mesin = existing.tipe;
    } else {
      mesin = clean_(f.mesin, 30).toUpperCase();
      if (!/^[A-Z0-9 \/-]{2,30}$/.test(mesin)) throw new Error('Jenis mesin wajib diisi (huruf/angka).');
      newTid = true;
    }
  } else {
    const row = db.find(function (r) { return r.tid === tid && r.branch === branch && r.lokasi === lokasi; });
    if (!row) throw new Error('TID tidak terdaftar pada Lokasi yang dipilih.');
    mesin = row.tipe; // selalu dari Database, bukan dari kiriman browser
  }

  const vendor = clean_(f.vendor, 50);
  if (VENDORS.indexOf(vendor) < 0) throw new Error('Vendor tidak valid.');

  const status = clean_(f.status, 10);
  if (STATUSES.indexOf(status) < 0) throw new Error('Status harus Normal atau Problem.');

  let problemsText = '-';
  let detail = '-';
  if (status === 'Problem') {
    const problems = (Array.isArray(f.problems) ? f.problems : [])
      .map(function (p) { return clean_(p, 60); })
      .filter(function (p, i, a) { return a.indexOf(p) === i; });
    if (!problems.length) throw new Error('Pilih minimal satu Keterangan Problem.');
    problems.forEach(function (p) {
      if (PROBLEMS.indexOf(p) < 0) throw new Error('Keterangan problem tidak dikenal: ' + p);
    });
    problemsText = problems.join(', ');
    if (problems.indexOf(OTHER_PROBLEM) >= 0) {
      detail = clean_(f.detailLainnya, 500);
      if (!detail) throw new Error('Detail Kendala Lainnya wajib diisi jika memilih Lainnya.');
    }
  }

  return {
    tanggal: tanggal, jam: jam, nama: nama, branch: branch, lokasi: lokasi, tid: tid, mesin: mesin,
    jenis: jenis, vendor: vendor, status: status, problemsText: problemsText, detail: detail, newTid: newTid
  };
}

/* ------------------------------------------------------------------ */
/* Foto                                                                */
/* ------------------------------------------------------------------ */

/** Memvalidasi & mengubah data URL gambar menjadi Blob (maks. 5 MB). */
function decodeImage_(fileObj, baseName) {
  const dataUrl = String(fileObj.data);
  if (dataUrl.length > CONFIG.MAX_FILE_SIZE * 1.4) throw new Error('Ukuran foto melebihi batas maksimal 5 MB.');

  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
  if (!m) throw new Error('File harus berupa gambar.');

  const bytes = Utilities.base64Decode(dataUrl.split(',').pop());
  if (bytes.length > CONFIG.MAX_FILE_SIZE) throw new Error('Ukuran foto melebihi batas maksimal 5 MB.');

  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic' }[m[1]] || 'jpg';
  return Utilities.newBlob(bytes, m[1], (baseName + '.' + ext).replace(/[\\/:*?"<>|]/g, '_'));
}

function saveBlob_(blob, folder) {
  const file = folder.createFile(blob);
  if (CONFIG.SHARE_PHOTO_WITH_LINK) file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

/** Foto dari form monitoring: folder berdasarkan nama (dibuat jika belum ada). */
function uploadPhoto_(fileObj, d) {
  if (!fileObj || !fileObj.data) return '';
  const blob = decodeImage_(fileObj, d.tid + '_' + d.tanggal + '_' + d.jam.replace(':', ''));
  const it = DriveApp.getFoldersByName(CONFIG.PHOTO_FOLDER);
  return saveBlob_(blob, it.hasNext() ? it.next() : DriveApp.createFolder(CONFIG.PHOTO_FOLDER));
}

/* ------------------------------------------------------------------ */
/* Simpan                                                              */
/* ------------------------------------------------------------------ */

function saveData(formData) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const db = readDatabase_();
    const d = validate_(formData, db);
    const responseSheet = getResponseSheet_();

    // TID baru langsung dicatat ke Database_Monitoring agar muncul di pilihan berikutnya.
    if (d.newTid) {
      writeRow_(getDatabaseSheet_(), [d.tid, d.mesin, d.branch, d.lokasi, d.jenis], '@');
    }

    const fotoUrl = uploadPhoto_(formData.fileObj, d);

    writeRow_(responseSheet, [
      new Date(), d.tanggal, d.jam, d.nama, d.branch, d.lokasi, d.tid, d.mesin, d.jenis,
      d.vendor, d.status, d.problemsText, d.detail, fotoUrl
    ], 'yyyy-mm-dd hh:mm:ss');

    return {
      success: true,
      message: 'Data monitoring berhasil disimpan.' + (d.newTid ? ' TID ' + d.tid + ' ditambahkan ke Database_Monitoring.' : '')
    };
  } catch (error) {
    return { success: false, message: error.message || String(error) };
  } finally {
    try { lock.releaseLock(); } catch (e) { /* lock tidak dipegang */ }
  }
}

/* ------------------------------------------------------------------ */
/* Tindak Lanjut (TL)                                                  */
/* ------------------------------------------------------------------ */

function getTLSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(CONFIG.TL_SHEET);
  if (!sheet) sheet = ss.insertSheet(CONFIG.TL_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, TL_HEADERS.length).setValues([TL_HEADERS]);
    sheet.setFrozenRows(1);
  }
  assertHeaders_(sheet, TL_HEADERS);
  return sheet;
}

/**
 * Mencatat TL untuk satu laporan Problem. Laporan asli TIDAK diubah; TL disimpan sebagai baris baru
 * di sheet Tindak_Lanjut (riwayat tetap utuh). Tanggal & jam TL ditentukan server (WIB).
 */
function saveFollowUp(f) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    if (!f) throw new Error('Data TL tidak ditemukan.');

    const pin = PropertiesService.getScriptProperties().getProperty('TL_PIN');
    if (pin && String(f.pin || '') !== pin) throw new Error('PIN tindak lanjut salah.');

    const tid = clean_(f.tid, 30);
    const ts = clean_(f.timestampLaporan, 30);
    const tanggal = clean_(f.tanggal, 10);
    const jam = clean_(f.jam, 5);
    const petugas = clean_(f.petugas, 100);
    if (!tid || !ts) throw new Error('Laporan yang di-TL tidak teridentifikasi.');
    if (petugas.length < 2) throw new Error('Nama petugas TL wajib diisi.');
    const hasPhoto = !!(f.fileObj && f.fileObj.data);
    if (CONFIG.TL_PHOTO_REQUIRED && !hasPhoto) throw new Error('Foto TL wajib diunggah.');

    // Cari laporan aslinya: harus ada dan berstatus Problem.
    const resp = getResponseSheet_();
    const last = resp.getLastRow();
    const data = last < 2 ? [] : resp.getRange(2, 1, last - 1, RESPONSE_HEADERS.length).getDisplayValues();
    const rep = data.filter(function (r) {
      return String(r[0]).trim() === ts && String(r[6]).trim() === tid &&
        String(r[1]).trim() === tanggal && String(r[2]).trim() === jam;
    })[0];
    if (!rep) throw new Error('Laporan tidak ditemukan. Muat ulang halaman lalu coba lagi.');
    if (String(rep[10]).trim() !== 'Problem') throw new Error('Hanya laporan berstatus Problem yang dapat di-TL.');

    // Cegah TL ganda untuk laporan yang sama.
    const tlSheet = getTLSheet_();
    const tlLast = tlSheet.getLastRow();
    const tlRows = tlLast < 2 ? [] : tlSheet.getRange(2, 1, tlLast - 1, 5).getDisplayValues();
    if (tlRows.some(function (r) { return String(r[1]).trim() === ts && String(r[4]).trim() === tid; })) {
      throw new Error('Laporan ini sudah di-TL sebelumnya.');
    }

    const now = new Date();
    const tanggalTL = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy-MM-dd');
    const jamTL = Utilities.formatDate(now, CONFIG.TIMEZONE, 'HH:mm');

    let fotoUrl = '';
    if (hasPhoto) {
      const blob = decodeImage_(f.fileObj, 'TL_' + tid + '_' + tanggal + '_' + jam.replace(':', '') + '_' +
        Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyyMMdd-HHmmss'));
      fotoUrl = saveBlob_(blob, DriveApp.getFolderById(CONFIG.TL_PHOTO_FOLDER_ID));
    }

    writeRow_(tlSheet, [now, ts, tanggal, jam, tid, rep[4], rep[5], petugas, tanggalTL, jamTL, fotoUrl], 'yyyy-mm-dd hh:mm:ss');

    return {
      success: true,
      message: 'Tindak lanjut berhasil disimpan.',
      data: { timestampLaporan: ts, tid: tid, tanggalTL: tanggalTL, jamTL: jamTL, petugas: petugas, foto: fotoUrl }
    };
  } catch (error) {
    return { success: false, message: error.message || String(error) };
  } finally {
    try { lock.releaseLock(); } catch (e) { /* lock tidak dipegang */ }
  }
}

/** Jalankan manual dari editor untuk memeriksa koneksi dan struktur sheet. */
function testConnection() {
  try {
    const rows = readDatabase_();
    const sheet = getResponseSheet_();
    return {
      success: true,
      spreadsheet: getSpreadsheet_().getName(),
      timezone: getSpreadsheet_().getSpreadsheetTimeZone(),
      jumlahTID: rows.length,
      jumlahBranch: new Set(rows.map(function (r) { return r.branch; })).size,
      baris_jawaban: Math.max(0, sheet.getLastRow() - 1)
    };
  } catch (error) {
    return { success: false, message: error.message || String(error) };
  }
}
