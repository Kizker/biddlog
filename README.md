# Bidding Plus Helper

MVP ini terdiri dari dua bagian:

1. `collector/` - script ADB/Appium untuk membaca card barang dari aplikasi Bidding Plus melalui UI Android.
2. `dashboard/` - web analyzer lokal untuk parse, filter, watchlist, nomor urut unit, export CSV, dan cek invoice.

## Alur Kerja

1. Install Android Platform Tools sampai command `adb devices` bisa dipakai.
2. Install Appium dan driver UiAutomator2.
3. Jalankan Appium server jika ingin memakai fallback Appium.
4. Hubungkan HP Android dan pastikan USB Debugging aktif.
5. Buka halaman Bidding Reguler di aplikasi Bidding Plus.
6. Jalankan `collector/appium_collector.py`.
7. Import atau paste isi `collector/output/scan-list/bidding-items.json` ke dashboard.
8. Gunakan filter dan export hasil.

## Setup Collector

Jalankan sekali:

```powershell
npm install -g appium
appium driver install uiautomator2
```

Periksa status setup:

```powershell
cd "Documents\bidlog\collector"
python check_setup.py
```

Jalankan sebelum collector dipakai:

```bat
set "PATH=C:\platform-tools;C:\laragon\bin\nodejs\node-v20.19.3-win-x64;%PATH%"
set ANDROID_HOME=C:\
set ANDROID_SDK_ROOT=C:\
adb devices
appium --base-path /
```

Di terminal lain:

```bat
cd "Documents\bidlog\collector"
set "PATH=C:\platform-tools;C:\laragon\bin\nodejs\node-v20.19.3-win-x64;%PATH%"
set ANDROID_HOME=C:\
set ANDROID_SDK_ROOT=C:\
"C:\laragon\bin\python\python-3.10\python.exe" appium_collector.py --backend adb
```

Command normal akan reset posisi daftar ke atas lebih dulu, membaca `Total Unit` dari UI jika tersedia, lalu scroll sampai target tercapai atau daftar mentok. Aman untuk hari dengan ratusan sampai 1000+ barang karena batas default collector adalah 1500 scroll. Untuk test cepat tanpa reset posisi:

```bat
"C:\laragon\bin\python\python-3.10\python.exe" appium_collector.py --backend adb --max-scrolls 3 --no-reset-position
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
set "PATH=C:\platform-tools;C:\laragon\bin\nodejs\node-v20.19.3-win-x64;%PATH%"
set ANDROID_HOME=C:\
set ANDROID_SDK_ROOT=C:\
"C:\laragon\bin\python\python-3.10\python.exe" invoice_collector.py --account menik --no-launch --phone-feedback
"C:\laragon\bin\python\python-3.10\python.exe" invoice_collector.py --account mubdi --no-launch --phone-feedback
"C:\laragon\bin\python\python-3.10\python.exe" invoice_collector.py --account aldi --no-launch --phone-feedback
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

Di dashboard, buka view `Cek Invoice`, lalu isi:

1. `Invoice JSON` memakai `collector/output/invoice/invoice-items.json`.
2. `List pembagian awal` dari list barang per orang.
3. `List barang didapat` dari hasil barang yang benar-benar didapat.
4. `List cadangan` jika ada.

Dashboard akan membuat teks siap copy dengan status:

- `OK` barang ada di invoice dan harga tidak lewat.
- `LEWAT` barang ada di invoice tetapi harga lewat dari batas tertinggi.
- `TIDAK ADA` barang tidak ditemukan di invoice atau unit yang sama sudah dipakai item lain.

## Panduan di Dashboard

Dashboard memiliki tiga view:

1. `Analyzer` untuk paste output collector, filter, nomor unit, dan export CSV.
2. `Panduan Collector` untuk melihat langkah penggunaan UI Collector di HP Android.
3. `Cek Invoice` untuk mencocokkan invoice 3 akun dengan list pembagian, list didapat, dan cadangan.

## Catatan

Collector belum mengakses API internal Bidding Plus. Script hanya membaca teks UI yang tampil pada akun pengguna normal.
