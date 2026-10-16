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

## Tindak Lanjut (TL)
Di Monitoring Dashboard, klik kotak merah. Di bawah laporan muncul blok TL: tanggal TL, jam TL, status (Sudah/Belum di-TL), dan foto bukti.
Tekan "Sudah di-TL", unggah foto (maks. 5 MB), lalu tekan "Done". Jam TL dicatat otomatis oleh server (WIB).
- Disimpan di sheet `Jawaban_Monitoring` pada baris laporan yang sama: **kolom O = Waktu TL** (`yyyy-MM-dd HH:mm`), **kolom P = Foto TL** (link Drive). Judul O1 dan P1 dibuat otomatis jika masih kosong.
- Kolom A:N (laporan asli) tidak diubah, dan TL yang sudah tercatat tidak bisa ditimpa.
- Kotak jadi **biru** (Sudah TL) jika semua laporan Problem di slot itu sudah di-TL. Data Analyst tetap menghitung laporan Problem aslinya (riwayat).
- Foto TL disimpan di folder Drive yang ditulis di `CONFIG.TL_PHOTO_FOLDER` (`form-apps-script/Code.gs`, boleh berupa link folder). Mengubah folder = ubah nilai itu lalu deploy **New version**; `.env` tidak berpengaruh. Akun pemilik Apps Script harus Editor di folder itu.
- Aktifkan: tempel `form-apps-script/Code.gs`, **Deploy > Manage deployments > Edit > New version** (akses "Siapa saja"), lalu isi `VITE_WRITE_API_URL` di `.env` (lokal) dan di Vercel, restart/redeploy.
- Keamanan: endpoint berakses "Siapa saja" dapat dipanggil siapa pun yang tahu URL-nya. Server memvalidasi laporan, mencegah TL ganda, dan membatasi tipe/ukuran foto.

## Aturan status slot
Kunci slot = tanggal + TID + jam mulai (WIB, dari kolom Tanggal & Jam, bukan Timestamp).
Status "Normal" = hijau, "Problem" = merah, laporan bertentangan pada slot yang sama = kuning, tanpa laporan = abu-abu (belum diinput).
`APP_CONFIG.emptyAsNormal = true` membuat slot yang sudah lewat tanpa laporan menjadi hijau (ditandai sebagai asumsi).

## Batasan saat ini
- Belum ada input monitoring lewat web ini; input lewat form Apps Script.
- Pembacaan langsung sheet (mode tanpa backend) belum diuji terhadap spreadsheet Anda dari lingkungan pembuat.

## Jika TL gagal: "Failed to fetch"
Browser tidak bisa menghubungi Web App. Cek berurutan:
1. Buka `<VITE_WRITE_API_URL>?ping=1` di jendela Incognito. Harus muncul JSON `{"success":true,...}`.
   - Diminta login Google: akses deployment belum "Anyone" (Deploy > Manage deployments > Edit > Who has access: Anyone > New version).
   - Muncul formulir biasa / error "Script function not found": kode belum versi terbaru, deploy **New version**.
   - URL tidak berakhiran `/exec` (mis. `/dev`): pakai URL dari Manage deployments.
2. Pastikan `.env` (lokal) / Environment Variables (Vercel) berisi URL yang sama, lalu restart / redeploy.
- `VITE_WRITE_API_URL` harus URL Web App (`https://script.google.com/macros/s/.../exec`), bukan link folder Drive. Aplikasi menampilkan peringatan jika bentuknya salah.

## Foto Mesin
Foto Mesin wajib diisi di form monitoring (validasi di browser dan di server; `CONFIG.PHOTO_REQUIRED` di Code.gs). Maks. 5 MB, format gambar.
