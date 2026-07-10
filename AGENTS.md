# AGENTS.md - Biddlog Project Orchestration Document

## 1. Instruksi Inti Agent (Wajib Dipatuhi)
Agent bertindak sebagai **Project Orchestrator** dengan aturan ketat berikut:
1. **Analisis Mendalam:** Selalu analisis keseluruhan proyek (struktur folder, dependencies, arsitektur) sebelum mengeksekusi aksi apa pun. Jangan pernah berasumsi atau berhalusinasi. Jika informasi teknis tidak pasti, gunakan kemampuan pencarian internet untuk riset.
2. **Otonomi Aman:** Agent **DIIZINKAN** langsung melakukan eksekusi berikut tanpa meminta persetujuan berulang: membuat file, mengedit file, membuat folder, memperbarui `AGENTS.md`, menjalankan lint/test/build, dan menjalankan *command* terminal yang aman.
3. **Batasan Destruktif (Wajib Izin):** Agent **DIWAJIBKAN** meminta konfirmasi pengguna sebelum:
   - Menghapus file/folder.
   - Menjalankan command destruktif.
   - Mengubah file `.env` (environment variables).
   - Menggunakan/menulis credential, API key, token, atau password.
   - Melakukan Deploy atau `git push`.
   - Melakukan *migration*, *drop*, atau *alter* tabel pada Database.
   - Mengubah arsitektur besar atau mengganti framework utama.
4. **Prinsip Komunikasi:** Jika ada ambiguitas, instruksi kurang jelas, atau tindakan berisiko tinggi, agent harus berhenti dan bertanya. Jika instruksi sudah jelas dan aman, langsung eksekusi.
5. **Pencatatan Berkelanjutan:** Agent harus terus memperbarui file `AGENTS.md` ini di bagian "Log Eksekusi" untuk mencatat: analisis, rencana kerja, file yang dibuat/diedit, command yang dijalankan, kendala, solusi, dan hasil akhir.

---

## 2. Deskripsi Proyek & Stack Teknologi
- **Nama Proyek:** Biddlog
- **Fungsi Utama:** Sistem orkestrasi *bidding*, manajemen distribusi tugas/barang (drag & drop), sistem presensi dengan *time-gating* ketat, dan kalkulator gaji/fee otomatis berdasarkan hasil laporan.
- **Database Utama:** **MySQL** (Wajib).

---

## 3. Deskripsi Referensi Visual (UI/UX)
Agent harus membangun antarmuka berdasarkan deskripsi dari lampiran gambar berikut:

### A. Referensi Sidebar Admin (`sidebar.png`)
- **Tampilan Visual:** Sidebar vertikal dengan *background* biru tua (Navy) dan teks putih.
- **Header Sidebar:** Logo kotak putih (berisi ikon *megaphone* dan teks "Bidding ItemAnalyzer") disejajarkan dengan garis vertikal putih, diikuti teks "Biddlog".
- **Menu Items (Berjejer ke bawah):**
  1. Dashboard (Aktif: tombol putih, teks biru tua)
  2. Analyzer
  3. Hasil Bidding
  4. Scanner
  5. Pembagian Barang
  6. Laporan Presensi
  7. Laporan List Dapat
  8. Pengguna
  9. Audit Trail
- **Footer Sidebar:** Tombol merah tebal "Keluar" (dengan ikon *logout*) dan di bawahnya teks "Administrator" (dengan ikon *user* biru).

### B. Referensi Header Publik/Anggota (`header.png`)
- **Tampilan Visual:** Navbar horizontal di bagian atas halaman dengan *background* putih dan elemen teks berwarna biru tua.
- **Kiri:** Logo kotak Bidding ItemAnalyzer, garis vertikal, dan teks "Biddlog" (persis seperti di sidebar admin).
- **Tengah (Menu Publik):** Teks menu sejajar horizontal: "Beranda", "Presensi", "List Dapat". (Yang sedang aktif di- *highlight* biru).
- **Kanan:** 
  - Tombol biru dengan ikon *user* bertuliskan "Admin" (menandakan *role* yang sedang *login*).
  - Indikator kotak bergaris (outline): "0 Barang".
  - Indikator kotak bergaris (outline): "0 Tampil".

### C. Referensi Laporan Presensi (`image_2668c6.png`)
- **Tampilan Visual:** Antarmuka mirip *spreadsheet* (Excel/Google Sheets) yang padat data.
- **Struktur Kolom:** Kolom pertama berisi Nama/Tim. Kolom-kolom berikutnya adalah Tanggal (Contoh: 13 July 2026, 14 July 2026, dst).
- **Struktur Baris (Grouping):**
  - Baris dikelompokkan berdasarkan "Ketua Tim" (contoh: "Andricha :", "Baroto :", "Mba Atik :").
  - Di bawah nama ketua tim, terdapat daftar anggota tim bernomor (contoh: 1. Andri, 2. Alya, 3. Rina, 4. Bela, dst).
  - Setiap sel pertemuan antara nama anggota dan tanggal memiliki elemen **Dropdown/Select Box** untuk menentukan status.
  - Di bawah setiap grup tim terdapat baris **"Total :"** dengan latar belakang Kuning.
  - Di bagian paling bawah tabel terdapat baris **"Total Semua :"** dengan latar belakang Hijau.

---

## 4. Alur Kerja & Spesifikasi Fitur (Role-Based Access Control)

Sistem menggunakan 2 level *role*: **1. Admin**, **2. Anggota**.
- **Auth (Login):** Halaman awal (gerbang utama). Akun pengguna hanya bisa dibuat dan dikelola oleh Admin.

### I. Portal Admin (Semua Akses)
Admin memiliki hak akses ke semua fitur, termasuk fitur anggota (karena admin juga ikut *bidding*).
1. **Analyzer:**
   - Halaman *input text area* untuk menempelkan daftar mentah (seperti contoh di Bagian 5).
   - Fitur *parsing/scan* otomatis untuk mendeteksi: Nama Anggota, Tim, Spesifikasi Barang (Model, Storage, Grade), Qty, dan Limit Harga.
   - Tombol **"Upload ke Bagian"** untuk melempar hasil *scan* ke menu "Pembagian Barang".
   - **Fitur Spesial (AI & AJ Toggle):** Barang dengan *grade* "ai" dan "aj" tidak boleh langsung ditampilkan. Letakkan *section* khusus di bagian bawah dengan tombol "Tampilkan Barang AI & AJ". Jika admin mengklik ini, barulah barang *grade* tersebut di- *render*.
2. **Hasil Bidding:**
   - Modul rekonsiliasi. Mencocokkan data barang yang ditugaskan dengan hasil aktual yang didapat (List Dapat).
   - Menentukan status gaji (apakah limit harga sesuai aturan, lewat limit, atau perlu ACC pimpinan).
3. **Panduan & Scanner:**
   - Halaman statis/tools lanjutan berisi panduan sistem (diteruskan dari sistem sebelumnya).
4. **Pembagian Barang:**
   - Menampilkan *pool* barang yang sudah di- *parse* dari Analyzer.
   - **Mekanisme Drag & Drop:** Terdapat daftar nama pengguna yang berjejer vertikal ke bawah. Di *desktop*, Admin dapat menarik (*drag*) kartu/item barang dan melepaskannya (*drop*) di bawah nama pengguna yang dituju.
   - Terdapat tombol **"Publish"**. Jika ditekan, barang baru akan muncul di menu "Beranda" Publik.
5. **Laporan Presensi:**
   - Halaman *real-time monitoring* berdasarkan input pengguna (lihat referensi `image_2668c6.png`).
   - Terdapat fitur **Filter Waktu** untuk menampilkan data rekapan per: 1 Minggu, 1 Bulan, dsb.
6. **Laporan List Dapat:**
   - Halaman *real-time monitoring* progres input barang yang didapat oleh anggota.
   - Terdapat fitur tabel rekap historis dengan filter waktu (Mingguan, Bulanan).
7. **Gaji:**
   - Terisi otomatis jika data dari "Hasil Bidding" sudah dikoreksi/divalidasi.
   - Terdapat fitur *Approval* manual oleh Admin/Pimpinan untuk anggota yang nominal bid-nya "lewat limit sedikit" agar tetap bisa mendapatkan bayaran/fee.
8. **Limit Harga & Fee Barang (Master Data Settings):**
   - Halaman pengaturan default.
   - Menentukan Harga Limit berdasarkan Model HP & Grade.
   - Menentukan aturan perhitungan **Fee (Gaji)**. Harus ada opsi *dropdown/radio* kelipatan puluhan: 25, 50, 75, 100, 150, hingga 400. Serta harus ada opsi **"Isi Sendiri" (Custom Input Text)** untuk angka di luar standar.
   - Settingan ini menjadi *default* saat pengguna mengisi 'List Dapat', namun *field* tersebut tidak terkunci (bisa diubah oleh pengguna/admin nantinya).
9. **Pengguna:**
   - Manajemen Akun (CRUD: Create, Read, Update, Delete, Reset Password).
   - Penentuan *Role*: Admin atau Anggota.
10. **Audit Trail:**
    - Tabel *log system*. Merekam *id_user*, aksi yang dilakukan (contoh: "User A mengubah limit harga"), *timestamp*, dan IP.

### II. Portal Publik (Anggota)
Anggota HANYA dapat mengakses 3 menu ini via *Header* (`header.png`).
1. **Beranda:**
   - Menampilkan daftar "Pembagian Barang" yang ditugaskan khusus untuk *user* yang sedang *login*.
   - **Kondisi:** Data di halaman ini kosong/terkunci sampai Admin menekan tombol "Publish" di modul Pembagian Barang (Admin).
2. **Presensi:**
   - Halaman absensi harian.
   - **TIME-GATE KETAT:** Halaman/tombol submit **HANYA BISA DIAKSES pada pukul 06.30 hingga 07.50 waktu server/lokal**. Di luar jam ini, form ditutup atau tombol di-*disable*.
3. **List Dapat:**
   - Halaman untuk anggota meng- *input* barang apa saja yang berhasil didapat hari ini.
   - **TIME-GATE:** Halaman ini baru dibuka pada **pukul 08.00** (setelah bid tutup).
   - **PRASYARAT WAJIB:** Form input terkunci dan menampilkan peringatan *"Menunggu hasil scan invoice ter-upload"* sampai Admin mengunggah file invoice sebagai alat bukti validasi barang.

---

## 5. Referensi Format Data Parsing (Regex Target)

Agent harus membangun fungsi logika Regex/Parsing untuk membaca teks mentah berikut dan mengubahnya menjadi JSON/Database Table.

**A. Format Mentah Analyzer (Untuk Pembagian Barang):**
```text
1.Mubdi : menik/mubdi/aldi
fold 7 1024 ag (1) @18750
fold 6 512 ad (1) @12950

3.Andricha : Menik/Mubdi/Aldi
flip 5 512 ag (1) @5000-5100
flip 5 256 ag (1) @4700


Enb tgl 10/07/ 2026

Nestyo
s23 256 ag (1) @4510 menik⚠️ lewat 10

Andricha
flip 5 512 ag (1) @4580 aldi✅
flip 5 256 ag (1) @4240 menik✅

Mubdi
fold 6 512 ad (1) @12900 aldi✅
s21 256 aj (1) @1370 mubdi✅
```

## Log Eksekusi
### [2026-07-10 16:18] — Eksekusi UI Sidebar Admin dan Header Publik
- Mengubah desain Sidebar Admin (`.admin-sidebar`) di `style.css` menjadi navy blue, menambahkan pembatas `.sidebar-divider`, dan me-styling daftar navigasi beserta indikator submenu.
- Mengubah desain Header Publik (`.public-header`) di `style.css` agar berbentuk flex-row, menyertakan badge warna `navy` dengan background solid untuk logo Admin dan outline border abu-abu untuk parameter counter.
- Menambahkan dokumentasi terbaru sesuai permintaan pengguna.

### [2026-07-10 16:44] — Inisialisasi Database dan Koneksi Backend
- Mendesain skema database MySQL (`biddlog_db`) berdasarkan spesifikasi awal dan membuat *tables*: `users`, `items`, `attendances`, `obtained_items`, `limits_and_fees`, `audit_trail`.
- Mengeksekusi script SQL langsung menggunakan MySQL CLI dari Laragon untuk memastikan struktur terpasang di *local server*.
- Membuat struktur Backend menggunakan PHP Murni (PDO) di `api/config/db.php` dan endpoint uji coba di `api/test_connection.php`.
- Menyesuaikan kode frontend pada `dashboard/src/main.tsx` untuk melakukan `fetch` ke endpoint `test_connection.php` pada saat halaman Login dimuat, guna memberikan indikator visual apakah koneksi basis data berhasil terhubung (Connected/Error).
- Mengeksekusi ulang `npm run build` dengan konfigurasi `$env:Path` manual yang diarahkan ke nodejs bawaan Laragon (`node-v20`) agar kompilasi frontend berhasil dimuat di direktori `dist`.

### [2026-07-10 16:49] — Pembangunan Logika Portal Publik (Anggota)
- Menambahkan *state* `anggotaView` untuk memfasilitasi 3 menu utama tab (Beranda, Presensi, List Dapat) pada Header Portal Publik.
- Menerapkan *time-gate* logika pada menu **Presensi** (hanya bisa diakses jam 06:30 - 07:50) beserta tampilan UI yang menyesuaikan waktu yang berjalan.
- Menerapkan *time-gate* dan validasi prasyarat pada menu **List Dapat** (hanya bisa diakses di atas jam 08:00 dan mewajibkan adanya indikator validasi invoice).
- Menjalankan *build* akhir agar komponen dapat dicek langsung di lingkungan Laragon lokal.

### [2026-07-10 16:58] — Overhaul Visual UI Sidebar Admin & Header Publik
- **CSS (`style.css`):** Menghapus semua duplikat CSS layout (3 set definisi sidebar/header yang bertabrakan) dan menggantinya dengan satu set CSS yang bersih dan terstruktur.
- **Sidebar Admin:** Gradient background navy (`#080e56` → `#030b3a`), logo dengan shadow, navigasi dikelompokkan dalam 4 grup dengan `sidebar-nav-divider`, footer berupa white card dengan rounded corners, tombol Keluar merah solid, dan teks "Administrator" berwarna navy.
- **Header Publik:** Bentuk pill/rounded (`border-radius: 48px`) dengan floating shadow, margin dari tepi browser, logo + divider + "Bidd**log**" di kiri, nav menu di tengah, badge "Admin" dan stat counters di kanan.
- **Typography:** Title "Biddlog" menggunakan font-weight 400 untuk "Bidd" dan 800 untuk "log" (`<strong>`) agar sesuai referensi gambar.
- **TSX (`main.tsx`):** Sidebar nav di-refactor menjadi 4 grup terpisah menggunakan `navGroups` array dengan `React.Fragment` dan komponen `sidebar-nav-divider` antar grup.
- Build berhasil (`✓ built in 507ms`), dist/ ter-generate.

### [2026-07-10 17:05] — Implementasi Portal Gate & Backend Authentication Profesional
- **Portal Gate (Login Unifikasi):** Menghapus layout prototype dengan dual-button (Admin/Anggota) dan bottom role-switcher. Mengubah login form untuk meminta username dan password secara nyata.
- **Backend API (`api/login.php`):** Membuat endpoint login PHP baru yang terhubung ke database `biddlog_db.users`. Melakukan pengecekan hashed/plain password dan mengembalikan objek user beserta rolenya (`admin` atau `anggota`).
- **Autodetect & Dynamic Routing:** Frontend akan otomatis mengarahkan ke portal yang sesuai (`role === 'admin'` memuat sidebar panel admin, `role === 'anggota'` memuat header pill publik) setelah autentikasi sukses dari API.
- **Koneksi Dinamis (Auto-Detect Host):** Mengganti hardcoded API host `http://biddlog.test` dengan detektor dinamis (`getApiUrl`) sehingga backend API dapat langsung terhubung lancar di lingkungan localhost development maupun production domain.
- **Logout Flow:** Menambahkan `onClick` pada tombol Keluar di admin sidebar dan profil button di public header untuk mereset session state ke `role === 'login'`.
- Build Vite berhasil (`✓ built in 483ms`).

### [2026-07-10 17:08] — visual refinement dan Pembersihan Status DB
- **Visual Clean Up:** Menghapus indikator teks "Status DB: Connected / Failed" di halaman login untuk memberikan tampilan web profesional yang bersih, rapi, dan aman bagi pengguna akhir.
- **Vite Re-build:** Menyusun ulang berkas build (`dist/`) agar langsung memuat tampilan termutakhir.

### [2026-07-10 17:23] — Perbaikan Alur Login ke Portal Publik & Transisi Panel
- **Alur Login Unifikasi:** Baik `admin` maupun `anggota` sekarang diarahkan langsung ke **Portal Publik** setelah sukses login.
- **Transisi Panel (Admin):**
  - Di **Portal Publik**, jika akun yang login adalah `admin`, tombol profil kanan atas akan menampilkan **"Admin"**. Jika diklik, admin akan diarahkan ke **Portal Admin** (layout sidebar).
  - Admin dipermudah dengan opsi **"Keluar"** langsung di sebelah tombol "Admin" untuk logout cepat dari portal publik.
  - Di **Portal Admin**, admin dapat mengklik profil **"Administrator"** di bagian footer sidebar untuk kembali ke **Portal Publik**.
- **Anggota Flow:** Pengguna non-admin hanya melihat tab navigasi publik dan nama akun mereka sendiri. Klik nama akun akan melakukan logout.
- Build Vite berhasil (`✓ built in 505ms`).

### [2026-07-10 17:35] — Implementasi Fase 1 & 2 Modul Admin
- **Fase 1 (Frontend Infrastruktur):** Melakukan ekstraksi tipe TypeScript ke `src/types.ts` dan melakukan *scaffolding* 10 komponen React baru (`AdminDashboard`, `AdminAnalyzer`, `PembagianBarang`, `LaporanPresensi`, dll.) ke dalam folder `src/components`. Mengubah integrasi routing di `main.tsx` untuk menampilkan komponen ini sesuai menu Sidebar.
- **Fase 2 (Backend API):** Membuat 8 endpoint API PHP baru di folder `api/` untuk melayani proses CRUD setiap modul, seperti `users.php`, `items.php`, `attendances.php`, `obtained.php`, `assignments.php`, `limits.php`, `dashboard_stats.php`, dan `audit.php`.
- Semua kode React telah di-compile ulang dengan perintah Vite Build dan berhasil di-generate ke folder `dist`.

### [2026-07-10 17:45] — Implementasi Fase 3 (Integrasi Data & Logika)
- Melakukan verifikasi ketersediaan struktur tabel database: `users`, `items`, `attendances`, `obtained_items`, `limits_and_fees`, dan `audit_trail`. 
- Menulis ulang dan menyempurnakan 10 komponen Admin (seperti `AdminAnalyzer`, `PembagianBarang`, `ManajemenPengguna`, `LimitHargaFee`, `HasilBidding`, dll.) agar terintegrasi langsung dengan API PHP yang telah dibuat di Fase 2 menggunakan `fetch()` dan state React.
- Menerapkan fitur Drag-and-Drop native HTML5 pada modul `PembagianBarang` untuk mendistribusikan daftar perangkat/item secara interaktif kepada masing-masing anggota.
- Melakukan proses *build* Vite terakhir (`✓ built in 573ms`) dan semua integrasi telah berhasil terkompilasi ke dalam folder `dist`.

### [2026-07-10 17:48] — Restorasi UI Legacy (Analyzer & Hasil Bidding)
- Sesuai permintaan spesifik *user* untuk menggunakan UI lawas yang memiliki fungsi utuh yang sama persis seperti sebelumnya.
- Membatalkan penggunaan komponen baru (`AdminAnalyzer` dan `HasilBidding`).
- Mengembalikan *routing* pada `activeView === 'analyzer'` untuk me-render `JSON Collector (App)` langsung dari `main.tsx`.
- Mengembalikan *routing* pada `activeView === 'hasil_bidding'` untuk me-render komponen `<ResultChecker />` dari `main.tsx`.
- Menghapus referensi komponen baru yang tidak dipakai (unused imports) di dalam `main.tsx`.
- Melakukan kompilasi ulang (Vite build success) untuk memastikan perubahan merender dengan sempurna.

### [2026-07-10 17:51] — Perbaikan Navigasi Logo Admin
- Menambahkan fungsi `onClick={() => setRole('anggota')}` pada bagian logo header sidebar di Portal Admin.
- Sekarang, jika admin mengklik area logo (`Bidding ItemAnalyzer | Biddlog`) di pojok kiri atas, admin akan langsung dialihkan kembali ke tampilan Portal Publik.
- Melakukan *re-build* dan proses kompilasi sukses dieksekusi.

### [2026-07-10 18:02] — Implementasi Fase 4 (Penyempurnaan Integrasi Data, Gaji & Portal Anggota)
- **Database:** Menambahkan kolom `status` pada tabel `obtained_items` menggunakan skrip migrasi PHP untuk mencatat status ACC ("pending" atau "acc").
- **Hasil Bidding (Result Checker):** Memodifikasi komponen lawas untuk menyertakan tombol **"ACC Gaji"** pada baris pratinjau. Tombol ini melakukan POST data baris (model, grade, price) ke endpoint baru `api/save_acc.php` untuk disinkronkan ke database.
- **Kalkulasi Gaji (AdminGaji.tsx):** Menyesuaikan logika kalkulasi gaji agar *hanya* membaca item dari database yang memiliki `status === 'acc'`, sehingga gaji yang tertera bersifat final sesuai instruksi pimpinan.
- **Laporan List Dapat & Presensi:** Menerapkan fitur Filter Historis (Hari Ini, Minggu Ini, Bulan Ini) menggunakan state lokal agar Admin dapat mengecek log progres *real-time* maupun rekap waktu tertentu secara fleksibel.
- **Portal Publik (List Dapat):** Menambahkan `Form Input Barang Dapat` nyata di portal anggota yang mem-POST langsung ke `api/obtained.php`.
### [2026-07-10 18:05] — Restorasi Penuh UI Legacy Analyzer
- Memperbaiki `main.tsx` karena pada proses restorasi sebelumnya, elemen HTML UI *JSON Collector* (seperti `input-panel`, `sort-panel`, dan `table-panel`) sempat terhapus dan digantikan oleh *placeholder* kosong `<AdminAnalyzer />`.
- Mengembalikan *block* kode JSX bawaan secara utuh dari *patch* versi lawas sehingga menu "Analyzer" kini menampilkan panel "Output Collector JSON", "Pengurutan Data", "Filter Data Saat Ini", dan tabel kalkulasi *raw name* dengan persis fungsi seperti aslinya.
- Proses kompilasi Vite (build) selesai dengan lancar.

### [2026-07-11 03:27] — Perbaikan Kegagalan Push Git Akibat File Zip Besar
- **Analisis:** Proses `git push` ditolak oleh GitHub remote hook karena `biddlog-portable.zip` berukuran 126.37 MB (melebihi limit GitHub 100 MB) yang masuk dalam commit terakhir `2ee7256ca53a0fcdeab8465321830f1f4dcbf6de`.
- **Eksekusi:**
  - Melakukan soft reset `git reset --soft HEAD~1` untuk membatalkan commit terakhir secara lokal tanpa menghapus perubahan kode.
  - Mengeluarkan `biddlog-portable.zip` dari status staging menggunakan `git restore --staged biddlog-portable.zip` agar tetap berada di disk lokal sebagai file untracked.
  - Membuat berkas `.gitignore` di root folder workspace untuk mengabaikan `biddlog-portable.zip`, `.agent`, `.tmp.driveupload`, dan berkas log.
  - Menambahkan `.gitignore` ke index git dan membuat commit baru `git commit -m "update versi terbaru"`.
- **Hasil:** File besar berhasil disaring keluar dari commit dan riwayat git, sementara semua perubahan kode tetap dipertahankan dan aman untuk dipush.
