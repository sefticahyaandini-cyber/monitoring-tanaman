# Kebun — PWA Monitoring Tanaman

Dashboard untuk memantau suhu dan kelembapan tanaman melalui ESP32 dan Blynk Cloud. Browser hanya berkomunikasi dengan backend aplikasi; Blynk Auth Token disimpan di server dalam `.env` dan tidak dikirim ke frontend.

## Kebutuhan

### Perangkat keras

- ESP32 dengan koneksi Wi-Fi.
- Sensor suhu dan kelembapan yang didukung firmware, misalnya DHT11 atau DHT22.
- Kabel jumper dan breadboard; resistor pull-up 4,7–10 kΩ jika menggunakan sensor DHT tanpa modul pull-up terintegrasi.
- Catu daya USB yang sesuai untuk ESP32.
- Akun Blynk Cloud dan perangkat dengan datastream virtual `V0` (suhu °C) serta `V1` (kelembapan %).

Pastikan model sensor, nomor pin GPIO, dan konfigurasi datastream sesuai dengan firmware ESP32 Anda.

### Perangkat lunak

- Node.js 18 atau lebih baru (disarankan Node.js 20 LTS atau lebih baru).
- npm.
- Browser modern yang mendukung PWA, misalnya Chrome atau Edge.
- VS Code (opsional, untuk pengembangan).

## Instalasi dan menjalankan backend

1. Buka folder proyek pada VS Code.
2. Salin `.env.example` menjadi `.env`, lalu isi `BLYNK_AUTH_TOKEN` dengan token perangkat Blynk Anda. Jangan menaruh token di file frontend atau membagikan `.env`.

   PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Pasang dependensi dan jalankan server:

   ```powershell
   npm install
   npm start
   ```

   Jika PowerShell membatasi skrip `npm.ps1`, gunakan `npm.cmd install` dan `npm.cmd start`.

4. Buka `http://localhost:3000` pada laptop yang menjalankan server.

Backend melayani dashboard dan `GET /api/sensor` dari origin yang sama. Endpoint membaca nilai `V0` dan `V1` melalui Blynk HTTPS API. Pastikan ESP32 terhubung ke Wi-Fi dan mengirim data ke datastream yang benar.

## Deployment Render + Netlify

Frontend publik tidak meminta Auth Token dari anggota kelompok. Token hanya disimpan sebagai environment variable backend Render. Jangan commit `.env`, menyalin token ke `config.js`, atau memasukkan token ke pengaturan Netlify.

### 1. Siapkan repository

Push proyek ke repository GitHub. Pastikan `.env` tidak dilacak Git (`.gitignore` sudah mengecualikan `.env` dan `.env.*`; `.env.example` hanya berisi placeholder). Jangan gunakan folder `node_modules` sebagai bagian deployment.

### 2. Deploy backend di Render

1. Di Render, pilih **New → Blueprint**, lalu hubungkan repository proyek ini. Blueprint menggunakan [render.yaml](render.yaml), `npm ci`, dan `npm start`.
2. Saat diminta, isi `BLYNK_AUTH_TOKEN` dengan token perangkat Blynk. Nilai ini disimpan sebagai secret environment variable di Render.
3. Isi `FRONTEND_ORIGINS` sementara dengan `http://localhost:3000` bila URL Netlify belum tersedia. Setelah mendapat URL Netlify, ganti nilainya seperti langkah 4.
4. Tunggu service berstatus **Live**. Catat URL publik backend, misalnya `https://nama-service.onrender.com`; uji `https://nama-service.onrender.com/health`.

Render menyediakan `PORT` sendiri, yang digunakan backend melalui `process.env.PORT`. Tidak perlu mengatur `PORT` manual.

### 3. Deploy frontend di Netlify

1. Di Netlify, pilih **Add new site → Import an existing project** dan hubungkan repository yang sama.
2. Gunakan root repository sebagai base directory dan publish directory (`.`). File [netlify.toml](netlify.toml) juga menetapkan publish directory dan mencegah cache lama pada `config.js`/`sw.js`.
3. Setelah deploy, catat origin situs, misalnya `https://nama-situs.netlify.app`.
4. Ganti nilai `apiBaseUrl` di [config.js](config.js) dengan URL backend Render yang sebenarnya, tanpa slash di akhir:

   ```js
   window.KebunConfig = Object.freeze({
     apiBaseUrl: "https://nama-service.onrender.com"
   });
   ```

5. Commit dan push perubahan `config.js`, lalu tunggu Netlify menyelesaikan deploy ulang.

### 4. Izinkan origin Netlify pada backend

Di Render → service → **Environment**, set `FRONTEND_ORIGINS` ke origin Netlify persis, tanpa path atau slash akhir. Jika memakai domain khusus, pisahkan origin dengan koma:

```text
https://nama-situs.netlify.app,https://kebun-kelompok.example
```

Simpan perubahan dan tunggu Render selesai deploy ulang. Untuk pengembangan lokal, tambahkan `http://localhost:3000` jika frontend lokal menggunakan origin tersebut. Backend menolak origin API yang tidak tercantum.

### 5. Verifikasi akses kelompok

- Buka situs Netlify dari HP/laptop anggota kelompok. Tidak ada input token Blynk di aplikasi.
- Pastikan `/health` backend merespons `{"ok":true,...}` dan dashboard mendapat data dari `/api/sensor`.
- Jika dashboard menunjukkan koneksi terputus, periksa URL di `config.js`, `FRONTEND_ORIGINS`, log Render, koneksi ESP32/Blynk, dan datastream `V0`/`V1`.
- PWA dapat dipasang dari origin HTTPS Netlify. Data sensor membutuhkan koneksi internet dan backend Render tetap aktif; mode gratis Render dapat tidur sementara saat tidak ada trafik.

Jangan publikasikan `.env` lewat Netlify atau GitHub. Netlify hanya meng-host berkas frontend; semua panggilan Blynk dan penggunaan token dilakukan server Render.

## Penggunaan dashboard

- Kartu sensor menunjukkan pembacaan terakhir dan indikator rentang ideal.
- Grafik menampilkan hingga 12 pembacaan terakhir; gunakan tombol **Suhu** atau **Kelembapan** untuk mengganti data.
- Label koneksi menunjukkan apakah permintaan terbaru ke `/api/sensor` berhasil. Saat backend atau Blynk gagal, status berubah menjadi **Koneksi terputus** dan pembacaan terakhir tetap terlihat.
- Waktu pembaruan menunjukkan waktu respons data terbaru yang diterima oleh browser.
- Data diminta setiap dua detik. App shell dapat dibuka offline setelah berhasil dimuat sekurangnya sekali, tetapi data sensor terbaru memerlukan backend, internet, dan koneksi Blynk.

## Instalasi PWA di laptop dan HP

### Laptop (Chrome atau Edge)

1. Jalankan server, lalu buka `http://localhost:3000` atau alamat HTTPS yang sudah dikonfigurasi.
2. Pilih **Pasang aplikasi** jika tombol muncul, atau gunakan ikon **Install app/Pasang aplikasi** pada bilah alamat/menu browser.
3. Konfirmasi pemasangan. Aplikasi akan terbuka dalam jendela standalone.

`localhost` dianggap secure context untuk pengembangan lokal. Untuk alamat selain `localhost`, termasuk akses melalui alamat IP LAN, gunakan HTTPS agar service worker dan instalasi PWA diizinkan browser.

### HP

1. Deploy aplikasi di server dengan HTTPS yang dapat dijangkau HP. Untuk uji lokal, HP dan laptop harus berada di jaringan yang sama, tetapi alamat server tetap perlu HTTPS dengan sertifikat yang dipercaya perangkat.
2. Buka URL HTTPS di Chrome pada Android, lalu pilih **Install app** atau **Tambahkan ke layar utama**.
3. Di Safari pada iPhone/iPad, buka menu **Bagikan** → **Tambahkan ke Layar Utama**.

`localhost` pada HP menunjuk ke HP itu sendiri, bukan laptop. Jangan gunakan alamat HTTP IP laptop untuk instalasi PWA.

## Konfigurasi Blynk

| Variabel | Kegunaan |
| --- | --- |
| `PORT` | Port backend; default `3000`. |
| `BLYNK_AUTH_TOKEN` | Token perangkat, hanya dibaca server dari `.env`. |
| `BLYNK_API_URL` | Endpoint Blynk HTTPS; default `https://blynk.cloud/external/api/get`. |

Backend mengembalikan objek `{ "temperature": number, "humidity": number, "timestamp": "ISO-8601" }`. Jika pembacaan Blynk gagal, endpoint mengembalikan HTTP 503; frontend menampilkan status koneksi terputus.

## File proyek

- `index.html`, `styles.css`, `app.js` — tampilan, gaya, pembacaan sensor, grafik, dan prompt instalasi.
- `manifest.json`, `sw.js`, `icon.svg`, `icon-192.png`, `icon-512.png` — metadata, app shell cache, dan ikon PWA.
- `config.js` — URL publik backend untuk frontend; tidak berisi rahasia.
- `server.js` — endpoint sensor, CORS, dan penyajian aset frontend.
- `render.yaml`, `netlify.toml` — konfigurasi deployment backend Render dan frontend Netlify.
- `.env.example` — contoh konfigurasi tanpa kredensial aktif.
- `docs/ARSITEKTUR.md` — arsitektur, diagram alur, dan tabel pengujian fungsional.

Lihat [dokumentasi arsitektur dan pengujian](docs/ARSITEKTUR.md) untuk alur komponen dan hasil verifikasi.
