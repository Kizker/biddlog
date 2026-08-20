import React, { useEffect, useState, useMemo } from 'react';
import { getFastCache, setFastCache } from '../utils/fastCache';

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

  // 2. Notes (e.g. lewat 22, cadangan, bonus)
  let notes = '';
  const notesMatch = raw.match(/(lewat\s+\d+|cadangan|bonus|pending)/i);
  if (notesMatch) {
    notes = notesMatch[0];
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

  // 6. Grade (2 letters like ad, ae, af, ag, ah, ai, ab, ac)
  let grade = '';
  const gradeMatch = raw.match(/\b(a[a-z]|b[a-z]|c[a-z])\b/i);
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
  if (notes) modelClean = modelClean.replace(new RegExp(notes, 'gi'), ' ');
  if (storage) modelClean = modelClean.replace(new RegExp(`\\b${storage}\\b`, 'g'), ' ');
  if (grade) modelClean = modelClean.replace(new RegExp(`\\b${grade}\\b`, 'gi'), ' ');
  if (price) modelClean = modelClean.replace(new RegExp(`@?${price}`, 'g'), ' ');
  modelClean = modelClean.replace(/\(\d+\)/g, ' ');
  modelClean = modelClean.replace(/\blewat\b/gi, ' ');
  modelClean = modelClean.replace(/\s+/g, ' ').trim();

  if (!modelClean) modelClean = 'Item';

  return {
    id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    person: person || 'Umum',
    model: modelClean,
    storage,
    grade,
    unit,
    price: price || 0,
    fee_info,
    bidder: bidder || 'mubdi',
    status,
    notes,
    raw_line: rawLine
  };
};

export default function LaporanListDapat({ onNavigateToHasilBidding }: { onNavigateToHasilBidding?: () => void }) {
  // Read instant cache for 0ms initial render
  const cachedObtained = useMemo(() => getFastCache<any>('obtained_data'), []);
  const cachedDates = useMemo(() => getFastCache<any>('obtained_dates'), []);

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
      return cachedObtained.data.map((row: any) => ({
        id: row.id,
        person: row.person || row.username || 'Umum',
        model: row.model || '',
        storage: row.storage ? String(row.storage) : '',
        grade: row.grade || '',
        unit: row.unit || 1,
        price: row.obtained_price || 0,
        fee_info: row.fee_info || '',
        bidder: row.bidder || '',
        status: (row.status === 'rejected' ? 'rejected' : 'approved') as 'approved' | 'rejected',
        notes: row.notes || '',
        report_date: row.report_date || '',
        raw_line: row.raw_line || ''
      }));
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
  const [availableDates, setAvailableDates] = useState<{ report_date: string; item_count: number }[]>(() => cachedDates?.data || []);

  // Import from Bidding State
  const [showImportBiddingModal, setShowImportBiddingModal] = useState<boolean>(false);
  const [biddingSnapshot, setBiddingSnapshot] = useState<{
    reportDate: string;
    items: ObtainedItem[];
    rawText: string;
    timestamp: number;
  } | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');

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

  // Fetch available dates for history dropdown
  const fetchAvailableDates = async () => {
    try {
      const res = await fetch('/api/obtained.php?action=get_dates');
      const json = await res.json();
      if (json.status === 'success' && Array.isArray(json.data)) {
        setFastCache('obtained_dates', json);
        setAvailableDates(json.data);
      }
    } catch (e) {
      console.error(e);
    }
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
          const loaded: ObtainedItem[] = json.data.map((row: any) => ({
            id: row.id,
            person: row.person || row.username || 'Umum',
            model: row.model || '',
            storage: row.storage ? String(row.storage) : '',
            grade: row.grade || '',
            unit: row.unit || 1,
            price: row.obtained_price || 0,
            fee_info: row.fee_info || '',
            bidder: row.bidder || '',
            status: (row.status === 'rejected' ? 'rejected' : 'approved') as 'approved' | 'rejected',
            notes: row.notes || '',
            report_date: row.report_date || dateToFetch,
            raw_line: row.raw_line || ''
          }));
          setItems(loaded);
          if (json.report_date && !targetDate) {
            setReportDate(json.report_date);
          }
        } else if (json.is_latest && json.data.length === 0) {
          setItems([]);
        } else {
          setItems([]);
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
    fetchAvailableDates();
  }, []);

  // Sync to database with safe date normalization
  const syncToDatabase = async (currentItems: ObtainedItem[], customDate?: string) => {
    setSaveStatus('Menyimpan...');
    const syncDate = customDate || reportDate;
    try {
      const payload = {
        action: 'sync_all',
        report_date: syncDate,
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
        fetchAvailableDates();
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

  // Execute Import from Bidding
  const handleExecuteImportBidding = async () => {
    if (!biddingSnapshot || !biddingSnapshot.items) return;

    let newItems: ObtainedItem[] = [];
    if (importMode === 'replace') {
      newItems = biddingSnapshot.items.map(it => ({
        ...it,
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)
      }));
    } else {
      // Append mode - avoid duplicates based on person, model, storage, grade, price, bidder
      const existingKeys = new Set(
        items.map(it => `${(it.person || '').toLowerCase()}_${(it.model || '').toLowerCase()}_${it.storage}_${it.grade}_${it.price}_${it.bidder}`)
      );
      const uniqueToAppend = biddingSnapshot.items
        .filter(it => !existingKeys.has(`${(it.person || '').toLowerCase()}_${(it.model || '').toLowerCase()}_${it.storage}_${it.grade}_${it.price}_${it.bidder}`))
        .map(it => ({
          ...it,
          id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)
        }));
      newItems = [...items, ...uniqueToAppend];
    }

    const finalDate = biddingSnapshot.reportDate || reportDate;
    setReportDate(finalDate);
    setItems(newItems);
    await syncToDatabase(newItems, finalDate);
    setShowImportBiddingModal(false);
    setSaveStatus(`Berhasil mengimpor ${biddingSnapshot.items.length} item dari Hasil Bidding! ✨`);
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
    if (!window.confirm('Apakah Anda yakin ingin menghapus SEMUA data list didapat? Tindakan ini akan mengosongkan list.')) return;
    setItems([]);
    localStorage.removeItem('obtained_list_data');
    try {
      await fetch('/api/obtained.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_date', date: new Date().toISOString().split('T')[0] })
      });
      setSaveStatus('Data berhasil di-reset 🗑️');
      setTimeout(() => setSaveStatus(''), 2500);
    } catch (e) {
      console.error(e);
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
        // Model
        parts.push(item.model);
        // Storage
        if (item.storage) parts.push(String(item.storage));
        // Grade
        if (item.grade) parts.push(item.grade);
        // Unit
        if (item.unit) parts.push(`(${item.unit})`);
        // Price
        if (item.price) parts.push(`@${item.price}`);
        // Fee keterangan, e.g. (100) or (75) or (50)
        if (item.fee_info && item.fee_info.trim()) {
          const feeClean = item.fee_info.replace(/[()]/g, '').trim();
          parts.push(`(${feeClean})`);
        }
        // Bidder + Status Symbol (✅ or ❌)
        const symbol = item.status === 'approved' ? '✅' : '❌';
        const bidderText = item.bidder ? `${item.bidder}${symbol}` : symbol;
        parts.push(bidderText);

        // Notes (e.g. lewat 22, cadangan)
        if (item.notes && item.notes.trim()) {
          parts.push(item.notes.trim());
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header & Summary Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'white',
        padding: '16px 20px',
        borderRadius: '12px',
        border: '1px solid var(--line)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--navy)' }}>Laporan List Didapat</h2>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="text"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                onBlur={() => fetchData(reportDate)}
                style={{
                  padding: '4px 10px',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: '1px solid var(--line)',
                  borderRadius: '6px',
                  color: 'var(--blue)',
                  background: '#f0f9ff'
                }}
                title="Klik untuk mengubah tanggal header"
              />

              {availableDates.length > 0 && (
                <select
                  value={availableDates.some(d => d.report_date === reportDate) ? reportDate : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setReportDate(e.target.value);
                      fetchData(e.target.value);
                    }
                  }}
                  style={{
                    padding: '4px 8px',
                    fontSize: '12px',
                    fontWeight: 500,
                    border: '1px solid var(--line)',
                    borderRadius: '6px',
                    color: '#475569',
                    background: '#f8fafc',
                    cursor: 'pointer'
                  }}
                  title="Pilih tanggal dari riwayat database"
                >
                  <option value="">📅 Pilih Riwayat Tanggal...</option>
                  {availableDates.map(d => (
                    <option key={d.report_date} value={d.report_date}>
                      {d.report_date} ({d.item_count} item)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {saveStatus && (
              <span style={{ fontSize: '12px', fontWeight: 600, color: saveStatus.includes('✅') || saveStatus.includes('✨') ? '#10b981' : '#f59e0b' }}>
                {saveStatus}
              </span>
            )}
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--muted)' }}>
            Kelola persetujuan barang didapat (✅ / ❌), keterangan fee, dan ekspor format chat.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          {/* Main Non-Copy-Paste Option: Tarik dari Hasil Bidding */}
          <button
            type="button"
            onClick={handleOpenImportBidding}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(2,132,199,0.25)',
              transition: 'all 0.2s'
            }}
            title="Import langsung hasil rekonsiliasi yang sudah diproses di Hasil Bidding tanpa copy-paste"
          >
            <span style={{ fontSize: '14px' }}>⚡</span>
            Tarik Hasil Bidding
          </button>

          <button
            type="button"
            onClick={handleCopyText}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              background: copied ? '#10b981' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(37,99,235,0.2)',
              transition: 'all 0.2s'
            }}
          >
            {copied ? (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Tersalin!
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Salin Chat
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowPasteModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '8px 12px',
              background: '#f8fafc',
              color: '#334155',
              border: '1px solid var(--line)',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
            Paste Teks
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '8px 12px',
              background: '#f8fafc',
              color: '#334155',
              border: '1px solid var(--line)',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Tambah
          </button>

          <button
            type="button"
            onClick={handleCleanDuplicates}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '8px 12px',
              background: '#fffbeb',
              color: '#b45309',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer'
            }}
            title="Bersihkan baris duplikat identik"
          >
            <span>🧹</span> Bersihkan Duplikat
          </button>

          <button
            type="button"
            onClick={() => syncToDatabase(items)}
            style={{
              padding: '8px 12px',
              background: '#ecfdf5',
              color: '#059669',
              border: '1px solid #a7f3d0',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer'
            }}
            title="Simpan perubahan ke database"
          >
            Simpan DB
          </button>

          <button
            type="button"
            onClick={handleSendToSalary}
            disabled={sendingSalary}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '8px 14px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: sendingSalary ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)',
              transition: 'all 0.2s'
            }}
            title="Simpan dan kirim data gaji hari ini ke menu Gaji"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            {sendingSalary ? 'Mengirim...' : '💸 Kirim Gaji'}
          </button>
        </div>
      </div>

      {/* Metrics Bar & Search / Filter */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <div style={{ background: 'white', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>Total Barang Didapat</div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--navy)', marginTop: '2px' }}>{totalItemsCount} item</div>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue)' }}>
            📦
          </div>
        </div>

        <div style={{ background: 'white', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>Disetujui (✅)</div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#10b981', marginTop: '2px' }}>{totalApproved} item</div>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
            ✅
          </div>
        </div>

        <div style={{ background: 'white', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>Ditolak (❌)</div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#ef4444', marginTop: '2px' }}>{totalRejected} item</div>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
            ❌
          </div>
        </div>

        <div style={{ background: 'white', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>Jumlah PIC / Anggota</div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#8b5cf6', marginTop: '2px' }}>{groupedByPerson.length} orang</div>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
            👥
          </div>
        </div>
      </div>

      {/* Fee Calculation Summary Card in View - Clean, Simple, Uniform */}
      {feeCalculation.formulaText && (
        <div style={{
          background: 'white',
          padding: '14px 20px',
          borderRadius: '10px',
          border: '1px solid var(--line)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--blue)',
              fontSize: '18px',
              flexShrink: 0
            }}>
              🧮
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>Total Perhitungan Fee</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '18px', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--navy)' }}>
                  {feeCalculation.formulaText}
                </span>
                <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--blue)' }}>
                  {feeCalculation.totalText}
                </span>
              </div>
            </div>
          </div>

          <div style={{
            background: '#f8fafc',
            border: '1px solid var(--line)',
            padding: '8px 16px',
            borderRadius: '8px',
            textAlign: 'right'
          }}>
            <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>Total Nominal Fee</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#10b981', marginTop: '1px' }}>
              Rp {new Intl.NumberFormat('id-ID').format(feeCalculation.grandTotal * 1000)}
            </div>
          </div>
        </div>
      )}

      {/* View Switcher & Filters */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Tab Controls */}
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px', gap: '4px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('cards')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'cards' ? 'white' : 'transparent',
              color: activeTab === 'cards' ? 'var(--navy)' : 'var(--muted)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: activeTab === 'cards' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            📋 Kelola Per PIC
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'preview' ? 'white' : 'transparent',
              color: activeTab === 'preview' ? 'var(--navy)' : 'var(--muted)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: activeTab === 'preview' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            Preview Format Chat
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('table')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'table' ? 'white' : 'transparent',
              color: activeTab === 'table' ? 'var(--navy)' : 'var(--muted)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: activeTab === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            📊 Tabel Data
          </button>
        </div>

        {/* Filter & Search */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Cari PIC, model, atau akun..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: '6px',
              border: '1px solid var(--line)',
              fontSize: '13px',
              width: '220px'
            }}
          />

          <select
            value={filterStatus}
            onChange={(e: any) => setFilterStatus(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: '6px',
              border: '1px solid var(--line)',
              fontSize: '13px',
              background: 'white'
            }}
          >
            <option value="all">Semua Status</option>
            <option value="approved">Hanya Disetujui (✅)</option>
            <option value="rejected">Hanya Ditolak (❌)</option>
          </select>

          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setAllStatus('approved')}
              style={{
                padding: '6px 10px',
                background: '#ecfdf5',
                color: '#059669',
                border: '1px solid #a7f3d0',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
              title="Setujui semua item"
            >
              ✅ ACC Semua
            </button>
            <button
              type="button"
              onClick={() => setAllStatus('rejected')}
              style={{
                padding: '6px 10px',
                background: '#fef2f2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
              title="Tolak semua item"
            >
              ❌ Tolak Semua
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Fee & Reset Toolbar */}
      {items.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f8fafc',
          padding: '12px 16px',
          borderRadius: '10px',
          border: '1px solid var(--line)',
          gap: '12px'
        }}>
          {/* Quick Bulk Fee Group */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              💰 Fee Rata:
            </span>
            <button
              type="button"
              onClick={() => setAllFee('50')}
              style={{
                padding: '5px 11px',
                background: 'white',
                color: '#2563eb',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
              }}
              title="Set fee (50) untuk semua anggota"
            >
              (50) 50rb
            </button>
            <button
              type="button"
              onClick={() => setAllFee('75')}
              style={{
                padding: '5px 11px',
                background: 'white',
                color: '#2563eb',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
              }}
              title="Set fee (75) untuk semua anggota"
            >
              (75) 75rb
            </button>
            <button
              type="button"
              onClick={() => setAllFee('100')}
              style={{
                padding: '5px 11px',
                background: 'white',
                color: '#2563eb',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
              }}
              title="Set fee (100) untuk semua anggota"
            >
              (100) 100rb
            </button>
            <button
              type="button"
              onClick={() => setAllFee('')}
              style={{
                padding: '5px 10px',
                background: 'white',
                color: '#64748b',
                border: '1px solid var(--line)',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
              title="Hapus keterangan fee dari seluruh barang"
            >
              ✕ Kosongkan Fee
            </button>
          </div>

          {/* Reset Buttons Group */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleResetStatusAndFee}
              style={{
                padding: '5px 12px',
                background: '#fffbeb',
                color: '#d97706',
                border: '1px solid #fde68a',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Reset status ke ACC dan bersihkan fee tanpa menghapus data"
            >
              🔄 Reset Status & Fee
            </button>
            <button
              type="button"
              onClick={handleResetAllData}
              style={{
                padding: '5px 12px',
                background: '#fef2f2',
                color: '#ef4444',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Hapus dan kosongkan seluruh list data"
            >
              🗑️ Reset / Hapus Semua Data
            </button>
          </div>
        </div>
      )}

      {/* Main Content Areas */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', background: 'white', borderRadius: '12px' }}>
          <p style={{ color: 'var(--muted)' }}>Memuat data laporan list didapat...</p>
        </div>
      ) : items.length === 0 ? (
        <div style={{
          padding: '50px 20px',
          textAlign: 'center',
          background: 'white',
          borderRadius: '12px',
          border: '1px solid var(--line)'
        }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>📋</div>
          <h3 style={{ margin: '0 0 8px 0', color: 'var(--navy)' }}>Belum Ada Data List Didapat</h3>
          <p style={{ color: 'var(--muted)', fontSize: '13px', maxWidth: '450px', margin: '0 auto 16px auto' }}>
            Anda dapat menempelkan teks format dari chat WhatsApp / Telegram atau memasukkan hasil bidding secara otomatis.
          </p>
          <button
            type="button"
            onClick={() => setShowPasteModal(true)}
            className="secondary-button"
            style={{ padding: '8px 18px', fontWeight: 'bold' }}
          >
            Tempel Teks Sekarang
          </button>
        </div>
      ) : activeTab === 'cards' ? (
        /* Grouped Cards View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredGrouped.map(([person, pItems]) => (
            <div
              key={person}
              style={{
                background: 'white',
                borderRadius: '10px',
                border: '1px solid var(--line)',
                overflow: 'hidden',
                boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
              }}
            >
              {/* Group Header */}
              <div style={{
                padding: '12px 18px',
                background: '#f8fafc',
                borderBottom: '1px solid var(--line)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '15px', color: 'var(--navy)' }}>{person}</span>
                  <span style={{ fontSize: '12px', color: 'var(--muted)', background: '#e2e8f0', padding: '2px 8px', borderRadius: '10px' }}>
                    {pItems.length} barang
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  {pItems.filter(i => i.status === 'approved').length} Disetujui (✅) • {pItems.filter(i => i.status === 'rejected').length} Ditolak (❌)
                </div>
              </div>

              {/* Items in Group */}
              <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {pItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: item.status === 'approved' ? '#f0fdf4' : '#fef2f2',
                      border: `1px solid ${item.status === 'approved' ? '#bbf7d0' : '#fecaca'}`,
                      borderRadius: '8px',
                      gap: '10px'
                    }}
                  >
                    {/* Item Details */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
                      {/* Status: Button for members, Read-only badge for Owners */}
                      {isOwnerPerson(person) ? (
                        <span
                          style={{
                            background: item.status === 'approved' ? '#ecfdf5' : '#fef2f2',
                            color: item.status === 'approved' ? '#059669' : '#dc2626',
                            border: `1px solid ${item.status === 'approved' ? '#a7f3d0' : '#fecaca'}`,
                            borderRadius: '6px',
                            padding: '5px 9px',
                            fontWeight: 'bold',
                            fontSize: '12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {item.status === 'approved' ? '✅ ACC' : '❌ Tolak'}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleItemStatus(item.id)}
                          style={{
                            background: item.status === 'approved' ? '#10b981' : '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                          }}
                          title="Klik untuk mengubah status ACC / Tolak"
                        >
                          {item.status === 'approved' ? '✅ ACC' : '❌ Tolak'}
                        </button>
                      )}

                      {/* Main Spec */}
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--navy)' }}>
                          {item.model} {item.storage ? `${item.storage}GB` : ''} {item.grade.toUpperCase()}
                          {item.unit && <span style={{ color: 'var(--blue)', marginLeft: '6px' }}>({item.unit})</span>}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', gap: '8px', marginTop: '2px' }}>
                          <span>Harga: <strong>@{item.price}</strong></span>
                          <span>•</span>
                          <span>Akun: <strong>{item.bidder || '-'}</strong></span>
                          {item.notes && (
                            <>
                              <span>•</span>
                              <span style={{ color: '#d97706', fontWeight: 600 }}>{item.notes}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Fee Buttons & Editing: Suppressed for Owners */}
                    {isOwnerPerson(person) ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '3px 9px', borderRadius: '4px', border: '1px solid #e2e8f0', fontWeight: 600 }}>
                          🔒 Read Only
                        </span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>Fee:</span>
                        {['50', '75', '100'].map((feeVal) => (
                          <button
                            key={feeVal}
                            type="button"
                            onClick={() => setItemFee(item.id, feeVal)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: item.fee_info === feeVal ? '1px solid #3b82f6' : '1px solid var(--line)',
                              background: item.fee_info === feeVal ? '#3b82f6' : 'white',
                              color: item.fee_info === feeVal ? 'white' : '#475569',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            ({feeVal})
                          </button>
                        ))}

                        <input
                          type="text"
                          placeholder="Fee custom"
                          value={item.fee_info || ''}
                          onChange={(e) => updateItemField(item.id, 'fee_info', e.target.value)}
                          style={{
                            width: '75px',
                            padding: '4px 6px',
                            fontSize: '11px',
                            border: '1px solid var(--line)',
                            borderRadius: '4px'
                          }}
                          title="Keterangan Fee (misal: 50, 100, 150)"
                        />

                        <input
                          type="text"
                          placeholder="Catatan..."
                          value={item.notes || ''}
                          onChange={(e) => updateItemField(item.id, 'notes', e.target.value)}
                          style={{
                            width: '100px',
                            padding: '4px 6px',
                            fontSize: '11px',
                            border: '1px solid var(--line)',
                            borderRadius: '4px'
                          }}
                          title="Catatan khusus (misal: lewat 12, cadangan)"
                        />

                        <button
                          type="button"
                          onClick={() => deleteItem(item.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: '4px',
                            fontSize: '14px'
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
          ))}
        </div>
      ) : activeTab === 'preview' ? (
        /* Live Chat Preview Mode */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            border: '1px solid var(--line)',
            padding: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--navy)' }}>Preview Format Chat WhatsApp / Telegram</h3>
              <button
                type="button"
                onClick={handleCopyText}
                className="secondary-button"
                style={{ fontSize: '12px', padding: '6px 12px' }}
              >
                {copied ? 'Tersalin!' : 'Salin Teks'}
              </button>
            </div>

            <textarea
              readOnly
              value={generatedOutputText}
              rows={22}
              style={{
                width: '100%',
                fontFamily: 'monospace',
                fontSize: '13px',
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

          <div style={{
            background: '#f0fdf4',
            borderRadius: '12px',
            border: '1px solid #bbf7d0',
            padding: '20px',
            height: 'fit-content'
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#166534' }}>💡 Panduan Format Output</h4>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#14532d', lineHeight: '1.6' }}>
              <li><strong>✅ Simbol Hijau:</strong> Menandakan barang telah <strong>disetujui (ACC)</strong>.</li>
              <li><strong>❌ Simbol Merah:</strong> Menandakan barang <strong>ditolak</strong> (misal karena harga lewat terlalu tinggi).</li>
              <li><strong>(50), (75), (100):</strong> Keterangan fee / bonus yang didapat (misal 50rb ditulis <code>(50)</code>).</li>
              <li><strong>lewat XX:</strong> Catatan selisih harga jika melewati batas bidding.</li>
              <li>Format output sudah dikelompokkan rapi per PIC / nama orang sehingga siap langsung di-paste ke grup WhatsApp.</li>
            </ul>
          </div>
        </div>
      ) : (
        /* Full Data Table Mode */
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--line)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--line)' }}>
              <tr>
                <th style={{ padding: '12px', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Nama PIC</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Model Barang</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Storage</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Grade</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Unit</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Harga (@)</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Fee</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Akun / Bidder</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Catatan</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '10px 12px' }}>
                    {isOwnerPerson(item.person) ? (
                      <span
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          background: item.status === 'approved' ? '#ecfdf5' : '#fef2f2',
                          color: item.status === 'approved' ? '#059669' : '#dc2626',
                          border: `1px solid ${item.status === 'approved' ? '#a7f3d0' : '#fecaca'}`,
                          fontWeight: 'bold',
                          fontSize: '11px',
                          display: 'inline-block'
                        }}
                      >
                        {item.status === 'approved' ? '✅ ACC' : '❌ Tolak'}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleItemStatus(item.id)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: 'none',
                          background: item.status === 'approved' ? '#10b981' : '#ef4444',
                          color: 'white',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                      >
                        {item.status === 'approved' ? '✅ ACC' : '❌ Tolak'}
                      </button>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 'bold' }}>{item.person}</td>
                  <td style={{ padding: '10px 12px' }}>{item.model}</td>
                  <td style={{ padding: '10px 12px' }}>{item.storage ? `${item.storage}GB` : '-'}</td>
                  <td style={{ padding: '10px 12px' }}>{item.grade.toUpperCase() || '-'}</td>
                  <td style={{ padding: '10px 12px' }}>({item.unit})</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>@{item.price}</td>
                  <td style={{ padding: '10px 12px', color: '#2563eb', fontWeight: 600 }}>{item.fee_info ? `(${item.fee_info})` : '-'}</td>
                  <td style={{ padding: '10px 12px' }}>{item.bidder}</td>
                  <td style={{ padding: '10px 12px', color: '#d97706' }}>{item.notes || '-'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    {isOwnerPerson(item.person) ? (
                      <span style={{ color: '#cbd5e1', fontSize: '12px' }}>—</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => deleteItem(item.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
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

      {/* Paste Raw Text Modal */}
      {showPasteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            width: '100%',
            maxWidth: '650px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: 'var(--navy)' }}>Tempel / Import Teks List Didapat</h3>
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
              Tempelkan teks list barang didapat (misal dari chat grup WhatsApp). Sistem akan secara cerdas mengenali nama PIC, model, storage, grade, harga, fee, akun, dan status.
            </p>

            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`Contoh:\nEnb tgl 19/08/ 2026\n\nMenik\nFold 4 256 ad (1) @6707 menik✅\nS25u 256 ad (1) @12922 mubdi⚠️ lewat 22\n\nRuzi\nfold 3 256 ag (1) @4364 (100) Mubdi✅`}
              rows={12}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                fontFamily: 'monospace',
                fontSize: '13px',
                resize: 'vertical'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="secondary-button"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleParseText(pasteText)}
                disabled={!pasteText.trim()}
                style={{
                  padding: '8px 18px',
                  background: 'var(--blue)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Import & Parse Teks
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            width: '100%',
            maxWidth: '520px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: 'var(--navy)' }}>Tambah Item Didapat</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Nama PIC</label>
                <input
                  type="text"
                  value={newItem.person || ''}
                  onChange={(e) => setNewItem({ ...newItem, person: e.target.value })}
                  placeholder="Contoh: Menik"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Model</label>
                <input
                  type="text"
                  value={newItem.model || ''}
                  onChange={(e) => setNewItem({ ...newItem, model: e.target.value })}
                  placeholder="Contoh: Fold 4"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Storage (GB)</label>
                <input
                  type="text"
                  value={newItem.storage || ''}
                  onChange={(e) => setNewItem({ ...newItem, storage: e.target.value })}
                  placeholder="Contoh: 256"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Grade</label>
                <input
                  type="text"
                  value={newItem.grade || ''}
                  onChange={(e) => setNewItem({ ...newItem, grade: e.target.value })}
                  placeholder="Contoh: ad"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Harga (@)</label>
                <input
                  type="text"
                  value={newItem.price || ''}
                  onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                  placeholder="Contoh: 6707"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Fee Keterangan</label>
                <input
                  type="text"
                  value={newItem.fee_info || ''}
                  onChange={(e) => setNewItem({ ...newItem, fee_info: e.target.value })}
                  placeholder="Contoh: 100 atau 75"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Akun Bidder</label>
                <input
                  type="text"
                  value={newItem.bidder || ''}
                  onChange={(e) => setNewItem({ ...newItem, bidder: e.target.value })}
                  placeholder="Contoh: mubdi"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Status</label>
                <select
                  value={newItem.status || 'approved'}
                  onChange={(e: any) => setNewItem({ ...newItem, status: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                >
                  <option value="approved">✅ Disetujui (ACC)</option>
                  <option value="rejected">❌ Ditolak</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Catatan</label>
              <input
                type="text"
                value={newItem.notes || ''}
                onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                placeholder="Contoh: lewat 22 atau cadangan"
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--line)' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="secondary-button"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAddNewItem}
                style={{
                  padding: '8px 18px',
                  background: 'var(--blue)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Simpan Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Directly from Hasil Bidding Modal (Non-Copy-Paste Option) */}
      {showImportBiddingModal && biddingSnapshot && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--line)',
              background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>⚡</span>
                  <h3 style={{ margin: 0, fontSize: '17px', color: '#0369a1', fontWeight: 700 }}>
                    Tarik Data dari Hasil Bidding
                  </h3>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#0284c7' }}>
                  Snapshot rekonsiliasi terbaru ({biddingSnapshot.reportDate}) — {biddingSnapshot.items.length} item siap diimpor tanpa copy-paste.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowImportBiddingModal(false)}
                style={{
                  background: 'white',
                  border: '1px solid #bae6fd',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '15px',
                  cursor: 'pointer',
                  color: '#0369a1'
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Mode Selection */}
              <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: '1px solid var(--line)' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: '8px' }}>
                  Pilih Mode Import:
                </label>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                    />
                    <span>
                      <strong>Ganti Semua (Replace)</strong> — <span style={{ color: '#64748b', fontSize: '12px' }}>Rekomendasi. Timpa list tanggal ini agar persis sesuai hasil bidding.</span>
                    </span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                    />
                    <span>
                      <strong>Tambahkan (Append)</strong> — <span style={{ color: '#64748b', fontSize: '12px' }}>Gabungkan dengan list yang ada (anti-duplikat).</span>
                    </span>
                  </label>
                </div>
              </div>

              {/* Items Preview */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--navy)' }}>
                    Preview Item yang Akan Diimpor:
                  </span>
                  <span style={{ fontSize: '12px', color: '#0284c7', fontWeight: 600 }}>
                    {biddingSnapshot.items.length} Item Total
                  </span>
                </div>

                <div style={{
                  maxHeight: '260px',
                  overflowY: 'auto',
                  border: '1px solid var(--line)',
                  borderRadius: '8px',
                  background: '#ffffff'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 2, borderBottom: '1px solid var(--line)' }}>
                      <tr>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#475569' }}>No</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#475569' }}>PIC</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#475569' }}>Model & Storage</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#475569' }}>Grade</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#475569' }}>Harga</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#475569' }}>Fee</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#475569' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {biddingSnapshot.items.map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 12px', color: '#94a3b8' }}>{idx + 1}</td>
                          <td style={{ padding: '6px 12px', fontWeight: 600, color: 'var(--navy)' }}>{it.person}</td>
                          <td style={{ padding: '6px 12px' }}>{it.model} {it.storage ? `${it.storage}GB` : ''}</td>
                          <td style={{ padding: '6px 12px' }}>{it.grade ? it.grade.toUpperCase() : '-'}</td>
                          <td style={{ padding: '6px 12px', fontWeight: 600 }}>@{it.price}</td>
                          <td style={{ padding: '6px 12px', color: '#0284c7' }}>{it.fee_info ? `(${it.fee_info})` : '-'}</td>
                          <td style={{ padding: '6px 12px' }}>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: it.status === 'approved' ? '#ecfdf5' : '#fef2f2',
                              color: it.status === 'approved' ? '#059669' : '#dc2626'
                            }}>
                              {it.status === 'approved' ? '✅ ACC' : '❌ Tolak'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 24px',
              borderTop: '1px solid var(--line)',
              background: '#f8fafc',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                type="button"
                onClick={() => setShowImportBiddingModal(false)}
                className="secondary-button"
                style={{ padding: '8px 16px' }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteImportBidding}
                style={{
                  padding: '8px 20px',
                  background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(2,132,199,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>⚡</span>
                Konfirmasi Tarik Hasil Bidding ({biddingSnapshot.items.length} Item)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

