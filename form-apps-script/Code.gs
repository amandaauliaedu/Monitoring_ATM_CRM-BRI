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
  SHARE_PHOTO_WITH_LINK: false
};

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

function uploadPhoto_(fileObj, d) {
  if (!fileObj || !fileObj.data) return '';
  const dataUrl = String(fileObj.data);
  if (dataUrl.length > CONFIG.MAX_FILE_SIZE * 1.4) throw new Error('Ukuran foto melebihi batas maksimal 5 MB.');

  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
  if (!m) throw new Error('File harus berupa gambar.');

  const bytes = Utilities.base64Decode(dataUrl.split(',').pop());
  if (bytes.length > CONFIG.MAX_FILE_SIZE) throw new Error('Ukuran foto melebihi batas maksimal 5 MB.');

  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic' }[m[1]] || 'jpg';
  const name = (d.tid + '_' + d.tanggal + '_' + d.jam.replace(':', '') + '.' + ext).replace(/[\\/:*?"<>|]/g, '_');
  const blob = Utilities.newBlob(bytes, m[1], name);

  const it = DriveApp.getFoldersByName(CONFIG.PHOTO_FOLDER);
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder(CONFIG.PHOTO_FOLDER);
  const file = folder.createFile(blob);
  if (CONFIG.SHARE_PHOTO_WITH_LINK) {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }
  return file.getUrl();
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
