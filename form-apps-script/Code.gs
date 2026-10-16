/**
 * Monitoring ATM & CRM Onsite RO Surabaya
 *
 * Sheet Database_Monitoring (A:E):  TID | Tipe Mesin | Branch Office | Lokasi | Jenis
 * Sheet Jawaban_Monitoring  (A:N):  Timestamp | Tanggal | Jam | Nama Petugas | Branch Office | Lokasi | TID |
 *                                   Mesin | Jenis Uker | Vendor | Status | Keterangan Problem |
 *                                   Detail Kendala Lainnya | Foto Mesin
 *   Kolom O:P diisi saat Tindak Lanjut (TL): O = Waktu TL (yyyy-MM-dd HH:mm, WIB), P = Foto TL (link Drive)
 */

const CONFIG = {
  TIMEZONE: 'Asia/Jakarta',
  DATABASE_SHEET: 'Database_Monitoring',
  RESPONSE_SHEET: 'Jawaban_Monitoring',
  PHOTO_FOLDER: 'Foto_Monitoring_ATM_CRM',
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  // false = foto hanya bisa dibuka akun yang punya akses ke folder Drive.
  // true  = siapa pun yang memegang link bisa melihat foto (cek kebijakan organisasi dulu).
  // true = form monitoring wajib menyertakan Foto Mesin
  PHOTO_REQUIRED: true,

  SHARE_PHOTO_WITH_LINK: false,

  // Tindak Lanjut (TL): hasilnya ditulis ke kolom O (Waktu TL) dan P (Foto TL) sheet Jawaban_Monitoring
  // Folder Drive untuk foto bukti TL. Tempel link foldernya (atau cukup ID-nya). Berlaku setelah Deploy > New version.
  TL_PHOTO_FOLDER: 'https://drive.google.com/drive/folders/1IlWOb72vux7RoGdQUZRSPY1vx-ZIWYkf?usp=sharing',
  TL_PHOTO_REQUIRED: true
};


const DB_HEADERS = ['TID', 'Tipe Mesin', 'Branch Office', 'Lokasi', 'Jenis'];

const RESPONSE_HEADERS = [
  'Timestamp', 'Tanggal', 'Jam', 'Nama Petugas', 'Branch Office', 'Lokasi', 'TID',
  'Mesin', 'Jenis Uker', 'Vendor', 'Status', 'Keterangan Problem',
  'Detail Kendala Lainnya', 'Foto Mesin',
  'Waktu TL', 'Foto TL'
];
const BASE_COLS = 14; // kolom A:N diisi form monitoring; O:P diisi TL

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

function doGet(e) {
  // Tes cepat: buka <URL /exec>?ping=1 . Jika muncul JSON, deployment ini sudah memakai Code.gs yang memiliki doPost (TL).
  if (e && e.parameter && e.parameter.ping) {
    return jsonOut_({ success: true, message: 'Web app aktif dan mendukung TL (doPost).' });
  }
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

/** strictTL = true: kolom O:P wajib berjudul Waktu TL | Foto TL (dipakai saat menyimpan TL). */
function getResponseSheet_(strictTL) {
  const ss = getSpreadsheet_();
  // Agar Timestamp tampil dalam WIB (sebelumnya terbaca selisih 7 jam dari kolom Jam).
  if (ss.getSpreadsheetTimeZone() !== CONFIG.TIMEZONE) ss.setSpreadsheetTimeZone(CONFIG.TIMEZONE);

  let sheet = ss.getSheetByName(CONFIG.RESPONSE_SHEET);
  if (!sheet) sheet = ss.insertSheet(CONFIG.RESPONSE_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, RESPONSE_HEADERS.length).setValues([RESPONSE_HEADERS]);
    sheet.setFrozenRows(1);
  }
  assertHeaders_(sheet, RESPONSE_HEADERS.slice(0, BASE_COLS));
  ensureTLHeaders_(sheet, strictTL);
  return sheet;
}

/** Membuat judul kolom O:P bila masih kosong (sheet lama). Jika sudah berisi judul lain: error hanya saat strict. */
function ensureTLHeaders_(sheet, strict) {
  const want = RESPONSE_HEADERS.slice(BASE_COLS);
  const range = sheet.getRange(1, BASE_COLS + 1, 1, want.length);
  const cur = range.getDisplayValues()[0].map(function (h) { return String(h || '').trim(); });
  if (cur.join('|') === want.join('|')) return;
  if (cur.every(function (h) { return h === ''; })) {
    range.setValues([want]);
    try { sheet.getRange(1, BASE_COLS, 1, 1).copyTo(range, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false); } catch (e) { /* format opsional */ }
    return;
  }
  if (strict) {
    throw new Error('Kolom O dan P pada "' + CONFIG.RESPONSE_SHEET + '" harus berjudul: ' + want.join(' | ') +
      ' (saat ini: ' + cur.join(' | ') + ').');
  }
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

  if (CONFIG.PHOTO_REQUIRED && !(f.fileObj && f.fileObj.data)) throw new Error('Foto Mesin wajib diunggah.');

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

    // Foto diproses lebih dulu: jika foto ditolak, tidak ada data (termasuk TID baru) yang tersimpan.
    const fotoUrl = uploadPhoto_(formData.fileObj, d);

    // TID baru langsung dicatat ke Database_Monitoring agar muncul di pilihan berikutnya.
    if (d.newTid) {
      writeRow_(getDatabaseSheet_(), [d.tid, d.mesin, d.branch, d.lokasi, d.jenis], '@');
    }

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

/** Mengambil folder foto TL dari CONFIG.TL_PHOTO_FOLDER (link atau ID). */
function getTLFolder_() {
  const raw = String(CONFIG.TL_PHOTO_FOLDER || '').trim();
  const m = raw.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  const id = m ? m[1] : raw;
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(id)) {
    throw new Error('TL_PHOTO_FOLDER di Code.gs bukan link/ID folder Drive yang valid.');
  }
  try {
    return DriveApp.getFolderById(id);
  } catch (e) {
    throw new Error('Folder foto TL tidak dapat diakses. Pastikan link folder benar dan akun pemilik Apps Script punya akses Editor ke folder itu.');
  }
}

/**
 * Mencatat TL pada baris laporan Problem: kolom O = Waktu TL (tanggal + jam WIB, otomatis dari server),
 * kolom P = link foto bukti TL (disimpan di folder Drive CONFIG.TL_PHOTO_FOLDER).
 * Kolom A:N (laporan asli) tidak diubah, dan TL yang sudah ada tidak bisa ditimpa.
 */
function saveFollowUp(f) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    if (!f) throw new Error('Data TL tidak ditemukan.');

    const tid = clean_(f.tid, 30);
    const ts = clean_(f.timestampLaporan, 30);
    const tanggal = clean_(f.tanggal, 10);
    const jam = clean_(f.jam, 5);
    if (!tid || !ts) throw new Error('Laporan yang di-TL tidak teridentifikasi.');
    const hasPhoto = !!(f.fileObj && f.fileObj.data);
    const folder = hasPhoto ? getTLFolder_() : null; // gagal lebih awal jika folder tidak bisa diakses
    if (CONFIG.TL_PHOTO_REQUIRED && !hasPhoto) throw new Error('Foto bukti TL wajib diunggah.');

    // Cari baris laporan aslinya: harus ada, berstatus Problem, dan belum di-TL.
    const sheet = getResponseSheet_(true);
    const last = sheet.getLastRow();
    const data = last < 2 ? [] : sheet.getRange(2, 1, last - 1, BASE_COLS + 2).getDisplayValues();
    let idx = -1;
    for (let i = 0; i < data.length; i++) {
      const r = data[i];
      if (String(r[0]).trim() === ts && String(r[6]).trim() === tid &&
          String(r[1]).trim() === tanggal && String(r[2]).trim() === jam) { idx = i; break; }
    }
    if (idx < 0) throw new Error('Laporan tidak ditemukan. Muat ulang halaman lalu coba lagi.');
    const row = data[idx];
    if (String(row[10]).trim() !== 'Problem') throw new Error('Hanya laporan berstatus Problem yang dapat di-TL.');
    if (String(row[BASE_COLS]).trim() !== '') throw new Error('Laporan ini sudah di-TL sebelumnya.');

    const now = new Date();
    const tanggalTL = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy-MM-dd');
    const jamTL = Utilities.formatDate(now, CONFIG.TIMEZONE, 'HH:mm');
    const waktuTL = tanggalTL + ' ' + jamTL;

    let fotoUrl = '';
    if (hasPhoto) {
      const blob = decodeImage_(f.fileObj, 'TL_' + tid + '_' + tanggal + '_' + jam.replace(':', '') + '_' +
        Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyyMMdd-HHmmss'));
      fotoUrl = saveBlob_(blob, folder);
    }

    const target = sheet.getRange(idx + 2, BASE_COLS + 1, 1, 2);
    target.setNumberFormats([['@', '@']]);
    target.setValues([[waktuTL, fotoUrl]]);

    return {
      success: true,
      message: 'Tindak lanjut berhasil disimpan.',
      data: { timestampLaporan: ts, tid: tid, waktuTL: waktuTL, tanggalTL: tanggalTL, jamTL: jamTL, foto: fotoUrl }
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
