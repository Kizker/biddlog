export type CollectorItem = {
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

export type ParsedItem = CollectorItem & {
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

export type InvoiceItem = {
  account: string;
  raw_name: string;
  grade?: string;
  invoice_price?: number | string | null;
  scan_order?: number;
  scan_marker?: string;
  source_text?: string;
};

export type LooseItemCode = {
  model: string;
  storage: number | null;
  grade: string;
  unit: number | null;
  key: string;
  baseKey: string;
};

export type TextListEntry = LooseItemCode & {
  id: string;
  person: string;
  rawLine: string;
  priceMax: number | null;
  accountHint: string;
  note: string;
  source: 'target' | 'obtained' | 'reserve';
};

export type ParsedTextList = {
  sections: Array<{ person: string; entries: TextListEntry[] }>;
  entries: TextListEntry[];
};

export type ComparisonPreviewRow = {
  id: string;
  person: string;
  targetLine: string;
  obtainedLine: string;
  status: 'ok' | 'warn' | 'missing';
  note: string;
  model: string;
  grade: string;
  price: number;
};

export type ComparisonPreviewSection = {
  person: string;
  rows: ComparisonPreviewRow[];
};

export type ComparisonPreviewData = {
  sections: ComparisonPreviewSection[];
  matched: number;
  warned: number;
  missing: number;
};

export type ParsedInvoiceItem = LooseItemCode & {
  id: string;
  account: string;
  rawName: string;
  invoicePrice: number | null;
  invoicePriceUnit: number | null;
  scanOrder: number;
  consumedBy?: string;
};

export type FilterKey = 'brands' | 'models' | 'storages' | 'grades' | 'statuses';
export type FilterState = Record<FilterKey, string[]>;
export type SortMode = 'scan' | 'catalog';

export const defaultBrandOrder = [
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

export const gradeOrder = ['aa', 'ab', 'ac', 'ad', 'ae', 'af', 'ag', 'ah', 'ai', 'aj', 'a'];
export const looseGradePattern = 'aa|ab|ac|ad|ae|af|ag|ah|ai|aj|gi|a';
export const invoiceAccounts = ['menik', 'mubdi', 'aldi'];
export const statusOk = '✅';
export const statusWarn = '⚠️';
export const statusMissing = '❌';

export const emptyFilters: FilterState = {
  brands: [],
  models: [],
  storages: [],
  grades: [],
  statuses: [],
};

export type ActiveView = 'analyzer' | 'scanner' | 'checker';
export type AdminViewMode = 'dashboard' | 'analyzer' | 'hasil_bidding' | 'scanner' | 'pembagian_barang' | 'presensi' | 'list_dapat' | 'gaji' | 'limit_harga' | 'pengguna' | 'audit_trail';
