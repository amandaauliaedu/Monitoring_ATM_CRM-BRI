# Monitoring ATM & CRM Onsite — BRI Region 12 Surabaya

Halaman: Home, Live Response, Monitoring Dashboard, Data Analyst. Data dari Google Sheets (tab `Database` dan `Jawaban_Monitoring`).

## Menjalankan
```bash
npm install
npm run dev     # tanpa .env pun bisa jalan
npm test
```

## Mode data
**Mode 1 (default, tanpa backend):** browser membaca sheet lewat endpoint Google Visualization (CSV). Syarat: spreadsheet dibagikan "Siapa saja yang memiliki link: Viewer". Jika tidak publik, muncul pesan error yang menjelaskannya. Mode ini belum diuji terhadap spreadsheet Anda dari lingkungan pembuat (tanpa akses jaringan ke Google).

**Mode 2 (Apps Script, untuk sheet privat):** deploy `backend/Code.gs` sebagai Web App, lalu isi `VITE_API_URL`. Di Vercel: Settings → Environment Variables → tambah `VITE_API_URL` → **Redeploy** (nilai VITE_* masuk saat build, jadi perubahan baru berlaku setelah build ulang).

## Backend (Google Apps Script)
1. Buka script.google.com, buat proyek, salin `backend/Code.gs` dan `appsscript.json`.
2. Project Settings → Script Properties: `SPREADSHEET_ID` = `1MYK7y45S18uRTXxRYPkHTlXMQjgw3sOMen85GZ1B0k8`; `API_TOKEN` (opsional).
3. Deploy → Web app. Uji `…/exec?action=responses` di browser.
4. Tempel URL ke `VITE_API_URL`.
Catatan keamanan: `access: ANYONE` membuat endpoint dapat dipanggil siapa pun yang tahu URL-nya. Token di `VITE_*` terlihat di browser, jadi bukan autentikasi. Untuk data internal, batasi ke domain organisasi.

## Struktur sheet (diverifikasi dari screenshot 14 Okt 2026)
- `Jawaban_Monitoring`: Timestamp | Tanggal | Jam | Nama Petugas | Branch Office | Lokasi | TID | Mesin | Jenis Uker | Vendor | Status | Keterangan Problem | Detail Kendala Lainnya | Foto Mesin
- `Database_Monitoring`: TID | Tipe Mesin | Branch Office | Lokasi | Jenis (satu baris = satu mesin). Tab `Database` lama tidak dipakai lagi.
Pemetaan ada di `src/config/columnMapping.js`; nama tab di `src/config/appConfig.js`.
Form input (Apps Script) ada di `form-apps-script/` (Code.gs + Form.html), terpisah dari backend baca opsional di `backend/`.

## Aturan status slot
Kunci slot = tanggal + TID + jam mulai (WIB, dari kolom Tanggal & Jam, bukan Timestamp).
Status "Normal" = hijau, "Problem" = merah, laporan bertentangan pada slot yang sama = kuning, tanpa laporan = abu-abu (belum diinput).
`APP_CONFIG.emptyAsNormal = true` membuat slot yang sudah lewat tanpa laporan menjadi hijau (ditandai sebagai asumsi).

## Batasan saat ini
- Belum ada input monitoring lewat web ini; input lewat form Apps Script.
- Pembacaan langsung sheet (mode tanpa backend) belum diuji terhadap spreadsheet Anda dari lingkungan pembuat.
