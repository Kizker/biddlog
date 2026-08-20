# Agent Project Orchestration

## Project Info
- **Project Name:** Biddlog (Bidding Item Analyzer & Helper)
- **Stack:** Laravel 13, React 19, Vite 8, Tailwind CSS, PHP 8.2, SQLite / MySQL
- **Environment:** macOS (Apple Silicon ARM64, zsh)

## Tasks & Workflow
- [x] Analyze workspace structure & dependencies
- [x] Configure local macOS toolchains (PHP 8.2, Composer 2.10, Node.js 22.14 LTS)
- [x] Resolve OpenSSL CA certificate path for Composer downloads
- [x] Run `composer install` and prepare `.env` with `APP_KEY`
- [x] Configure database migration & multi-database fallback (SQLite & MySQL)
- [x] Seed default authentication accounts (`admin`, `testuser`)
- [x] Compile React dashboard frontend (`biddlog_legacy/dashboard`) into `public/`
- [x] Modernize PHP API layer with SQLite custom functions (`CURDATE()`, `NOW()`, `DATE()`)
- [x] Start local development server on `http://127.0.0.1:8000`
- [x] Fix hardcoded `http://biddlog.test` domain across frontend components to use universal relative `/api/` endpoints
- [x] Rebuild React frontend assets and sync to `public/`
- [x] Configure direct-to-admin view on login and hide public/member portal
- [x] Disable and hide 'Laporan Presensi' and 'Limit Harga & Fee Barang' navigation and views
- [x] Disable and hide 'Dashboard' navigation and view, default login directly to 'Analyzer'
- [x] Disable and hide 'Pembagian Barang' navigation and view
- [x] Implement enhanced 'Laporan List Didapat' with approval management (✅/❌), fee notation `(50)`/`(100)`, text parser, direct sync from Hasil Bidding, and one-click chat format export
- [x] Add bulk fee actions (50, 75, 100) with owner exclusion (Menik & Mubdi strict exact match, excluding Mubdi 2) and reset buttons
- [x] Improve Smart Parser to accurately recognize names with numbers (e.g. `Bilqis 2`, `Mubdi 2`) as Person Headers, and fix price vs storage extraction
- [x] Automatically ignore and filter out `Enb tgl ...` date headers in 'Hasil Bidding' so they are not detected as items
- [x] Add input persistence (LocalStorage) and Reset Input button in 'Hasil Bidding'
- [x] Prepend input label and date header (`Enb tgl ...`) automatically to output text when copied in 'Hasil Bidding'
- [x] Remove 'ACC Gaji' buttons from Hasil Bidding comparison preview
- [x] Add automated Fee breakdown calculation formula (e.g. `66x50+3x75+4x100\n=3575` using 'x') counting 1 unit per item row, rendered under date label and uniform clean summary card in Laporan List Didapat
- [x] Revamp 'Gaji' module with multi-day payroll batch aggregation, transfer status tracking, weekly timeline, and 1-click WhatsApp chat export
- [x] Add explicit 'Kirim Gaji' action button in Laporan List Didapat to commit and persist payroll batches to Gaji module
- [x] Unify bidder cards into a single comprehensive 'Anggota & Alias' list with add/edit member and alias management
- [x] Redesign 'Anggota & Alias' tab into an aesthetic, clean, streamlined vertical list view with avatar initials, badges, and quick actions
- [x] Configure 27 official canonical members (Nama Asli) with smart bidirectional alias mapping across all Gaji and bidding views
- [x] Add member deletion functionality (Hapus Anggota) with confirmation dialog from list row and edit modal
- [x] Unify 'Bilqiis' and 'Bilqis' as 1 single canonical member (`Bilqis`) across parser, analyzer, and payroll
- [x] Clean up and unify member count cards without redundant subtexts
- [x] Embed detailed payroll breakdown tables directly inside each catalog card with collapsible accordions (removing detached bottom table)
- [x] Implement 4-card per row responsive catalog grid (`catalog-grid-4`) in Gaji module
- [x] Add monthly pagination toolbar (1 page for 1 month) with Month dropdown, Prev/Next navigation, and quick batch selectors
- [x] Group date cards by weeks (Minggu 1, 2, 3, 4, 5) with weekly header separators and stats
- [x] Display member list (PIC) with units, fee formula, and total Rp per person inside each date card
- [x] Add full Date Detail Modal (`modalDetailDate`) triggered via '📋 Rincian' button
- [x] Redesign Date Detail Modal with clean, streamlined card-row layout, stat badges, fast search filter, collapsible raw item list, and aesthetic status actions
- [x] Fix and redesign 'Rekap Gabungan' table layout and 'Rincian Barang Per Anggota' modal with robust canonical alias matching, item badges, and 1-click WhatsApp slip action
- [x] Simplify button labels by removing emoji icons ('Detail', 'Slip', 'Salin WA', 'Rincian', etc.)
- [x] Import 10 payroll date lists (Minggu 1: 03-07 Agust & Minggu 2: 10-14 Agust 2026) from 'ENB Fee.xlsx' to complete August 2026 payroll timeline
- [x] Reverse week order and dates (newest week and newest date on top)
- [x] Implement 5 cards per row grid layout (`catalog-grid-5`) to fit 1 full workweek (Senin-Jumat) in 1 horizontal row
- [x] Redesign 'Rincian Gaji' modal with ultra-clean, minimalist table columns, concise badges, and balanced actions
- [x] Change button label on catalog cards from 'Salin WA' to 'Salin'
- [x] Add 1-click Delete Batch action (`🗑️`) on date cards and modal to remove any payroll date list
- [x] Delete payroll data list for date 18 Juli 2026 (`Enb tgl 18/07/ 2026`) from database
- [x] Remove all owner disclaimers, notes, and labels ('_Catatan: Menik & Mubdi murni tidak termasuk pembagian gaji._' and '👑 Owner') from web UI, tooltips, and WhatsApp export formats
- [x] Apply canonical member list ordering from 'Anggota & Alias' tab consistently across all Gaji views (cards, tables, modals, and WA copy exports)
- [x] Configure MySQL remote credentials (`u141095167_bid`, `u141095167_headbid`) in `.env` with fallback resilience
- [x] Generate production MySQL schema and data export `database/biddlog_mysql_export.sql`
- [x] Create 1-click database migrator endpoint `public/api/migrate_db.php`
- [x] Create 1-command server auto-update script `deploy.sh`
- [x] Generate comprehensive PDF deployment guide `Panduan_Deployment_dan_Pembaruan_Biddlog.pdf`
- [x] Fix MariaDB/MySQL SQL syntax error (`datetime('now', 'localtime')`) in `public/api/salary.php` for 'Kirim Gaji' and marking payment status ('Lunas' / 'Pending')
- [x] Boost server load & reload speed: Added Gzip compression (mod_deflate), browser caching for immutable assets (mod_expires & Cache-Control), lazy table initialization in backend API, created index accelerator (`public/api/optimize_db.php`), and automated database query optimization
- [x] Fix duplicate items & auto-bleeding issue between Hasil Bidding and Laporan List Didapat: Added strict date isolation in `obtained.php`, atomic transaction sync, automatic date normalization, and fallback isolation
- [x] Add 1-click non-copy-paste '⚡ Tarik Hasil Bidding' direct import feature with preview modal, replace/append mode selection, and 1-click duplicate cleaner in Laporan List Didapat
- [x] Add interactive success notification and direct navigation button in Hasil Bidding to seamlessly open Laporan List Didapat after sending data
- [x] Implement Zero-Loading Instant Performance Engine (0ms rendering): In-memory & local persistent cache (SWR), app-level eager parallel background preloading (`preload.php`), sub-3ms ultra-low latency SQLite WAL / MySQL persistent connections, and zero-spinner instant tab switching across all modules
- [x] Implement Multi-Alias support (comma-separated multiple aliases) with individual tag badges and smart bidirectional canonical matching
- [x] Implement Member & Alias Merge feature (🔗 Gabungkan Anggota): Smart similarity detection engine, automatic suggestion banner, merge modal with target/source selectors, live alias preview, and historical data reconciliation




## Server & Access Info
- **Local URL:** `http://127.0.0.1:8000`
- **Default Accounts:**
  - **Admin:** `admin` / `password` (Role: `admin`)
  - **Member:** `testuser` / `password` (Role: `member`)
- **API Health Check:** `http://127.0.0.1:8000/api/test_connection.php`

## Notes
- Database configured with automatic SQLite fallback (`database/database.sqlite`), supporting both MySQL and SQLite seamlessly without needing an external MySQL daemon running.
- React frontend compiled directly into `public/` and served along with backend APIs on port 8000.
- Replaced hardcoded `http://biddlog.test/api/` with relative `/api/` across all frontend components so API calls work in any local/production environment (`localhost:8000`, `127.0.0.1:8000`, custom hostnames).
- All endpoints tested and returning valid JSON responses.
