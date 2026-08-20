import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { getFastCache, setFastCache } from '../utils/fastCache';

// Strict owner rule: Only exact 'menik' and 'mubdi' are owners. 'Mubdi 2' is a regular member.
export const isOwnerPerson = (personName: string): boolean => {
  const norm = (personName || '').toLowerCase().trim();
  return /^(?:menik|mubdi)$/i.test(norm);
};

export const parseDateRobust = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const clean = dateStr.replace(/^[Ee]nb\s+tgl\s+/i, '').trim();
  
  // Match YYYY-MM-DD
  const isoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
  }
  
  // Match DD/MM/YYYY or DD/MM/ YYYY
  const slashMatch = clean.match(/^(\d{1,2})\/(\d{1,2})\/\s*(\d{4})/);
  if (slashMatch) {
    return new Date(parseInt(slashMatch[3], 10), parseInt(slashMatch[2], 10) - 1, parseInt(slashMatch[1], 10));
  }
  
  const d = new Date(clean);
  return isNaN(d.getTime()) ? null : d;
};

export const getMonthKey = (dateStr: string): string => {
  const d = parseDateRobust(dateStr);
  if (!d) return 'unknown';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const indonesianMonths = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const formatMonthLabel = (monthKey: string): string => {
  if (!monthKey || monthKey === 'unknown') return 'Lainnya';
  const parts = monthKey.split('-');
  if (parts.length < 2) return monthKey;
  const [year, month] = parts;
  const mIndex = parseInt(month, 10) - 1;
  const mName = indonesianMonths[mIndex] || month;
  return `${mName} ${year}`;
};

export const formatDateLabelIndo = (dateStr: string): string => {
  const d = parseDateRobust(dateStr);
  if (!d) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const mIndex = d.getMonth();
  const mName = indonesianMonths[mIndex] || '';
  const year = d.getFullYear();
  return `${day} ${mName} ${year}`;
};

interface ObtainedItem {
  id: number | string;
  person: string;
  model: string;
  storage?: string;
  grade?: string;
  unit: number;
  obtained_price?: number;
  fee_info?: string;
  bidder?: string;
  status: string;
  notes?: string;
  report_date: string;
  created_at?: string;
  raw_line?: string;
}

interface SalaryTransfer {
  id: number;
  transfer_batch_id: string;
  person: string;
  dates_included: string;
  total_items: number;
  total_fee_points: number;
  total_amount: number;
  status: string;
  transferred_at: string;
  notes?: string;
}

interface BidderAlias {
  id?: number;
  bidder_name: string;
  alias_name: string;
  notes?: string;
}

interface MemberRecord {
  id?: number;
  name: string;
  alias: string;
  notes?: string;
}

export default function AdminGaji() {
  // Read instant cache for 0ms initial render
  const initialCache = useMemo(() => {
    const cached = getFastCache<any>('salary_data');
    return cached?.data || null;
  }, []);

  const [items, setItems] = useState<ObtainedItem[]>(() => initialCache?.items || []);
  const [transfers, setTransfers] = useState<SalaryTransfer[]>(() => initialCache?.transfers || []);
  const [members, setMembers] = useState<MemberRecord[]>(() => initialCache?.members || []);
  const [bidderAliases, setBidderAliases] = useState<BidderAlias[]>(() => initialCache?.bidder_aliases || []);
  const [availableDates, setAvailableDates] = useState<string[]>(() => {
    if (!initialCache) return [];
    const dateSet = new Set<string>();
    (initialCache.items || []).forEach((it: any) => {
      const d = it.report_date || (it.created_at ? it.created_at.split(' ')[0] : '');
      if (d) dateSet.add(d);
    });
    (initialCache.dates || []).forEach((dObj: any) => {
      if (dObj.report_day) dateSet.add(dObj.report_day);
    });
    return Array.from(dateSet).sort((a, b) => b.localeCompare(a));
  });
  const [loading, setLoading] = useState(() => !initialCache);

  // Active month page for Catalog (e.g. '2026-08')
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  // Tabs: 'payroll' (Katalog & Detail Rekap) | 'bidders' (Anggota & Alias)
  const [activeTab, setActiveTab] = useState<'payroll' | 'bidders'>('payroll');

  // Selected dates for multi-day batch aggregation
  const [selectedDates, setSelectedDates] = useState<string[]>([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTransferStatus, setFilterTransferStatus] = useState<'all' | 'unpaid' | 'paid'>('all');

  // Search for Members Tab
  const [searchMemberQuery, setSearchMemberQuery] = useState('');

  // Modal detail item per person
  const [detailPerson, setDetailPerson] = useState<string | null>(null);

  // Modal detail full date
  const [modalDetailDate, setModalDetailDate] = useState<string | null>(null);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [showModalItemDetails, setShowModalItemDetails] = useState(false);

  // Status feedback
  const [copiedBatch, setCopiedBatch] = useState(false);
  const [copiedPersonSlip, setCopiedPersonSlip] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState('');

  // Selected people for bulk transfer marking
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);

  // Selected members for merging
  const [selectedMemberNamesForMerge, setSelectedMemberNamesForMerge] = useState<string[]>([]);
  const [showMergeModal, setShowMergeModal] = useState<boolean>(false);
  const [mergeTargetName, setMergeTargetName] = useState<string>('');
  const [mergeSourceNames, setMergeSourceNames] = useState<string[]>([]);
  const [mergeCustomAlias, setMergeCustomAlias] = useState<string>('');

  // Modal for adding / editing member & alias
  const [modalMember, setModalMember] = useState<{
    isEdit: boolean;
    name: string;
    alias: string;
    notes: string;
  } | null>(null);

  // Helper to split multiple comma-separated aliases
  const splitAliases = (aliasStr: string | undefined | null): string[] => {
    if (!aliasStr) return [];
    return aliasStr
      .split(',')
      .map(a => a.trim())
      .filter(a => a.length > 0);
  };

  // Helper to calculate similarity between names
  const calculateSimilarity = (a: string, b: string): number => {
    const s1 = (a || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const s2 = (b || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!s1 || !s2) return 0;
    if (s1 === s2) return 1;
    if (s1.includes(s2) || s2.includes(s1)) return 0.85;

    const d1 = s1.replace(/(.)\1+/g, '$1');
    const d2 = s2.replace(/(.)\1+/g, '$1');
    if (d1 === d2) return 0.95;

    const getBigrams = (str: string) => {
      const bigrams = new Set<string>();
      for (let i = 0; i < str.length - 1; i++) {
        bigrams.add(str.substring(i, i + 2));
      }
      return bigrams;
    };
    const b1 = getBigrams(s1);
    const b2 = getBigrams(s2);
    if (b1.size === 0 || b2.size === 0) return 0;
    let intersection = 0;
    b1.forEach(bg => { if (b2.has(bg)) intersection++; });
    return (2 * intersection) / (b1.size + b2.size);
  };

  // Fetch all salary & obtained data in background (Stale-While-Revalidate)
  const fetchData = async (silent = false) => {
    if (!silent && !initialCache) setLoading(true);
    try {
      const res = await fetch('/api/salary.php');
      const json = await res.json();
      if (json.status === 'success') {
        setFastCache('salary_data', json);
        const data = json.data;
        const fetchedItems: ObtainedItem[] = data.items || [];
        setItems(fetchedItems);
        setTransfers(data.transfers || []);
        setMembers(data.members || []);
        setBidderAliases(data.bidder_aliases || []);

        // Extract and sort distinct dates from batches or items
        const dateSet = new Set<string>();
        fetchedItems.forEach(it => {
          const d = it.report_date || (it.created_at ? it.created_at.split(' ')[0] : '');
          if (d) dateSet.add(d);
        });
        (data.dates || []).forEach((dObj: any) => {
          if (dObj.report_day) dateSet.add(dObj.report_day);
        });

        const sortedDates = Array.from(dateSet).sort((a, b) => b.localeCompare(a));
        setAvailableDates(sortedDates);

        // Default to latest date if not set
        if (sortedDates.length > 0 && selectedDates.length === 0) {
          setSelectedDates([sortedDates[0]]);
        }
      }
    } catch (err) {
      console.error('Error fetching salary data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(Boolean(initialCache));
  }, []);

  const showToast = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(''), 3000);
  };

  // Toggle date selection for multi-day payroll batch
  const handleToggleDate = (date: string) => {
    if (selectedDates.includes(date)) {
      if (selectedDates.length > 1) {
        setSelectedDates(selectedDates.filter(d => d !== date));
      }
    } else {
      setSelectedDates([...selectedDates, date].sort((a, b) => b.localeCompare(a)));
    }
  };

  // Select all available dates
  const handleSelectAllDates = () => {
    setSelectedDates([...availableDates]);
  };

  // Select latest single date
  const handleSelectLatestDate = () => {
    if (availableDates.length > 0) {
      setSelectedDates([availableDates[0]]);
    }
  };

  // Select last 2-3 days
  const handleSelectDaysCount = (count: number) => {
    if (availableDates.length > 0) {
      setSelectedDates(availableDates.slice(0, count));
    }
  };

  // Check if a person has been transferred for the selected dates
  const getTransferRecord = (person: string, dates: string[]): SalaryTransfer | undefined => {
    return transfers.find(t => {
      if (t.person.toLowerCase() !== person.toLowerCase()) return false;
      try {
        const parsed = JSON.parse(t.dates_included);
        if (Array.isArray(parsed)) {
          return dates.every(d => parsed.includes(d));
        }
      } catch {
        return dates.some(d => t.dates_included.includes(d));
      }
      return false;
    });
  };

  // Find member where raw input matches Nama Asli or matches ANY of its multiple aliases
  const findMember = (rawName: string): MemberRecord | undefined => {
    const norm = (rawName || '').trim().toLowerCase();
    if (!norm) return undefined;

    // 1. Direct match on Nama Asli
    const byName = members.find(m => m.name.toLowerCase().trim() === norm);
    if (byName) return byName;

    // 2. Match on any of multiple aliases (comma-separated)
    const byAlias = members.find(m => {
      const aliases = splitAliases(m.alias);
      return aliases.some(a => a.toLowerCase().trim() === norm);
    });
    if (byAlias) return byAlias;

    // 3. Fallback to bidderAliases table
    const byBidderAlias = bidderAliases.find(a => a.bidder_name.toLowerCase().trim() === norm);
    if (byBidderAlias && byBidderAlias.alias_name) {
      const matchParent = members.find(m => {
        const mNorm = m.name.toLowerCase().trim();
        const mAliases = splitAliases(m.alias).map(a => a.toLowerCase().trim());
        const targetAlias = byBidderAlias.alias_name.toLowerCase().trim();
        return mNorm === targetAlias || mAliases.includes(targetAlias);
      });
      if (matchParent) return matchParent;
    }

    // 4. Normalized alphanumeric & reduced repeated chars (e.g. "bilqiis" -> "bilqis")
    const cleanNorm = norm.replace(/[^a-z0-9]/g, '');
    const deDupe = cleanNorm.replace(/(.)\1+/g, '$1');
    const fuzzy = members.find(m => {
      const cName = m.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const dName = cName.replace(/(.)\1+/g, '$1');
      if (cName === cleanNorm || dName === deDupe) return true;

      const aliases = splitAliases(m.alias);
      return aliases.some(a => {
        const cAlias = a.toLowerCase().replace(/[^a-z0-9]/g, '');
        const dAlias = cAlias.replace(/(.)\1+/g, '$1');
        return cAlias === cleanNorm || dAlias === deDupe;
      });
    });
    if (fuzzy) return fuzzy;

    return undefined;
  };

  // Get Canonical Name (Nama Asli)
  const getCanonicalName = (rawName: string): string => {
    const m = findMember(rawName);
    return m ? m.name : rawName;
  };

  // Helper to format name and alias together: "Nama Asli (Alias 1, Alias 2)" or "Nama Asli"
  const getDisplayName = (rawName: string): string => {
    const norm = (rawName || '').trim();
    if (!norm) return '';
    const m = findMember(norm);
    if (!m) return norm;

    if (m.alias && m.alias.trim() && m.alias.toLowerCase().trim() !== m.name.toLowerCase().trim()) {
      return `${m.name} (${m.alias.trim()})`;
    }
    return m.name;
  };

  const getAliasOnly = (rawName: string): string => {
    const norm = (rawName || '').trim();
    if (!norm) return '';
    const m = findMember(norm);
    return (m && m.alias && m.alias.trim()) ? m.alias.trim() : '';
  };

  // Map any person/bidder name to its sequence in the official Anggota & Alias list
  const getMemberOrderIndex = useCallback((personName: string): number => {
    const canonical = getCanonicalName(personName).toLowerCase().trim();
    if (!canonical) return 999;

    // 1. Search in members array (exact order in Anggota & Alias)
    const idxInMembers = members.findIndex(m => {
      const mName = m.name.toLowerCase().trim();
      const mAliases = splitAliases(m.alias).map(a => a.toLowerCase().trim());
      return mName === canonical || mAliases.includes(canonical);
    });
    if (idxInMembers !== -1) return idxInMembers;

    // 2. Fallback to official 27 members order
    const fallbackList = [
      'andri', 'alya', 'rina', 'bela', 'tiwi', 'jeremia', 'riski', 'nestyo', 'ruzi', 'fikri',
      'fauzan', 'jessica', 'baroto', 'icha', 'mba atik', 'ka agam', 'bilqis', 'raka', 'aldo',
      'via', 'zacky', 'lida', 'wenda', 'rudi', 'fahri', 'p. rt reza', 'ramdan'
    ];
    const fbIdx = fallbackList.indexOf(canonical);
    if (fbIdx !== -1) return fbIdx;

    return 900;
  }, [members, bidderAliases]);

  // Filter items based on selected dates and owner exclusions
  const filteredActiveItems = useMemo(() => {
    return items.filter(it => {
      const d = it.report_date || (it.created_at ? it.created_at.split(' ')[0] : '');
      const inDate = selectedDates.includes(d);
      const isApproved = it.status === 'approved';
      const isNotOwner = !isOwnerPerson(it.person);
      return inDate && isApproved && isNotOwner;
    });
  }, [items, selectedDates]);

  // Aggregate salary per person for the selected dates (grouped by Canonical Nama Asli)
  const aggregatedPayroll = useMemo(() => {
    const map = new Map<string, {
      person: string;
      rawNames: Set<string>;
      alias: string;
      displayName: string;
      items: ObtainedItem[];
      totalUnits: number;
      feeCounts: Map<number, number>;
      totalFeePoints: number;
      totalRupiah: number;
      formulaParts: string[];
      formulaText: string;
      isTransferred: boolean;
      transferInfo?: SalaryTransfer;
    }>();

    filteredActiveItems.forEach(it => {
      const rawPerson = it.person.trim() || 'Umum';
      const canonical = getCanonicalName(rawPerson);

      if (!map.has(canonical)) {
        const alias = getAliasOnly(canonical);
        const displayName = getDisplayName(canonical);

        map.set(canonical, {
          person: canonical,
          rawNames: new Set<string>(),
          alias: alias,
          displayName: displayName,
          items: [],
          totalUnits: 0,
          feeCounts: new Map<number, number>(),
          totalFeePoints: 0,
          totalRupiah: 0,
          formulaParts: [],
          formulaText: '',
          isTransferred: false
        });
      }

      const pObj = map.get(canonical)!;
      pObj.rawNames.add(rawPerson);
      pObj.items.push(it);
      // Each row counts as 1 unit
      pObj.totalUnits += 1;

      if (it.fee_info) {
        const feeVal = parseInt(it.fee_info.replace(/[()]/g, '').trim(), 10);
        if (!isNaN(feeVal) && feeVal > 0) {
          pObj.feeCounts.set(feeVal, (pObj.feeCounts.get(feeVal) || 0) + 1);
        }
      }
    });

    const result = Array.from(map.values()).map(pObj => {
      let totalPoints = 0;
      const sortedTiers = Array.from(pObj.feeCounts.entries()).sort((a, b) => a[0] - b[0]);
      const parts: string[] = [];

      sortedTiers.forEach(([fee, count]) => {
        totalPoints += count * fee;
        parts.push(`${count}x${fee}`);
      });

      pObj.totalFeePoints = totalPoints;
      pObj.totalRupiah = totalPoints * 1000;
      pObj.formulaParts = parts;
      pObj.formulaText = parts.length > 0 ? `${parts.join(' + ')} = ${totalPoints}` : '0';

      const transfer = getTransferRecord(pObj.person, selectedDates) || Array.from(pObj.rawNames).map(r => getTransferRecord(r, selectedDates)).find(Boolean);
      if (transfer) {
        pObj.isTransferred = true;
        pObj.transferInfo = transfer;
      }

      return pObj;
    });

    return result.sort((a, b) => {
      const orderA = getMemberOrderIndex(a.person);
      const orderB = getMemberOrderIndex(b.person);
      if (orderA !== orderB) return orderA - orderB;
      return a.person.localeCompare(b.person);
    });
  }, [filteredActiveItems, transfers, selectedDates, members, bidderAliases, getMemberOrderIndex]);

  // Overall metrics for selected dates
  const payrollMetrics = useMemo(() => {
    let totalRupiah = 0;
    let totalPoints = 0;
    let totalUnits = 0;
    let paidRupiah = 0;
    let unpaidRupiah = 0;
    let unpaidCount = 0;
    let paidCount = 0;

    aggregatedPayroll.forEach(p => {
      totalRupiah += p.totalRupiah;
      totalPoints += p.totalFeePoints;
      totalUnits += p.totalUnits;

      if (p.isTransferred) {
        paidRupiah += p.totalRupiah;
        paidCount += 1;
      } else {
        unpaidRupiah += p.totalRupiah;
        unpaidCount += 1;
      }
    });

    return {
      totalRupiah,
      totalPoints,
      totalUnits,
      paidRupiah,
      unpaidRupiah,
      unpaidCount,
      paidCount,
      totalPeople: aggregatedPayroll.length
    };
  }, [aggregatedPayroll]);

  // Filtered payroll list for display
  const displayedPayroll = useMemo(() => {
    return aggregatedPayroll.filter(p => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q ||
        p.person.toLowerCase().includes(q) ||
        (p.alias && p.alias.toLowerCase().includes(q)) ||
        p.displayName.toLowerCase().includes(q);
      const matchTransfer =
        filterTransferStatus === 'all' ||
        (filterTransferStatus === 'paid' && p.isTransferred) ||
        (filterTransferStatus === 'unpaid' && !p.isTransferred);
      return matchQuery && matchTransfer;
    });
  }, [aggregatedPayroll, searchQuery, filterTransferStatus]);

  // Unified Members & Aliases List (based on official members table)
  const membersAndAliases = useMemo(() => {
    const memberMap = new Map<string, {
      id?: number;
      name: string;
      alias: string;
      notes: string;
      totalItemsWon: number;
      isOwner: boolean;
      aliasId?: number;
    }>();

    // 1. Seed with official members list
    members.forEach(m => {
      memberMap.set(m.name.toLowerCase().trim(), {
        id: m.id,
        name: m.name,
        alias: m.alias || '',
        notes: m.notes || '',
        totalItemsWon: 0,
        isOwner: isOwnerPerson(m.name),
        aliasId: m.id
      });
    });

    // 2. Count won items per canonical member
    items.forEach(it => {
      if (it.status === 'approved') {
        const canonical = getCanonicalName(it.person || '');
        const key = canonical.toLowerCase().trim();
        if (memberMap.has(key)) {
          memberMap.get(key)!.totalItemsWon += 1;
        } else if (canonical) {
          // If a new unlisted member is found in items
          memberMap.set(key, {
            name: canonical,
            alias: getAliasOnly(canonical),
            notes: '',
            totalItemsWon: 1,
            isOwner: isOwnerPerson(canonical)
          });
        }
      }
    });

    return Array.from(memberMap.values());
  }, [members, items, bidderAliases]);

  const displayedMembers = useMemo(() => {
    return membersAndAliases.filter(m => {
      if (!searchMemberQuery) return true;
      const q = searchMemberQuery.toLowerCase();
      return m.name.toLowerCase().includes(q) || m.alias.toLowerCase().includes(q) || m.notes.toLowerCase().includes(q);
    });
  }, [membersAndAliases, searchMemberQuery]);

  // Mark single person as transferred
  const handleMarkTransferred = async (person: string, totalUnits: number, totalPoints: number, totalRupiah: number, targetDates?: string[]) => {
    const dates = targetDates || selectedDates;
    try {
      const res = await fetch('/api/salary.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_transferred',
          person,
          dates: dates,
          total_items: totalUnits,
          total_fee_points: totalPoints,
          total_amount: totalRupiah,
          notes: `Transfer ${dates.join(', ')}`
        })
      });
      const json = await res.json();
      if (json.status === 'success') {
        showToast(`✅ Gaji untuk ${person} berhasil ditandai sudah ditransfer!`);
        fetchData();
      } else {
        alert('Gagal menandai transfer: ' + (json.message || 'Terjadi kesalahan'));
      }
    } catch (e: any) {
      console.error(e);
      alert('Terjadi kesalahan saat menandai status transfer: ' + (e.message || e));
    }
  };

  // Unmark person transfer
  const handleUnmarkTransferred = async (transferId: number) => {
    if (!window.confirm('Batalkan tanda transfer untuk anggota ini?')) return;
    try {
      const res = await fetch('/api/salary.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unmark_transferred',
          id: transferId
        })
      });
      const json = await res.json();
      if (json.status === 'success') {
        showToast('Status transfer berhasil dibatalkan');
        fetchData();
      } else {
        alert('Gagal membatalkan status transfer: ' + (json.message || 'Terjadi kesalahan'));
      }
    } catch (e: any) {
      console.error(e);
      alert('Terjadi kesalahan saat membatalkan transfer: ' + (e.message || e));
    }
  };

  // Mark multiple selected people as transferred in batch
  const handleBatchMarkTransferred = async (targetPayrollList?: any[], targetDates?: string[]) => {
    const list = targetPayrollList || aggregatedPayroll;
    const dates = targetDates || selectedDates;
    const toTransfer = list.filter((p: any) => selectedPeople.includes(p.person) && !p.isTransferred);
    if (toTransfer.length === 0) {
      alert('Pilih minimal satu anggota yang belum ditransfer.');
      return;
    }

    if (!window.confirm(`Tandai ${toTransfer.length} anggota sebagai SUDAH DITRANSFER untuk periode ${dates.join(', ')}?`)) return;

    try {
      const records = toTransfer.map((p: any) => ({
        person: p.person,
        dates: dates,
        total_items: p.totalUnits,
        total_fee_points: p.totalFeePoints,
        total_amount: p.totalRupiah,
        notes: `Batch transfer ${dates.join(', ')}`
      }));

      const res = await fetch('/api/salary.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_batch_transferred',
          records
        })
      });
      const json = await res.json();
      if (json.status === 'success') {
        showToast(`✅ ${json.count} anggota berhasil ditandai sudah ditransfer!`);
        setSelectedPeople([]);
        fetchData();
      } else {
        alert('Gagal menandai transfer batch: ' + (json.message || 'Terjadi kesalahan'));
      }
    } catch (e: any) {
      console.error(e);
      alert('Terjadi kesalahan saat menandai batch transfer: ' + (e.message || e));
    }
  };

  // Select all people checkbox
  const handleToggleSelectAllPeople = () => {
    if (selectedPeople.length === displayedPayroll.length) {
      setSelectedPeople([]);
    } else {
      setSelectedPeople(displayedPayroll.map(p => p.person));
    }
  };

  // Copy Full Batch Summary for WhatsApp / Chat
  const handleCopyBatchSummary = () => {
    if (aggregatedPayroll.length === 0) return;

    const formattedDates = selectedDates.length === 1
      ? selectedDates[0]
      : `${selectedDates[selectedDates.length - 1]} s/d ${selectedDates[0]} (${selectedDates.length} Hari)`;

    const lines: string[] = [
      `💰 *REKAPITULASI GAJI & FEE BIDDING*`,
      `📅 Periode: ${formattedDates}`,
      `📦 Total Barang: ${payrollMetrics.totalUnits} unit`,
      `💵 Total Pengeluaran: Rp ${new Intl.NumberFormat('id-ID').format(payrollMetrics.totalRupiah)}`,
      ``,
      `*Rincian Per Anggota:*`
    ];

    aggregatedPayroll.forEach((p, idx) => {
      const feeFormula = p.formulaParts.length > 0 ? p.formulaParts.join(' + ') : '-';
      const statusIcon = p.isTransferred ? '✅ [Lunas]' : '⏳ [Pending]';
      lines.push(`${idx + 1}. *${p.displayName}* ${statusIcon}`);
      lines.push(`   ${p.totalUnits} unit | ${feeFormula} = ${p.totalFeePoints}`);
      lines.push(`   👉 *Rp ${new Intl.NumberFormat('id-ID').format(p.totalRupiah)}*`);
    });

    const fullText = lines.join('\n');
    navigator.clipboard.writeText(fullText).then(() => {
      setCopiedBatch(true);
      setTimeout(() => setCopiedBatch(false), 2000);
    });
  };

  // Copy Individual Slip for a specific person
  const handleCopyPersonSlip = (personObj: any, targetDates?: string[]) => {
    const dates = targetDates || selectedDates;
    const formattedDates = dates.length === 1
      ? dates[0]
      : `${dates[dates.length - 1]} s/d ${dates[0]} (${dates.length} Hari)`;

    const lines: string[] = [
      `📄 *SLIP GAJI BIDDING*`,
      `👤 Nama: *${personObj.displayName}*`,
      `📅 Periode: ${formattedDates}`,
      `📦 Total Barang: ${personObj.totalUnits} unit`,
      `🧮 Rincian Fee: ${personObj.formulaText}`,
      `💰 *Total Ditransfer: Rp ${new Intl.NumberFormat('id-ID').format(personObj.totalRupiah)}*`,
      ``,
      `*Daftar Barang yang Didapat:*`
    ];

    personObj.items.forEach((it: any, idx: number) => {
      const feeText = it.fee_info ? ` (${it.fee_info})` : '';
      const bidderText = it.bidder ? ` [${it.bidder}]` : '';
      lines.push(`${idx + 1}. ${it.model} ${it.storage || ''} ${it.grade || ''} @${it.obtained_price || '-'}${feeText}${bidderText}`);
    });

    const fullText = lines.join('\n');
    navigator.clipboard.writeText(fullText).then(() => {
      setCopiedPersonSlip(personObj.person);
      setTimeout(() => setCopiedPersonSlip(null), 2000);
    });
  };

  // Delete an entire date batch from Gaji
  const handleDeleteBatch = async (dateStr: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus seluruh data gaji tanggal "${dateStr}"?`)) {
      return;
    }
    try {
      const res = await fetch('/api/salary.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_batch',
          report_date: dateStr
        })
      });
      const json = await res.json();
      if (json.status === 'success') {
        showToast(`🗑️ ${json.message}`);
        setSelectedDates(prev => prev.filter(d => d !== dateStr));
        if (modalDetailDate === dateStr) {
          setModalDetailDate(null);
        }
        fetchData();
      } else {
        showToast(`Gagal menghapus batch: ${json.message || 'Terjadi kesalahan'}`);
      }
    } catch (err) {
      console.error(err);
      showToast('Gagal menghapus batch data tanggal');
    }
  };

  // Weekly Timeline Grouping
  const weeklyTimeline = useMemo(() => {
    const weekMap = new Map<string, {
      weekKey: string;
      weekLabel: string;
      dates: Set<string>;
      items: ObtainedItem[];
      totalUnits: number;
      totalRupiah: number;
      totalPoints: number;
      peopleCount: number;
    }>();

    items.forEach(it => {
      if (it.status !== 'approved' || isOwnerPerson(it.person)) return;
      const dStr = it.report_date || (it.created_at ? it.created_at.split(' ')[0] : '');
      if (!dStr) return;

      const dateObj = new Date(dStr);
      if (isNaN(dateObj.getTime())) return;

      const startOfYear = new Date(dateObj.getFullYear(), 0, 1);
      const pastDaysOfYear = (dateObj.getTime() - startOfYear.getTime()) / 86400000;
      const weekNum = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
      const weekKey = `${dateObj.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;

      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, {
          weekKey,
          weekLabel: `Minggu ke-${weekNum} (${dateObj.getFullYear()})`,
          dates: new Set<string>(),
          items: [],
          totalUnits: 0,
          totalRupiah: 0,
          totalPoints: 0,
          peopleCount: 0
        });
      }

      const wObj = weekMap.get(weekKey)!;
      wObj.dates.add(dStr);
      wObj.items.push(it);
      wObj.totalUnits += 1;

      if (it.fee_info) {
        const feeVal = parseInt(it.fee_info.replace(/[()]/g, '').trim(), 10);
        if (!isNaN(feeVal) && feeVal > 0) {
          wObj.totalPoints += feeVal;
          wObj.totalRupiah += feeVal * 1000;
        }
      }
    });

    return Array.from(weekMap.values()).map(w => {
      const distinctPeople = new Set(w.items.map(it => it.person));
      w.peopleCount = distinctPeople.size;
      return w;
    }).sort((a, b) => b.weekKey.localeCompare(a.weekKey));
  }, [items]);

  // Save Member & Alias handler
  const handleSaveMemberAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalMember || !modalMember.name.trim()) return;

    try {
      const res = await fetch('/api/salary.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_member_alias',
          name: modalMember.name.trim(),
          alias_name: modalMember.alias.trim(),
          notes: modalMember.notes.trim()
        })
      });
      const json = await res.json();
      if (json.status === 'success') {
        showToast(json.message || 'Data anggota / alias berhasil disimpan ✅');
        setModalMember(null);
        fetchData();
      } else {
        alert('Gagal menyimpan: ' + (json.message || 'Error'));
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat menyimpan.');
    }
  };

  // Delete Member completely
  const handleDeleteMember = async (name: string) => {
    if (!window.confirm(`Hapus anggota "${name}" dari sistem? Tindakan ini akan menghapus data anggota dan aliasnya.`)) return;
    try {
      const res = await fetch('/api/salary.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_member',
          name
        })
      });
      const json = await res.json();
      if (json.status === 'success') {
        showToast(json.message || `Anggota ${name} berhasil dihapus.`);
        if (modalMember) setModalMember(null);
        fetchData();
      } else {
        alert('Gagal menghapus: ' + (json.message || 'Error'));
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat menghapus.');
    }
  };

  // Delete Member Alias handler
  const handleDeleteMemberAlias = async (name: string) => {
    if (!window.confirm(`Hapus alias dan catatan untuk ${name}?`)) return;
    try {
      const res = await fetch('/api/salary.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_member_alias',
          name
        })
      });
      const json = await res.json();
      if (json.status === 'success') {
        showToast(`Alias untuk ${name} berhasil dihapus`);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Open merge modal
  const handleOpenMergeModal = (presetTarget?: string, presetSources?: string[]) => {
    const target = presetTarget || (selectedMemberNamesForMerge.length > 0 ? selectedMemberNamesForMerge[0] : (membersAndAliases[0]?.name || ''));
    const sources = presetSources || selectedMemberNamesForMerge.filter(n => n.toLowerCase() !== target.toLowerCase());

    setMergeTargetName(target);
    setMergeSourceNames(sources);

    // Calculate combined aliases
    const targetMem = membersAndAliases.find(m => m.name.toLowerCase() === target.toLowerCase());
    const initialAliases = new Set<string>();
    if (targetMem && targetMem.alias) {
      splitAliases(targetMem.alias).forEach(a => initialAliases.add(a));
    }
    sources.forEach(srcName => {
      initialAliases.add(srcName);
      const srcMem = membersAndAliases.find(m => m.name.toLowerCase() === srcName.toLowerCase());
      if (srcMem && srcMem.alias) {
        splitAliases(srcMem.alias).forEach(a => initialAliases.add(a));
      }
    });
    initialAliases.delete(target);
    setMergeCustomAlias(Array.from(initialAliases).join(', '));
    setShowMergeModal(true);
  };

  // Change merge target
  const handleSelectMergeTarget = (newTarget: string) => {
    setMergeTargetName(newTarget);
    const newSources = mergeSourceNames.filter(s => s.toLowerCase() !== newTarget.toLowerCase());
    setMergeSourceNames(newSources);

    const targetMem = membersAndAliases.find(m => m.name.toLowerCase() === newTarget.toLowerCase());
    const allAli = new Set<string>();
    if (targetMem && targetMem.alias) {
      splitAliases(targetMem.alias).forEach(a => allAli.add(a));
    }
    newSources.forEach(s => {
      allAli.add(s);
      const sMem = membersAndAliases.find(m => m.name.toLowerCase() === s.toLowerCase());
      if (sMem && sMem.alias) {
        splitAliases(sMem.alias).forEach(a => allAli.add(a));
      }
    });
    allAli.delete(newTarget);
    setMergeCustomAlias(Array.from(allAli).join(', '));
  };

  // Toggle source in merge modal
  const handleToggleMergeSource = (srcName: string) => {
    let updatedSources: string[];
    if (mergeSourceNames.includes(srcName)) {
      updatedSources = mergeSourceNames.filter(s => s !== srcName);
    } else {
      updatedSources = [...mergeSourceNames, srcName];
    }
    setMergeSourceNames(updatedSources);

    const targetMem = membersAndAliases.find(m => m.name.toLowerCase() === mergeTargetName.toLowerCase());
    const allAli = new Set<string>();
    if (targetMem && targetMem.alias) {
      splitAliases(targetMem.alias).forEach(a => allAli.add(a));
    }
    updatedSources.forEach(s => {
      allAli.add(s);
      const sMem = membersAndAliases.find(m => m.name.toLowerCase() === s.toLowerCase());
      if (sMem && sMem.alias) {
        splitAliases(sMem.alias).forEach(a => allAli.add(a));
      }
    });
    allAli.delete(mergeTargetName);
    setMergeCustomAlias(Array.from(allAli).join(', '));
  };

  // Execute merge members
  const handleExecuteMergeMembers = async () => {
    if (!mergeTargetName) {
      alert('Pilih nama anggota utama (target).');
      return;
    }
    if (mergeSourceNames.length === 0) {
      alert('Pilih minimal 1 anggota yang akan digabungkan.');
      return;
    }

    if (!window.confirm(`Gabungkan ${mergeSourceNames.join(', ')} ke dalam "${mergeTargetName}"?\n\nAnggota yang digabung akan dihapus dan namanya otomatis ditambahkan ke daftar alias "${mergeTargetName}".`)) {
      return;
    }

    try {
      const res = await fetch('/api/salary.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'merge_members',
          target_name: mergeTargetName,
          source_names: mergeSourceNames,
          combined_alias: mergeCustomAlias
        })
      });
      const json = await res.json();
      if (json.status === 'success') {
        showToast(json.message || `Anggota berhasil digabungkan ke ${mergeTargetName}! ✅`);
        setShowMergeModal(false);
        setSelectedMemberNamesForMerge([]);
        fetchData();
      } else {
        alert('Gagal menggabungkan anggota: ' + (json.message || 'Error'));
      }
    } catch (err: any) {
      console.error(err);
      alert('Terjadi kesalahan saat menggabungkan anggota: ' + (err.message || err));
    }
  };

  // Toggle member selection in table
  const handleToggleSelectMemberForMerge = (name: string) => {
    if (selectedMemberNamesForMerge.includes(name)) {
      setSelectedMemberNamesForMerge(selectedMemberNamesForMerge.filter(n => n !== name));
    } else {
      setSelectedMemberNamesForMerge([...selectedMemberNamesForMerge, name]);
    }
  };

  // Select all or deselect all members
  const handleToggleSelectAllMembers = () => {
    if (selectedMemberNamesForMerge.length === displayedMembers.length) {
      setSelectedMemberNamesForMerge([]);
    } else {
      setSelectedMemberNamesForMerge(displayedMembers.map(m => m.name));
    }
  };

  // Detect pairs of similar member names that might need merging
  const similarMemberSuggestions = useMemo(() => {
    const suggestions: Array<{
      memberA: string;
      memberB: string;
      score: number;
      reason: string;
    }> = [];

    for (let i = 0; i < membersAndAliases.length; i++) {
      for (let j = i + 1; j < membersAndAliases.length; j++) {
        const a = membersAndAliases[i];
        const b = membersAndAliases[j];
        if (a.isOwner || b.isOwner) continue;

        const score = calculateSimilarity(a.name, b.name);
        if (score >= 0.70) {
          suggestions.push({
            memberA: a.name,
            memberB: b.name,
            score,
            reason: score >= 0.90 ? 'Nama hampir identik' : 'Kemiripan nama tinggi'
          });
        }
      }
    }
    return suggestions;
  }, [membersAndAliases]);

  // Track which catalog cards are expanded
  const [expandedCardKeys, setExpandedCardKeys] = useState<Record<string, boolean>>({});

  const isCardExpanded = (key: string, isDefaultOpen: boolean = false) => {
    if (expandedCardKeys[key] !== undefined) {
      return expandedCardKeys[key];
    }
    return isDefaultOpen;
  };

  const toggleCardExpanded = (key: string, isDefaultOpen: boolean = false) => {
    const current = isCardExpanded(key, isDefaultOpen);
    setExpandedCardKeys(prev => ({
      ...prev,
      [key]: !current
    }));
  };

  // Helper to compute payroll & metrics for any arbitrary array of dates
  const getPayrollDataForDates = (datesList: string[]) => {
    const activeItems = items.filter(it => {
      const itemDate = it.report_date || (it.created_at ? it.created_at.split(' ')[0] : '');
      const isDateMatch = datesList.length === 0 || datesList.includes(itemDate);
      const isApproved = it.status === 'approved';
      const isNotOwner = !isOwnerPerson(it.person);
      return isDateMatch && isApproved && isNotOwner;
    });

    const map = new Map<string, {
      person: string;
      alias: string;
      displayName: string;
      rawNames: Set<string>;
      totalUnits: number;
      feeCounts: Map<number, number>;
      totalFeePoints: number;
      totalRupiah: number;
      formulaParts: string[];
      formulaText: string;
      isTransferred: boolean;
      transferInfo?: SalaryTransfer;
      items: ObtainedItem[];
    }>();

    activeItems.forEach(it => {
      const rawPerson = (it.person || '').trim();
      const canonical = getCanonicalName(rawPerson);
      const alias = getAliasOnly(canonical);
      const displayName = getDisplayName(rawPerson);

      if (!map.has(canonical)) {
        map.set(canonical, {
          person: canonical,
          alias,
          displayName,
          rawNames: new Set([rawPerson]),
          totalUnits: 0,
          feeCounts: new Map(),
          totalFeePoints: 0,
          totalRupiah: 0,
          formulaParts: [],
          formulaText: '',
          isTransferred: false,
          items: []
        });
      }

      const pObj = map.get(canonical)!;
      pObj.rawNames.add(rawPerson);
      pObj.items.push(it);
      pObj.totalUnits += 1;

      if (it.fee_info) {
        const feeVal = parseInt(it.fee_info.replace(/[()]/g, '').trim(), 10);
        if (!isNaN(feeVal) && feeVal > 0) {
          pObj.feeCounts.set(feeVal, (pObj.feeCounts.get(feeVal) || 0) + 1);
        }
      }
    });

    const payrollList = Array.from(map.values()).map(pObj => {
      let totalPoints = 0;
      const sortedTiers = Array.from(pObj.feeCounts.entries()).sort((a, b) => a[0] - b[0]);
      const parts: string[] = [];

      sortedTiers.forEach(([fee, count]) => {
        totalPoints += count * fee;
        parts.push(`${count}x${fee}`);
      });

      pObj.totalFeePoints = totalPoints;
      pObj.totalRupiah = totalPoints * 1000;
      pObj.formulaParts = parts;
      pObj.formulaText = parts.length > 0 ? `${parts.join(' + ')} = ${totalPoints}` : '0';

      const transfer = getTransferRecord(pObj.person, datesList) || Array.from(pObj.rawNames).map(r => getTransferRecord(r, datesList)).find(Boolean);
      if (transfer) {
        pObj.isTransferred = true;
        pObj.transferInfo = transfer;
      }

      return pObj;
    }).sort((a, b) => {
      const orderA = getMemberOrderIndex(a.person);
      const orderB = getMemberOrderIndex(b.person);
      if (orderA !== orderB) return orderA - orderB;
      return a.person.localeCompare(b.person);
    });

    let totalRupiah = 0;
    let totalPoints = 0;
    let totalUnits = 0;
    let paidRupiah = 0;
    let unpaidRupiah = 0;
    let unpaidCount = 0;
    let paidCount = 0;

    payrollList.forEach(p => {
      totalRupiah += p.totalRupiah;
      totalPoints += p.totalFeePoints;
      totalUnits += p.totalUnits;

      if (p.isTransferred) {
        paidRupiah += p.totalRupiah;
        paidCount += 1;
      } else {
        unpaidRupiah += p.totalRupiah;
        unpaidCount += 1;
      }
    });

    return {
      payrollList,
      totalRupiah,
      totalPoints,
      totalUnits,
      paidRupiah,
      unpaidRupiah,
      unpaidCount,
      paidCount,
      totalPeople: payrollList.length,
      isAllPaid: payrollList.length > 0 && paidCount === payrollList.length
    };
  };

  // Copy Full Batch Summary for WhatsApp
  const handleCopyBatchSummaryForDates = (targetDates: string[], list: any[], metrics: any) => {
    if (list.length === 0) return;

    const formattedDates = targetDates.length === 1
      ? targetDates[0]
      : `${targetDates[targetDates.length - 1]} s/d ${targetDates[0]} (${targetDates.length} Hari)`;

    const lines: string[] = [
      `💰 *REKAPITULASI GAJI & FEE BIDDING*`,
      `📅 Periode: ${formattedDates}`,
      `📦 Total Barang: ${metrics.totalUnits} unit`,
      `💵 Total Pengeluaran: Rp ${new Intl.NumberFormat('id-ID').format(metrics.totalRupiah)}`,
      ``,
      `*Rincian Per Anggota:*`
    ];

    list.forEach((p, idx) => {
      const feeFormula = p.formulaParts && p.formulaParts.length > 0 ? p.formulaParts.join(' + ') : '-';
      const statusIcon = p.isTransferred ? '✅ [Lunas]' : '⏳ [Pending]';
      lines.push(`${idx + 1}. *${p.displayName}* ${statusIcon}`);
      lines.push(`   ${p.totalUnits} unit | ${feeFormula} = ${p.totalFeePoints}`);
      lines.push(`   👉 *Rp ${new Intl.NumberFormat('id-ID').format(p.totalRupiah)}*`);
    });

    const fullText = lines.join('\n');
    navigator.clipboard.writeText(fullText).then(() => {
      showToast(`✓ Format WhatsApp untuk ${formattedDates} berhasil disalin!`);
    });
  };

  // Distinct months in descending order (e.g. ['2026-08', '2026-07'])
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    availableDates.forEach(d => {
      const mKey = getMonthKey(d);
      if (mKey && mKey !== 'unknown') monthSet.add(mKey);
    });
    const sorted = Array.from(monthSet).sort((a, b) => b.localeCompare(a));
    if (sorted.length === 0) {
      const now = new Date();
      return [`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`];
    }
    return sorted;
  }, [availableDates]);

  useEffect(() => {
    if (availableMonths.length > 0 && (!selectedMonth || !availableMonths.includes(selectedMonth))) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  // Dates in active month
  const currentMonthDates = useMemo(() => {
    if (!selectedMonth) return availableDates;
    return availableDates.filter(d => getMonthKey(d) === selectedMonth);
  }, [availableDates, selectedMonth]);

  // Group currentMonthDates into Weeks (Minggu 1, 2, 3, 4, 5)
  const currentMonthWeeks = useMemo(() => {
    const weeks: Array<{
      weekIndex: number;
      weekTitle: string;
      startDay: number;
      endDay: number;
      dates: string[];
      totalUnits: number;
      totalRupiah: number;
      totalPoints: number;
      totalPeople: number;
    }> = [];

    const [yearStr, monthStr] = (selectedMonth || '').split('-');
    const year = parseInt(yearStr, 10) || new Date().getFullYear();
    const month = parseInt(monthStr, 10) || (new Date().getMonth() + 1);
    const daysInMonth = new Date(year, month, 0).getDate();

    const weekRanges = [
      { index: 1, start: 1, end: 7 },
      { index: 2, start: 8, end: 14 },
      { index: 3, start: 15, end: 21 },
      { index: 4, start: 22, end: 28 },
      { index: 5, start: 29, end: daysInMonth }
    ];

    weekRanges.forEach(range => {
      if (range.start > daysInMonth) return;
      const end = Math.min(range.end, daysInMonth);
      const mNameShort = indonesianMonths[month - 1] ? indonesianMonths[month - 1].substring(0, 3) : '';

      const matchingDates = currentMonthDates.filter(dStr => {
        const dObj = parseDateRobust(dStr);
        if (!dObj) return false;
        const day = dObj.getDate();
        return day >= range.start && day <= end;
      });

      if (matchingDates.length > 0) {
        // Sort dates within the week newest first
        const sortedMatchingDates = [...matchingDates].sort((a, b) => {
          const da = parseDateRobust(a)?.getTime() || 0;
          const db = parseDateRobust(b)?.getTime() || 0;
          return db - da;
        });

        const weekPayroll = getPayrollDataForDates(sortedMatchingDates);
        weeks.push({
          weekIndex: range.index,
          weekTitle: `Minggu ke-${range.index} (${String(range.start).padStart(2, '0')} - ${String(end).padStart(2, '0')} ${mNameShort} ${year})`,
          startDay: range.start,
          endDay: end,
          dates: sortedMatchingDates,
          totalUnits: weekPayroll.totalUnits,
          totalRupiah: weekPayroll.totalRupiah,
          totalPoints: weekPayroll.totalPoints,
          totalPeople: weekPayroll.totalPeople
        });
      }
    });

    // Newest week on top (Minggu 5 -> 4 -> 3 -> 2 -> 1)
    return weeks.reverse();
  }, [currentMonthDates, selectedMonth, items, transfers, members, bidderAliases]);

  const handlePrevMonth = () => {
    const currentIndex = availableMonths.indexOf(selectedMonth);
    if (currentIndex < availableMonths.length - 1 && currentIndex >= 0) {
      setSelectedMonth(availableMonths[currentIndex + 1]);
    }
  };

  const handleNextMonth = () => {
    const currentIndex = availableMonths.indexOf(selectedMonth);
    if (currentIndex > 0) {
      setSelectedMonth(availableMonths[currentIndex - 1]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>
      {/* Header Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'white',
        padding: '18px 24px',
        borderRadius: '12px',
        border: '1px solid var(--line)',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--navy)' }}>
              Rekapitulasi & Pembagian Gaji
            </h2>
            <span style={{ background: '#eff6ff', color: 'var(--blue)', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>
              Katalog & Detail Terpadu
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--muted)' }}>
            Rincian gaji tersemat di dalam setiap kartu katalog periode. Buka detail kartu untuk melihat rincian anggota, slip, dan aksi transfer.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={fetchData}
            style={{
              padding: '8px 14px',
              background: '#f8fafc',
              border: '1px solid var(--line)',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              color: 'var(--navy)'
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {actionMessage && (
        <div style={{
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          color: '#059669',
          padding: '10px 16px',
          borderRadius: '8px',
          fontWeight: 600,
          fontSize: '13px'
        }}>
          {actionMessage}
        </div>
      )}

      {availableDates.length === 0 && !loading && (
        <div style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '12px',
          padding: '24px',
          textAlign: 'center',
          color: '#1e3a8a'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>💸</div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', fontWeight: 800 }}>Belum Ada Data Gaji yang Dikirim</h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#3b82f6', maxWidth: '540px', marginInline: 'auto' }}>
            Data gaji tersimpan saat Anda melakukan aksi <strong>"Kirim Gaji"</strong> dari menu <strong>Laporan List Dapat</strong>. Silakan buka menu Laporan List Dapat dan klik tombol hijau <strong>💸 Kirim Gaji</strong> untuk memasukkan data gaji hari ini ke menu Gaji.
          </p>
        </div>
      )}

      {/* Primary Tab Navigation Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px', gap: '4px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('payroll')}
            style={{
              padding: '8px 18px',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'payroll' ? 'white' : 'transparent',
              color: activeTab === 'payroll' ? 'var(--navy)' : 'var(--muted)',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: activeTab === 'payroll' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s'
            }}
          >
            💰 Rekap & Katalog Gaji
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bidders')}
            style={{
              padding: '8px 18px',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'bidders' ? 'white' : 'transparent',
              color: activeTab === 'bidders' ? 'var(--navy)' : 'var(--muted)',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: activeTab === 'bidders' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s'
            }}
          >
            👥 Anggota & Alias ({membersAndAliases.length})
          </button>
        </div>
      </div>

      {/* SECTION 1: REKAP & KATALOG GAJI (4-CARD GRID, MONTHLY PAGINATION & WEEKLY SEPARATORS) */}
      {activeTab === 'payroll' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Summary Metrics Bar for Selected Dates / Active Month */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div style={{ background: 'white', padding: '16px 20px', borderRadius: '10px', border: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Siap Ditransfer</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#f59e0b', marginTop: '2px' }}>
                  Rp {new Intl.NumberFormat('id-ID').format(payrollMetrics.unpaidRupiah)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{payrollMetrics.unpaidCount} orang pending</div>
              </div>
              <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                ⏳
              </div>
            </div>

            <div style={{ background: 'white', padding: '16px 20px', borderRadius: '10px', border: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Sudah Ditransfer</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
                  Rp {new Intl.NumberFormat('id-ID').format(payrollMetrics.paidRupiah)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{payrollMetrics.paidCount} orang lunas</div>
              </div>
              <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                ✅
              </div>
            </div>

            <div style={{ background: 'white', padding: '16px 20px', borderRadius: '10px', border: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Barang & Poin</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--navy)', marginTop: '2px' }}>
                  {payrollMetrics.totalUnits} unit
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>= {payrollMetrics.totalPoints} poin fee</div>
              </div>
              <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                📦
              </div>
            </div>

            <div style={{ background: 'white', padding: '16px 20px', borderRadius: '10px', border: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Jumlah Anggota (PIC)</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#8b5cf6', marginTop: '2px' }}>
                  {payrollMetrics.totalPeople} orang
                </div>
              </div>
              <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                👥
              </div>
            </div>
          </div>

          {/* MONTHLY NAVIGATION & TOOLBAR (1 HALAMAN = 1 BULAN) */}
          <div style={{
            background: 'white',
            padding: '16px 20px',
            borderRadius: '12px',
            border: '1px solid var(--line)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px'
          }}>
            {/* Left: Month Navigator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handlePrevMonth}
                disabled={availableMonths.indexOf(selectedMonth) >= availableMonths.length - 1}
                style={{
                  padding: '7px 12px',
                  background: availableMonths.indexOf(selectedMonth) >= availableMonths.length - 1 ? '#f8fafc' : '#eff6ff',
                  color: availableMonths.indexOf(selectedMonth) >= availableMonths.length - 1 ? '#94a3b8' : '#1d4ed8',
                  border: '1px solid #bfdbfe',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: availableMonths.indexOf(selectedMonth) >= availableMonths.length - 1 ? 'not-allowed' : 'pointer'
                }}
                title="Pindah ke bulan sebelumnya"
              >
                ◀ Bulan Lalu
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>📅</span>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '8px',
                    border: '1.5px solid #2563eb',
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    fontSize: '14px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  {availableMonths.map(mKey => (
                    <option key={mKey} value={mKey}>
                      {formatMonthLabel(mKey)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                disabled={availableMonths.indexOf(selectedMonth) <= 0}
                style={{
                  padding: '7px 12px',
                  background: availableMonths.indexOf(selectedMonth) <= 0 ? '#f8fafc' : '#eff6ff',
                  color: availableMonths.indexOf(selectedMonth) <= 0 ? '#94a3b8' : '#1d4ed8',
                  border: '1px solid #bfdbfe',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: availableMonths.indexOf(selectedMonth) <= 0 ? 'not-allowed' : 'pointer'
                }}
                title="Pindah ke bulan berikutnya"
              >
                Bulan Berikut ▶
              </button>

              <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '12px', fontWeight: 700 }}>
                {currentMonthDates.length} Hari Kerja di Bulan Ini
              </span>
            </div>

            {/* Right: Quick Batch Selection Presets */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  if (currentMonthDates.length > 0) {
                    setSelectedDates([currentMonthDates[0]]);
                  }
                }}
                style={{
                  padding: '6px 11px',
                  fontSize: '12px',
                  background: selectedDates.length === 1 && selectedDates[0] === currentMonthDates[0] ? '#eff6ff' : '#f8fafc',
                  color: selectedDates.length === 1 && selectedDates[0] === currentMonthDates[0] ? '#1d4ed8' : 'var(--navy)',
                  border: '1px solid var(--line)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                Hari Terakhir
              </button>

              <button
                type="button"
                onClick={() => {
                  if (currentMonthDates.length > 0) {
                    setSelectedDates(currentMonthDates.slice(0, 2));
                  }
                }}
                style={{
                  padding: '6px 11px',
                  fontSize: '12px',
                  background: selectedDates.length === 2 ? '#eff6ff' : '#f8fafc',
                  color: selectedDates.length === 2 ? '#1d4ed8' : 'var(--navy)',
                  border: '1px solid var(--line)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                Gabung 2 Hari
              </button>

              <button
                type="button"
                onClick={() => {
                  if (currentMonthDates.length > 0) {
                    setSelectedDates(currentMonthDates.slice(0, 3));
                  }
                }}
                style={{
                  padding: '6px 11px',
                  fontSize: '12px',
                  background: selectedDates.length === 3 ? '#eff6ff' : '#f8fafc',
                  color: selectedDates.length === 3 ? '#1d4ed8' : 'var(--navy)',
                  border: '1px solid var(--line)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                Gabung 3 Hari
              </button>

              <button
                type="button"
                onClick={() => setSelectedDates([...currentMonthDates])}
                style={{
                  padding: '6px 11px',
                  fontSize: '12px',
                  background: selectedDates.length === currentMonthDates.length && currentMonthDates.length > 0 ? '#eff6ff' : '#f8fafc',
                  color: selectedDates.length === currentMonthDates.length && currentMonthDates.length > 0 ? '#1d4ed8' : 'var(--navy)',
                  border: '1px solid var(--line)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                Pilih Semua Bulan Ini ({currentMonthDates.length})
              </button>

              {selectedDates.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedDates([])}
                  style={{
                    padding: '6px 11px',
                    fontSize: '12px',
                    background: '#fef2f2',
                    color: '#dc2626',
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 700
                  }}
                >
                  ✕ Reset Pilihan
                </button>
              )}
            </div>
          </div>

          {/* 1. SPECIAL COMBINED CARD (Visible when 2+ dates are selected) */}
          {selectedDates.length > 1 && (() => {
            const combined = getPayrollDataForDates(selectedDates);
            const isExpanded = isCardExpanded('combined', true);
            const filteredList = combined.payrollList.filter((p: any) => {
              const q = searchQuery.toLowerCase().trim();
              const matchQuery = !q || p.person.toLowerCase().includes(q) || (p.alias && p.alias.toLowerCase().includes(q)) || p.displayName.toLowerCase().includes(q);
              const matchTransfer = filterTransferStatus === 'all' || (filterTransferStatus === 'paid' && p.isTransferred) || (filterTransferStatus === 'unpaid' && !p.isTransferred);
              return matchQuery && matchTransfer;
            });

            return (
              <div
                key="combined_catalog_card"
                style={{
                  background: '#f8fafc',
                  borderRadius: '12px',
                  border: '2px solid #2563eb',
                  boxShadow: '0 4px 14px rgba(37,99,235,0.08)',
                  overflow: 'hidden'
                }}
              >
                {/* Combined Card Header */}
                <div style={{
                  padding: '16px 20px',
                  background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{
                    background: '#2563eb',
                    color: 'white',
                    padding: '3px 10px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '0.3px'
                  }}>
                    ✨ REKAP GABUNGAN ({selectedDates.length} HARI)
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e3a8a' }}>
                    {selectedDates[selectedDates.length - 1]} s/d {selectedDates[0]}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '3px' }}>
                  Rincian gabungan gaji untuk {selectedDates.length} tanggal yang dipilih bersamaan
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'white', padding: '6px 14px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--navy)' }}>📦 {combined.totalUnits} unit</span>
                  <span style={{ color: '#cbd5e1' }}>|</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#8b5cf6' }}>👥 {combined.totalPeople} orang</span>
                  <span style={{ color: '#cbd5e1' }}>|</span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#10b981' }}>Rp {new Intl.NumberFormat('id-ID').format(combined.totalRupiah)}</span>
                  <span style={{ color: '#cbd5e1' }}>|</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: combined.isAllPaid ? '#059669' : '#d97706' }}>
                    {combined.isAllPaid ? '✓ Lunas' : `${combined.unpaidCount} Pending`}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopyBatchSummaryForDates(selectedDates, combined.payrollList, combined)}
                  style={{
                    padding: '8px 14px',
                    background: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(37,99,235,0.25)'
                  }}
                  title="Salin rekap WhatsApp format gabungan"
                >
                  Salin WA Gabungan
                </button>

                <button
                  type="button"
                  onClick={() => toggleCardExpanded('combined', true)}
                  style={{
                    padding: '8px 14px',
                    background: 'white',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {isExpanded ? 'Tutup Detail' : 'Buka Detail'}
                </button>
              </div>
            </div>

            {/* Combined Card Body (Embedded Detail Table) */}
            {isExpanded && (
              <div style={{ padding: '16px 20px', background: 'white', borderTop: '1px solid #bfdbfe' }}>
                {/* Search & Bulk Transfer Toolbar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedPeople.length > 0 && selectedPeople.length === filteredList.length}
                        onChange={() => {
                          if (selectedPeople.length === filteredList.length) {
                            setSelectedPeople([]);
                          } else {
                            setSelectedPeople(filteredList.map((p: any) => p.person));
                          }
                        }}
                      />
                      Pilih Semua ({selectedPeople.length} terpilih)
                    </label>

                    {selectedPeople.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleBatchMarkTransferred(combined.payrollList, selectedDates)}
                        style={{
                          padding: '6px 12px',
                          background: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        ✓ Tandai {selectedPeople.length} Sudah Ditransfer
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="🔍 Cari nama anggota..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--line)',
                        fontSize: '12px',
                        width: '180px'
                      }}
                    />

                    <select
                      value={filterTransferStatus}
                      onChange={(e: any) => setFilterTransferStatus(e.target.value)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--line)',
                        fontSize: '12px',
                        background: 'white'
                      }}
                    >
                      <option value="all">Semua Status</option>
                      <option value="unpaid">⏳ Belum Ditransfer</option>
                      <option value="paid">✅ Sudah Ditransfer</option>
                    </select>
                  </div>
                </div>

                {/* Embedded Table for Combined Card */}
                <div style={{ overflowX: 'auto', border: '1px solid #bfdbfe', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'auto' }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <tr>
                        <th style={{ padding: '10px 12px', width: '36px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedPeople.length > 0 && selectedPeople.length === filteredList.length}
                            onChange={() => {
                              if (selectedPeople.length === filteredList.length) {
                                setSelectedPeople([]);
                              } else {
                                setSelectedPeople(filteredList.map((p: any) => p.person));
                              }
                            }}
                          />
                        </th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', minWidth: '180px' }}>Nama Anggota (PIC)</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', width: '90px' }}>Total Unit</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', minWidth: '150px' }}>Rincian Poin Fee</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right', width: '130px' }}>Total Gaji (Rp)</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', width: '130px' }}>Status Transfer</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center', width: '150px' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredList.length > 0 ? (
                        filteredList.map((p: any, idx: number) => {
                          const isChecked = selectedPeople.includes(p.person);
                          const initial = p.person ? p.person.charAt(0).toUpperCase() : '?';
                          return (
                            <tr
                              key={p.person}
                              style={{
                                borderBottom: '1px solid #f1f5f9',
                                background: isChecked ? '#eff6ff' : (idx % 2 === 0 ? 'white' : '#fafbfc'),
                                transition: 'background 0.15s'
                              }}
                            >
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setSelectedPeople(selectedPeople.filter(n => n !== p.person));
                                    } else {
                                      setSelectedPeople([...selectedPeople, p.person]);
                                    }
                                  }}
                                />
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '6px',
                                    background: '#eff6ff',
                                    color: '#2563eb',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 800,
                                    fontSize: '12px',
                                    flexShrink: 0
                                  }}>
                                    {initial}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 800, color: 'var(--navy)', fontSize: '13.5px' }}>{p.person}</span>
                                    {p.alias && p.alias.toLowerCase() !== p.person.toLowerCase() && (
                                      <span style={{
                                        background: '#eff6ff',
                                        color: '#1d4ed8',
                                        border: '1px solid #bfdbfe',
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: 700
                                      }}>
                                        ({p.alias})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <span style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px', fontWeight: 700, fontSize: '12px', color: 'var(--navy)' }}>
                                  {p.totalUnits} unit
                                </span>
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                <span style={{
                                  fontFamily: 'monospace',
                                  fontWeight: 600,
                                  fontSize: '12px',
                                  color: '#2563eb',
                                  background: '#eff6ff',
                                  padding: '2px 6px',
                                  borderRadius: '4px'
                                }}>
                                  {p.formulaText || '-'}
                                </span>
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#059669' }}>
                                  Rp {new Intl.NumberFormat('id-ID').format(p.totalRupiah)}
                                </div>
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                {p.isTransferred ? (
                                  <button
                                    type="button"
                                    onClick={() => p.transferInfo && handleUnmarkTransferred(p.transferInfo.id)}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      background: '#ecfdf5',
                                      color: '#059669',
                                      border: '1px solid #a7f3d0',
                                      cursor: 'pointer'
                                    }}
                                    title="Klik untuk membatalkan tanda transfer"
                                  >
                                    ✓ Lunas
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleMarkTransferred(p.person, p.totalUnits, p.totalFeePoints, p.totalRupiah, selectedDates)}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      background: '#fffbeb',
                                      color: '#d97706',
                                      border: '1px solid #fde68a',
                                      cursor: 'pointer'
                                    }}
                                    title="Klik untuk menandai sudah ditransfer"
                                  >
                                    ⏳ Pending
                                  </button>
                                )}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => setDetailPerson(p.person)}
                                    style={{
                                      padding: '4px 8px',
                                      fontSize: '11.5px',
                                      background: '#f8fafc',
                                      color: '#334155',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontWeight: 600,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px'
                                    }}
                                    title="Lihat rincian barang"
                                  >
                                    Detail
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleCopyPersonSlip(p, selectedDates)}
                                    style={{
                                      padding: '4px 8px',
                                      fontSize: '11.5px',
                                      background: copiedPersonSlip === p.person ? '#10b981' : '#eff6ff',
                                      color: copiedPersonSlip === p.person ? 'white' : '#2563eb',
                                      border: '1px solid #bfdbfe',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontWeight: 700,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px'
                                    }}
                                    title="Salin format slip WhatsApp"
                                  >
                                    {copiedPersonSlip === p.person ? 'Tersalin' : 'Slip'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
                            Tidak ada data anggota untuk kriteria pencarian ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* 2. WEEKLY GROUPED CATALOG LIST (1 ROW = 4 CARDS, GROUPED BY WEEKS IN ACTIVE MONTH) */}
      {currentMonthWeeks.length > 0 ? (
        currentMonthWeeks.map(week => (
          <div key={`week_section_${week.weekIndex}`} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* WEEKLY HEADER SEPARATOR */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)',
              padding: '12px 18px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>📌</span>
                <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--navy)' }}>
                  {week.weekTitle}
                </span>
                <span style={{ fontSize: '11px', background: '#e2e8f0', color: '#334155', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                  {week.dates.length} Hari Kerja
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                  📦 <strong style={{ color: 'var(--navy)' }}>{week.totalUnits}</strong> unit • 👥 <strong style={{ color: '#8b5cf6' }}>{week.totalPeople}</strong> orang • 💵 <strong style={{ color: '#059669' }}>Rp {new Intl.NumberFormat('id-ID').format(week.totalRupiah)}</strong>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const allSelected = week.dates.every(d => selectedDates.includes(d));
                    if (allSelected) {
                      setSelectedDates(selectedDates.filter(d => !week.dates.includes(d)));
                    } else {
                      const combined = Array.from(new Set([...selectedDates, ...week.dates]));
                      setSelectedDates(combined.sort((a, b) => b.localeCompare(a)));
                    }
                  }}
                  style={{
                    padding: '5px 12px',
                    fontSize: '11px',
                    background: week.dates.every(d => selectedDates.includes(d)) ? '#2563eb' : 'white',
                    color: week.dates.every(d => selectedDates.includes(d)) ? 'white' : '#1d4ed8',
                    border: `1px solid ${week.dates.every(d => selectedDates.includes(d)) ? '#2563eb' : '#bfdbfe'}`,
                    borderRadius: '6px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  {week.dates.every(d => selectedDates.includes(d)) ? '✓ Terpilih Semua' : 'Pilih Minggu Ini'}
                </button>
              </div>
            </div>

            {/* 5 CARDS PER ROW GRID (1 WORKWEEK IN 1 ROW) */}
            <div className="catalog-grid-5">
              {week.dates.map(dateStr => {
                const cardData = getPayrollDataForDates([dateStr]);
                const isSelected = selectedDates.includes(dateStr);

                return (
                  <div
                    key={dateStr}
                    style={{
                      background: 'white',
                      borderRadius: '10px',
                      border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      boxShadow: isSelected ? '0 4px 14px rgba(37,99,235,0.12)' : '0 1px 3px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      transition: 'all 0.15s ease',
                      position: 'relative'
                    }}
                  >
                    {/* Top: Date Header & Status */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px', marginBottom: '8px' }}>
                        <label
                          style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 800, color: isSelected ? '#1d4ed8' : 'var(--navy)', minWidth: 0 }}
                          title="Centang untuk menggabungkan hari ini ke rekap gaji"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleDate(dateStr)}
                            style={{ cursor: 'pointer', width: '14px', height: '14px', flexShrink: 0 }}
                          />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            📅 {formatDateLabelIndo(dateStr)}
                          </span>
                        </label>

                        <span style={{
                          fontSize: '9.5px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '10px',
                          background: cardData.isAllPaid ? '#ecfdf5' : '#fef3c7',
                          color: cardData.isAllPaid ? '#059669' : '#d97706',
                          border: `1px solid ${cardData.isAllPaid ? '#a7f3d0' : '#fde68a'}`,
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}>
                          {cardData.isAllPaid ? '✓ Lunas' : `${cardData.unpaidCount} Pending`}
                        </span>
                      </div>

                      {/* Quick Summary Row */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: isSelected ? '#eff6ff' : '#f8fafc',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: `1px solid ${isSelected ? '#bfdbfe' : '#f1f5f9'}`,
                        marginBottom: '8px',
                        fontSize: '11px'
                      }}>
                        <span style={{ fontWeight: 700, color: 'var(--navy)' }}>📦 {cardData.totalUnits} unit</span>
                        <span style={{ fontWeight: 800, color: '#059669', fontSize: '11.5px' }}>
                          Rp {new Intl.NumberFormat('id-ID').format(cardData.totalRupiah)}
                        </span>
                      </div>

                      {/* Member List Header */}
                      <div style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: 'var(--muted)',
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.3px',
                        display: 'flex',
                        justifyContent: 'space-between'
                      }}>
                        <span>Anggota ({cardData.totalPeople})</span>
                        <span>Total / Fee</span>
                      </div>

                      {/* Member List Container (List Nama dan Total Per Orang yang Mendapat) */}
                      <div style={{
                        maxHeight: '160px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        paddingRight: '2px',
                        marginBottom: '10px'
                      }}>
                        {cardData.payrollList.length > 0 ? (
                          cardData.payrollList.map((person: any) => (
                            <div
                              key={person.person}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: '#f8fafc',
                                padding: '4px 6px',
                                borderRadius: '5px',
                                border: '1px solid #e2e8f0',
                                fontSize: '11px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                                <span style={{
                                  width: '16px',
                                  height: '16px',
                                  borderRadius: '50%',
                                  background: person.isTransferred ? '#ecfdf5' : '#eff6ff',
                                  color: person.isTransferred ? '#059669' : '#1d4ed8',
                                  fontSize: '9px',
                                  fontWeight: 800,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}>
                                  {person.person.charAt(0).toUpperCase()}
                                </span>
                                <div style={{ fontWeight: 700, color: 'var(--navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '11px' }}>
                                  {person.person}
                                  {person.alias && person.alias.toLowerCase() !== person.person.toLowerCase() && (
                                    <span style={{ fontSize: '9px', color: '#64748b', marginLeft: '2px' }}>({person.alias})</span>
                                  )}
                                </div>
                              </div>

                              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '4px' }}>
                                <div style={{ fontWeight: 800, color: '#059669', fontSize: '10.5px' }}>
                                  Rp {new Intl.NumberFormat('id-ID').format(person.totalRupiah)}
                                </div>
                                <div style={{ fontSize: '9px', color: 'var(--muted)' }}>
                                  {person.totalUnits}u {person.formulaParts.length > 0 ? `(${person.formulaParts.join('+')})` : ''}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '12px 0', fontSize: '11px' }}>
                            Tidak ada data anggota
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Bottom Actions */}
                    <div style={{
                      borderTop: '1px solid #f1f5f9',
                      paddingTop: '8px',
                      display: 'flex',
                      gap: '4px',
                      alignItems: 'center'
                    }}>
                      <button
                        type="button"
                        onClick={() => handleCopyBatchSummaryForDates([dateStr], cardData.payrollList, cardData)}
                        style={{
                          flex: 1,
                          padding: '5px 4px',
                          background: '#f8fafc',
                          color: 'var(--navy)',
                          border: '1px solid #cbd5e1',
                          borderRadius: '5px',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Salin rekap WhatsApp untuk hari ini"
                      >
                        Salin
                      </button>

                      <button
                        type="button"
                        onClick={() => setModalDetailDate(dateStr)}
                        style={{
                          flex: 1,
                          padding: '5px 4px',
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          border: '1px solid #bfdbfe',
                          borderRadius: '5px',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Lihat rincian lengkap barang & transfer"
                      >
                        Rincian
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteBatch(dateStr)}
                        style={{
                          padding: '5px 6px',
                          background: '#fef2f2',
                          color: '#dc2626',
                          border: '1px solid #fecaca',
                          borderRadius: '5px',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                        title="Hapus seluruh data list tanggal ini dari Gaji"
                      >
                        🗑️
                      </button>

                      {!cardData.isAllPaid && (
                        <button
                          type="button"
                          onClick={() => {
                            const unpaidPeople = cardData.payrollList.filter((p: any) => !p.isTransferred).map((p: any) => p.person);
                            setSelectedPeople(unpaidPeople);
                            handleBatchMarkTransferred(cardData.payrollList, [dateStr]);
                          }}
                          style={{
                            padding: '5px 6px',
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            fontSize: '10.5px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                          title="Tandai semua anggota di tanggal ini lunas ditransfer"
                        >
                          ✓
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      ) : (
        <div style={{ background: 'white', padding: '36px', borderRadius: '12px', textAlign: 'center', color: 'var(--muted)', border: '1px solid var(--line)' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📅</div>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', color: 'var(--navy)', fontWeight: 700 }}>
            Tidak Ada Tanggal Bidding di Bulan {formatMonthLabel(selectedMonth)}
          </h4>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
            Gunakan tombol navigasi di atas untuk berpindah ke bulan lain yang memiliki data gaji.
          </p>
        </div>
      )}
    </div>
  )}

      {/* TAB 3: DAFTAR ANGGOTA & ALIAS (CLEAN & MODERN GRID WITH MERGE & MULTI-ALIAS) */}
      {activeTab === 'bidders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Header & Controls Card */}
          <div style={{
            background: 'white',
            padding: '16px 20px',
            borderRadius: '12px',
            border: '1px solid var(--line)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--navy)' }}>
                  👥 Anggota & Alias Bidding
                </h3>
                <span style={{ background: '#f1f5f9', color: 'var(--navy)', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                  {membersAndAliases.length} Anggota
                </span>
                <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                  {membersAndAliases.filter(m => m.alias && m.alias.trim()).length} Punya Alias
                </span>
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                Kelola anggota, buat multiple alias (pisahkan koma), atau gabungkan nama-nama mirip ke satu nama utama.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="🔍 Cari nama atau alias..."
                value={searchMemberQuery}
                onChange={e => setSearchMemberQuery(e.target.value)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--line)',
                  fontSize: '13px',
                  width: '200px',
                  background: '#f8fafc'
                }}
              />

              <button
                type="button"
                onClick={() => handleOpenMergeModal()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  background: 'linear-gradient(135deg, #4f46e5, #4338ca)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(79,70,229,0.25)',
                  transition: 'all 0.15s'
                }}
              >
                <span>🔗</span>
                Gabungkan Anggota
              </button>

              <button
                type="button"
                onClick={() => setModalMember({ isEdit: false, name: '', alias: '', notes: '' })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
                  transition: 'all 0.15s'
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Tambah Anggota
              </button>
            </div>
          </div>

          {/* Smart Similar Name Suggester Banner */}
          {similarMemberSuggestions.length > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%)',
              border: '1px solid #f0abfc',
              borderRadius: '12px',
              padding: '14px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>💡</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#86198f' }}>
                  Rekomendasi Penggabungan Nama Mirip ({similarMemberSuggestions.length} Pasangan Ditemukan):
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {similarMemberSuggestions.slice(0, 5).map((sug, sIdx) => (
                  <div key={sIdx} style={{
                    background: 'white',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e879f9',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#701a75' }}>
                      <strong>{sug.memberA}</strong> ↔ <strong>{sug.memberB}</strong>
                    </span>
                    <span style={{ fontSize: '11px', color: '#a21caf', background: '#fdf4ff', padding: '1px 6px', borderRadius: '4px' }}>
                      {Math.round(sug.score * 100)}% mirip
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenMergeModal(sug.memberA, [sug.memberB])}
                      style={{
                        background: '#9333ea',
                        color: 'white',
                        border: 'none',
                        padding: '3px 10px',
                        borderRadius: '5px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      🔗 Gabungkan
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bulk Selection Bar */}
          {selectedMemberNamesForMerge.length > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
              color: 'white',
              padding: '12px 20px',
              borderRadius: '10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 4px 12px rgba(49,46,129,0.25)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '16px' }}>📌</span>
                <span style={{ fontSize: '13px', fontWeight: 700 }}>
                  {selectedMemberNamesForMerge.length} Anggota Dipilih: {selectedMemberNamesForMerge.join(', ')}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleOpenMergeModal()}
                  style={{
                    background: '#6366f1',
                    color: 'white',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  🔗 Gabungkan Anggota Terpilih
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMemberNamesForMerge([])}
                  style={{
                    background: 'rgba(255,255,255,0.15)',
                    color: 'white',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12.5px',
                    cursor: 'pointer'
                  }}
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          {/* Members Clean List View */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            border: '1px solid var(--line)',
            overflow: 'hidden'
          }}>
            {displayedMembers.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {displayedMembers.map((m, idx) => {
                  const initials = m.name.slice(0, 2).toUpperCase();
                  const aliasesList = splitAliases(m.alias);
                  const isChecked = selectedMemberNamesForMerge.includes(m.name);

                  return (
                    <div
                      key={m.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 20px',
                        borderBottom: idx === displayedMembers.length - 1 ? 'none' : '1px solid #f1f5f9',
                        background: isChecked ? '#f5f3ff' : 'white',
                        transition: 'background 0.15s',
                        gap: '12px',
                        flexWrap: 'wrap'
                      }}
                      onMouseEnter={(e) => { if (!isChecked) e.currentTarget.style.background = '#f8fafc'; }}
                      onMouseLeave={(e) => { if (!isChecked) e.currentTarget.style.background = 'white'; }}
                    >
                      {/* Left: Checkbox, Number, Avatar & Name */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '240px' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelectMemberForMerge(m.name)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                          title="Pilih anggota untuk digabungkan"
                        />

                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--muted)', width: '22px', textAlign: 'center' }}>
                          {idx + 1}
                        </span>

                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '13px',
                          flexShrink: 0
                        }}>
                          {initials}
                        </div>

                        <div>
                          <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>{m.name}</span>
                            <span style={{ background: '#ecfdf5', color: '#059669', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                              ✓ Anggota
                            </span>
                            {aliasesList.length > 1 && (
                              <span style={{ background: '#eff6ff', color: '#2563eb', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                                {aliasesList.length} Alias
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Middle: Multi-Alias Badges */}
                      <div style={{ flex: 1, minWidth: '220px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                        {aliasesList.length > 0 ? (
                          <>
                            <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, marginRight: '4px' }}>
                              Alias ({aliasesList.length}):
                            </span>
                            {aliasesList.map((ali, aIdx) => (
                              <span
                                key={aIdx}
                                style={{
                                  background: '#eff6ff',
                                  color: '#1d4ed8',
                                  border: '1px solid #bfdbfe',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontWeight: 700,
                                  fontSize: '11.5px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                              >
                                🏷️ {ali}
                              </span>
                            ))}
                          </>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                            — (Sama dengan nama)
                          </span>
                        )}
                      </div>

                      {/* Right: Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => setModalMember({ isEdit: true, name: m.name, alias: m.alias || '', notes: m.notes || '' })}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 700,
                            transition: 'all 0.15s'
                          }}
                        >
                          ✏️ Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenMergeModal(m.name, [])}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 10px',
                            fontSize: '12px',
                            background: '#f5f3ff',
                            color: '#6366f1',
                            border: '1px solid #ddd6fe',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 700,
                            transition: 'all 0.15s'
                          }}
                          title={`Gabungkan anggota lain ke ${m.name}`}
                        >
                          🔗 Gabung
                        </button>

                        {!m.isOwner && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMember(m.name)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '6px 10px',
                              fontSize: '12px',
                              background: '#fef2f2',
                              color: '#dc2626',
                              border: '1px solid #fecaca',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: 700,
                              transition: 'all 0.15s'
                            }}
                            title={`Hapus anggota ${m.name}`}
                          >
                            🗑️ Hapus
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{
                padding: '32px',
                textAlign: 'center',
                color: 'var(--muted)'
              }}>
                Tidak ada anggota yang cocok dengan pencarian "{searchMemberQuery}".
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: TAMBAH / EDIT ANGGOTA & MULTIPLE ALIAS */}
      {modalMember && (
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
          zIndex: 9999,
          padding: '20px'
        }}>
          <form
            onSubmit={handleSaveMemberAlias}
            style={{
              background: 'white',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '480px',
              padding: '22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '17px', color: 'var(--navy)', fontWeight: 800 }}>
                {modalMember.isEdit ? `✏️ Edit Anggota & Alias: ${modalMember.name}` : '➕ Tambah Anggota / Alias Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setModalMember(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--muted)' }}
              >
                ✕
              </button>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--navy)', marginBottom: '4px' }}>
                Nama Anggota Asli (PIC Utama):
              </label>
              <input
                type="text"
                value={modalMember.name}
                onChange={e => setModalMember({ ...modalMember, name: e.target.value })}
                placeholder="Contoh: Wenda, Fikri, Bilqis, dll."
                disabled={modalMember.isEdit}
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--line)',
                  fontSize: '13px',
                  background: modalMember.isEdit ? '#f8fafc' : 'white'
                }}
                autoFocus={!modalMember.isEdit}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--navy)' }}>
                  Alias / Nama Akun Bidding (Bisa Lebih dari 1):
                </label>
                <span style={{ fontSize: '11px', color: '#6366f1', fontWeight: 600 }}>
                  Pisahkan dengan tanda koma (,)
                </span>
              </div>
              <input
                type="text"
                value={modalMember.alias}
                onChange={e => setModalMember({ ...modalMember, alias: e.target.value })}
                placeholder="Contoh: bilqis, bilqiis, bilqis 2, bq"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--line)',
                  fontSize: '13px'
                }}
                autoFocus={modalMember.isEdit}
              />
              <p style={{ margin: '4px 0 0 0', fontSize: '11.5px', color: 'var(--muted)' }}>
                💡 Masukkan semua variasi nama bidding yang digunakan orang ini. Sistem akan otomatis menyatukannya saat rekapitulasi gaji.
              </p>

              {/* Live Preview Alias Tags */}
              {splitAliases(modalMember.alias).length > 0 && (
                <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Preview Alias:</span>
                  {splitAliases(modalMember.alias).map((al, alIdx) => (
                    <span
                      key={alIdx}
                      style={{
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #bfdbfe',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700
                      }}
                    >
                      🏷️ {al}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--line)' }}>
              <div>
                {modalMember.isEdit && !isOwnerPerson(modalMember.name) && (
                  <button
                    type="button"
                    onClick={() => handleDeleteMember(modalMember.name)}
                    style={{
                      padding: '9px 16px',
                      background: '#fef2f2',
                      color: '#b91c1c',
                      border: '1.5px solid #fca5a5',
                      borderRadius: '8px',
                      fontSize: '13px',
                      cursor: 'pointer',
                      fontWeight: 700,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}
                  >
                    🗑️ Hapus Anggota
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModalMember(null)}
                  style={{
                    padding: '9px 18px',
                    background: '#ffffff',
                    color: '#1e293b',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    fontWeight: 700,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '9px 22px',
                    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(37,99,235,0.3)'
                  }}
                >
                  Simpan
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: GABUNGKAN ANGGOTA (MERGE MEMBERS) */}
      {showMergeModal && (
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
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '560px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '18px 22px',
              borderBottom: '1px solid var(--line)',
              background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🔗</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', color: '#4338ca', fontWeight: 800 }}>
                    Gabungkan Anggota & Alias
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#6366f1' }}>
                    Satukan nama-nama mirip menjadi 1 Nama Asli Utama dengan multiple alias.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMergeModal(false)}
                style={{
                  background: 'white',
                  border: '1px solid #ddd6fe',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '15px',
                  cursor: 'pointer',
                  color: '#4338ca'
                }}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Step 1: Target Canonical Name */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--navy)', marginBottom: '6px' }}>
                  1. Pilih Nama Asli Utama (Target yang Dipertahankan):
                </label>
                <select
                  value={mergeTargetName}
                  onChange={e => handleSelectMergeTarget(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #6366f1',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    background: '#f5f3ff',
                    color: '#312e81'
                  }}
                >
                  <option value="">-- Pilih Nama Utama --</option>
                  {membersAndAliases.map(m => (
                    <option key={m.name} value={m.name}>
                      {m.name} {m.alias ? `(Alias: ${m.alias})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: Source Names to Merge */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--navy)', marginBottom: '6px' }}>
                  2. Pilih Anggota yang Akan Digabungkan ke "{mergeTargetName || 'Target'}":
                </label>
                <div style={{
                  maxHeight: '160px',
                  overflowY: 'auto',
                  border: '1px solid var(--line)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  background: '#f8fafc'
                }}>
                  {membersAndAliases
                    .filter(m => m.name.toLowerCase() !== mergeTargetName.toLowerCase() && !m.isOwner)
                    .map(m => {
                      const isSrcChecked = mergeSourceNames.includes(m.name);
                      return (
                        <label
                          key={m.name}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            padding: '4px 6px',
                            borderRadius: '6px',
                            background: isSrcChecked ? '#ede9fe' : 'transparent'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSrcChecked}
                            onChange={() => handleToggleMergeSource(m.name)}
                          />
                          <span style={{ fontWeight: isSrcChecked ? 700 : 500, color: isSrcChecked ? '#4338ca' : '#334155' }}>
                            {m.name} {m.alias ? `(Alias: ${m.alias})` : ''}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>

              {/* Step 3: Resulting Combined Aliases */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--navy)' }}>
                    3. Hasil Daftar Alias Baru untuk "{mergeTargetName}":
                  </label>
                  <span style={{ fontSize: '11px', color: '#6366f1', fontWeight: 600 }}>
                    Pisahkan koma (,)
                  </span>
                </div>
                <input
                  type="text"
                  value={mergeCustomAlias}
                  onChange={e => setMergeCustomAlias(e.target.value)}
                  placeholder="Contoh: bilqiis, bilqis 2, bq"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--line)',
                    fontSize: '13px'
                  }}
                />

                {splitAliases(mergeCustomAlias).length > 0 && (
                  <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Preview Tags:</span>
                    {splitAliases(mergeCustomAlias).map((al, alIdx) => (
                      <span
                        key={alIdx}
                        style={{
                          background: '#ede9fe',
                          color: '#4338ca',
                          border: '1px solid #c7d2fe',
                          padding: '2px 7px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700
                        }}
                      >
                        🏷️ {al}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '14px 22px',
              borderTop: '1px solid var(--line)',
              background: '#f8fafc',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                type="button"
                onClick={() => setShowMergeModal(false)}
                className="secondary-button"
                style={{ padding: '8px 16px' }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteMergeMembers}
                style={{
                  padding: '8px 20px',
                  background: 'linear-gradient(135deg, #4f46e5, #4338ca)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(79,70,229,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>⚡</span>
                Konfirmasi Gabungkan Anggota
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DETAIL BARANG PER ORANG */}
      {detailPerson && (() => {
        const canonicalTarget = getCanonicalName(detailPerson).toLowerCase().trim();
        const personItems = filteredActiveItems.filter(it => {
          const rawPerson = (it.person || '').trim().toLowerCase();
          const canonicalIt = getCanonicalName(it.person || '').toLowerCase().trim();
          return rawPerson === detailPerson.toLowerCase().trim() || canonicalIt === canonicalTarget;
        });

        const totalPersonUnits = personItems.length;
        const totalPersonPoints = personItems.reduce((acc, it) => {
          if (!it.fee_info) return acc;
          const feeVal = parseInt(it.fee_info.replace(/[()]/g, '').trim(), 10);
          return !isNaN(feeVal) ? acc + feeVal : acc;
        }, 0);
        const totalPersonRupiah = totalPersonPoints * 1000;

        return (
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
            zIndex: 9999,
            padding: '20px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(226, 232, 240, 0.8)'
            }}>
              {/* Header */}
              <div style={{
                padding: '18px 24px',
                borderBottom: '1px solid #f1f5f9',
                background: 'linear-gradient(to right, #ffffff, #f8fafc)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: '#eff6ff',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    fontWeight: 'bold',
                    flexShrink: 0
                  }}>
                    📦
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '17px', color: '#0f172a', fontWeight: 800 }}>
                      Rincian Barang: {getDisplayName(detailPerson || '')}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                      <span style={{
                        background: '#f1f5f9',
                        color: '#475569',
                        padding: '2px 8px',
                        borderRadius: '20px',
                        fontSize: '11.5px',
                        fontWeight: 600
                      }}>
                        {totalPersonUnits} unit
                      </span>
                      <span style={{
                        background: '#ecfdf5',
                        color: '#059669',
                        border: '1px solid #a7f3d0',
                        padding: '2px 8px',
                        borderRadius: '20px',
                        fontSize: '11.5px',
                        fontWeight: 700
                      }}>
                        💰 Rp {new Intl.NumberFormat('id-ID').format(totalPersonRupiah)}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDetailPerson(null)}
                  style={{
                    background: '#f1f5f9',
                    border: 'none',
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    cursor: 'pointer',
                    color: '#64748b'
                  }}
                  title="Tutup"
                >
                  ✕
                </button>
              </div>

              {/* Items List */}
              <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {personItems.length > 0 ? (
                  personItems.map((it, idx) => (
                    <div
                      key={it.id || idx}
                      style={{
                        background: '#f8fafc',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: '13.5px', color: '#0f172a' }}>
                          {it.model} {it.storage ? `${it.storage}GB` : ''} {it.grade ? it.grade.toUpperCase() : ''}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', gap: '8px', marginTop: '3px', flexWrap: 'wrap' }}>
                          <span>Harga: <strong>@{it.price || it.obtained_price || '-'}</strong></span>
                          <span>•</span>
                          <span>Akun: <strong>{it.bidder || '-'}</strong></span>
                          {it.report_date && (
                            <>
                              <span>•</span>
                              <span style={{ color: '#2563eb' }}>{it.report_date}</span>
                            </>
                          )}
                          {it.notes && (
                            <>
                              <span>•</span>
                              <span style={{ color: '#d97706', fontWeight: 600 }}>{it.notes}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div>
                        <span style={{
                          background: it.fee_info ? '#eff6ff' : '#f1f5f9',
                          color: it.fee_info ? '#2563eb' : '#64748b',
                          border: `1px solid ${it.fee_info ? '#bfdbfe' : '#e2e8f0'}`,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontWeight: 700,
                          fontSize: '12px'
                        }}>
                          Fee: ({it.fee_info || '0'})
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '30px 20px', color: '#64748b', fontSize: '13px' }}>
                    Tidak ada rincian barang untuk anggota ini pada periode terpilih.
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{
                padding: '14px 24px',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#fafbfc'
              }}>
                <button
                  type="button"
                  onClick={() => {
                    const pObj = aggregatedPayroll.find(p => p.person === detailPerson) || {
                      person: detailPerson,
                      displayName: getDisplayName(detailPerson || ''),
                      totalUnits: totalPersonUnits,
                      totalFeePoints: totalPersonPoints,
                      totalRupiah: totalPersonRupiah,
                      formulaParts: []
                    };
                    handleCopyPersonSlip(pObj, selectedDates);
                  }}
                  style={{
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  Salin Slip WA
                </button>

                <button
                  type="button"
                  onClick={() => setDetailPerson(null)}
                  style={{
                    padding: '8px 18px',
                    background: '#f1f5f9',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: RINCIAN LENGKAP TANGGAL GAJI */}
      {modalDetailDate && (() => {
        const modalData = getPayrollDataForDates([modalDetailDate]);
        const dateItems = items.filter(it => {
          const itemDate = it.report_date || (it.created_at ? it.created_at.split(' ')[0] : '');
          return itemDate === modalDetailDate && it.status === 'approved' && !isOwnerPerson(it.person);
        });

        const filteredList = modalData.payrollList.filter(p => {
          if (!modalSearchQuery.trim()) return true;
          const q = modalSearchQuery.toLowerCase().trim();
          return p.person.toLowerCase().includes(q) || (p.alias && p.alias.toLowerCase().includes(q)) || p.displayName.toLowerCase().includes(q);
        });

        return (
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
            zIndex: 9999,
            padding: '16px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '820px',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #e2e8f0'
            }}>
              {/* Header */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid #f1f5f9',
                background: 'linear-gradient(to right, #ffffff, #f8fafc)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '17px', color: '#0f172a', fontWeight: 800 }}>
                      Rincian Gaji: {formatDateLabelIndo(modalDetailDate)}
                    </h3>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                    <span style={{
                      background: '#f1f5f9',
                      color: '#475569',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11.5px',
                      fontWeight: 600
                    }}>
                      {modalData.totalUnits} Barang
                    </span>
                    <span style={{
                      background: '#f1f5f9',
                      color: '#475569',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11.5px',
                      fontWeight: 600
                    }}>
                      {modalData.totalPeople} Anggota
                    </span>
                    <span style={{
                      background: '#ecfdf5',
                      color: '#059669',
                      border: '1px solid #a7f3d0',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11.5px',
                      fontWeight: 700
                    }}>
                      Total Rp {new Intl.NumberFormat('id-ID').format(modalData.totalRupiah)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setModalDetailDate(null);
                    setModalSearchQuery('');
                  }}
                  style={{
                    background: '#f1f5f9',
                    border: 'none',
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '15px',
                    cursor: 'pointer',
                    color: '#64748b',
                    transition: 'all 0.15s'
                  }}
                  title="Tutup"
                >
                  ✕
                </button>
              </div>

              {/* Search Toolbar */}
              <div style={{
                padding: '8px 20px',
                background: '#fafbfc',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}>
                <input
                  type="text"
                  placeholder="Cari nama atau alias..."
                  value={modalSearchQuery}
                  onChange={(e) => setModalSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    maxWidth: '240px',
                    padding: '5px 10px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: 'white',
                    outline: 'none'
                  }}
                />
                <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>
                  {filteredList.length} dari {modalData.totalPeople} orang
                </span>
              </div>

              {/* Table Body */}
              <div style={{ padding: '12px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {/* Table Header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '32px 1.4fr 65px 135px 115px 95px 60px',
                  padding: '7px 10px',
                  background: '#f8fafc',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  alignItems: 'center'
                }}>
                  <span>No</span>
                  <span>Anggota</span>
                  <span style={{ textAlign: 'center' }}>Unit</span>
                  <span>Formula Fee</span>
                  <span style={{ textAlign: 'right' }}>Total Fee</span>
                  <span style={{ textAlign: 'center' }}>Status</span>
                  <span style={{ textAlign: 'center' }}>Aksi</span>
                </div>

                {/* Rows */}
                {filteredList.map((p, idx) => {
                  const initial = p.person ? p.person.charAt(0).toUpperCase() : '?';
                  return (
                    <div
                      key={p.person}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '32px 1.4fr 65px 135px 115px 95px 60px',
                        alignItems: 'center',
                        padding: '7px 10px',
                        background: idx % 2 === 0 ? 'white' : '#fcfdfe',
                        borderRadius: '6px',
                        border: '1px solid #f1f5f9',
                        fontSize: '12px'
                      }}
                    >
                      {/* No */}
                      <span style={{ fontWeight: 600, color: '#94a3b8', fontSize: '11px' }}>
                        #{idx + 1}
                      </span>

                      {/* Name & Avatar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, paddingRight: '6px' }}>
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          background: '#eff6ff',
                          color: '#2563eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '11px',
                          flexShrink: 0
                        }}>
                          {initial}
                        </div>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: 800, color: '#0f172a' }}>{p.person}</span>
                          {p.alias && p.alias.toLowerCase().trim() !== p.person.toLowerCase().trim() && (
                            <span style={{ color: '#64748b', fontSize: '11px', marginLeft: '4px' }}>
                              ({p.alias})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Unit */}
                      <div style={{ textAlign: 'center' }}>
                        <span style={{
                          background: '#f1f5f9',
                          color: '#334155',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          fontSize: '11px'
                        }}>
                          {p.totalUnits}u
                        </span>
                      </div>

                      {/* Formula */}
                      <div>
                        <span style={{
                          fontFamily: 'monospace',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          color: '#2563eb',
                          background: '#eff6ff',
                          padding: '2px 5px',
                          borderRadius: '4px'
                        }}>
                          {p.formulaText || '-'}
                        </span>
                      </div>

                      {/* Total Rp */}
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 800, color: '#059669', fontSize: '12px' }}>
                          Rp {new Intl.NumberFormat('id-ID').format(p.totalRupiah)}
                        </span>
                      </div>

                      {/* Status */}
                      <div style={{ textAlign: 'center' }}>
                        {p.isTransferred ? (
                          <button
                            type="button"
                            onClick={() => p.transferInfo && handleUnmarkTransferred(p.transferInfo.id)}
                            style={{
                              background: '#ecfdf5',
                              color: '#059669',
                              border: '1px solid #a7f3d0',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10.5px',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                            title="Klik untuk membatalkan status Lunas"
                          >
                            ✓ Lunas
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleMarkTransferred(p.person, p.totalUnits, p.totalFeePoints, p.totalRupiah, [modalDetailDate])}
                            style={{
                              background: '#fffbeb',
                              color: '#d97706',
                              border: '1px solid #fde68a',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10.5px',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                            title="Klik jika sudah ditransfer"
                          >
                            ⏳ Pending
                          </button>
                        )}
                      </div>

                      {/* Aksi */}
                      <div style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleCopyPersonSlip(p, [modalDetailDate])}
                          style={{
                            padding: '3px 8px',
                            fontSize: '10.5px',
                            fontWeight: 700,
                            background: copiedPersonSlip === p.person ? '#10b981' : '#eff6ff',
                            color: copiedPersonSlip === p.person ? 'white' : '#2563eb',
                            border: '1px solid #bfdbfe',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                          title="Salin Slip WA untuk orang ini"
                        >
                          {copiedPersonSlip === p.person ? 'Tersalin' : 'Slip'}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Collapsible raw itemized list */}
                {dateItems.length > 0 && (
                  <div style={{ marginTop: '8px', borderTop: '1px dashed #e2e8f0', paddingTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setShowModalItemDetails(!showModalItemDetails)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '2px 0'
                      }}
                    >
                      <span>{showModalItemDetails ? '▼' : '▶'}</span>
                      <span>Lihat Rincian {dateItems.length} Barang Didapat</span>
                    </button>

                    {showModalItemDetails && (
                      <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '160px', overflowY: 'auto' }}>
                        {dateItems.map((it, idx) => (
                          <div
                            key={it.id || idx}
                            style={{
                              background: '#f8fafc',
                              padding: '5px 10px',
                              borderRadius: '5px',
                              border: '1px solid #e2e8f0',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '11px'
                            }}
                          >
                            <div>
                              <span style={{ fontWeight: 700, color: '#0f172a' }}>
                                {it.model} {it.storage ? `${it.storage}GB` : ''} {it.grade.toUpperCase()}
                              </span>
                              <span style={{ color: '#64748b', marginLeft: '8px' }}>
                                PIC: <strong>{getDisplayName(it.person || '')}</strong> • Akun: {it.bidder || '-'}
                              </span>
                            </div>
                            <span style={{
                              background: it.fee_info ? '#eff6ff' : '#f1f5f9',
                              color: it.fee_info ? '#2563eb' : '#64748b',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              fontWeight: 700,
                              fontSize: '10.5px'
                            }}>
                              Fee: ({it.fee_info || '0'})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{
                padding: '12px 20px',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#fafbfc'
              }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => handleCopyBatchSummaryForDates([modalDetailDate], modalData.payrollList, modalData)}
                    style={{
                      padding: '7px 14px',
                      background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
                    }}
                  >
                    Salin Rekap WA
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteBatch(modalDetailDate)}
                    style={{
                      padding: '7px 12px',
                      background: '#fff1f2',
                      color: '#e11d48',
                      border: '1px solid #fecdd3',
                      borderRadius: '6px',
                      fontWeight: 600,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                    title="Hapus data tanggal ini dari menu Gaji"
                  >
                    Hapus Batch Tanggal
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setModalDetailDate(null);
                    setModalSearchQuery('');
                  }}
                  style={{
                    padding: '7px 16px',
                    background: '#f1f5f9',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
