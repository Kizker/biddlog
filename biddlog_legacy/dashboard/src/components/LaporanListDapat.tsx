import React, { useEffect, useState, useMemo } from 'react';
import { getFastCache, setFastCache, clearFastCache } from '../utils/fastCache';

export interface ObtainedItem {
  id: string | number;
  person: string;
  model: string;
  storage: string;
  grade: string;
  unit: number | string;
  price: number | string;
  fee_info?: string;
  bidder: string;
  status: 'approved' | 'rejected' | 'pending';
  notes?: string;
  report_date?: string;
  raw_line?: string;
}

// Helper to identify owner accounts (Menik & Mubdi - only exact names, not 'Mubdi 2' or 'Menik 2')
export const isOwnerPerson = (personName: string): boolean => {
  const norm = (personName || '').toLowerCase().trim();
  return /^(?:menik|mubdi)$/i.test(norm);
};

// Helper to identify if a line is a Person Name header
export const isPersonHeaderLine = (line: string): boolean => {
  const trimmed = (line || '').trim();
  if (!trimmed) return false;
  if (/^enb\s+tgl/i.test(trimmed)) return false;
  // If line contains calculation formula or total line, skip
  if (/^\d+\s*[*xX]\s*\d+/i.test(trimmed) || /^=\s*\d+/i.test(trimmed)) return false;
  // If line contains status emojis, @, or parentheses (unit / fee), it is definitely an item line
  if (/[✅❌⚠️@]/.test(trimmed)) return false;
  if (trimmed.includes('(') && trimmed.includes(')')) return false;

  // If line contains phone brand keywords accompanied by storage or grade, it is an item line
  const hasPhonePattern = /\b(fold|flip|s\d+|note|iphone|a\d+)\b/i.test(trimmed) && 
                         (/\b(64|128|256|512|1024)\b/.test(trimmed) || /\b(a[a-z]|b[a-z]|c[a-z])\b/i.test(trimmed));
  if (hasPhonePattern) return false;

  // Otherwise, if line length is concise (< 40 chars), it is a Person Name (e.g. "Bilqis 2", "Mubdi 2", "K agam", "Mb atik", "Icha", "Menik", etc.)
  return trimmed.length < 40;
};

// Helper to sanitize model and notes so notes never stick inside the model name
export const sanitizeModelAndNotes = (model: string, notes?: string): { cleanModel: string; cleanNotes: string } => {
  let cleanModel = (model || '').trim();
  let cleanNotes = (notes || '').trim();

  // Pattern for notes that might appear anywhere in the model string
  const noteKeywordsRegex = /\b(barang\s+sama(?:\s+[a-zA-Z0-9_, -]+)?|ga(?:k)?\s*ada\s*(?:di\s*|d)?invoice|tidak\s*ada\s*(?:di\s*|d)?invoice|cadangan|bonus|pending|lewat(?:\s+\d+)?)\b/i;

  let match = cleanModel.match(noteKeywordsRegex);
  while (match) {
    const extracted = match[0].trim();
    cleanModel = cleanModel.replace(new RegExp(extracted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ').replace(/\s+/g, ' ').trim();
    if (!cleanNotes) {
      cleanNotes = extracted;
    } else if (!cleanNotes.toLowerCase().includes(extracted.toLowerCase())) {
      cleanNotes = `${cleanNotes} ${extracted}`.trim();
    }
    match = cleanModel.match(noteKeywordsRegex);
  }

  return { cleanModel: cleanModel || 'Item', cleanNotes };
};

// Helper to parse individual item lines accurately
export const parseObtainedItemLine = (rawLine: string, person: string): ObtainedItem => {
  const raw = rawLine.trim();

  // 1. Status
  let status: 'approved' | 'rejected' | 'pending' = 'approved';
  if (raw.includes('❌')) {
    status = 'rejected';
  } else if (raw.includes('⚠️') || raw.includes('✅')) {
    status = 'approved';
  }

  // 2. Notes extraction
  let notes = '';
  // Also extract anything after the status emoji [✅❌⚠️] if present
  const trailingAfterEmoji = raw.match(/[✅❌⚠️]\s*([a-zA-Z0-9\s_,-]+)$/);
  if (trailingAfterEmoji) {
    notes = trailingAfterEmoji[1].trim();
  } else {
    // Match known note patterns anywhere in the line
    const knownNotesRegex = /\b(barang\s+sama(?:\s+[a-zA-Z0-9_, -]+)?|ga(?:k)?\s*ada\s*(?:di\s*|d)?invoice|tidak\s*ada\s*(?:di\s*|d)?invoice|lewat\s+\d+|cadangan|bonus|pending)\b/i;
    const notesMatch = raw.match(knownNotesRegex);
    if (notesMatch) {
      notes = notesMatch[0].trim();
    }
  }

  // 3. Bidder account (word right before emoji)
  let bidder = '';
  const bidderMatch = raw.match(/([a-zA-Z]+)\s*[✅❌⚠️]/);
  if (bidderMatch) {
    bidder = bidderMatch[1].replace(/[()]/g, '').trim();
  }

  // 4. Units & Fee from parentheses (X)
  let unit: number | string = 1;
  let fee_info = '';
  const parenMatches = Array.from(raw.matchAll(/\((\d+)\)/g));
  for (const pm of parenMatches) {
    const num = parseInt(pm[1], 10);
    if (num >= 25) {
      fee_info = String(num);
    } else {
      unit = num;
    }
  }

  // 5. Storage (64, 128, 256, 512, 1024)
  let storage = '';
  const storageMatch = raw.match(/\b(64|128|256|512|1024)\b/);
  if (storageMatch) {
    storage = storageMatch[1];
  }

  // 6. Grade (2 letters like ad, ae, af, ag, ah, ai, ab, ac, aj, gi)
  let grade = '';
  const gradeMatch = raw.match(/\b(a[a-z]|b[a-z]|c[a-z]|gi)\b/i);
  if (gradeMatch) {
    grade = gradeMatch[1].toLowerCase();
  }

  // 7. Price extraction
  let price: number | string = '';
  const atPriceMatch = raw.match(/@(\d+(?:\.\d+)?)/);
  if (atPriceMatch) {
    price = atPriceMatch[1].replace('.', '');
  } else {
    const dotPriceMatch = raw.match(/\b(\d{1,2}\.\d{3})\b/);
    if (dotPriceMatch) {
      price = dotPriceMatch[1].replace('.', '');
    } else {
      // Standalone 3 to 6 digit numbers (not storage, not fee)
      const allNums = Array.from(raw.matchAll(/\b(\d{3,6})\b/g));
      for (const nm of allNums) {
        const val = nm[1];
        if (val !== storage && val !== fee_info && val !== '1024') {
          price = val;
          break;
        }
      }
    }
  }

  // 8. Clean Model name
  let modelClean = raw;
  modelClean = modelClean.replace(/[✅❌⚠️@]/g, ' ');
  if (bidder) modelClean = modelClean.replace(new RegExp(`\\b${bidder}\\b`, 'gi'), ' ');
  if (notes) {
    const escapedNotes = notes.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    modelClean = modelClean.replace(new RegExp(escapedNotes, 'gi'), ' ');
  }
  // Thoroughly strip any note keywords from modelClean
  modelClean = modelClean.replace(/\b(barang\s+sama|ga(?:k)?\s*ada\s*(?:di\s*|d)?invoice|tidak\s*ada\s*(?:di\s*|d)?invoice|cadangan|bonus|pending)\b/gi, ' ');
  if (storage) modelClean = modelClean.replace(new RegExp(`\\b${storage}\\b`, 'g'), ' ');
  if (grade) modelClean = modelClean.replace(new RegExp(`\\b${grade}\\b`, 'gi'), ' ');
  if (price) modelClean = modelClean.replace(new RegExp(`@?${price}`, 'g'), ' ');
  modelClean = modelClean.replace(/\(\d+\)/g, ' ');
  modelClean = modelClean.replace(/\blewat(?:\s+\d+)?\b/gi, ' ');
  modelClean = modelClean.replace(/\s+/g, ' ').trim();

  const sanitized = sanitizeModelAndNotes(modelClean, notes);

  return {
    id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    person: person || 'Umum',
    model: sanitized.cleanModel,
    storage,
    grade,
    unit,
    price: price || 0,
    fee_info,
    bidder: bidder || 'mubdi',
    status,
    notes: sanitized.cleanNotes,
    raw_line: rawLine
  };
};

export default function LaporanListDapat({ onNavigateToHasilBidding }: { onNavigateToHasilBidding?: () => void }) {
  // Read instant cache for 0ms initial render
  const cachedObtained = useMemo(() => getFastCache<any>('obtained_data'), []);

  const [reportDate, setReportDate] = useState<string>(() => {
    if (cachedObtained?.report_date) return cachedObtained.report_date;
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    return `Enb tgl ${day}/${month}/ ${year}`;
  });

  const [items, setItems] = useState<ObtainedItem[]>(() => {
    if (cachedObtained && Array.isArray(cachedObtained.data)) {
      return cachedObtained.data.map((row: any) => {
        const { cleanModel, cleanNotes } = sanitizeModelAndNotes(row.model, row.notes);
        return {
          id: row.id,
          person: row.person || row.username || 'Umum',
          model: cleanModel,
          storage: row.storage ? String(row.storage) : '',
          grade: row.grade || '',
          unit: row.unit || 1,
          price: row.obtained_price || 0,
          fee_info: row.fee_info || '',
          bidder: row.bidder || '',
          status: (row.status === 'rejected' ? 'rejected' : 'approved') as 'approved' | 'rejected',
          notes: cleanNotes,
          report_date: row.report_date || '',
          raw_line: row.raw_line || ''
        };
      });
    }
    return [];
  });

  const [loading, setLoading] = useState<boolean>(() => !cachedObtained);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'approved' | 'rejected'>('all');
  const [activeTab, setActiveTab] = useState<'cards' | 'preview' | 'table'>('cards');
  const [copied, setCopied] = useState<boolean>(false);
  const [showPasteModal, setShowPasteModal] = useState<boolean>(false);
  const [pasteText, setPasteText] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string>('');

  // Import from Bidding State
  const [showImportBiddingModal, setShowImportBiddingModal] = useState<boolean>(false);
  const [biddingSnapshot, setBiddingSnapshot] = useState<{
    reportDate: string;
    items: ObtainedItem[];
    rawText: string;
    timestamp: number;
  } | null>(null);
  // Form state for adding manual item
  const [newItem, setNewItem] = useState<Partial<ObtainedItem>>({
    person: '',
    model: '',
    storage: '256',
    grade: 'ad',
    unit: 1,
    price: '',
    fee_info: '',
    bidder: 'mubdi',
    status: 'approved',
    notes: '',
  });

  // Helper to deduplicate item list based on person, model, storage, grade, price, bidder, fee
  const deduplicateItemsList = (itemList: ObtainedItem[]): { unique: ObtainedItem[]; removedCount: number } => {
    const seen = new Set<string>();
    const unique: ObtainedItem[] = [];
    let removedCount = 0;
    for (const it of itemList) {
      const p = (it.person || '').trim().toLowerCase();
      const m = (it.model || '').trim().toLowerCase();
      const s = String(it.storage || '').trim().toLowerCase();
      const g = (it.grade || '').trim().toLowerCase();
      const pr = String(it.price || 0).trim();
      const b = (it.bidder || '').trim().toLowerCase();
      const f = String(it.fee_info || '').trim();
      const st = (it.status || 'approved').trim().toLowerCase();
      const key = `${p}|${m}|${s}|${g}|${pr}|${b}|${f}|${st}`;
      if (seen.has(key)) {
        removedCount++;
      } else {
        seen.add(key);
        unique.push(it);
      }
    }
    return { unique, removedCount };
  };

  // Fetch data from API with strict date isolation (Stale-While-Revalidate)
  const fetchData = async (targetDate?: string, silent = false) => {
    if (!silent && !cachedObtained) setLoading(true);
    try {
      const dateToFetch = targetDate || reportDate;
      const res = await fetch(`/api/obtained.php?date=${encodeURIComponent(dateToFetch)}`);
      const json = await res.json();
      if (json.status === 'success') {
        if (!targetDate) {
          setFastCache('obtained_data', json);
        }
        if (Array.isArray(json.data) && json.data.length > 0) {
          const loaded: ObtainedItem[] = json.data.map((row: any) => {
            const { cleanModel, cleanNotes } = sanitizeModelAndNotes(row.model, row.notes);
            return {
              id: row.id,
              person: row.person || row.username || 'Umum',
              model: cleanModel,
              storage: row.storage ? String(row.storage) : '',
              grade: row.grade || '',
              unit: row.unit || 1,
              price: row.obtained_price || 0,
              fee_info: row.fee_info || '',
              bidder: row.bidder || '',
              status: (row.status === 'rejected' ? 'rejected' : 'approved') as 'approved' | 'rejected',
              notes: cleanNotes,
              report_date: row.report_date || dateToFetch,
              raw_line: row.raw_line || ''
            };
          });
          setItems(loaded);
          if (json.report_date && !targetDate) {
            setReportDate(json.report_date);
          }
        } else {
          setItems([]);
          setFastCache('obtained_data', { status: 'success', data: [], report_date: dateToFetch });
        }
      }
    } catch (err) {
      console.error('Error fetching obtained items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(undefined, Boolean(cachedObtained));
  }, []);

  // Sync to database with safe date normalization and optional clean replace
  const syncToDatabase = async (currentItems: ObtainedItem[], customDate?: string, replaceAll = false) => {
    setSaveStatus('Menyimpan...');
    const syncDate = customDate || reportDate;
    try {
      const payload = {
        action: 'sync_all',
        report_date: syncDate,
        replace_all: replaceAll,
        clear_existing: true,
        items: currentItems.map(it => ({
          person: it.person,
          model: it.model,
          storage: it.storage,
          grade: it.grade,
          unit: it.unit,
          obtained_price: it.price,
          fee_info: it.fee_info,
          bidder: it.bidder,
          status: it.status,
          notes: it.notes,
          raw_line: it.raw_line
        }))
      };
      const res = await fetch('/api/obtained.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === 'success') {
        setSaveStatus('Tersimpan di DB ✅');
        setFastCache('obtained_data', {
          status: 'success',
          data: currentItems.map(it => ({
            ...it,
            obtained_price: it.price
          })),
          report_date: syncDate
        });
        setTimeout(() => setSaveStatus(''), 2500);
      } else {
        setSaveStatus('Gagal simpan ⚠️');
      }
    } catch (err) {
      setSaveStatus('Error koneksi ⚠️');
      setTimeout(() => setSaveStatus(''), 2500);
    }
  };

  // Open Import from Bidding Modal (Non-copy-paste option)
  const handleOpenImportBidding = () => {
    const saved = localStorage.getItem('biddlog_latest_bidding_result');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
          setBiddingSnapshot(parsed);
          setShowImportBiddingModal(true);
          return;
        }
      } catch (e) {}
    }

    if (window.confirm('Belum ada snapshot hasil bidding yang diproses di tab "Hasil Bidding". Apakah Anda ingin berpindah ke tab Hasil Bidding sekarang?')) {
      if (onNavigateToHasilBidding) onNavigateToHasilBidding();
    }
  };

  // Execute Import from Bidding (Clean Replacement - No Stacking/Appending)
  const handleExecuteImportBidding = async () => {
    if (!biddingSnapshot || !biddingSnapshot.items || biddingSnapshot.items.length === 0) return;

    // 1. Generate clean item list with fresh unique IDs
    const newItems: ObtainedItem[] = biddingSnapshot.items.map((it, idx) => ({
      ...it,
      id: 'item_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substr(2, 5)
    }));

    const finalDate = biddingSnapshot.reportDate || reportDate;
    setReportDate(finalDate);
    setItems(newItems);

    // 2. Wipe old caches completely
    clearFastCache('obtained_data');
    clearFastCache('obtained_dates');
    localStorage.setItem('obtained_list_data', JSON.stringify(newItems));

    // 3. Atomically replace database records with the new list
    await syncToDatabase(newItems, finalDate, true);
    setShowImportBiddingModal(false);
    setSaveStatus(`Berhasil mengganti list dengan ${newItems.length} item dari Hasil Bidding! ✨`);
    setTimeout(() => setSaveStatus(''), 3000);
  };

  // Clean duplicate items in 1 click
  const handleCleanDuplicates = async () => {
    if (items.length === 0) {
      alert('Tidak ada item untuk diperiksa.');
      return;
    }
    const seen = new Set<string>();
    const uniqueItems: ObtainedItem[] = [];
    let dupCount = 0;

    for (const it of items) {
      const key = `${(it.person || '').toLowerCase()}|${(it.model || '').toLowerCase()}|${it.storage}|${it.grade}|${it.price}|${it.fee_info}|${it.bidder}|${it.status}`;
      if (seen.has(key)) {
        dupCount++;
      } else {
        seen.add(key);
        uniqueItems.push(it);
      }
    }

    if (dupCount === 0) {
      alert('Tidak ditemukan item duplikat pada list saat ini.');
      return;
    }

    if (!window.confirm(`Ditemukan ${dupCount} item duplikat yang identik. Bersihkan semua duplikat sekarang?`)) return;

    setItems(uniqueItems);
    await syncToDatabase(uniqueItems, reportDate);
    try {
      await fetch('/api/obtained.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clean_duplicates', report_date: reportDate })
      });
    } catch (e) {}
    setSaveStatus(`${dupCount} duplikat dibersihkan! 🧹`);
    setTimeout(() => setSaveStatus(''), 3000);
  };

  // Publish / Kirim Gaji to Salary Module
  const [sendingSalary, setSendingSalary] = useState(false);
  const handleSendToSalary = async () => {
    if (items.length === 0) {
      alert('Tidak ada data barang untuk dikirim ke Gaji.');
      return;
    }

    const approvedCount = items.filter(it => it.status === 'approved' && !isOwnerPerson(it.person) && it.fee_info).length;
    if (!window.confirm(`Kirim dan simpan data gaji (${approvedCount} item disetujui) pada ${reportDate} ke menu Gaji?`)) {
      return;
    }

    setSendingSalary(true);
    try {
      // 1. Sync obtained items first
      await syncToDatabase(items);

      // 2. Publish to salary
      const res = await fetch('/api/salary.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'publish_payroll',
          report_date: reportDate,
          items: items
        })
      });
      const json = await res.json();
      if (json.status === 'success') {
        setSaveStatus(`Data gaji ${reportDate} berhasil dikirim ke menu Gaji! 💸`);
        setTimeout(() => setSaveStatus(''), 3500);
      } else {
        alert('Gagal mengirim gaji: ' + (json.message || 'Error'));
      }
    } catch (e) {
      console.error(e);
      alert('Terjadi kesalahan saat mengirim data gaji.');
    } finally {
      setSendingSalary(false);
    }
  };

  // Parse Raw Text Input (Smart Parser)
  const handleParseText = (text: string) => {
    if (!text.trim()) return;

    const lines = text.split('\n');
    const parsedItems: ObtainedItem[] = [];
    let currentPerson = '';
    let foundHeaderDate = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Check header date like "Enb tgl 19/08/ 2026" or "Enb tgl 19/08/2026"
      if (/^enb\s+tgl/i.test(line)) {
        foundHeaderDate = line;
        continue;
      }

      // Skip fee formula lines like "66x50+3x75+4x100" or "=3575"
      if (/^\d+\s*[*xX]\s*\d+/i.test(line) || /^=\s*\d+/i.test(line)) {
        continue;
      }

      // Check if this line is a person name header
      if (isPersonHeaderLine(line)) {
        currentPerson = line;
        continue;
      }

      // Parse as item line
      const parsedItem = parseObtainedItemLine(line, currentPerson);
      parsedItems.push(parsedItem);
    }

    if (foundHeaderDate) {
      setReportDate(foundHeaderDate);
    }

    if (parsedItems.length > 0) {
      setItems(parsedItems);
      syncToDatabase(parsedItems);
      setShowPasteModal(false);
      setPasteText('');
    }
  };

  // Toggle item status between approved and rejected
  const toggleItemStatus = (id: string | number) => {
    const updated = items.map(item => {
      if (item.id === id) {
        const nextStatus = item.status === 'approved' ? 'rejected' : 'approved';
        return { ...item, status: nextStatus };
      }
      return item;
    });
    setItems(updated as ObtainedItem[]);
    syncToDatabase(updated as ObtainedItem[]);
  };

  // Quick set fee
  const setItemFee = (id: string | number, fee: string) => {
    const updated = items.map(item => {
      if (item.id === id) {
        return { ...item, fee_info: item.fee_info === fee ? '' : fee };
      }
      return item;
    });
    setItems(updated);
    syncToDatabase(updated);
  };

  // Update item field
  const updateItemField = (id: string | number, field: keyof ObtainedItem, value: any) => {
    const updated = items.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    });
    setItems(updated);
  };

  // Delete an item
  const deleteItem = (id: string | number) => {
    const updated = items.filter(it => it.id !== id);
    setItems(updated);
    syncToDatabase(updated);
  };

  // Bulk actions
  const setAllStatus = (newStatus: 'approved' | 'rejected') => {
    const updated = items.map(it => ({ ...it, status: newStatus }));
    setItems(updated);
    syncToDatabase(updated);
  };

  // Bulk set fee across all items, excluding owners (Menik & Mubdi)
  const setAllFee = (feeVal: string) => {
    const updated = items.map(it => {
      // Exclude Menik and Mubdi from receiving fees because they are the owners
      if (isOwnerPerson(it.person)) {
        return { ...it, fee_info: '' };
      }
      return { ...it, fee_info: feeVal };
    });
    setItems(updated);
    syncToDatabase(updated);
  };

  // Reset status and fee to default
  const handleResetStatusAndFee = () => {
    if (!window.confirm('Reset semua status menjadi Disetujui (✅) dan hapus seluruh keterangan fee?')) return;
    const updated = items.map(it => ({ ...it, status: 'approved' as const, fee_info: '' }));
    setItems(updated);
    syncToDatabase(updated);
  };

  // Reset all data completely
  const handleResetAllData = async () => {
    if (!window.confirm('Apakah Anda yakin ingin mengosongkan SEMUA data list didapat? Tindakan ini akan menghapus data secara permanen.')) return;
    
    // 1. Immediately empty local UI state
    setItems([]);
    setSaveStatus('Mengosongkan database...');

    // 2. Clear all local storage & RAM caches
    localStorage.removeItem('obtained_list_data');
    localStorage.removeItem('biddlog_latest_bidding_result');
    clearFastCache('obtained_data');
    clearFastCache('obtained_dates');
    setFastCache('obtained_data', { status: 'success', data: [], report_date: reportDate });

    // 3. Send permanent deletion to backend
    try {
      const res = await fetch('/api/obtained.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'clear_all', 
          clear_all: true,
          report_date: reportDate
        })
      });
      const resJson = await res.json();
      if (resJson && resJson.status === 'success') {
        setSaveStatus('Data berhasil dikosongkan bersih 🗑️');
      } else {
        setSaveStatus('Gagal mengosongkan DB ⚠️');
      }
      setTimeout(() => setSaveStatus(''), 2500);
    } catch (e) {
      console.error(e);
      setSaveStatus('Error koneksi ⚠️');
      setTimeout(() => setSaveStatus(''), 2500);
    }
  };

  // Add new manual item
  const handleAddNewItem = () => {
    if (!newItem.model) return;
    const created: ObtainedItem = {
      id: 'item_' + Date.now(),
      person: newItem.person || 'Umum',
      model: newItem.model || '',
      storage: newItem.storage || '256',
      grade: newItem.grade || 'ad',
      unit: newItem.unit || 1,
      price: newItem.price || 0,
      fee_info: newItem.fee_info || '',
      bidder: newItem.bidder || 'mubdi',
      status: (newItem.status as any) || 'approved',
      notes: newItem.notes || ''
    };
    const updated = [...items, created];
    setItems(updated);
    syncToDatabase(updated);
    setShowAddModal(false);
    setNewItem({
      person: created.person,
      model: '',
      storage: '256',
      grade: 'ad',
      unit: 1,
      price: '',
      fee_info: '',
      bidder: 'mubdi',
      status: 'approved',
      notes: ''
    });
  };

  // Group items by person
  const groupedByPerson = useMemo(() => {
    const map = new Map<string, ObtainedItem[]>();
    items.forEach(item => {
      const personKey = item.person.trim() || 'Umum';
      if (!map.has(personKey)) {
        map.set(personKey, []);
      }
      map.get(personKey)!.push(item);
    });
    return Array.from(map.entries());
  }, [items]);

  // Total Fee breakdown calculation (e.g. 66*50+3*75+4*100 = 3575)
  const feeCalculation = useMemo(() => {
    const feeCounts = new Map<number, number>();

    items.forEach(item => {
      // Only approved items count for fee calculation, and ignore owners (Menik & Mubdi)
      if (item.status === 'approved' && !isOwnerPerson(item.person) && item.fee_info) {
        const feeNum = parseInt(item.fee_info.replace(/[()]/g, '').trim(), 10);
        if (!isNaN(feeNum) && feeNum > 0) {
          // Each line item represents 1 single item (numbers like (1), (2) are sequence index, not quantity multiplier)
          feeCounts.set(feeNum, (feeCounts.get(feeNum) || 0) + 1);
        }
      }
    });

    if (feeCounts.size === 0) {
      return {
        formulaText: '',
        totalText: '',
        grandTotal: 0,
        tiers: [] as { fee: number; count: number; subtotal: number }[]
      };
    }

    // Sort fee tiers ascending (e.g. 50, 75, 100)
    const sortedTiers = Array.from(feeCounts.entries()).sort((a, b) => a[0] - b[0]);
    
    let grandTotal = 0;
    const formulaParts: string[] = [];

    sortedTiers.forEach(([feeVal, count]) => {
      const subtotal = count * feeVal;
      grandTotal += subtotal;
      formulaParts.push(`${count}x${feeVal}`);
    });

    const formulaText = formulaParts.join('+');
    const totalText = `=${grandTotal}`;

    return {
      formulaText,
      totalText,
      grandTotal,
      tiers: sortedTiers.map(([fee, count]) => ({ fee, count, subtotal: count * fee }))
    };
  }, [items]);

  // Generate Output Text matching user's requested layout
  const generatedOutputText = useMemo(() => {
    if (items.length === 0) return '';
    const lines: string[] = [reportDate];

    // Prepend fee calculation formula right below date label
    if (feeCalculation.formulaText) {
      lines.push('');
      lines.push(feeCalculation.formulaText);
      lines.push(feeCalculation.totalText);
    }
    lines.push('');

    groupedByPerson.forEach(([person, personItems]) => {
      lines.push(person);
      personItems.forEach(item => {
        const parts: string[] = [];
        const { cleanModel, cleanNotes } = sanitizeModelAndNotes(item.model, item.notes);

        // 1. Model (selalu bersih dari catatan)
        parts.push(cleanModel);
        // 2. Storage
        if (item.storage) parts.push(String(item.storage));
        // 3. Grade
        if (item.grade) parts.push(item.grade);
        // 4. Unit
        if (item.unit) parts.push(`(${item.unit})`);
        // 5. Price
        if (item.price) parts.push(`@${item.price}`);
        // 6. Fee keterangan, e.g. (100) or (75) or (50) or (25)
        if (item.fee_info && item.fee_info.trim()) {
          const feeClean = item.fee_info.replace(/[()]/g, '').trim();
          parts.push(`(${feeClean})`);
        }
        // 7. Bidder + Status Symbol (hanya ✅ atau ❌, tidak ada lagi simbol ⚠️)
        // Ceklist (✅) untuk disetujui / ACC, silang (❌) untuk ditolak.
        // Item yang lewat (atau warning) diganti simbolnya sesuai pilihan status user (default: ACC = ✅).
        const symbol = item.status === 'approved' ? '✅' : '❌';
        const bidderText = item.bidder ? `${item.bidder}${symbol}` : symbol;
        parts.push(bidderText);

        // 8. Keterangan/Catatan SELALU diletakkan di paling belakang baris (keterangan lewat tetap ada)
        if (cleanNotes) {
          const notesText = cleanNotes.replace(/⚠️/g, '').trim();
          if (notesText) {
            parts.push(notesText);
          }
        }

        lines.push(parts.join(' '));
      });
      lines.push(''); // Blank line between groups
    });

    return lines.join('\n').trim();
  }, [items, reportDate, groupedByPerson, feeCalculation]);

  // Copy result to clipboard
  const handleCopyText = () => {
    if (!generatedOutputText) return;
    navigator.clipboard.writeText(generatedOutputText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Filtered items for display
  const filteredGrouped = useMemo(() => {
    return groupedByPerson
      .map(([person, pItems]) => {
        const filtered = pItems.filter(item => {
          const matchesSearch =
            !searchQuery ||
            item.person.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.bidder.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase()));

          const matchesStatus =
            filterStatus === 'all' || item.status === filterStatus;

          return matchesSearch && matchesStatus;
        });
        return [person, filtered] as [string, ObtainedItem[]];
      })
      .filter(([_, pItems]) => pItems.length > 0);
  }, [groupedByPerson, searchQuery, filterStatus]);

  // Stats calculation
  const totalApproved = items.filter(it => it.status === 'approved').length;
  const totalRejected = items.filter(it => it.status === 'rejected').length;
  const totalItemsCount = items.length;

  // Dropdown state for extra options
  const [showMoreActions, setShowMoreActions] = useState(false);

  // Helper for initials & avatar background color
  const getAvatarStyle = (name: string) => {
    const colors = [
      'linear-gradient(135deg, #3b82f6, #1d4ed8)',
      'linear-gradient(135deg, #10b981, #047857)',
      'linear-gradient(135deg, #8b5cf6, #6d28d9)',
      'linear-gradient(135deg, #f59e0b, #b45309)',
      'linear-gradient(135deg, #ec4899, #be185d)',
      'linear-gradient(135deg, #06b6d4, #0e7490)'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const bg = colors[Math.abs(hash) % colors.length];
    const initial = (name.trim()[0] || 'U').toUpperCase();
    return { bg, initial };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      {/* 1. Integrated Header & Stat Bar - Sleek, Minimalist & Modern */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        border: '1px solid var(--line)',
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
      }}>
        {/* Top Row: Date Picker & Main Actions */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px'
        }}>
          {/* Left: Date Picker Pill & Live Save Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: '#f8fafc',
              border: '1px solid var(--line)',
              borderRadius: '8px',
              padding: '4px 10px',
              gap: '6px'
            }}>
              <span style={{ fontSize: '14px', color: '#64748b' }}>📅</span>
              <input
                type="text"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                onBlur={() => fetchData(reportDate)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--navy)',
                  padding: '2px 4px',
                  width: '155px',
                  outline: 'none'
                }}
                title="Tanggal Laporan"
              />
            </div>

            {saveStatus && (
              <span style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '3px 9px',
                borderRadius: '12px',
                background: saveStatus.includes('✅') || saveStatus.includes('✨') ? '#ecfdf5' : '#fffbeb',
                color: saveStatus.includes('✅') || saveStatus.includes('✨') ? '#059669' : '#d97706',
                border: `1px solid ${saveStatus.includes('✅') || saveStatus.includes('✨') ? '#a7f3d0' : '#fde68a'}`
              }}>
                {saveStatus}
              </span>
            )}
          </div>

          {/* Right: Core Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Main 1-Click Pull Button */}
            <button
              type="button"
              onClick={handleOpenImportBidding}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                color: 'white',
                border: 'none',
                borderRadius: '7px',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(2, 132, 199, 0.2)',
                transition: 'transform 0.1s ease'
              }}
              title="Tarik hasil rekonsiliasi terbaru dari menu Hasil Bidding"
            >
              <span>⚡</span>
              <span>Tarik Hasil Bidding</span>
            </button>

            {/* Kirim Gaji Button */}
            <button
              type="button"
              onClick={handleSendToSalary}
              disabled={sendingSalary || items.length === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: 'white',
                border: 'none',
                borderRadius: '7px',
                fontWeight: 700,
                fontSize: '12px',
                cursor: sendingSalary || items.length === 0 ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
              }}
              title="Simpan dan terbitkan ke menu Gaji"
            >
              <span>💸</span>
              <span>{sendingSalary ? 'Mengirim...' : 'Kirim Gaji'}</span>
            </button>

            {/* More Actions Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowMoreActions(!showMoreActions)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '7px 11px',
                  background: '#f8fafc',
                  color: '#475569',
                  border: '1px solid var(--line)',
                  borderRadius: '7px',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
                title="Opsi Tambahan"
              >
                ⚙️ Opsi
              </button>

              {showMoreActions && (
                <>
                  <div
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
                    onClick={() => setShowMoreActions(false)}
                  />
                  <div style={{
                    position: 'absolute',
                    right: 0,
                    top: '110%',
                    width: '180px',
                    background: 'white',
                    borderRadius: '10px',
                    border: '1px solid var(--line)',
                    boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
                    zIndex: 100,
                    padding: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}>
                    <button
                      type="button"
                      onClick={() => { setShowMoreActions(false); handleResetStatusAndFee(); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 10px',
                        background: 'transparent',
                        color: '#d97706',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 500,
                        textAlign: 'left',
                        cursor: 'pointer'
                      }}
                    >
                      <span>🔄</span> Reset Status & Fee
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowMoreActions(false); handleResetAllData(); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 10px',
                        background: 'transparent',
                        color: '#ef4444',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 500,
                        textAlign: 'left',
                        cursor: 'pointer'
                      }}
                    >
                      <span>🗑️</span> Kosongkan Data
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: '#f1f5f9', width: '100%' }} />

        {/* Bottom Row: Compact Metric Chips & Fee Summary */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px'
        }}>
          {/* Metrics */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px' }}>
              <span style={{ color: 'var(--muted)' }}>Total:</span>
              <strong style={{ color: 'var(--navy)' }}>{totalItemsCount} item</strong>
            </div>
            <div style={{ height: '12px', width: '1px', background: 'var(--line)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px' }}>
              <span style={{ color: '#059669' }}>Disetujui:</span>
              <strong style={{ color: '#059669' }}>{totalApproved}</strong>
            </div>
            <div style={{ height: '12px', width: '1px', background: 'var(--line)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px' }}>
              <span style={{ color: '#dc2626' }}>Ditolak:</span>
              <strong style={{ color: '#dc2626' }}>{totalRejected}</strong>
            </div>
            <div style={{ height: '12px', width: '1px', background: 'var(--line)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px' }}>
              <span style={{ color: 'var(--muted)' }}>PIC:</span>
              <strong style={{ color: '#7c3aed' }}>{groupedByPerson.length} orang</strong>
            </div>
          </div>

          {/* Fee Calculation */}
          {feeCalculation.formulaText ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#f8fafc',
              padding: '3px 8px',
              borderRadius: '6px',
              border: '1px solid var(--line)'
            }}>
              <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>Fee:</span>
              <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--navy)' }}>
                {feeCalculation.formulaText}
              </span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#0284c7' }}>
                {feeCalculation.totalText}
              </span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#059669', marginLeft: '3px' }}>
                (Rp {new Intl.NumberFormat('id-ID').format(feeCalculation.grandTotal * 1000)})
              </span>
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Belum ada fee diatur
            </div>
          )}
        </div>
      </div>

      {/* 3. Integrated Toolbar (Tabs, Search, Bulk Fee) - 1 Single Compact Row */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '10px'
      }}>
        {/* Left: View Tabs */}
        <div style={{ display: 'flex', background: '#e2e8f0', padding: '3px', borderRadius: '8px', gap: '2px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('cards')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'cards' ? 'white' : 'transparent',
              color: activeTab === 'cards' ? 'var(--navy)' : '#64748b',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: activeTab === 'cards' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            👥 Per PIC ({groupedByPerson.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'preview' ? 'white' : 'transparent',
              color: activeTab === 'preview' ? 'var(--navy)' : '#64748b',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: activeTab === 'preview' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            💬 Format Chat
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('table')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'table' ? 'white' : 'transparent',
              color: activeTab === 'table' ? 'var(--navy)' : '#64748b',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: activeTab === 'table' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            📊 Tabel Data
          </button>
        </div>

        {/* Right: Quick Search & Global Fee Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Quick Fee Rata Pills */}
          {items.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'white', padding: '3px 6px', borderRadius: '6px', border: '1px solid var(--line)' }}>
              <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, marginRight: '2px' }}>Fee Rata:</span>
              <button
                type="button"
                onClick={() => setAllFee('25')}
                style={{
                  padding: '3px 7px',
                  background: '#fffbeb',
                  color: '#b45309',
                  border: '1px solid #fde68a',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                title="Terapkan fee 25 untuk semua item non-owner"
              >
                25
              </button>
              <button
                type="button"
                onClick={() => setAllFee('50')}
                style={{
                  padding: '3px 7px',
                  background: '#f0fdf4',
                  color: '#15803d',
                  border: '1px solid #bbf7d0',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                title="Terapkan fee 50 untuk semua item non-owner"
              >
                50
              </button>
              <button
                type="button"
                onClick={() => setAllFee('75')}
                style={{
                  padding: '3px 7px',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                title="Terapkan fee 75 untuk semua item non-owner"
              >
                75
              </button>
              <button
                type="button"
                onClick={() => setAllFee('100')}
                style={{
                  padding: '3px 7px',
                  background: '#f5f3ff',
                  color: '#6d28d9',
                  border: '1px solid #ddd6fe',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                title="Terapkan fee 100 untuk semua item non-owner"
              >
                100
              </button>
            </div>
          )}

          {/* Search Box */}
          <input
            type="text"
            placeholder="🔍 Cari PIC / model / akun..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid var(--line)',
              fontSize: '12px',
              width: '180px',
              background: 'white'
            }}
          />

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e: any) => setFilterStatus(e.target.value)}
            style={{
              padding: '6px 8px',
              borderRadius: '6px',
              border: '1px solid var(--line)',
              fontSize: '12px',
              background: 'white',
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            <option value="all">Semua Status</option>
            <option value="approved">✅ Disetujui</option>
            <option value="rejected">❌ Ditolak</option>
          </select>
        </div>
      </div>

      {/* 4. Main Content Area */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', background: 'white', borderRadius: '12px', border: '1px solid var(--line)' }}>
          <p style={{ color: 'var(--muted)', margin: 0, fontSize: '13px' }}>Memuat data laporan...</p>
        </div>
      ) : items.length === 0 ? (
        /* Empty State */
        <div style={{
          padding: '48px 20px',
          textAlign: 'center',
          background: 'white',
          borderRadius: '12px',
          border: '1px dashed #cbd5e1'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', color: 'var(--navy)' }}>Belum Ada Data List Didapat</h3>
          <p style={{ color: 'var(--muted)', fontSize: '13px', maxWidth: '400px', margin: '0 auto 16px auto' }}>
            Tarik hasil bidding yang telah Anda proses atau tempel teks dari grup WhatsApp.
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={handleOpenImportBidding}
              style={{
                padding: '8px 16px',
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              ⚡ Tarik dari Hasil Bidding
            </button>
            <button
              type="button"
              onClick={() => setShowPasteModal(true)}
              style={{
                padding: '8px 16px',
                background: '#f1f5f9',
                color: '#334155',
                border: '1px solid var(--line)',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              📝 Tempel Teks
            </button>
          </div>
        </div>
      ) : activeTab === 'cards' ? (
        /* Streamlined PIC Cards View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredGrouped.map(([person, pItems]) => {
            const { bg, initial } = getAvatarStyle(person);
            const isOwner = isOwnerPerson(person);
            const approvedCount = pItems.filter(i => i.status === 'approved').length;

            return (
              <div
                key={person}
                style={{
                  background: 'white',
                  borderRadius: '10px',
                  border: '1px solid var(--line)',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}
              >
                {/* Clean PIC Header */}
                <div style={{
                  padding: '10px 16px',
                  background: '#f8fafc',
                  borderBottom: '1px solid var(--line)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}>
                  {/* Left: Avatar & Name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: bg,
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '12px',
                      flexShrink: 0
                    }}>
                      {initial}
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--navy)' }}>{person}</span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 7px',
                      borderRadius: '10px',
                      background: '#e2e8f0',
                      color: '#475569'
                    }}>
                      {pItems.length} item
                    </span>
                    {isOwner && (
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                        (Non-Fee)
                      </span>
                    )}
                  </div>

                  {/* Right: Quick Action Per PIC */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', marginRight: '4px' }}>
                      {approvedCount}/{pItems.length} ACC
                    </span>
                    {!isOwner && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = items.map(it => it.person === person ? { ...it, status: 'approved' as const } : it);
                            setItems(updated);
                            syncToDatabase(updated);
                          }}
                          style={{
                            padding: '3px 8px',
                            background: '#ecfdf5',
                            color: '#059669',
                            border: '1px solid #a7f3d0',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                          title={`Setujui semua barang ${person}`}
                        >
                          ACC Semua
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = items.map(it => it.person === person ? { ...it, status: 'rejected' as const } : it);
                            setItems(updated);
                            syncToDatabase(updated);
                          }}
                          style={{
                            padding: '3px 8px',
                            background: '#fef2f2',
                            color: '#dc2626',
                            border: '1px solid #fecaca',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                          title={`Tolak semua barang ${person}`}
                        >
                          Tolak Semua
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Streamlined Item Rows */}
                <div style={{ padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {pItems.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        background: item.status === 'approved' ? '#fcfdfc' : '#fff9f9',
                        border: `1px solid ${item.status === 'approved' ? '#e2f2e8' : '#fde8e8'}`,
                        borderRadius: '6px',
                        gap: '8px'
                      }}
                    >
                      {/* Left: Interactive Status Pill & Item Spec */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
                        {/* Status Toggle Pill */}
                        {isOwner ? (
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: item.status === 'approved' ? '#ecfdf5' : '#fef2f2',
                            color: item.status === 'approved' ? '#059669' : '#dc2626',
                            border: `1px solid ${item.status === 'approved' ? '#a7f3d0' : '#fecaca'}`
                          }}>
                            {item.status === 'approved' ? '✅ ACC' : '❌ Tolak'}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleItemStatus(item.id)}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              border: 'none',
                              background: item.status === 'approved' ? '#10b981' : '#ef4444',
                              color: 'white',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.08)'
                            }}
                            title="Klik untuk mengubah status ACC / Tolak"
                          >
                            {item.status === 'approved' ? '✅ ACC' : '❌ Tolak'}
                          </button>
                        )}

                        {/* Model & Specs */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--navy)' }}>
                            {item.model}
                          </span>
                          {item.storage && (
                            <span style={{ fontSize: '11px', background: '#eff6ff', color: '#1d4ed8', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                              {item.storage}GB
                            </span>
                          )}
                          {item.grade && (
                            <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                              {item.grade.toUpperCase()}
                            </span>
                          )}
                          {item.unit && (
                            <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600 }}>
                              ({item.unit})
                            </span>
                          )}
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginLeft: '4px' }}>
                            @{item.price}
                          </span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                            • {item.bidder || '-'}
                          </span>
                          {item.notes && (
                            <span style={{ fontSize: '11px', color: '#d97706', background: '#fffbeb', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                              {item.notes}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Fee Controls & Inline Notes */}
                      {!isOwner && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {/* Mini Fee Buttons */}
                          <div style={{ display: 'flex', gap: '2px' }}>
                            {['25', '50', '75', '100'].map((feeVal) => (
                              <button
                                key={feeVal}
                                type="button"
                                onClick={() => setItemFee(item.id, feeVal)}
                                style={{
                                  padding: '2px 6px',
                                  borderRadius: '3px',
                                  border: item.fee_info === feeVal ? '1px solid #0284c7' : '1px solid var(--line)',
                                  background: item.fee_info === feeVal ? '#0284c7' : 'white',
                                  color: item.fee_info === feeVal ? 'white' : '#64748b',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                {feeVal}
                              </button>
                            ))}
                          </div>

                          {/* Custom Fee Input */}
                          <input
                            type="text"
                            placeholder="Fee"
                            value={item.fee_info || ''}
                            onChange={(e) => updateItemField(item.id, 'fee_info', e.target.value)}
                            style={{
                              width: '46px',
                              padding: '2px 4px',
                              fontSize: '11px',
                              border: '1px solid var(--line)',
                              borderRadius: '4px',
                              textAlign: 'center'
                            }}
                            title="Keterangan Fee custom"
                          />

                          {/* Delete Item */}
                          <button
                            type="button"
                            onClick={() => deleteItem(item.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#cbd5e1',
                              cursor: 'pointer',
                              padding: '2px 4px',
                              fontSize: '12px'
                            }}
                            title="Hapus baris"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : activeTab === 'preview' ? (
        /* Clean Chat Preview */
        <div style={{
          background: 'white',
          borderRadius: '12px',
          border: '1px solid var(--line)',
          padding: '18px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--navy)' }}>
                Preview Format Chat WhatsApp / Telegram
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                Format siap copy-paste langsung ke grup kerja.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyText}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                background: copied ? '#10b981' : 'var(--blue)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              {copied ? '✅ Tersalin!' : '📋 Salin Teks'}
            </button>
          </div>

          <textarea
            readOnly
            value={generatedOutputText}
            rows={18}
            style={{
              width: '100%',
              fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: '12px',
              lineHeight: '1.6',
              padding: '14px',
              borderRadius: '8px',
              border: '1px solid var(--line)',
              background: '#f8fafc',
              color: '#1e293b',
              whiteSpace: 'pre-wrap',
              resize: 'vertical'
            }}
          />
        </div>
      ) : (
        /* Clean Data Table */
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--line)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--line)' }}>
              <tr>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Status</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>PIC</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Model</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Storage</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Grade</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Unit</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Harga</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Fee</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Akun</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Catatan</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', color: '#475569' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      background: item.status === 'approved' ? '#ecfdf5' : '#fef2f2',
                      color: item.status === 'approved' ? '#059669' : '#dc2626'
                    }}>
                      {item.status === 'approved' ? '✅ ACC' : '❌ Tolak'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--navy)' }}>{item.person}</td>
                  <td style={{ padding: '8px 12px' }}>{item.model}</td>
                  <td style={{ padding: '8px 12px' }}>{item.storage ? `${item.storage}GB` : '-'}</td>
                  <td style={{ padding: '8px 12px' }}>{item.grade ? item.grade.toUpperCase() : '-'}</td>
                  <td style={{ padding: '8px 12px' }}>({item.unit})</td>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>@{item.price}</td>
                  <td style={{ padding: '8px 12px', color: '#0284c7', fontWeight: 600 }}>{item.fee_info ? `(${item.fee_info})` : '-'}</td>
                  <td style={{ padding: '8px 12px' }}>{item.bidder}</td>
                  <td style={{ padding: '8px 12px', color: '#d97706' }}>{item.notes || '-'}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    {!isOwnerPerson(item.person) && (
                      <button
                        type="button"
                        onClick={() => deleteItem(item.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                      >
                        🗑️
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals: Paste, Add, Import Bidding */}
      {showPasteModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px'
        }}>
          <div style={{
            background: 'white', borderRadius: '12px', padding: '20px',
            width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '14px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--navy)', fontWeight: 700 }}>
                Tempel Teks List Didapat
              </h3>
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#94a3b8' }}
              >
                ✕
              </button>
            </div>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`Contoh:\nEnb tgl 20/08/ 2026\n\nMenik\nFold 4 256 ad (1) @6707 menik✅\n\nRuzi\nfold 3 256 ag (1) @4364 (100) Mubdi✅`}
              rows={10}
              style={{
                width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--line)',
                fontFamily: 'monospace', fontSize: '12px', resize: 'vertical'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="secondary-button"
                style={{ padding: '6px 14px', fontSize: '12px' }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleParseText(pasteText)}
                disabled={!pasteText.trim()}
                style={{
                  padding: '6px 16px', background: 'var(--blue)', color: 'white',
                  border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '12px', cursor: 'pointer'
                }}
              >
                Proses & Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px'
        }}>
          <div style={{
            background: 'white', borderRadius: '12px', padding: '20px',
            width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '12px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--navy)', fontWeight: 700 }}>
                Tambah Item Manual
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#94a3b8' }}
              >
                ✕
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>Nama PIC</label>
                <input
                  type="text"
                  value={newItem.person || ''}
                  onChange={(e) => setNewItem({ ...newItem, person: e.target.value })}
                  placeholder="Contoh: Ruzi"
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '12px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>Model</label>
                <input
                  type="text"
                  value={newItem.model || ''}
                  onChange={(e) => setNewItem({ ...newItem, model: e.target.value })}
                  placeholder="Contoh: Fold 4"
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '12px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>Storage (GB)</label>
                <input
                  type="text"
                  value={newItem.storage || ''}
                  onChange={(e) => setNewItem({ ...newItem, storage: e.target.value })}
                  placeholder="256"
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '12px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>Grade</label>
                <input
                  type="text"
                  value={newItem.grade || ''}
                  onChange={(e) => setNewItem({ ...newItem, grade: e.target.value })}
                  placeholder="ad"
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '12px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>Harga (@)</label>
                <input
                  type="text"
                  value={newItem.price || ''}
                  onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                  placeholder="6707"
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '12px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>Fee (rb)</label>
                <input
                  type="text"
                  value={newItem.fee_info || ''}
                  onChange={(e) => setNewItem({ ...newItem, fee_info: e.target.value })}
                  placeholder="25, 50, 75, 100"
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '12px' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="secondary-button"
                style={{ padding: '6px 14px', fontSize: '12px' }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAddNewItem}
                style={{
                  padding: '6px 16px', background: 'var(--blue)', color: 'white',
                  border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '12px', cursor: 'pointer'
                }}
              >
                Simpan Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Import Bidding */}
      {showImportBiddingModal && biddingSnapshot && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1100, padding: '20px'
        }}>
          <div style={{
            background: 'white', borderRadius: '12px', width: '100%', maxWidth: '640px',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', border: '1px solid var(--line)'
          }}>
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid var(--line)', background: '#f0f9ff',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#0369a1', fontWeight: 700 }}>
                  ⚡ Tarik Data Hasil Bidding
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#0284c7' }}>
                  Snapshot: {biddingSnapshot.reportDate} ({biddingSnapshot.items.length} item)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowImportBiddingModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#0369a1' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--line)', fontSize: '12px' }}>
                <span style={{ fontWeight: 600, color: 'var(--navy)' }}>Mode Import: </span>
                <span style={{ color: '#059669', fontWeight: 600 }}>Ganti Semua (Replace Bersih)</span>
                <span style={{ color: 'var(--muted)', marginLeft: '6px' }}>— Mengganti list tanggal ini persis sesuai hasil bidding.</span>
              </div>

              <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--line)', borderRadius: '6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, borderBottom: '1px solid var(--line)' }}>
                    <tr>
                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>No</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>PIC</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>Model & Storage</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>Grade</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>Harga</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {biddingSnapshot.items.map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '5px 10px', color: '#94a3b8' }}>{idx + 1}</td>
                        <td style={{ padding: '5px 10px', fontWeight: 600, color: 'var(--navy)' }}>{it.person}</td>
                        <td style={{ padding: '5px 10px' }}>{it.model} {it.storage ? `${it.storage}GB` : ''}</td>
                        <td style={{ padding: '5px 10px' }}>{it.grade ? it.grade.toUpperCase() : '-'}</td>
                        <td style={{ padding: '5px 10px', fontWeight: 600 }}>@{it.price}</td>
                        <td style={{ padding: '5px 10px', color: '#0284c7' }}>{it.fee_info ? `(${it.fee_info})` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--line)', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowImportBiddingModal(false)}
                className="secondary-button"
                style={{ padding: '6px 14px', fontSize: '12px' }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteImportBidding}
                style={{
                  padding: '6px 18px', background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  color: 'white', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '12px', cursor: 'pointer'
                }}
              >
                Konfirmasi Tarik ({biddingSnapshot.items.length} Item)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

