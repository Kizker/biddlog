# AGENTS.md - Bidding Plus Helper

## Tujuan Project
Project ini adalah helper tool untuk mempermudah proses bidding di aplikasi Bidding Plus.
Terdiri dari dua sub-sistem utama:
1. **Collector**: Script otomatis menggunakan ADB/Appium untuk mengumpulkan data barang/unit (Bidding Reguler & Invoice/Riwayat Barang) langsung dari layar HP Android.
2. **Dashboard**: Web interface lokal berbasis React/Vue untuk melihat, memfilter, mengekspor hasil scan, dan mencocokkan invoice dengan pembagian barang.

## Karakteristik Project
- Stack utama: Python 3.10+, ADB (Android Debug Bridge), XML Parser, JSON & CSV Data Storage.
- Dashboard lokal: JavaScript/Vue/React.
- Data exchange format: JSON (`bidding-items.json`, `invoice-items.json`, `invoice-[account].json`) dan CSV.

## Struktur Penting
- `collector/appium_collector.py`: Script ADB/Appium untuk memindai barang bidding reguler.
- `collector/invoice_collector.py`: Script ADB/Appium khusus memindai invoice/riwayat barang per akun (`menik`, `mubdi`, `aldi`).
- `collector/output/invoice/`: Folder output hasil scan invoice.
- `dashboard/`: Web analyzer lokal untuk menganalisis hasil scan.

## Cara Kerja di Project Ini
- Selalu uji menggunakan device Android fisik atau emulator yang terhubung via ADB (`adb devices`).
- Pastikan HP standby di halaman invoice/riwayat barang yang sesuai sebelum melakukan scan invoice.
- Simpan data secara rapi dalam format JSON dan CSV di subfolder `output/`.

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
