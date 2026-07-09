# Bidding Plus Helper

MVP ini terdiri dari dua bagian:

1. `collector/` - script ADB/Appium untuk membaca card barang dari aplikasi Bidding Plus melalui UI Android.
2. `dashboard/` - web analyzer yang di-deploy di **https://biddlog.site** untuk parse, filter, watchlist, nomor urut unit, export CSV, dan cek invoice.

## Dashboard (Live)

Dashboard sudah di-deploy dan bisa diakses langsung di:

> 🌐 **https://biddlog.site**

### Teknologi Deployment

| Komponen | Detail |
|---|---|
| VPS | Hostinger VPS — IP `72.62.127.119` |
| Panel | FASTPANEL (`https://72.62.127.119:8888`) |
| Container | Docker multi-container (dashboard + collector API) |
| Port Dashboard | `8081` (host) → `80` (container Nginx) |
| Port Scan API | `5000` (container internal, diproxy Nginx) |
| SSL | Let's Encrypt (auto-renew via certbot) |
| Reverse Proxy | Nginx di host → `http://127.0.0.1:8081` |

### Update Dashboard ke Server

Setelah melakukan perubahan di `dashboard/` atau `collector/`, push ke GitHub lalu jalankan di VPS via SSH:

```bash
ssh root@72.62.127.119
cd /var/www/fastuser/data/www/biddlog.site
git pull origin main
docker compose up -d --build
```

### Menjalankan Dashboard Secara Lokal (Opsional)

Jika ingin menjalankan dashboard di laptop untuk development:

```powershell
cd dashboard
npm install
npm run dev
```

Dashboard lokal akan terbuka di `http://localhost:5173`.

---

## VPS Remote Scan (Baru)

Collector sekarang bisa dijalankan dari VPS secara remote menggunakan arsitektur SSH Tunnel:

```
HP Android ◄──USB──► Laptop (ADB Server) ◄──SSH Tunnel──► VPS (Collector + API)
```

### Arsitektur

- **Laptop**: Menjalankan ADB server dan SSH reverse tunnel ke VPS (port 5037)
- **VPS**: Menjalankan collector script + REST API (`scan_api.py`) di Docker
- **Dashboard**: Tombol "Load dari Server" dan panel "Remote Scan" untuk trigger scan langsung dari web

### Cara Pakai Remote Scan

#### 1. Setup SSH Key (sekali saja)

```powershell
# Di laptop Windows
ssh-keygen -t ed25519
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh root@72.62.127.119 "cat >> ~/.ssh/authorized_keys"
```

#### 2. Jalankan ADB Tunnel di Laptop

```powershell
# Sambungkan HP via USB, pastikan USB Debugging aktif
.\scripts\start-adb-tunnel.ps1
```

Script akan:
- Mengecek HP terdeteksi via ADB
- Membuat SSH reverse tunnel (port 5037) ke VPS
- Auto-reconnect jika tunnel putus

**Jangan tutup window PowerShell selama scan berlangsung.**

#### 3. Gunakan Dashboard

Buka **https://biddlog.site** → tab **Analyzer**:

- Klik **🌐 Load dari Server** untuk memuat data terbaru dari server
- Gunakan panel **Remote Scan** untuk:
  - **▶ Scan Bidding** — trigger scan daftar Bidding Reguler
  - **📋 Scan Invoice** — trigger scan invoice per akun
  - **🔄 Refresh** — cek status ADB dan scan
  - **⏹ Stop Scan** — hentikan scan yang sedang berjalan

### Docker Services

| Service | Container | Port | Fungsi |
|---|---|---|---|
| `dashboard` | `bidlog_dashboard` | 8081:80 | Nginx serve dashboard + proxy API |
| `collector` | `bidlog_collector` | 5000 (internal) | Python scan API + collector |

### API Endpoints

| Method | Path | Fungsi |
|---|---|---|
| `GET` | `/api/scan/status` | Status scan (idle/running/done/error) |
| `POST` | `/api/scan/start` | Mulai scan baru |
| `POST` | `/api/scan/stop` | Hentikan scan |
| `GET` | `/api/data/<path>` | Serve file output collector |
| `GET` | `/api/data/list` | List semua file output |
| `GET` | `/api/adb/status` | Cek koneksi ADB |
| `GET` | `/api/health` | Health check |

---

## Alur Kerja Collector (Lokal/Portable)

> Metode lokal tetap bisa dipakai sebagai alternatif jika VPS tidak tersedia.

1. Install Android Platform Tools sampai command `adb devices` bisa dipakai.
2. Install Appium dan driver UiAutomator2.
3. Jalankan Appium server jika ingin memakai fallback Appium.
4. Hubungkan HP Android dan pastikan USB Debugging aktif.
5. Buka halaman Bidding Reguler di aplikasi Bidding Plus.
6. Jalankan `collector/appium_collector.py`.
7. Buka **https://biddlog.site**, klik **🌐 Load dari Server** atau upload file `bidding-items.json` manual.
8. Gunakan filter dan export hasil.

## Setup Collector

Jalankan sekali:

```powershell
npm install -g appium
appium driver install uiautomator2
```

Periksa status setup:

```powershell
cd collector
python check_setup.py
```

Jalankan sebelum collector dipakai:

```bat
set "PATH=C:\platform-tools;%PATH%"
set ANDROID_HOME=C:\
set ANDROID_SDK_ROOT=C:\
adb devices
appium --base-path /
```

Di terminal lain:

```bat
cd collector
set "PATH=C:\platform-tools;%PATH%"
set ANDROID_HOME=C:\
set ANDROID_SDK_ROOT=C:\
python appium_collector.py --backend adb
```

Command normal akan reset posisi daftar ke atas lebih dulu, membaca `Total Unit` dari UI jika tersedia, lalu scroll sampai target tercapai atau daftar mentok. Aman untuk hari dengan ratusan sampai 1000+ barang karena batas default collector adalah 1500 scroll. Untuk test cepat tanpa reset posisi:

```bat
python appium_collector.py --backend adb --max-scrolls 3 --no-reset-position
```

## Setup Scanner Invoice

Scanner invoice dibuat terpisah dari scanner Bidding Reguler. Alurnya:

1. Login atau pindah ke akun invoice yang ingin discan.
2. Sambungkan HP ke laptop dan pastikan USB Debugging sudah diizinkan.
3. Buka manual halaman invoice/riwayat barang didapat di aplikasi yang sesuai akun, lalu biarkan HP tetap di halaman itu.
4. Jalankan command sesuai nama akun.
5. Ulangi untuk akun `menik`, `mubdi`, dan `aldi`.

Command scan invoice:

```bat
cd "Documents\bidlog\collector"
set "PATH=C:\platform-tools;%PATH%"
set ANDROID_HOME=C:\
set ANDROID_SDK_ROOT=C:\
python invoice_collector.py --account menik --no-launch --phone-feedback
python invoice_collector.py --account mubdi --no-launch --phone-feedback
python invoice_collector.py --account aldi --no-launch --phone-feedback
```

Package aplikasi invoice otomatis:

- `menik`: `id.biddingplus` atau Bidding Plus asli.
- `mubdi`: `id.biddingplut` atau Bidding Plus clone App Cloner.
- `aldi`: `com.biddingnativeapp` atau Bidding Plus clone Island.

Semua akun invoice memakai `--no-launch`, jadi scanner tidak membuka aplikasi otomatis. Pastikan HP sudah standby di halaman invoice akun yang benar sebelum command dijalankan. Contoh untuk akun `aldi`:

```bat
"C:\laragon\bin\python\python-3.10\python.exe" invoice_collector.py --account aldi --no-launch --phone-feedback
```

Output per akun:

- `collector/output/invoice/invoice-menik.json` dan `collector/output/invoice/invoice-menik.csv`
- `collector/output/invoice/invoice-mubdi.json` dan `collector/output/invoice/invoice-mubdi.csv`
- `collector/output/invoice/invoice-aldi.json` dan `collector/output/invoice/invoice-aldi.csv`

Setiap selesai scan satu akun, scanner juga memperbarui output gabungan:

- `collector/output/invoice/invoice-items.json`
- `collector/output/invoice/invoice-items.csv`

## Modul Cek Invoice

Di dashboard (**https://biddlog.site**), buka view `Hasil Bidding`, lalu isi:

1. `Invoice JSON` memakai `collector/output/invoice/invoice-items.json` (atau klik **🌐 Load Invoice dari Server**).
2. `List pembagian awal` dari list barang per orang.
3. `List barang didapat` dari hasil barang yang benar-benar didapat.
4. `List cadangan` jika ada.

Dashboard akan membuat teks siap copy dengan status:

- `OK` barang ada di invoice dan harga tidak lewat.
- `LEWAT` barang ada di invoice tetapi harga lewat dari batas tertinggi.
- `TIDAK ADA` barang tidak ditemukan di invoice atau unit yang sama sudah dipakai item lain.

## Panduan di Dashboard

Dashboard memiliki tiga view:

1. `Analyzer` untuk load data dari server atau upload file, filter, nomor unit, remote scan, dan export XLSX.
2. `Panduan Collector` untuk melihat langkah penggunaan UI Collector di HP Android.
3. `Hasil Bidding` untuk mencocokkan invoice 3 akun dengan list pembagian, list didapat, dan cadangan.

## Catatan

Collector belum mengakses API internal Bidding Plus. Script hanya membaca teks UI yang tampil pada akun pengguna normal.

