# AGENTS.md - Bidding Plus Helper

## Tujuan Project
Project ini adalah helper tool untuk mempermudah proses bidding di aplikasi Bidding Plus.
Terdiri dari dua sub-sistem utama:
1. **Collector**: Script otomatis menggunakan ADB/Appium untuk mengumpulkan data barang/unit (Bidding Reguler & Invoice/Riwayat Barang) langsung dari layar HP Android.
2. **Dashboard**: Web interface yang di-deploy di **https://biddlog.site** (VPS Hostinger) untuk melihat, memfilter, mengekspor hasil scan, dan mencocokkan invoice dengan pembagian barang.

## Karakteristik Project
- Stack utama: Python 3.10+, ADB (Android Debug Bridge), XML Parser, JSON & CSV Data Storage.
- Dashboard: JavaScript/Vite/React, di-deploy via Docker (Nginx Alpine) di VPS Hostinger.
- Collector API: Python Flask, di-deploy via Docker di VPS Hostinger (bisa di-trigger remote dari dashboard).
- Data exchange format: JSON (`bidding-items.json`, `invoice-items.json`, `invoice-[account].json`) dan CSV.

## Deployment & Infrastruktur
- **URL Live**: https://biddlog.site
- **VPS**: Hostinger — IP `72.62.127.119`
- **Panel**: FASTPANEL (`https://72.62.127.119:8888`, user `fastuser`)
- **Container**: Docker multi-container (dashboard Nginx + collector Python API)
- **Port Dashboard**: `8081` (host) → `80` (container `bidlog_dashboard`)
- **Port Scan API**: `5000` (internal container `bidlog_collector`, diproxy via Nginx)
- **SSL**: Let's Encrypt (fullchain.pem via certbot)
- **Reverse Proxy**: Nginx host → `http://127.0.0.1:8081`
- **Nginx Config**: `/etc/nginx/conf.d/biddlog.site.conf`
- **Folder Deploy**: `/var/www/fastuser/data/www/biddlog.site`
- **GitHub Repo**: `https://github.com/Kizker/biddlog.git`
- **Remote Scan**: SSH reverse tunnel ADB port 5037 dari laptop ke VPS

### Cara Update Dashboard di Server
```bash
ssh root@72.62.127.119
cd /var/www/fastuser/data/www/biddlog.site
git pull origin main
docker compose up -d --build
```

### Troubleshooting Server
- Jika setelah update Nginx config, perubahan tidak terasa: gunakan `systemctl restart nginx` (bukan `reload`).
- Jika port 8081 sudah dipakai: ubah port di `docker-compose.yml` dan sesuaikan Nginx config.
- Jika sertifikat SSL expired: jalankan `certbot renew` lalu `systemctl restart nginx`.

## Struktur Penting
- `collector/appium_collector.py`: Script ADB/Appium untuk memindai barang bidding reguler.
- `collector/invoice_collector.py`: Script ADB/Appium khusus memindai invoice/riwayat barang per akun (`menik`, `mubdi`, `aldi`).
- `collector/scan_api.py`: REST API (Flask) untuk trigger scan remote dari dashboard.
- `collector/Dockerfile`: Docker image Python + ADB client.
- `collector/output/invoice/`: Folder output hasil scan invoice.
- `dashboard/`: Source code web analyzer (Vite + React).
- `dashboard/Dockerfile`: Multi-stage Docker build.
- `dashboard/nginx.conf`: Config Nginx di dalam container Docker (proxy /api/ ke collector).
- `docker-compose.yml`: Orchestrator Docker multi-container (dashboard + collector).
- `scripts/start-adb-tunnel.ps1`: Script Windows untuk SSH reverse tunnel ADB.
- `scripts/start-adb-tunnel.sh`: Script Linux/Mac untuk SSH reverse tunnel ADB.

## Cara Kerja di Project Ini
- Selalu uji menggunakan device Android fisik atau emulator yang terhubung via ADB (`adb devices`).
- Pastikan HP standby di halaman invoice/riwayat barang yang sesuai sebelum melakukan scan invoice.
- Simpan data secara rapi dalam format JSON dan CSV di subfolder `output/`.
- Setelah push perubahan dashboard ke GitHub, jalankan update di VPS (lihat bagian Deployment).

## Catatan Eksekusi
- **2026-05-28**: Memperbaiki bug "miss scan" (kehilangan data scan) pada collector invoice ketika terdapat beberapa barang yang sama (duplicates).
  - Masalah: 
    1. Sistem menggunakan `find_sequence_overlap` secara default yang mencocokkan key secara sekuensial. Ketika ada item duplikat berurutan, overlap key meleset secara fisik, menyebabkan item duplikat baru dianggap sudah di-scan dan dibuang.
    2. Saat membandingkan Y-coordinate secara spasial, item yang berada di bagian paling atas dan bawah layar terpotong (clipped) oleh kontainer Android UI, sehingga Y-coordinate-nya meleset dari predicted Y-scroll delta dan terdeteksi dua kali (double-scan).
  - Solusi: 
    1. Menggunakan unique-key matching terlebih dahulu pada `estimate_scroll_delta_robust` untuk menentukan Y-scroll delta yang 100% akurat.
    2. Menyimpan dan membatasi pencarian delta spasial menggunakan `last_scroll_delta` historis sebagai filter/fallback.
    3. Mengimplementasikan pendeteksian clipping pada `split_new_visible_items_by_position`. Jika item terpotong di bagian atas, pembandingan posisi dilakukan menggunakan koordinat `bottom` (yang tidak terpotong), jika tidak terpotong maka membandingkan koordinat `top`.
  - Pengujian: Melakukan run otomatis pada HP standby di akun `menik` menggunakan perintah:
    ```powershell
    python invoice_collector.py --account menik --no-launch --phone-feedback --expected-total 28
    ```
    Hasil scan sukses 100% mendeteksi tepat 28 barang riil secara akurat tanpa ada double scan maupun item terlewat. Data tersimpan di `invoice-menik.json` dan `invoice-menik.csv`.

- **2026-06-05**: Memperbaiki bug overscan/noise pada invoice (contoh: akun 'mubdi' yang memindai 13 barang dari seharusnya 11).
  - Masalah: 
    Pendeteksian RecyclerView XML sering memberikan data kotor/terdaur-ulang (recycled dirty data) pada item yang terpotong ekstrem di bagian atas atau bawah layar (misal tinggi elemen hanya 15px-24px). Item "sliver" ini dibaca sebagai item penuh, dan karena ini belum pernah direkam di posisi tersebut, scanner menganggapnya sebagai barang baru (menimbulkan duplikat noise).
  - Solusi: 
    1. Mengedit `collect_visible_invoice_items_from_source` di `invoice_collector.py` untuk mengabaikan UI node yang memiliki tinggi bounding box (`bottom - top`) kurang dari 75px.
    2. Perbaikan yang sama diaplikasikan pada `collect_visible_items_from_source` dan `collect_visible_texts_from_source` di `appium_collector.py` agar sinkron.
    Dengan ini elemen UI yang terlalu terpotong akan diabaikan dan baru akan dipindai dengan utuh pada layar/scroll berikutnya.
  - Pengujian: Melakukan run otomatis pada HP standby di akun `mubdi` menggunakan perintah:
    ```powershell
    python invoice_collector.py --account mubdi --no-launch --expected-total 11
    ```
    Skrip berhasil mencetak tepat 11 item.

- **2026-07-07**: Deploy dashboard ke VPS Hostinger (biddlog.site).
  - Setup: Docker multi-stage build (Node 20 → Nginx Alpine), reverse proxy via Nginx host.
  - Kendala yang diatasi:
    1. Error DKIM Debian-exim saat membuat situs di FASTPANEL → membuat user/group `Debian-exim`.
    2. Port 8080 sudah dipakai → pindah ke port 8081.
    3. Nginx config FASTPANEL tidak ter-load (`fastpanel2-sites/` bukan di `conf.d/`) → manual copy config ke `conf.d/`.
    4. Sertifikat SSL parking selalu disajikan meski SNI benar → `systemctl restart nginx` (bukan `reload`).
  - Hasil: Dashboard live di https://biddlog.site dengan SSL Let's Encrypt valid.

- **2026-07-09**: Migrasi Collector ke VPS (Remote Scan via SSH Tunnel).
  - Arsitektur: HP Android ◄─USB─► Laptop (ADB Server) ◄─SSH Tunnel port 5037─► VPS (Collector + API)
  - File baru yang dibuat:
    1. `collector/Dockerfile` — Container Python 3.10 + ADB client.
    2. `collector/scan_api.py` — REST API Flask untuk trigger scan dari dashboard.
    3. `collector/requirements-server.txt` — Dependensi Flask + Flask-CORS.
    4. `collector/.dockerignore` — Exclude .venv, __pycache__, output.
    5. `scripts/start-adb-tunnel.ps1` — SSH reverse tunnel Windows (auto-reconnect).
    6. `scripts/start-adb-tunnel.sh` — SSH reverse tunnel Linux/Mac.
  - File yang dimodifikasi:
    1. `docker-compose.yml` — Tambah service `collector` + shared volume `collector-output`.
    2. `dashboard/nginx.conf` — Proxy `/api/` ke collector container + `/data/` alias ke output.
    3. `dashboard/src/main.tsx` — Tombol "Load dari Server", panel "Remote Scan", status ADB.
    4. `dashboard/src/style.css` — CSS untuk komponen baru (scan buttons, status dot, log viewer).
    5. `README.md` — Section VPS Remote Scan, arsitektur, API endpoints.
  - API Endpoints: `/api/scan/start`, `/api/scan/status`, `/api/scan/stop`, `/api/data/<path>`, `/api/adb/status`, `/api/health`.
  - Dashboard UI baru: tombol "🌐 Load dari Server" di Analyzer & Hasil Bidding, panel Remote Scan dengan start/stop/status/log.
