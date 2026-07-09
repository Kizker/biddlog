import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

type CollectorItem = {
  raw_name: string;
  grade?: string;
  status?: string;
  condition?: string;
  stock?: number | string;
  auction_price?: number | string;
  scan_order?: number;
  scanned_at?: string;
  scan_marker?: string;
  screen_no?: number;
  screen_item_no?: number;
  source_bounds?: string;
  source_hash?: string;
  source_text?: string;
};

type ParsedItem = CollectorItem & {
  id: string;
  brand: string;
  model: string;
  short_code: string;
  storage: number | null;
  grade_code: string;
  unit_no: number;
  item_code: string;
  auction_price_number: number | null;
};

type InvoiceItem = {
  account: string;
  raw_name: string;
  grade?: string;
  invoice_price?: number | string | null;
  scan_order?: number;
  scan_marker?: string;
  source_text?: string;
};

type LooseItemCode = {
  model: string;
  storage: number | null;
  grade: string;
  unit: number | null;
  key: string;
  baseKey: string;
};

type TextListEntry = LooseItemCode & {
  id: string;
  person: string;
  rawLine: string;
  priceMax: number | null;
  accountHint: string;
  note: string;
  source: 'target' | 'obtained' | 'reserve';
};

type ParsedTextList = {
  sections: Array<{ person: string; entries: TextListEntry[] }>;
  entries: TextListEntry[];
};

type ComparisonPreviewRow = {
  id: string;
  person: string;
  targetLine: string;
  obtainedLine: string;
  status: 'ok' | 'warn' | 'missing';
  note: string;
};

type ComparisonPreviewSection = {
  person: string;
  rows: ComparisonPreviewRow[];
};

type ComparisonPreviewData = {
  sections: ComparisonPreviewSection[];
  matched: number;
  warned: number;
  missing: number;
};

type ParsedInvoiceItem = LooseItemCode & {
  id: string;
  account: string;
  rawName: string;
  invoicePrice: number | null;
  invoicePriceUnit: number | null;
  scanOrder: number;
  consumedBy?: string;
};

type ActiveView = 'analyzer' | 'guide' | 'checker';
type FilterKey = 'brands' | 'models' | 'storages' | 'grades' | 'statuses';
type FilterState = Record<FilterKey, string[]>;
type SortMode = 'scan' | 'catalog';

const defaultBrandOrder = [
  'samsung',
  'iphone',
  'asus',
  'oppo',
  'vivo',
  'xiaomi',
  'realme',
  'infinix',
  'tecno',
  'huawei',
];

const gradeOrder = ['aa', 'ab', 'ac', 'ad', 'ae', 'af', 'ag', 'ah', 'ai', 'aj', 'a'];
const looseGradePattern = 'aa|ab|ac|ad|ae|af|ag|ah|ai|aj|gi|a';
const invoiceAccounts = ['menik', 'mubdi', 'aldi'];
const statusOk = '✅';
const statusWarn = '⚠️';
const statusMissing = '❌';

const emptyFilters: FilterState = {
  brands: [],
  models: [],
  storages: [],
  grades: [],
  statuses: [],
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/\bgalaxy\b/g, '')
    .replace(/\bsamsung\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeModel(rawName: string, storage: number | null) {
  const withoutStorage = normalizeText(rawName)
    .replace(/\b(\d+)\s*(tb|gb|g)\b/g, (match, amount, unit) => {
      return unit === 'g' && Number(amount) === 5 ? match : '';
    })
    .trim();

  const replacements: Array<[RegExp, string, string, string]> = [
    [/\bz\s*fold\s*(\d+)\b/, 'Samsung', 'Fold $1', 'fold $1'],
    [/\bz\s*flip\s*(\d+)\b/, 'Samsung', 'Flip $1', 'flip $1'],
    [/\bs(\d+)\s*ultra\b/, 'Samsung', 'S$1 Ultra', 's$1u'],
    [/\bs(\d+)\s*plus\b/, 'Samsung', 'S$1+', 's$1+'],
    [/\bs(\d+)\s*\+\b/, 'Samsung', 'S$1+', 's$1+'],
    [/\bs(\d+)\s*fe\b/, 'Samsung', 'S$1 FE', 's$1 fe'],
    [/\bs(\d+)\s*e\b/, 'Samsung', 'S$1e', 's$1e'],
    [/\bs(\d+)\s*edge\b/, 'Samsung', 'S$1 Edge', 's$1 edge'],
    [/\bs(\d+)\b/, 'Samsung', 'S$1', 's$1'],
    [/\bnote\s*(\d+)\s*(?:u|ultra)\b/, 'Samsung', 'Note $1 Ultra', 'note $1u'],
    [/\bnote\s*(\d+)\s*lite\b/, 'Samsung', 'Note $1 Lite', 'note $1 lite'],
    [/\bnote\s*(\d+)\s*plus\b/, 'Samsung', 'Note $1+', 'note $1+'],
    [/\bnote\s*(\d+)\s*\+\b/, 'Samsung', 'Note $1+', 'note $1+'],
    [/\bnote\s*(\d+)\b/, 'Samsung', 'Note $1', 'note $1'],
    [/\ba(\d+)\s*5g\b/, 'Samsung', 'A$1 5G', 'a$1 5g'],
    [/\ba(\d+)\b/, 'Samsung', 'A$1', 'a$1'],
    [/\biphone\s*(\d+)\s*pro\s*max\b/, 'iPhone', 'iPhone $1 Pro Max', 'iphone $1 pro max'],
    [/\biphone\s*(\d+)\s*pro\b/, 'iPhone', 'iPhone $1 Pro', 'iphone $1 pro'],
    [/\biphone\s*(\d+)\s*plus\b/, 'iPhone', 'iPhone $1 Plus', 'iphone $1 plus'],
    [/\biphone\s*(\d+)\b/, 'iPhone', 'iPhone $1', 'iphone $1'],
    [/\brog\s*phone\s*(\d+)\b/, 'Asus', 'ROG Phone $1', 'rog phone $1'],
    [/\bzenfone\s*(\d+)\b/, 'Asus', 'Zenfone $1', 'zenfone $1'],
    [/\brealme\s*(.+)\b/, 'Realme', 'Realme $1', 'realme $1'],
  ];

  for (const [pattern, brand, modelTemplate, codeTemplate] of replacements) {
    const match = withoutStorage.match(pattern);
    if (!match) continue;
    const model = modelTemplate.replace('$1', match[1] ?? '').replace(/\s+/g, ' ').trim();
    const code = codeTemplate.replace('$1', match[1] ?? '').replace(/\s+/g, ' ').trim();
    return { brand, model, short_code: code };
  }

  const fallback = withoutStorage || (storage ? `${storage}gb` : 'unknown');
  return {
    brand: rawName.split(' ')[0] || 'Unknown',
    model: fallback,
    short_code: fallback,
  };
}

function parsePrice(value: number | string | undefined) {
  if (typeof value === 'number') return value;
  if (!value) return null;
  const parsed = Number(String(value).replace(/[^\d]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseStorageFromText(value: string) {
  const unitMatches = Array.from(value.matchAll(/\b(\d{1,4})\s*(tb|gb|g)\b/gi));
  const withUnitMatch = unitMatches.find((match) => {
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    return !(unit === 'g' && amount === 5);
  });

  if (withUnitMatch) {
    const amount = Number(withUnitMatch[1]);
    if (!Number.isFinite(amount)) return null;
    return withUnitMatch[2].toLowerCase() === 'tb' ? amount * 1024 : amount;
  }

  const beforeGradeMatch = value.match(new RegExp(`\\b(\\d{1,4})\\s+(?:${looseGradePattern})\\b`, 'i'));
  if (!beforeGradeMatch) return null;

  const storage = Number(beforeGradeMatch[1]);
  return Number.isFinite(storage) ? storage : null;
}

function parseItems(items: CollectorItem[]): ParsedItem[] {
  const groupedCount = new Map<string, number>();

  return items.map((item, index) => {
    const storage = parseStorageFromText(item.raw_name);
    const gradeSourceText = `${item.raw_name} ${item.source_text || ''}`;
    const rawGradeMatch = gradeSourceText.match(new RegExp(`\\b(${looseGradePattern})\\b`, 'i'));
    const grade_code = normalizeGradeCode(item.grade || rawGradeMatch?.[1] || '');
    const model = normalizeModel(item.raw_name, storage);
    const groupKey = `${model.short_code}|${storage ?? 'na'}|${grade_code}`;
    const unit_no = (groupedCount.get(groupKey) ?? 0) + 1;
    groupedCount.set(groupKey, unit_no);

    const item_code = `${model.short_code} ${storage ?? '-'} ${grade_code || '-'} (${unit_no}) @`;

    return {
      ...item,
      id: `${index}-${item.raw_name}-${unit_no}`,
      brand: model.brand,
      model: model.model,
      short_code: model.short_code,
      storage,
      grade_code,
      unit_no,
      item_code,
      auction_price_number: parsePrice(item.auction_price),
    };
  });
}

function currency(value: number | null) {
  if (value === null) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path
        d="M8 8.5C8 7.12 9.12 6 10.5 6H18C19.38 6 20.5 7.12 20.5 8.5V18C20.5 19.38 19.38 20.5 18 20.5H10.5C9.12 20.5 8 19.38 8 18V8.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M5.5 15.5H5C3.62 15.5 2.5 14.38 2.5 13V5.5C2.5 4.12 3.62 3 5 3H12.5C13.88 3 15 4.12 15 5.5V6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function CommandLine({
  command,
  copied,
  onCopy,
}: {
  command: string;
  copied: boolean;
  onCopy: (command: string) => void;
}) {
  return (
    <div className="command-row">
      <code>{command}</code>
      <button
        aria-label={`Salin perintah: ${command}`}
        className="copy-command"
        onClick={() => onCopy(command)}
        title="Salin perintah"
        type="button"
      >
        {copied ? <span>OK</span> : <CopyIcon />}
      </button>
    </div>
  );
}

function CollectorGuide() {
  const [copiedCommand, setCopiedCommand] = useState('');

  function copyCommand(command: string) {
    navigator.clipboard
      .writeText(command)
      .then(() => {
        setCopiedCommand(command);
        window.setTimeout(() => setCopiedCommand(''), 1400);
      })
      .catch(() => {
        setCopiedCommand('');
      });
  }

  function command(commandText: string) {
    return (
      <CommandLine
        command={commandText}
        copied={copiedCommand === commandText}
        key={commandText}
        onCopy={copyCommand}
      />
    );
  }

  return (
    <section className="guide-grid">
      <article className="panel guide-panel guide-wide">
        <p className="section-label">Cek Kesiapan</p>
        <h2>Status yang harus OK</h2>
        <div className="status-grid">
          <div className="status-card">
            <span className="status-dot pending" />
            <strong>ADB tersedia</strong>
            <p>Menandakan Android Platform Tools sudah terpasang dan command adb bisa dipakai.</p>
          </div>
          <div className="status-card">
            <span className="status-dot pending" />
            <strong>HP terhubung</strong>
            <p>Menandakan kabel data, USB Debugging, dan izin Allow di HP sudah benar.</p>
          </div>
          <div className="status-card">
            <span className="status-dot pending" />
            <strong>Appium tersedia</strong>
            <p>Menandakan Appium CLI dan driver UiAutomator2 sudah siap menjalankan automation.</p>
          </div>
          <div className="status-card">
            <span className="status-dot pending" />
            <strong>Android SDK env siap</strong>
            <p>Menandakan ANDROID_HOME atau ANDROID_SDK_ROOT sudah diset sebelum Appium server dibuka.</p>
          </div>
          <div className="status-card">
            <span className="status-dot pending" />
            <strong>Appium server aktif</strong>
            <p>Menandakan server lokal di port 4723 sudah hidup sebelum collector dijalankan.</p>
          </div>
        </div>
        <div className="command-list compact">
          {command('cd [folder-project]\\collector')}
          {command('python check_setup.py')}
        </div>
        <p className="guide-note">
          Jalankan lewat Command Prompt. Browser tidak bisa membaca status USB secara langsung, jadi status dicek lewat script lokal.
        </p>
      </article>

      <article className="panel guide-panel">
        <p className="section-label">Panduan HP</p>
        <h2>Persiapan sebelum scan</h2>
        <ol className="steps">
          <li>Install aplikasi Bidding Plus dari Play Store dan login dengan akun yang biasa dipakai.</li>
          <li>Buka Settings HP, masuk ke About Phone, lalu tap Build Number beberapa kali sampai Developer Options aktif.</li>
          <li>Masuk ke Developer Options, aktifkan USB Debugging.</li>
          <li>Sambungkan HP ke laptop menggunakan kabel USB data, bukan kabel charge-only.</li>
          <li>Jika muncul pilihan mode USB, pilih File Transfer atau Transfer files.</li>
          <li>Saat muncul prompt Allow USB debugging, pilih Allow. Jika ada pilihan Always allow, aktifkan.</li>
          <li>Buka Bidding Plus sampai halaman Bidding Reguler yang berisi daftar barang.</li>
        </ol>
      </article>

      <article className="panel guide-panel">
        <p className="section-label">Perintah Laptop</p>
        <h2>Setup pertama kali</h2>
        <div className="command-list">
          {command('cd [folder-project]\\collector')}
          {command('set "PATH=C:\\platform-tools;%PATH%"')}
          {command('set ANDROID_HOME=C:\\')}
          {command('set ANDROID_SDK_ROOT=C:\\')}
          {command('npm install -g appium')}
          {command('appium driver install uiautomator2')}
          {command('pip install -r requirements.txt')}
        </div>
        <p className="guide-note">
          Langkah install cukup dilakukan sekali. Perintah set PATH hanya berlaku untuk terminal CMD yang sedang dibuka.
        </p>
      </article>

      <article className="panel guide-panel">
        <p className="section-label">Sebelum Scan</p>
        <h2>Urutan cek harian</h2>
        <div className="command-list">
          {command('cd [folder-project]\\collector')}
          {command('set "PATH=C:\\platform-tools;%PATH%"')}
          {command('set ANDROID_HOME=C:\\')}
          {command('set ANDROID_SDK_ROOT=C:\\')}
          {command('adb devices')}
          {command('python check_setup.py')}
          {command('appium --base-path /')}
        </div>
        <p className="guide-note">
          Jika adb devices menampilkan unauthorized, lihat layar HP dan tekan Allow. Jika environment baru diset, tutup Appium server lama lalu jalankan ulang.
        </p>
      </article>

      <article className="panel guide-panel">
        <p className="section-label">Jalankan Scan</p>
        <h2>Mulai collector</h2>
        <p className="guide-note first-note">
          Gunakan scan keseluruhan sebagai pilihan utama. Jika total barang hari itu sudah diketahui,
          tambahkan expected total agar collector tidak berhenti terlalu cepat saat menemukan banyak unit identik.
        </p>
        <div className="command-list">
          {command('cd [folder-project]\\collector')}
          {command('set "PATH=C:\\platform-tools;%PATH%"')}
          {command('set ANDROID_HOME=C:\\')}
          {command('set ANDROID_SDK_ROOT=C:\\')}
        </div>
        <div className="scan-mode-grid">
          <div className="scan-mode-card preferred">
            <p className="section-label">Utama</p>
            <strong>Scan keseluruhan</strong>
            <p>Dipakai untuk scan normal dari atas sampai daftar mentok atau total UI terbaca.</p>
            <div className="command-list compact">
              {command('python appium_collector.py --backend adb --phone-feedback')}
            </div>
          </div>
          <div className="scan-mode-card">
            <p className="section-label">Jika Total Diketahui</p>
            <strong>Scan dengan target harian</strong>
            <p>Ganti angka sesuai total barang hari itu. Untuk hari ini gunakan 415.</p>
            <div className="command-list compact">
              {command('python appium_collector.py --backend adb --expected-total 415 --phone-feedback')}
            </div>
          </div>
          <div className="scan-mode-card">
            <p className="section-label">Tes Cepat</p>
            <strong>Cek 10 barang teratas</strong>
            <p>Dipakai untuk memastikan urutan awal sudah sesuai sebelum scan penuh.</p>
            <div className="command-list compact">
              {command('python appium_collector.py --backend adb --expected-total 10 --phone-feedback')}
            </div>
          </div>
        </div>
        <p className="guide-note">
          Jangan pakai no-reset-position untuk scan utama. Collector akan reset ke atas, scroll otomatis,
          memberi getar pendek saat layar terbaca, lalu menyimpan hasil ke output JSON dan CSV.
        </p>
      </article>

      <article className="panel guide-panel">
        <p className="section-label">Saat Collector Berjalan</p>
        <h2>Yang dilakukan di HP</h2>
        <ol className="steps">
          <li>Jangan menutup aplikasi Bidding Plus.</li>
          <li>Jangan menyentuh layar saat auto-scroll sedang berjalan.</li>
          <li>Biarkan layar tetap menyala sampai proses selesai.</li>
          <li>Pastikan internet HP stabil agar list tidak gagal dimuat saat scroll.</li>
          <li>Jika aplikasi pindah halaman atau logout, hentikan proses lalu ulang dari halaman list.</li>
        </ol>
      </article>

      <article className="panel guide-panel guide-wide">
        <p className="section-label">Scanner Invoice</p>
        <h2>Scan invoice 3 akun</h2>
        <p className="guide-note first-note">
          Scanner invoice dipisah dari scan Bidding Reguler. Untuk setiap akun, sambungkan HP ke laptop,
          buka manual halaman invoice akun yang benar, biarkan HP tetap di halaman itu, lalu jalankan
          command sesuai akun. Menik memakai aplikasi asli, Mubdi memakai clone App Cloner,
          dan Aldi memakai clone Island.
        </p>
        <div className="scan-mode-grid">
          <div className="scan-mode-card">
            <p className="section-label">Menik</p>
            <strong>Scan invoice akun Menik</strong>
            <div className="command-list compact">
              {command('python invoice_collector.py --account menik --no-launch --phone-feedback')}
            </div>
          </div>
          <div className="scan-mode-card">
            <p className="section-label">Mubdi</p>
            <strong>Scan invoice akun Mubdi</strong>
            <div className="command-list compact">
              {command('python invoice_collector.py --account mubdi --no-launch --phone-feedback')}
            </div>
          </div>
          <div className="scan-mode-card">
            <p className="section-label">Aldi</p>
            <strong>Scan invoice akun Aldi</strong>
            <div className="command-list compact">
              {command('python invoice_collector.py --account aldi --no-launch --phone-feedback')}
            </div>
          </div>
        </div>
        <p className="guide-note">
          Setelah tiga akun discan, gunakan file collector/output/invoice/invoice-items.json di view Hasil Bidding.
        </p>
      </article>

      <article className="panel guide-panel">
        <p className="section-label">Output</p>
        <h2>File yang dipakai dashboard</h2>
        <div className="output-list">
          <span>collector/output/scan-list/bidding-items.json</span>
          <span>collector/output/scan-list/bidding-items.csv</span>
          <span>collector/output/scan-list/scan-summary.json</span>
          <span>collector/output/invoice/invoice-items.json</span>
        </div>
        <p className="guide-note">
          Di view Analyzer, pilih file scan-list/bidding-items.json lewat input file. Setelah scan penuh,
          cek scan-list/scan-summary.json: collected_count harus sesuai total harian, dan target_reached bernilai true jika expected total dipakai.
        </p>
      </article>

      <article className="panel guide-panel guide-wide">
        <p className="section-label">Arti Status</p>
        <h2>Kalau pengecekan belum OK</h2>
        <div className="status-help">
          <p><strong>ADB perlu ditambah ke PATH:</strong> jalankan perintah set PATH di atas atau tambahkan C:\platform-tools ke Environment Variables Windows.</p>
          <p><strong>HP belum terhubung:</strong> kabel belum tersambung, USB mode salah, atau USB Debugging belum aktif.</p>
          <p><strong>HP belum diizinkan:</strong> prompt Allow USB debugging belum disetujui di layar HP.</p>
          <p><strong>Android SDK Environment perlu diset:</strong> jalankan set ANDROID_HOME=C:\ dan set ANDROID_SDK_ROOT=C:\ sebelum membuka Appium server.</p>
          <p><strong>Appium CLI belum dikenali:</strong> pastikan Node.js sudah terinstall dan ada di PATH, lalu jalankan perintah set PATH di atas.</p>
          <p><strong>Appium server belum aktif:</strong> jalankan appium --base-path / di terminal terpisah setelah semua perintah set selesai.</p>
          <p><strong>UiAutomator2 belum ada:</strong> jalankan appium driver install uiautomator2.</p>
        </div>
      </article>
    </section>
  );
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'id', { numeric: true }),
  );
}

function toggleFilter(filters: FilterState, key: FilterKey, value: string): FilterState {
  const current = filters[key];
  const nextValues = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
  return { ...filters, [key]: nextValues };
}

function hasActiveFilter(filters: FilterState) {
  return Object.values(filters).some((values) => values.length > 0);
}

function normalizeSortRule(value: string) {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function itemBaseCode(item: ParsedItem) {
  return normalizeSortRule(item.item_code);
}

function gradeRank(grade: string) {
  const index = gradeOrder.indexOf(grade);
  return index >= 0 ? index : gradeOrder.length;
}

function normalizeBrand(value: string) {
  const normalized = normalizeSortRule(value);
  if (normalized.includes('iphone') || normalized === 'apple') return 'iphone';
  if (normalized.includes('samsung')) return 'samsung';
  if (normalized.includes('asus')) return 'asus';
  if (normalized.includes('oppo')) return 'oppo';
  if (normalized.includes('vivo')) return 'vivo';
  if (normalized.includes('xiaomi') || normalized.includes('redmi')) return 'xiaomi';
  if (normalized.includes('realme')) return 'realme';
  if (normalized.includes('infinix')) return 'infinix';
  if (normalized.includes('tecno')) return 'tecno';
  if (normalized.includes('huawei')) return 'huawei';
  return normalized;
}

function itemBrandKey(item: ParsedItem) {
  return normalizeBrand(`${item.brand} ${item.raw_name}`);
}

function brandRank(item: ParsedItem, brandOrder: string[]) {
  const key = itemBrandKey(item);
  const index = brandOrder.map(normalizeBrand).indexOf(key);
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}

function firstNumber(value: string) {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function samsungModelSort(item: ParsedItem): number[] {
  const code = normalizeSortRule(item.short_code);
  let match = code.match(/^fold\s*(\d+)/);
  if (match) return [0, -Number(match[1]), 0];

  match = code.match(/^flip\s*(\d+)/);
  if (match) return [1, -Number(match[1]), 0];

  match = code.match(/^s(\d+)(u|\+|\s*edge|\s*fe)?/);
  if (match) {
    const generation = Number(match[1]);
    const suffix = (match[2] || '').replace(/\s+/g, '');
    const variantRank =
      suffix === 'u' ? 0 : suffix === '+' ? 1 : suffix === 'edge' ? 2 : suffix === '' ? 3 : 4;
    return [2, -generation, variantRank];
  }

  match = code.match(/^note\s*(\d+)(\+|\s*lite)?/);
  if (match) {
    const suffix = (match[2] || '').replace(/\s+/g, '');
    const variantRank = suffix === '+' ? 0 : suffix === '' ? 1 : 2;
    return [3, -Number(match[1]), variantRank];
  }

  match = code.match(/^a(\d+)(s)?(\s*5g)?/);
  if (match) {
    const suffixRank = match[2] ? 0 : 1;
    const networkRank = match[3] ? 0 : 1;
    return [4, -Number(match[1]), suffixRank, networkRank];
  }

  return [9, -firstNumber(code), 0];
}

function iphoneModelSort(item: ParsedItem): number[] {
  const code = normalizeSortRule(item.short_code);
  const generation = firstNumber(code);
  const variantRank = code.includes('pro max')
    ? 0
    : code.includes('pro')
      ? 1
      : code.includes('plus')
        ? 2
        : 3;
  return [0, -generation, variantRank];
}

function genericModelSort(item: ParsedItem): number[] {
  const code = normalizeSortRule(item.short_code);
  return [0, -firstNumber(code), 0];
}

function catalogModelSort(item: ParsedItem) {
  const brand = itemBrandKey(item);
  if (brand === 'samsung') return samsungModelSort(item);
  if (brand === 'iphone') return iphoneModelSort(item);
  return genericModelSort(item);
}

function compareNumberArrays(left: number[], right: number[]) {
  const size = Math.max(left.length, right.length);
  for (let index = 0; index < size; index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function sortByCatalog(items: ParsedItem[], brandOrder: string[]) {
  const normalizedBrandOrder = brandOrder.map(normalizeBrand).filter(Boolean);

  return [...items].sort((left, right) => {
    const leftBase = itemBaseCode(left);
    const rightBase = itemBaseCode(right);
    const brandDiff = brandRank(left, normalizedBrandOrder) - brandRank(right, normalizedBrandOrder);
    if (brandDiff !== 0) return brandDiff;

    const modelDiff = compareNumberArrays(catalogModelSort(left), catalogModelSort(right));
    if (modelDiff !== 0) return modelDiff;

    const storageDiff = (right.storage ?? -1) - (left.storage ?? -1);
    if (storageDiff !== 0) return storageDiff;

    const gradeDiff = gradeRank(left.grade_code) - gradeRank(right.grade_code);
    if (gradeDiff !== 0) return gradeDiff;

    const codeDiff = leftBase.localeCompare(rightBase, 'id', { numeric: true });
    if (codeDiff !== 0) return codeDiff;

    return (left.scan_order ?? 0) - (right.scan_order ?? 0);
  });
}

function cleanListText(value: string) {
  return value
    .replace(/\u200e|\u200f|\u202a|\u202b|\u202c|\u202d|\u202e/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePersonName(value: string) {
  const normalized = cleanListText(value)
    .toLowerCase()
    .replace(/:+$/g, '')
    .replace(/\bbilqiis\b/g, 'bilqis')
    .replace(/\briski\b/g, 'rizky')
    .replace(/\bzaky\b/g, 'zacky')
    .replace(/\bmb\s+atik\b/g, 'mba atik')
    .replace(/\bk\s+agam\b/g, 'ka agam')
    .trim();
  return normalized || 'Tanpa Nama';
}

function displayPersonName(value: string) {
  return cleanListText(value).replace(/:+$/g, '').trim() || 'Tanpa Nama';
}

function normalizeAccountName(value: string) {
  const normalized = cleanListText(value).toLowerCase();
  return invoiceAccounts.find((account) => normalized.includes(account)) || '';
}

function normalizeGradeCode(value: string) {
  const grade = cleanListText(value)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z]/g, '');
  if (grade === 'gi') return 'ai';
  return grade;
}

function normalizeLooseText(value: string) {
  return cleanListText(value)
    .toLowerCase()
    .replace(/\s+-\s+(?=[a-z])/g, ' ')
    .replace(/\bgalaxy\b/g, '')
    .replace(/\bsamsung\b/g, '')
    .replace(/\bgb\b/g, '')
    .replace(/\bteraftar\b/g, 'terdaftar')
    .replace(/\bnote\s*(\d+)\s*u\b/g, 'note $1u')
    .replace(/\bnote\s*(\d+)\s*ultra\b/g, 'note $1u')
    .replace(/\bnote\s*(\d+)\s*p\b/g, 'note $1+')
    .replace(/\bnote\s*(\d+)p\b/g, 'note $1+')
    .replace(/\bs(\d+)\s*u\b/g, 's$1u')
    .replace(/\bs(\d+)\s*ultra\b/g, 's$1u')
    .replace(/\bs(\d+)\s*plus\b/g, 's$1+')
    .replace(/\bs(\d+)\s*\+\b/g, 's$1+')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPriceRange(line: string) {
  const normalized = cleanListText(line);
  const atMatch = normalized.match(/@+\s*([\d.,]+)(?:\s*-\s*([\d.,]+))?/i);
  if (atMatch?.index !== undefined) {
    const first = parsePrice(atMatch[1]) ?? null;
    const second = parsePrice(atMatch[2]) ?? null;
    return {
      priceMax: Math.max(first ?? 0, second ?? first ?? 0) || null,
      priceStart: atMatch.index,
    };
  }

  const priceMatches = Array.from(
    normalized.matchAll(/\b(\d{4,8})(?:\s*-\s*(\d{4,8}))?\b/g),
  ).filter((match) => {
    const value = Number(match[1]);
    return value >= 1000;
  });
  const lastMatch = priceMatches.at(-1);
  if (!lastMatch?.index) return { priceMax: null, priceStart: -1 };

  const first = parsePrice(lastMatch[1]) ?? null;
  const second = parsePrice(lastMatch[2]) ?? null;
  return {
    priceMax: Math.max(first ?? 0, second ?? first ?? 0) || null,
    priceStart: lastMatch.index,
  };
}

function detectLooseModel(text: string) {
  const normalized = normalizeLooseText(text);
  let match = normalized.match(/\bfold\s*(\d+)\b/) || normalized.match(/\bz\s*fold\s*(\d+)\b/);
  if (match) return `fold ${match[1]}`;

  match = normalized.match(/\bflip\s*(\d+)\b/) || normalized.match(/\bz\s*flip\s*(\d+)\b/);
  if (match) return `flip ${match[1]}`;

  match = normalized.match(/\bs(\d+)\+/) || normalized.match(/\bs(\d+)\s*(?:plus)\b/);
  if (match) return `s${match[1]}+`;

  match = normalized.match(/\bs(\d+)\s*(?:u|ultra)\b/);
  if (match) return `s${match[1]}u`;

  match = normalized.match(/\bs(\d+)\s*edge\b/);
  if (match) return `s${match[1]} edge`;

  match = normalized.match(/\bs(\d+)\s*fe\b/);
  if (match) return `s${match[1]} fe`;

  match = normalized.match(/\bs(\d+)\s*e\b/);
  if (match) return `s${match[1]}e`;

  match = normalized.match(/\bs(\d+)\b/);
  if (match) return `s${match[1]}`;

  match = normalized.match(/\bnote\s*(\d+)\+/) || normalized.match(/\bnote\s*(\d+)\s*plus\b/);
  if (match) return `note ${match[1]}+`;

  match = normalized.match(/\bnote\s*(\d+)\s*(?:u|ultra)\b/);
  if (match) return `note ${match[1]}u`;

  match = normalized.match(/\bnote\s*(\d+)\s*lite\b/);
  if (match) return `note ${match[1]} lite`;

  match = normalized.match(/\bnote\s*(\d+)\b/);
  if (match) return `note ${match[1]}`;

  match = normalized.match(/\ba(\d+)(s)?\s*(5g)?\b/);
  if (match) return `a${match[1]}${match[2] || ''}${match[3] ? ' 5g' : ''}`;

  match = normalized.match(/\brog\s*phone\s*(\d+)\b/);
  if (match) return `rog phone ${match[1]}`;

  match = normalized.match(/\bzenfone\s*(\d+)\b/);
  if (match) return `zenfone ${match[1]}`;

  match = normalized.match(/\biphone\s*(\d+)\s*(pro max|pro|plus)?\b/);
  if (match) return `iphone ${match[1]}${match[2] ? ` ${match[2]}` : ''}`;

  return (
    normalized
      .replace(new RegExp(`\\b\\d{1,4}\\s*(?:tb|gb|g)?\\s*(?=${looseGradePattern}\\b)`, 'gi'), '')
      .replace(new RegExp(`\\b(?:${looseGradePattern})\\b`, 'gi'), '')
      .trim() || 'unknown'
  );
}

function parseLooseItemCode(line: string): LooseItemCode {
  const price = extractPriceRange(line);
  const beforePrice = price.priceStart >= 0 ? line.slice(0, price.priceStart) : line;
  const withoutAccount = beforePrice.replace(/\b(menik|mubdi|aldi)\b/gi, ' ');
  const normalized = normalizeLooseText(withoutAccount);
  const storage = parseStorageFromText(normalized);
  const gradeMatch = normalized.match(new RegExp(`\\b(${looseGradePattern})\\b`, 'i'));
  const grade = gradeMatch ? normalizeGradeCode(gradeMatch[1]) : '';
  const unitParen = normalized.match(/\((\d+)\)/);
  const trailingUnit = normalized.match(new RegExp(`\\b(?:${looseGradePattern})\\s+(\\d+)\\b`, 'i'));
  const unit = unitParen ? Number(unitParen[1]) : trailingUnit ? Number(trailingUnit[1]) : null;
  const model = detectLooseModel(normalized);
  const baseKey = `${model}|${storage ?? '-'}|${grade || '-'}`;
  return {
    model,
    storage,
    grade,
    unit,
    baseKey,
    key: `${baseKey}|${unit ?? '-'}`,
  };
}

function parseTextList(text: string, source: TextListEntry['source']): ParsedTextList {
  const sections: ParsedTextList['sections'] = [];
  const entries: TextListEntry[] = [];
  let currentPerson = source === 'reserve' ? 'Cadangan' : '';

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = cleanListText(rawLine);
    if (!line) return;

    const isHeader = !/@|\b\d{4,8}\b/.test(line) && parseStorageFromText(line) === null;
    if (isHeader || /:\s*$/.test(line)) {
      currentPerson = displayPersonName(line);
      if (!sections.some((section) => normalizePersonName(section.person) === normalizePersonName(currentPerson))) {
        sections.push({ person: currentPerson, entries: [] });
      }
      return;
    }

    const price = extractPriceRange(line);
    const accountHint = normalizeAccountName(line);
    const parsedCode = parseLooseItemCode(line);
    let person = currentPerson || 'Tanpa Nama';
    let note = '';

    if (source === 'reserve') {
      const accountless = line.replace(/\b(menik|mubdi|aldi)\b/gi, '').trim();
      const trailingPerson = accountless.match(/\s([a-zA-Z][a-zA-Z\s]{1,24})$/);
      if (trailingPerson && price.priceStart >= 0 && trailingPerson.index && trailingPerson.index > price.priceStart) {
        person = displayPersonName(trailingPerson[1]);
      }
      if (/\blewat\b/i.test(line)) note = 'lewat';
    }

    const entry: TextListEntry = {
      ...parsedCode,
      id: `${source}-${index}-${line}`,
      person,
      rawLine: line,
      priceMax: price.priceMax,
      accountHint,
      note,
      source,
    };
    entries.push(entry);

    const normalizedPerson = normalizePersonName(person);
    let section = sections.find((item) => normalizePersonName(item.person) === normalizedPerson);
    if (!section) {
      section = { person, entries: [] };
      sections.push(section);
    }
    section.entries.push(entry);
  });

  return { sections, entries };
}

function priceToBidUnit(value: number | null) {
  if (value === null) return null;
  return value >= 100000 ? Math.round(value / 1000) : value;
}

function invoiceLineName(item: InvoiceItem) {
  return `${item.raw_name} ${item.grade || ''}`.trim();
}

function parseInvoiceItems(items: InvoiceItem[]): ParsedInvoiceItem[] {
  const grouped = new Map<string, number>();

  return items.map((item, index) => {
    const parsedCode = parseLooseItemCode(invoiceLineName(item));
    const grade = normalizeGradeCode(item.grade || parsedCode.grade || '');
    const baseKey = `${parsedCode.model}|${parsedCode.storage ?? '-'}|${grade || '-'}`;
    const unit = (grouped.get(baseKey) ?? 0) + 1;
    grouped.set(baseKey, unit);
    const invoicePrice = parsePrice(item.invoice_price ?? undefined);

    return {
      ...parsedCode,
      grade,
      unit,
      baseKey,
      key: `${baseKey}|${unit}`,
      id: `${item.account}-${index}-${item.raw_name}`,
      account: normalizeAccountName(item.account) || item.account.toLowerCase(),
      rawName: item.raw_name,
      invoicePrice,
      invoicePriceUnit: priceToBidUnit(invoicePrice),
      scanOrder: item.scan_order ?? index + 1,
    };
  });
}

function modelFamilyKey(value: string) {
  return cleanListText(value)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/^z/, '')
    .replace(/plus$/, '+')
    .replace(/ultra$/, 'u')
    .replace(/note(\d+)\+$/, 'note$1+')
    .replace(/^a54(?:5g)?$/, 'a54');
}

function gradeFamilyKey(value: string) {
  return normalizeGradeCode(value);
}

function itemMatches(entry: LooseItemCode, invoice: LooseItemCode) {
  const modelOk = entry.model === invoice.model || modelFamilyKey(entry.model) === modelFamilyKey(invoice.model);
  const storageOk = !entry.storage || entry.storage === invoice.storage;
  const gradeOk = !entry.grade || gradeFamilyKey(entry.grade) === gradeFamilyKey(invoice.grade);
  return modelOk && storageOk && gradeOk;
}

function obtainedPriceMatchesInvoice(entry: TextListEntry, invoice: ParsedInvoiceItem) {
  if (entry.source !== 'obtained') return true;
  const entryPriceUnit = priceToBidUnit(entry.priceMax);
  if (entryPriceUnit === null) return true;
  return invoice.invoicePriceUnit !== null && entryPriceUnit === invoice.invoicePriceUnit;
}

function scoreInvoiceCandidate(entry: TextListEntry, invoice: ParsedInvoiceItem) {
  let score = 0;
  if (entry.model === invoice.model) score += 4;
  else if (modelFamilyKey(entry.model) === modelFamilyKey(invoice.model)) score += 3;
  if (!entry.storage || entry.storage === invoice.storage) score += 2;
  if (!entry.grade || gradeFamilyKey(entry.grade) === gradeFamilyKey(invoice.grade)) score += 2;
  if (entry.accountHint && entry.accountHint === invoice.account) score += 1;
  if (entry.unit && entry.unit === invoice.unit) score += 1;
  if (entry.priceMax !== null && invoice.invoicePriceUnit !== null) {
    const diff = Math.abs((entry.priceMax ?? 0) - invoice.invoicePriceUnit);
    score += diff === 0 ? 2 : diff <= 50 ? 1 : 0;
  }
  return score;
}

function scoreTargetCandidate(entry: TextListEntry, target: TextListEntry) {
  let score = 0;
  if (normalizePersonName(entry.person) === normalizePersonName(target.person)) score += 4;
  if (entry.model === target.model) score += 3;
  else if (modelFamilyKey(entry.model) === modelFamilyKey(target.model)) score += 2;
  if (!entry.storage || entry.storage === target.storage) score += 2;
  if (!entry.grade || gradeFamilyKey(entry.grade) === gradeFamilyKey(target.grade)) score += 2;
  if (entry.unit && entry.unit === target.unit) score += 1;
  return score;
}

function findBestTargetMatch(
  entry: TextListEntry,
  targetEntries: TextListEntry[],
  consumedTargetIds: Set<string>,
) {
  const candidates = targetEntries.filter(
    (target) => !consumedTargetIds.has(target.id) && itemMatches(entry, target),
  );
  if (candidates.length === 0) return null;

  const ranked = [...candidates].sort((left, right) => {
    const rightScore = scoreTargetCandidate(entry, right);
    const leftScore = scoreTargetCandidate(entry, left);
    if (rightScore !== leftScore) return rightScore - leftScore;

    const rightUnitDiff = entry.unit && right.unit ? Math.abs(entry.unit - right.unit) : Number.MAX_SAFE_INTEGER;
    const leftUnitDiff = entry.unit && left.unit ? Math.abs(entry.unit - left.unit) : Number.MAX_SAFE_INTEGER;
    if (rightUnitDiff !== leftUnitDiff) return leftUnitDiff - rightUnitDiff;

    const rightPerson = Number(normalizePersonName(right.person) === normalizePersonName(entry.person));
    const leftPerson = Number(normalizePersonName(left.person) === normalizePersonName(entry.person));
    if (rightPerson !== leftPerson) return rightPerson - leftPerson;

    return 0;
  });

  const top = ranked[0] ?? null;
  if (!top) return null;

  const topScore = scoreTargetCandidate(entry, top);
  return topScore <= 0 ? null : top;
}

function buildComparisonPreview(
  targetList: ParsedTextList,
  obtainedList: ParsedTextList,
  reserveList: ParsedTextList,
): ComparisonPreviewData {
  const consumedTargetIds = new Set<string>();
  const consumedReserveIds = new Set<string>();
  const sections: ComparisonPreviewSection[] = [];
  let matched = 0;
  let warned = 0;
  let missing = 0;

  function findReserveMatch(entry: TextListEntry) {
    return findBestTargetMatch(entry, reserveList.entries, consumedReserveIds);
  }

  obtainedList.sections.forEach((section) => {
    const rows: ComparisonPreviewRow[] = [];

    section.entries.forEach((entry) => {
      const target = findBestTargetMatch(entry, targetList.entries, consumedTargetIds);
      const reserve = target ? null : findReserveMatch(entry);
      const reference = target ?? reserve;
      const baseId = `${section.person}-${entry.id}`;

      if (!reference) {
        missing += 1;
        rows.push({
          id: baseId,
          person: section.person,
          targetLine: '-',
          obtainedLine: entry.rawLine,
          status: 'missing',
          note: 'tidak ada pasangan di list awal',
        });
        return;
      }

      if (target) consumedTargetIds.add(target.id);
      if (reserve) consumedReserveIds.add(reserve.id);

      const targetPrice = reference.priceMax;
      const obtainedPrice = entry.priceMax;
      const targetUnit = priceToBidUnit(targetPrice);
      const obtainedUnit = priceToBidUnit(obtainedPrice);
      const over = targetUnit !== null && obtainedUnit !== null ? obtainedUnit - targetUnit : null;

      if (over !== null && over > 0) {
        warned += 1;
        rows.push({
          id: baseId,
          person: section.person,
          targetLine: reference.rawLine,
          obtainedLine: entry.rawLine,
          status: 'warn',
          note: `${reserve ? 'cadangan ' : ''}lewat ${over}`,
        });
        return;
      }

      matched += 1;
      rows.push({
        id: baseId,
        person: section.person,
        targetLine: reference.rawLine,
        obtainedLine: entry.rawLine,
        status: 'ok',
        note: reserve ? 'sesuai cadangan' : 'sesuai',
      });
    });

    if (rows.length > 0) {
      sections.push({ person: section.person, rows });
    }
  });

  return { sections, matched, warned, missing };
}

function formatInvoiceEntryCode(item: ParsedInvoiceItem) {
  return `${item.model} ${item.storage ?? '-'} ${item.grade || '-'} (${item.unit ?? 1})`;
}

function formatTextEntryCode(entry: TextListEntry) {
  const price = extractPriceRange(entry.rawLine);
  const beforePrice = price.priceStart >= 0 ? entry.rawLine.slice(0, price.priceStart) : entry.rawLine;
  const normalizedCode = normalizeLooseText(beforePrice);
  const displayStorage =
    entry.storage ??
    parseStorageFromText(normalizedCode) ??
    (() => {
      const storageBeforeGrade = normalizedCode.match(
        new RegExp(`\\b(\\d{2,4})\\s*(?:tb|gb|g)?\\s*(?:-\\s*)?(?:${looseGradePattern})\\b`, 'i'),
      );
      if (!storageBeforeGrade) return null;
      const storage = Number(storageBeforeGrade[1]);
      return Number.isFinite(storage) ? storage : null;
    })();
  let modelText = cleanListText(beforePrice)
    .replace(/\s+-\s+(?=[a-z])/gi, ' ')
    .replace(/\b(menik|mubdi|aldi)\b/gi, ' ')
    .replace(/\(\s*\d+\s*\)/g, ' ')
    .replace(new RegExp(`\\b(?:${looseGradePattern})\\b`, 'gi'), ' ');

  if (displayStorage !== null) {
    modelText = modelText.replace(new RegExp(`\\b${displayStorage}\\s*(?:tb|gb|g)?\\b`, 'gi'), ' ');
  }

  modelText = cleanListText(modelText) || entry.model;

  const codeParts = [modelText];
  if (displayStorage !== null) codeParts.push(String(displayStorage));
  if (entry.grade) codeParts.push(entry.grade);
  if (entry.unit) codeParts.push(`(${entry.unit})`);

  const suffix = price.priceStart >= 0 ? cleanListText(entry.rawLine.slice(price.priceStart)) : '';
  return cleanListText(`${codeParts.join(' ')} ${suffix}`);
}

function formatStatusLine(
  entry: TextListEntry,
  invoice: ParsedInvoiceItem | null,
  reserve: TextListEntry | null,
  comparisonPrice: number | null,
) {
  const entryLine = formatTextEntryCode(entry);

  if (!invoice) {
    const duplicateNote = reserve?.note === 'barang sama' ? ' barang sama' : ' ga ada di invoice';
    return `${entryLine}${statusMissing}${duplicateNote}`;
  }

  const targetPrice = reserve?.priceMax ?? comparisonPrice ?? entry.priceMax;
  const targetUnit = priceToBidUnit(targetPrice);
  const obtainedUnit = priceToBidUnit(entry.priceMax) ?? invoice.invoicePriceUnit;
  const accountSuffix = entry.accountHint ? '' : ` ${invoice.account}`;
  const reserveSuffix = reserve ? ' cadangan' : '';

  if (targetUnit !== null && obtainedUnit !== null && obtainedUnit > targetUnit) {
    return `${entryLine}${accountSuffix}${statusWarn}${reserveSuffix} lewat ${obtainedUnit - targetUnit}`;
  }

  return `${entryLine}${accountSuffix}${statusOk}${reserveSuffix}`;
}

function buildCheckResult(
  targetList: ParsedTextList,
  obtainedList: ParsedTextList,
  reserveList: ParsedTextList,
  invoiceItems: ParsedInvoiceItem[],
) {
  const workingInvoices = invoiceItems.map((item) => ({ ...item }));
  const reserveEntries = reserveList.entries;
  const consumedObtainedKeys = new Set<string>();
  const consumedTargetIds = new Set<string>();
  const consumedReserveIds = new Set<string>();
  const linesByPerson = new Map<string, string[]>();
  const orderedPeople: string[] = [];

  function pushLine(person: string, line: string) {
    const normalized = normalizePersonName(person);
    if (!linesByPerson.has(normalized)) {
      linesByPerson.set(normalized, []);
      orderedPeople.push(person);
    }
    linesByPerson.get(normalized)?.push(line);
  }

  function findInvoice(entry: TextListEntry) {
    const exactCandidates = workingInvoices.filter(
      (invoice) => !invoice.consumedBy && obtainedPriceMatchesInvoice(entry, invoice) && itemMatches(entry, invoice),
    );
    const candidates = exactCandidates.length
      ? exactCandidates
      : workingInvoices.filter((invoice) => {
          if (invoice.consumedBy) return false;
          if (!obtainedPriceMatchesInvoice(entry, invoice)) return false;
          const familyOk = modelFamilyKey(entry.model) === modelFamilyKey(invoice.model);
          const storageOk = !entry.storage || entry.storage === invoice.storage;
          const gradeOk = !entry.grade || entry.grade === invoice.grade;
          return familyOk && storageOk && gradeOk;
        });
    if (candidates.length === 0) return null;

    const ranked = [...candidates].sort((left, right) => {
      const rightUnitExact = Number(Boolean(entry.unit && right.unit && entry.unit === right.unit));
      const leftUnitExact = Number(Boolean(entry.unit && left.unit && entry.unit === left.unit));
      if (rightUnitExact !== leftUnitExact) return rightUnitExact - leftUnitExact;

      const rightScore = scoreInvoiceCandidate(entry, right);
      const leftScore = scoreInvoiceCandidate(entry, left);
      if (rightScore !== leftScore) return rightScore - leftScore;

      const rightUnitDiff = entry.unit && right.unit ? Math.abs(entry.unit - right.unit) : Number.MAX_SAFE_INTEGER;
      const leftUnitDiff = entry.unit && left.unit ? Math.abs(entry.unit - left.unit) : Number.MAX_SAFE_INTEGER;
      if (rightUnitDiff !== leftUnitDiff) return leftUnitDiff - rightUnitDiff;

      const rightAccount = Number(right.account === entry.accountHint);
      const leftAccount = Number(left.account === entry.accountHint);
      if (rightAccount !== leftAccount) return rightAccount - leftAccount;

      return left.scanOrder - right.scanOrder;
    });
    const top = ranked[0] ?? null;
    if (!top) return null;
    return top;
  }

  function findDuplicateConflict(entry: TextListEntry) {
    return workingInvoices.some((invoice) => invoice.consumedBy && itemMatches(entry, invoice));
  }

  function findTargetReference(entry: TextListEntry) {
    return findBestTargetMatch(entry, targetList.entries, consumedTargetIds);
  }

  function findReserve(entry: TextListEntry) {
    return findBestTargetMatch(entry, reserveEntries, consumedReserveIds);
  }

  function markReferenceConsumed(targetReference: TextListEntry | null, reserve: TextListEntry | null) {
    if (targetReference) consumedTargetIds.add(targetReference.id);
    if (reserve) consumedReserveIds.add(reserve.id);
  }

  obtainedList.sections.forEach((section) => {
    section.entries.forEach((entry) => {
      const invoice = findInvoice(entry);
      const targetReference = findTargetReference(entry);
      const reserve = targetReference ? null : findReserve(entry);
      markReferenceConsumed(targetReference, reserve);
      consumedObtainedKeys.add(entry.key);
      if (invoice) invoice.consumedBy = entry.id;
      const duplicateConflict = !invoice && findDuplicateConflict(entry);
      const reserveForLine = duplicateConflict
        ? ({ ...(reserve ?? entry), note: 'barang sama' } as TextListEntry)
        : reserve
          ? { ...reserve, note: reserve.note || 'cadangan' }
          : null;
      const line = formatStatusLine(entry, invoice, reserveForLine, targetReference?.priceMax ?? null);
      pushLine(section.person, line);
    });
  });

  targetList.entries.forEach((entry) => {
    if (consumedObtainedKeys.has(entry.key) || consumedTargetIds.has(entry.id)) return;
    const invoice = findInvoice(entry);
    if (!invoice) return;
    invoice.consumedBy = entry.id;
    pushLine('Mubdi', `${formatInvoiceEntryCode(invoice)} @${invoice.invoicePriceUnit ?? '-'} ${invoice.account}${statusOk}`);
  });

  workingInvoices
    .filter((invoice) => !invoice.consumedBy)
    .sort((left, right) => left.scanOrder - right.scanOrder)
    .forEach((invoice) => {
      pushLine('Mubdi', `${formatInvoiceEntryCode(invoice)} @${invoice.invoicePriceUnit ?? '-'} ${invoice.account}${statusOk}`);
      invoice.consumedBy = 'extra-mubdi';
    });

  return orderedPeople
    .map((person) => {
      const normalized = normalizePersonName(person);
      const lines = linesByPerson.get(normalized) ?? [];
      return [person, ...lines].join('\n');
    })
    .filter(Boolean)
    .join('\n\n');
}

function MultiFilter({
  title,
  values,
  selected,
  onToggle,
}: {
  title: string;
  values: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <section className="filter-group">
      <div className="filter-group-header">
        <span>{title}</span>
        {selected.length > 0 ? <small>{selected.length} dipilih</small> : null}
      </div>
      <div className="filter-options">
        {values.length === 0 ? (
          <p className="empty-filter">Belum ada data</p>
        ) : (
          values.map((value) => (
            <label className="check-option" key={value}>
              <input
                type="checkbox"
                checked={selected.includes(value)}
                onChange={() => onToggle(value)}
              />
              <span>{value}</span>
            </label>
          ))
        )}
      </div>
    </section>
  );
}

function ResultChecker() {
  const [targetText, setTargetText] = useState('');
  const [obtainedText, setObtainedText] = useState('');
  const [reserveText, setReserveText] = useState('');
  const [invoiceJson, setInvoiceJson] = useState('');
  const [invoiceFileName, setInvoiceFileName] = useState('');
  const [copied, setCopied] = useState(false);

  function importInvoiceFile(file: File | undefined) {
    if (!file) {
      setInvoiceJson('');
      setInvoiceFileName('');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setInvoiceJson(typeof reader.result === 'string' ? reader.result : '');
      setInvoiceFileName(file.name);
    };
    reader.onerror = () => {
      setInvoiceJson('');
      setInvoiceFileName('');
    };
    reader.readAsText(file);
  }

  const invoiceItems = useMemo(() => {
    try {
      const parsed = JSON.parse(invoiceJson);
      if (!Array.isArray(parsed)) return [];
      return parseInvoiceItems(parsed as InvoiceItem[]);
    } catch {
      return [];
    }
  }, [invoiceJson]);

  const targetList = useMemo(() => parseTextList(targetText, 'target'), [targetText]);
  const obtainedList = useMemo(() => parseTextList(obtainedText, 'obtained'), [obtainedText]);
  const reserveList = useMemo(() => parseTextList(reserveText, 'reserve'), [reserveText]);
  const comparisonPreview = useMemo(
    () => buildComparisonPreview(targetList, obtainedList, reserveList),
    [obtainedList, reserveList, targetList],
  );

  const checkResult = useMemo(
    () => buildCheckResult(targetList, obtainedList, reserveList, invoiceItems),
    [invoiceItems, obtainedList, reserveList, targetList],
  );

  const missingInvoice = invoiceJson.trim().length > 0 && invoiceItems.length === 0;

  function copyResult() {
    if (!checkResult) return;
    navigator.clipboard
      .writeText(checkResult)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      })
      .catch(() => setCopied(false));
  }

  return (
    <section className="checker-layout">
      <aside className="panel checker-input-panel">
        <section className="checker-block">
          <p className="section-label">Invoice 3 Akun</p>
          <label className="file-drop checker-upload">
            <span className="file-action">Pilih Invoice JSON</span>
            <span className="file-meta">
              <strong>{invoiceFileName || 'Belum ada file invoice'}</strong>
              <small>
                {invoiceItems.length > 0
                  ? `${invoiceItems.length} item invoice terbaca`
                  : 'Gunakan collector/output/invoice/invoice-items.json'}
              </small>
            </span>
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => importInvoiceFile(event.target.files?.[0])}
            />
          </label>
          <button
            type="button"
            className="server-load-btn"
            onClick={async () => {
              try {
                const response = await fetch('/api/data/invoice/invoice-items.json');
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const text = await response.text();
                setInvoiceJson(text);
                setInvoiceFileName('🌐 invoice-items.json (Server)');
              } catch (err) {
                alert(`Gagal memuat invoice dari server: ${err instanceof Error ? err.message : err}`);
              }
            }}
          >
            🌐 Load Invoice dari Server
          </button>
          {missingInvoice ? (
            <p className="checker-error">File invoice tidak bisa dibaca sebagai JSON array.</p>
          ) : null}
        </section>

        <label className="checker-field">
          <span>List pembagian awal</span>
          <textarea
            value={targetText}
            onChange={(event) => setTargetText(event.target.value)}
            placeholder="Tempel list barang yang sudah dibagi per orang"
          />
        </label>

        <label className="checker-field">
          <span>List barang didapat</span>
          <textarea
            value={obtainedText}
            onChange={(event) => setObtainedText(event.target.value)}
            placeholder="Tempel list barang yang didapat dari tiap orang"
          />
        </label>

        <label className="checker-field">
          <span>List cadangan</span>
          <textarea
            value={reserveText}
            onChange={(event) => setReserveText(event.target.value)}
            placeholder="Tempel list cadangan jika ada"
          />
        </label>
      </aside>

      <section className="panel checker-result-panel">
        <div className="checker-result-header">
          <div>
            <p className="section-label">Hasil Cek</p>
          </div>
          <button type="button" onClick={copyResult} disabled={!checkResult}>
            {copied ? 'Tersalin' : 'Copy Hasil'}
          </button>
        </div>

        <div className="checker-stats">
          <span>{targetList.entries.length} target</span>
          <span>{obtainedList.entries.length} didapat</span>
          <span>{reserveList.entries.length} cadangan</span>
          <span>{invoiceItems.length} invoice</span>
        </div>

        <section className="comparison-preview">
          <div className="comparison-preview-header">
            <div>
              <p className="section-label">Preview Perbandingan</p>
              <h3>List awal vs barang didapat</h3>
            </div>
            <div className="comparison-preview-stats">
              <span>{comparisonPreview.matched} sesuai</span>
              <span>{comparisonPreview.warned} lewat</span>
              <span>{comparisonPreview.missing} belum ketemu</span>
            </div>
          </div>

          <div className="comparison-preview-list">
            {comparisonPreview.sections.length > 0 ? (
              comparisonPreview.sections.map((section) => (
                <div className="comparison-preview-group" key={section.person}>
                  <div className="comparison-preview-group-title">{section.person}</div>
                  {section.rows.map((row) => (
                    <div className={`comparison-preview-row ${row.status}`} key={row.id}>
                      <div className="comparison-preview-status">
                        {row.status === 'ok' ? statusOk : row.status === 'warn' ? statusWarn : statusMissing}
                      </div>
                      <div className="comparison-preview-item">
                        <span>Awal</span>
                        <strong>{row.targetLine}</strong>
                      </div>
                      <div className="comparison-preview-item">
                        <span>Didapat</span>
                        <strong>{row.obtainedLine}</strong>
                      </div>
                      <div className="comparison-preview-note">{row.note}</div>
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <p className="comparison-preview-empty">Belum ada data untuk dibandingkan.</p>
            )}
          </div>
        </section>

        <textarea
          className="result-textarea"
          readOnly
          value={checkResult}
          placeholder="Hasil cek akan muncul setelah invoice JSON dan list didapat diisi."
        />

        <div className="status-help checker-help">
          <p><strong>{statusOk}:</strong> barang ada di invoice dan harga tidak melewati batas.</p>
          <p><strong>{statusWarn}:</strong> barang ada di invoice tetapi harga melewati batas tertinggi.</p>
          <p><strong>{statusMissing}:</strong> barang tidak ditemukan di invoice atau unit yang sama sudah dipakai item lain.</p>
        </div>
      </section>
    </section>
  );
}

type ScanStatus = {
  status: 'idle' | 'running' | 'done' | 'error';
  type: string | null;
  account: string | null;
  started_at: string | null;
  finished_at: string | null;
  collected_count: number;
  error: string | null;
  log_tail: string[];
};

const emptyScanStatus: ScanStatus = {
  status: 'idle',
  type: null,
  account: null,
  started_at: null,
  finished_at: null,
  collected_count: 0,
  error: null,
  log_tail: [],
};

function App() {
  const [activeView, setActiveView] = useState<ActiveView>('analyzer');
  const [rawJson, setRawJson] = useState('');
  const [importedFileName, setImportedFileName] = useState('');
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('catalog');
  const [brandOrder, setBrandOrder] = useState(defaultBrandOrder);
  const [newBrand, setNewBrand] = useState('');
  const [draggedBrandIndex, setDraggedBrandIndex] = useState<number | null>(null);
  const [copiedItemCodes, setCopiedItemCodes] = useState(false);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const [sidebarHeight, setSidebarHeight] = useState(0);

  // --- Remote scan state ---
  const [serverLoading, setServerLoading] = useState(false);
  const [scanStatus, setScanStatus] = useState<ScanStatus>(emptyScanStatus);
  const [adbConnected, setAdbConnected] = useState<boolean | null>(null);
  const [scanPolling, setScanPolling] = useState(false);
  const scanPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadFromServer(path: string, label: string) {
    setServerLoading(true);
    try {
      const response = await fetch(`/api/data/${path}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      setRawJson(text);
      setImportedFileName(`🌐 ${label}`);
      setFilters(emptyFilters);
      setSearch('');
    } catch (err) {
      alert(`Gagal memuat data dari server: ${err instanceof Error ? err.message : err}`);
    } finally {
      setServerLoading(false);
    }
  }

  async function fetchScanStatus() {
    try {
      const response = await fetch('/api/scan/status');
      if (response.ok) {
        const data = await response.json();
        setScanStatus(data as ScanStatus);
        return data as ScanStatus;
      }
    } catch { /* ignore */ }
    return null;
  }

  async function checkAdbStatus() {
    try {
      const response = await fetch('/api/adb/status');
      if (response.ok) {
        const data = await response.json();
        setAdbConnected(data.connected as boolean);
      }
    } catch {
      setAdbConnected(false);
    }
  }

  async function startScan(type: string, account?: string, options?: Record<string, unknown>) {
    try {
      const response = await fetch('/api/scan/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, account, options: options || {} }),
      });
      if (!response.ok) {
        const err = await response.json();
        alert(err.error || 'Gagal memulai scan');
        return;
      }
      // Start polling
      startScanPolling();
    } catch (err) {
      alert(`Gagal memulai scan: ${err instanceof Error ? err.message : err}`);
    }
  }

  function startScanPolling() {
    if (scanPollRef.current) clearInterval(scanPollRef.current);
    setScanPolling(true);
    scanPollRef.current = setInterval(async () => {
      const status = await fetchScanStatus();
      if (status && status.status !== 'running') {
        stopScanPolling();
      }
    }, 2000);
  }

  function stopScanPolling() {
    if (scanPollRef.current) {
      clearInterval(scanPollRef.current);
      scanPollRef.current = null;
    }
    setScanPolling(false);
  }

  async function stopScan() {
    try {
      await fetch('/api/scan/stop', { method: 'POST' });
      await fetchScanStatus();
      stopScanPolling();
    } catch { /* ignore */ }
  }

  useLayoutEffect(() => {
    if (activeView !== 'analyzer' || !sidebarRef.current) return undefined;

    const updateSidebarHeight = () => {
      setSidebarHeight(sidebarRef.current?.offsetHeight ?? 0);
    };
    const observer = new ResizeObserver(updateSidebarHeight);
    observer.observe(sidebarRef.current);
    window.addEventListener('resize', updateSidebarHeight);
    updateSidebarHeight();

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSidebarHeight);
    };
  }, [activeView]);

  function importJsonFile(file: File | undefined) {
    if (!file) {
      setRawJson('');
      setImportedFileName('');
      setFilters(emptyFilters);
      setSearch('');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setRawJson(typeof reader.result === 'string' ? reader.result : '');
      setImportedFileName(file.name);
      setFilters(emptyFilters);
      setSearch('');
    };
    reader.onerror = () => {
      setRawJson('');
      setImportedFileName('');
      setFilters(emptyFilters);
      setSearch('');
    };
    reader.readAsText(file);
  }

  const collectorItems = useMemo(() => {
    try {
      const parsed = JSON.parse(rawJson);
      return Array.isArray(parsed) ? (parsed as CollectorItem[]) : [];
    } catch {
      return [];
    }
  }, [rawJson]);

  const parsedItems = useMemo(() => parseItems(collectorItems), [collectorItems]);

  const filterOptions = useMemo(
    () => ({
      brands: uniqueSorted(parsedItems.map((item) => item.brand)),
      models: uniqueSorted(parsedItems.map((item) => item.model)),
      storages: uniqueSorted(parsedItems.map((item) => String(item.storage ?? '-'))),
      grades: uniqueSorted(parsedItems.map((item) => item.grade_code.toUpperCase() || '-')),
      statuses: uniqueSorted(parsedItems.map((item) => item.status || '-')),
    }),
    [parsedItems],
  );

  const filteredItems = parsedItems.filter((item) => {
    const text = `${item.item_code} ${item.raw_name} ${item.brand} ${item.model}`.toLowerCase();
    const searchOk = !search || text.includes(search.toLowerCase());
    const brandOk = filters.brands.length === 0 || filters.brands.includes(item.brand);
    const modelOk = filters.models.length === 0 || filters.models.includes(item.model);
    const storageOk =
      filters.storages.length === 0 || filters.storages.includes(String(item.storage ?? '-'));
    const gradeOk =
      filters.grades.length === 0 || filters.grades.includes(item.grade_code.toUpperCase() || '-');
    const statusOk = filters.statuses.length === 0 || filters.statuses.includes(item.status || '-');
    return searchOk && brandOk && modelOk && storageOk && gradeOk && statusOk;
  });

  const visibleItems = useMemo(
    () => (sortMode === 'catalog' ? sortByCatalog(filteredItems, brandOrder) : filteredItems),
    [brandOrder, filteredItems, sortMode],
  );

  const activeFilterCount = Object.values(filters).reduce((total, values) => total + values.length, 0);

  function moveBrand(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= brandOrder.length) return;
    setBrandOrder((current) => {
      const nextOrder = [...current];
      [nextOrder[index], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[index]];
      return nextOrder;
    });
  }

  function moveBrandTo(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    setBrandOrder((current) => {
      const nextOrder = [...current];
      const [movedBrand] = nextOrder.splice(fromIndex, 1);
      nextOrder.splice(toIndex, 0, movedBrand);
      return nextOrder;
    });
  }

  function removeBrand(index: number) {
    setBrandOrder((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function addBrand() {
    const normalized = normalizeBrand(newBrand);
    if (!normalized || brandOrder.map(normalizeBrand).includes(normalized)) {
      setNewBrand('');
      return;
    }
    setBrandOrder((current) => [...current, normalized]);
    setNewBrand('');
  }

  function dropBrand(targetIndex: number) {
    if (draggedBrandIndex === null) return;
    moveBrandTo(draggedBrandIndex, targetIndex);
    setDraggedBrandIndex(null);
  }

  function copyItemCodes() {
    const itemCodes = visibleItems.map((item) => item.item_code).join('\n');
    if (!itemCodes) return;

    navigator.clipboard
      .writeText(itemCodes)
      .then(() => {
        setCopiedItemCodes(true);
        window.setTimeout(() => setCopiedItemCodes(false), 1400);
      })
      .catch(() => {
        setCopiedItemCodes(false);
      });
  }

  async function exportXlsx() {
    const headers = [
      'No',
      'Kode Item',
      'Brand',
      'Model',
      'Storage',
      'Grade',
      'Unit Ke',
      'Marker',
      'Layar',
      'Urutan Layar',
      'Kelengkapan',
      'Status',
      'Harga Lelang',
      'Source Hash',
      'Raw Name',
    ];
    const rows = visibleItems.map((item, index) => ({
      No: index + 1,
      'Kode Item': item.item_code,
      Brand: item.brand,
      Model: item.model,
      Storage: item.storage,
      Grade: item.grade_code.toUpperCase(),
      'Unit Ke': item.unit_no,
      Marker: item.scan_marker || '-',
      Layar: item.screen_no || '-',
      'Urutan Layar': item.screen_item_no || '-',
      Kelengkapan: item.condition || '-',
      Status: item.status || '-',
      'Harga Lelang': item.auction_price_number,
      'Source Hash': item.source_hash || '-',
      'Raw Name': item.raw_name,
    }));
    const ExcelJS = await import('exceljs');
    const Workbook = ExcelJS.Workbook ?? ExcelJS.default.Workbook;
    const workbook = new Workbook();
    workbook.creator = 'Bidding Item Analyzer';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Bidding Items');
    worksheet.addRow(headers);
    rows.forEach((row) => {
      worksheet.addRow(headers.map((header) => row[header as keyof typeof row]));
    });

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = { vertical: 'middle' };
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    headers.forEach((header, index) => {
      const widestCell = rows.reduce((max, row) => {
        const value = row[header as keyof (typeof rows)[number]];
        return Math.max(max, String(value ?? '').length);
      }, header.length);

      const column = worksheet.getColumn(index + 1);
      column.width = Math.min(Math.max(widestCell + 3, 10), 120);
      column.alignment = {
        vertical: 'top',
        wrapText: true,
      };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const now = new Date();
    const dateStamp = [
      String(now.getDate()).padStart(2, '0'),
      String(now.getMonth() + 1).padStart(2, '0'),
      now.getFullYear(),
    ].join('');
    link.href = url;
    link.download = `biddlog-${dateStamp}.xlsx`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <main className="app-shell">
      <div className="app-inner">
        <section className="topbar">
          <div className="brand-lockup">
            <div className="brand-mark">
              <img
                alt="Bidding Item Analyzer"
                className="app-logo"
                src="/bidding-item-analyzer-crop.png"
              />
            </div>
            <div className="brand-copy">
              <p className="eyebrow">Bidding Plus Helper</p>
              <h1>Item Analyzer</h1>
            </div>
          </div>
          <nav className="view-tabs" aria-label="Dashboard views">
            <button
              type="button"
              className={activeView === 'analyzer' ? 'active' : ''}
              onClick={() => setActiveView('analyzer')}
            >
              Analyzer
            </button>
            <button
              type="button"
              className={activeView === 'guide' ? 'active' : ''}
              onClick={() => setActiveView('guide')}
            >
              Panduan Collector
            </button>
            <button
              type="button"
              className={activeView === 'checker' ? 'active' : ''}
              onClick={() => setActiveView('checker')}
            >
              Hasil Bidding
            </button>
          </nav>
          <div className="summary">
            <span>{parsedItems.length} barang</span>
            <span>{visibleItems.length} tampil</span>
          </div>
        </section>

        {activeView === 'guide' ? (
          <CollectorGuide />
        ) : activeView === 'checker' ? (
          <ResultChecker />
        ) : (
          <section className="workspace">
          <aside className="panel input-panel" ref={sidebarRef}>
            <section className="upload-field" aria-labelledby="collector-json-label">
              <span id="collector-json-label" className="upload-title">
                Output Collector JSON
              </span>
              <label className="file-drop">
                <span className="file-action">Pilih File JSON</span>
                <span className="file-meta">
                  <strong>{importedFileName || 'Belum ada file'}</strong>
                  <small>
                    {parsedItems.length > 0
                      ? `${parsedItems.length} barang siap dianalisis`
                      : 'Data masih kosong'}
                  </small>
                </span>
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) => importJsonFile(event.target.files?.[0])}
                />
              </label>
              <button
                type="button"
                className="server-load-btn"
                disabled={serverLoading}
                onClick={() => loadFromServer('scan-list/bidding-items.json', 'bidding-items.json (Server)')}
              >
                {serverLoading ? '⏳ Memuat...' : '🌐 Load dari Server'}
              </button>
            </section>

            <section className="remote-scan-panel">
              <p className="section-label">Remote Scan</p>
              <div className="scan-status-bar">
                <span className={`scan-dot scan-dot--${scanStatus.status}`} />
                <span>
                  {scanStatus.status === 'idle' && 'Siap'}
                  {scanStatus.status === 'running' && `Scanning... (${scanStatus.collected_count} item)`}
                  {scanStatus.status === 'done' && `Selesai — ${scanStatus.collected_count} item`}
                  {scanStatus.status === 'error' && `Error: ${scanStatus.error || 'unknown'}`}
                </span>
                {adbConnected !== null && (
                  <span className={`adb-badge ${adbConnected ? 'adb-badge--ok' : 'adb-badge--off'}`}>
                    {adbConnected ? '📱 ADB OK' : '📱 ADB OFF'}
                  </span>
                )}
              </div>
              <div className="scan-actions">
                {scanStatus.status === 'running' ? (
                  <button type="button" className="scan-btn scan-btn--stop" onClick={stopScan}>
                    ⏹ Stop Scan
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="scan-btn scan-btn--start"
                      onClick={() => startScan('bidding', undefined, { phone_feedback: true })}
                    >
                      ▶ Scan Bidding
                    </button>
                    <button
                      type="button"
                      className="scan-btn scan-btn--invoice"
                      onClick={() => {
                        const account = prompt('Akun invoice (menik/mubdi/aldi):');
                        if (account && ['menik', 'mubdi', 'aldi'].includes(account.toLowerCase())) {
                          startScan('invoice', account.toLowerCase(), { phone_feedback: true });
                        }
                      }}
                    >
                      📋 Scan Invoice
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="scan-btn scan-btn--check"
                  onClick={() => { checkAdbStatus(); fetchScanStatus(); }}
                >
                  🔄 Refresh
                </button>
              </div>
              {scanStatus.log_tail.length > 0 && (
                <details className="scan-log">
                  <summary>Log ({scanStatus.log_tail.length} baris)</summary>
                  <pre>{scanStatus.log_tail.join('\n')}</pre>
                </details>
              )}
            </section>

            <section className="sort-panel" aria-labelledby="sort-panel-title">
              <div className="sort-panel-header">
                <div>
                  <p id="sort-panel-title" className="section-label">
                    Pengurutan Data
                  </p>
                  <span>{sortMode === 'catalog' ? 'Urutan katalog aktif' : 'Urutan scan aktif'}</span>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setBrandOrder(defaultBrandOrder)}
                >
                  Default
                </button>
              </div>
              <div className="segmented-control" role="group" aria-label="Mode pengurutan">
                <button
                  type="button"
                  className={sortMode === 'catalog' ? 'active' : ''}
                  onClick={() => setSortMode('catalog')}
                >
                  Katalog
                </button>
                <button
                  type="button"
                  className={sortMode === 'scan' ? 'active' : ''}
                  onClick={() => setSortMode('scan')}
                >
                  Scan
                </button>
              </div>
              <div className="brand-sort-builder">
                <div className="brand-add-row">
                  <input
                    value={newBrand}
                    onChange={(event) => setNewBrand(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addBrand();
                      }
                    }}
                    placeholder="Tambah brand, contoh: sony"
                  />
                  <button type="button" className="secondary-button" onClick={addBrand}>
                    Tambah
                  </button>
                </div>
                <div className="brand-order-list" aria-label="Prioritas brand katalog">
                  {brandOrder.map((brand, index) => (
                    <div
                      className={`brand-order-item ${
                        draggedBrandIndex === index ? 'dragging' : ''
                      }`}
                      draggable
                      key={`${brand}-${index}`}
                      onDragEnd={() => setDraggedBrandIndex(null)}
                      onDragOver={(event) => event.preventDefault()}
                      onDragStart={() => setDraggedBrandIndex(index)}
                      onDrop={() => dropBrand(index)}
                      title="Tahan lalu geser untuk mengubah urutan"
                    >
                      <span className="brand-rank">{index + 1}</span>
                      <strong>{brand}</strong>
                      <div className="brand-actions">
                        <button
                          type="button"
                          className="icon-button"
                          disabled={index === 0}
                          onClick={() => moveBrand(index, -1)}
                          title="Naikkan brand"
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          disabled={index === brandOrder.length - 1}
                          onClick={() => moveBrand(index, 1)}
                          title="Turunkan brand"
                        >
                          Down
                        </button>
                        <button
                          type="button"
                          className="icon-button danger"
                          onClick={() => removeBrand(index)}
                          title="Hapus brand"
                        >
                          X
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="sort-hint">
                Mode katalog otomatis mengurutkan model premium dulu, nomor besar ke kecil,
                storage besar ke kecil, lalu grade terbaik ke bawah.
              </p>
            </section>

            <div className="filter-sidebar-header">
              <div>
                <p className="section-label">Filter Data Saat Ini</p>
                <span>{activeFilterCount} filter aktif</span>
              </div>
              <button
                type="button"
                className="secondary-button"
                disabled={!hasActiveFilter(filters)}
                onClick={() => setFilters(emptyFilters)}
              >
                Reset
              </button>
            </div>

            <MultiFilter
              title="Merek HP"
              values={filterOptions.brands}
              selected={filters.brands}
              onToggle={(value) => setFilters((current) => toggleFilter(current, 'brands', value))}
            />
            <MultiFilter
              title="Model"
              values={filterOptions.models}
              selected={filters.models}
              onToggle={(value) => setFilters((current) => toggleFilter(current, 'models', value))}
            />
            <MultiFilter
              title="Storage"
              values={filterOptions.storages}
              selected={filters.storages}
              onToggle={(value) =>
                setFilters((current) => toggleFilter(current, 'storages', value))
              }
            />
            <MultiFilter
              title="Grade"
              values={filterOptions.grades}
              selected={filters.grades}
              onToggle={(value) => setFilters((current) => toggleFilter(current, 'grades', value))}
            />
            <MultiFilter
              title="Status"
              values={filterOptions.statuses}
              selected={filters.statuses}
              onToggle={(value) =>
                setFilters((current) => toggleFilter(current, 'statuses', value))
              }
            />
          </aside>

          <section
            className="panel table-panel"
            style={
              sidebarHeight > 0
                ? ({ '--sidebar-height': `${sidebarHeight}px` } as React.CSSProperties)
                : undefined
            }
          >
            <div className="filters">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari model, kode item, raw name"
              />
              <div className="filter-actions">
                <button
                  className="secondary-button"
                  disabled={visibleItems.length === 0}
                  onClick={copyItemCodes}
                  type="button"
                >
                  {copiedItemCodes ? 'Tersalin' : 'Copy Kode Item'}
                </button>
                <button type="button" onClick={exportXlsx}>
                  Export
                </button>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Kode Item</th>
                    <th>Model</th>
                    <th>Storage</th>
                    <th>Grade</th>
                    <th>Unit Ke</th>
                    <th>Marker</th>
                    <th>Harga</th>
                    <th>Status</th>
                    <th>Raw Name</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
                      <td>
                        <strong>{item.item_code}</strong>
                      </td>
                      <td>{item.model}</td>
                      <td>{item.storage ?? '-'}</td>
                      <td>{item.grade_code.toUpperCase() || '-'}</td>
                      <td>{item.unit_no}</td>
                      <td title={item.source_text || item.source_hash || ''}>
                        {item.scan_marker || '-'}
                      </td>
                      <td>{currency(item.auction_price_number)}</td>
                      <td>{item.status || '-'}</td>
                      <td>{item.raw_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          </section>
        )}
      </div>
    </main>
  );
}

createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
