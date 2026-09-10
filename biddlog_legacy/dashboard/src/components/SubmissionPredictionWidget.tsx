import React, { useMemo } from 'react';
import type { ParsedTextList, TextListEntry, ParsedInvoiceItem, LooseItemCode } from '../types';
import { normalizePersonName, displayPersonName } from '../main';

export interface UnlistedWonItem {
  id: string;
  person: string;
  entry: TextListEntry;
  source: 'target' | 'reserve';
  matchedInvoice: ParsedInvoiceItem;
}

export interface UnlistedPersonPrediction {
  person: string;
  normalizedPerson: string;
  unlistedItems: UnlistedWonItem[];
  unlistedCount: number;
  totalAssigned: number;
  alreadyListedCount: number;
  isPartiallyListed: boolean;
}

export interface UnlistedPredictionAnalysis {
  unlistedPeople: UnlistedPersonPrediction[];
  totalUnlistedPeople: number;
  totalUnlistedItems: number;
  totalAssignedCount: number;
  totalInvoiceItems: number;
  mubdiExtraItemsCount: number;
  allMatchedInvoiceCount: number;
}

// Matching helpers consistent with Biddlog core
function modelFamilyKey(value: string) {
  return (value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/^z/, '')
    .replace(/plus$/, '+')
    .replace(/ultra$/, 'u')
    .replace(/note(\d+)\+$/, 'note$1+')
    .replace(/^a54(?:5g)?$/, 'a54');
}

function normalizeGradeCode(value: string) {
  const grade = (value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z]/g, '');
  if (grade === 'gi') return 'ai';
  return grade;
}

function itemMatches(entry: LooseItemCode, invoice: LooseItemCode) {
  const modelOk = entry.model === invoice.model || modelFamilyKey(entry.model) === modelFamilyKey(invoice.model);
  const storageOk = !entry.storage || entry.storage === invoice.storage;
  const gradeOk = !entry.grade || normalizeGradeCode(entry.grade) === normalizeGradeCode(invoice.grade);
  return modelOk && storageOk && gradeOk;
}

function priceToBidUnit(value: number | null) {
  if (value === null) return null;
  return value >= 100000 ? Math.round(value / 1000) : value;
}

function scoreInvoiceCandidate(entry: TextListEntry, invoice: ParsedInvoiceItem) {
  let score = 0;
  if (entry.model === invoice.model) score += 4;
  else if (modelFamilyKey(entry.model) === modelFamilyKey(invoice.model)) score += 3;
  if (!entry.storage || entry.storage === invoice.storage) score += 2;
  if (!entry.grade || normalizeGradeCode(entry.grade) === normalizeGradeCode(invoice.grade)) score += 2;
  if (entry.accountHint && entry.accountHint === invoice.account) score += 1;
  if (entry.unit && entry.unit === invoice.unit) score += 1;
  if (entry.priceMax !== null && invoice.invoicePriceUnit !== null) {
    const diff = Math.abs((entry.priceMax ?? 0) - invoice.invoicePriceUnit);
    score += diff === 0 ? 2 : diff <= 50 ? 1 : 0;
  }
  return score;
}

function isOwnerPerson(personName: string): boolean {
  const norm = normalizePersonName(personName);
  return /^(?:menik|mubdi|owner)$/i.test(norm);
}

function formatItemSummaryLine(entry: TextListEntry, invoice?: ParsedInvoiceItem): string {
  const model = entry.model ? entry.model.toUpperCase() : 'HP';
  const storage = entry.storage ? `${entry.storage}GB` : '';
  const grade = entry.grade ? entry.grade.toUpperCase() : '';
  const unit = entry.unit ? `(${entry.unit})` : '';
  const price = invoice?.invoicePriceUnit != null
    ? `@${invoice.invoicePriceUnit}`
    : entry.priceMax
      ? `@${priceToBidUnit(entry.priceMax)}`
      : '';
  const account = invoice?.account ? `(${invoice.account})` : '';
  return [model, storage, grade, unit, price, account].filter(Boolean).join(' ');
}

/**
 * Core Algorithm for Prediction:
 * 1. Check List Pembagian Awal (Target) & Cadangan.
 * 2. Check Hasil Scan Invoice (Barang yang didapat dari 3 akun).
 * 3. Match invoice items with target/cadangan items.
 * 4. Compare with List Barang Didapat (Sudah melist vs Belum melist).
 * 5. Exclude Owner accounts (Mubdi & Menik).
 * 6. ONLY output people who have WON items in invoice but have NOT LISTED them yet!
 *    People who did not win anything (tidak ada di invoice) or already listed everything are completely ignored.
 */
export function buildUnlistedWonPrediction(
  targetList: ParsedTextList,
  obtainedList: ParsedTextList,
  reserveList: ParsedTextList,
  invoiceItems: ParsedInvoiceItem[] = []
): UnlistedPredictionAnalysis {
  const workingInvoices = (invoiceItems || []).map(item => ({ ...item }));

  // Collect all assigned target items and cadangan items per person
  const personAssignedMap = new Map<string, {
    displayName: string;
    targetEntries: TextListEntry[];
    reserveEntries: TextListEntry[];
    obtainedEntries: TextListEntry[];
  }>();

  const getOrCreate = (rawName: string) => {
    const trimmed = displayPersonName(rawName);
    const normalized = normalizePersonName(trimmed);
    if (!normalized || normalized === 'tanpa nama' || normalized === 'cadangan') {
      return null;
    }
    // Strictly skip owner accounts from prediction mapping
    if (isOwnerPerson(normalized)) {
      return null;
    }

    if (!personAssignedMap.has(normalized)) {
      personAssignedMap.set(normalized, {
        displayName: trimmed,
        targetEntries: [],
        reserveEntries: [],
        obtainedEntries: [],
      });
    }
    return personAssignedMap.get(normalized)!;
  };

  // 1. Gather target list items
  targetList.sections.forEach(sec => {
    const p = getOrCreate(sec.person);
    if (p && (sec.person.length > p.displayName.length || /^[A-Z]/.test(sec.person))) {
      p.displayName = displayPersonName(sec.person);
    }
  });
  targetList.entries.forEach(item => {
    const p = getOrCreate(item.person);
    if (p) p.targetEntries.push(item);
  });

  // 2. Gather cadangan items
  reserveList.sections.forEach(sec => {
    if (normalizePersonName(sec.person) !== 'cadangan') {
      getOrCreate(sec.person);
    }
  });
  reserveList.entries.forEach(item => {
    const p = getOrCreate(item.person);
    if (p) p.reserveEntries.push(item);
  });

  // 3. Gather obtained list items
  obtainedList.sections.forEach(sec => {
    const p = getOrCreate(sec.person);
    if (p && (sec.person.length > p.displayName.length || /^[A-Z]/.test(sec.person))) {
      p.displayName = displayPersonName(sec.person);
    }
  });
  obtainedList.entries.forEach(item => {
    const p = getOrCreate(item.person);
    if (p) p.obtainedEntries.push(item);
  });

  // STEP A: Mark invoice items that are ALREADY REPORTED in obtainedList as claimed
  obtainedList.entries.forEach(obtEntry => {
    const candidates = workingInvoices.filter(inv => !inv.consumedBy && itemMatches(obtEntry, inv));
    if (candidates.length > 0) {
      const best = candidates.sort((a, b) => scoreInvoiceCandidate(obtEntry, b) - scoreInvoiceCandidate(obtEntry, a))[0];
      if (best) {
        best.consumedBy = `obtained-${obtEntry.id}`;
      }
    }
  });

  // Active unclaimed invoice items (won in invoice but not yet submitted in obtained list by anyone)
  const activeUnclaimedInvoices = workingInvoices.filter(inv => !inv.consumedBy);

  // STEP B: Check remaining invoice items against assigned target & cadangan per unsubmitted person
  const unlistedPeople: UnlistedPersonPrediction[] = [];
  let totalUnlistedItems = 0;
  let totalAssignedCount = 0;
  const matchedInvoiceIds = new Set<string>();

  personAssignedMap.forEach((data, normalized) => {
    // Strictly exclude owner accounts (Mubdi & Menik)
    if (isOwnerPerson(normalized) || isOwnerPerson(data.displayName)) {
      return;
    }

    // USER RULE: Jika orang sudah ada namanya di list dapat (sudah setor / melist),
    // maka ABAIKAN SAJA (berarti sisa barangnya memang tidak dapat / zonk).
    const hasSubmittedObtained = data.obtainedEntries.length > 0 || 
      obtainedList.sections.some(sec => normalizePersonName(sec.person) === normalized);
    if (hasSubmittedObtained) {
      return;
    }

    const totalAssigned = data.targetEntries.length + data.reserveEntries.length;
    totalAssignedCount += totalAssigned;

    const unlistedItems: UnlistedWonItem[] = [];

    const allAssigned = [
      ...data.targetEntries.map(e => ({ entry: e, source: 'target' as const })),
      ...data.reserveEntries.map(e => ({ entry: e, source: 'reserve' as const })),
    ];

    allAssigned.forEach(assigned => {
      // Check if this assigned item matches any active unclaimed invoice item
      // (Supports multiple unsubmitted bidders who were given the same target e.g. S23U 256 AF)
      const candidates = activeUnclaimedInvoices.filter(inv => itemMatches(assigned.entry, inv));
      if (candidates.length > 0) {
        const best = candidates.sort((a, b) => scoreInvoiceCandidate(assigned.entry, b) - scoreInvoiceCandidate(assigned.entry, a))[0];
        if (best) {
          matchedInvoiceIds.add(best.id);
          unlistedItems.push({
            id: assigned.entry.id,
            person: data.displayName,
            entry: assigned.entry,
            source: assigned.source,
            matchedInvoice: best,
          });
        }
      }
    });

    // ONLY include person if they have AT LEAST 1 won item in invoice and have NOT submitted!
    if (unlistedItems.length > 0) {
      totalUnlistedItems += unlistedItems.length;
      unlistedPeople.push({
        person: data.displayName,
        normalizedPerson: normalized,
        unlistedItems,
        unlistedCount: unlistedItems.length,
        totalAssigned,
        alreadyListedCount: 0,
        isPartiallyListed: false,
      });
    }
  });

  // Sort: highest unlisted count first, then by name
  unlistedPeople.sort((a, b) => b.unlistedCount - a.unlistedCount || a.person.localeCompare(b.person, 'id'));

  // Remaining unassigned invoices -> Mubdi
  const unassignedInvoices = activeUnclaimedInvoices.filter(inv => !matchedInvoiceIds.has(inv.id));
  const allMatchedInvoices = workingInvoices.filter(inv => inv.consumedBy?.startsWith('obtained-') || matchedInvoiceIds.has(inv.id));

  return {
    unlistedPeople,
    totalUnlistedPeople: unlistedPeople.length,
    totalUnlistedItems,
    totalAssignedCount,
    totalInvoiceItems: (invoiceItems || []).length,
    mubdiExtraItemsCount: unassignedInvoices.length,
    allMatchedInvoiceCount: allMatchedInvoices.length,
  };
}

export function SubmissionPredictionWidget({
  targetList,
  obtainedList,
  reserveList,
  invoiceItems = [],
  detectedHeaderDate: _detectedHeaderDate,
}: {
  targetList: ParsedTextList;
  obtainedList: ParsedTextList;
  reserveList: ParsedTextList;
  invoiceItems?: ParsedInvoiceItem[];
  detectedHeaderDate?: string;
}) {
  const analysis = useMemo(
    () => buildUnlistedWonPrediction(targetList, obtainedList, reserveList, invoiceItems),
    [targetList, obtainedList, reserveList, invoiceItems],
  );

  const hasAnyData = targetList.entries.length > 0 || obtainedList.entries.length > 0 || reserveList.entries.length > 0 || invoiceItems.length > 0;
  if (!hasAnyData) {
    return (
      <section className="bidding-prediction-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#64748b', padding: '12px' }}>
          <span style={{ fontSize: '20px' }}>🎯</span>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>
            Prediksi Belum Melist: Masukkan <strong>Invoice JSON</strong>, <strong>List Pembagian Awal (Target)</strong>, dan <strong>List Barang Didapat</strong> untuk mendeteksi siapa saja yang barangnya ada di invoice tetapi belum dilist.
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="bidding-prediction-panel">
      {/* 1. Header */}
      <div className="bidding-prediction-header">
        <div className="bidding-prediction-title">
          <span className="bidding-prediction-icon">🎯</span>
          <div className="bidding-prediction-title-row">
            <h3 className="bidding-prediction-h3">
              Prediksi Barang Didapat yang Belum Dilist
            </h3>
            {analysis.totalUnlistedPeople > 0 ? (
              <span className="bidding-pill-danger">
                🔥 {analysis.totalUnlistedPeople} Orang ({analysis.totalUnlistedItems} Unit di Invoice)
              </span>
            ) : (
              <span className="bidding-pill-success">
                ✓ Semua Barang di Invoice Sudah Dilist
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Informational Cards Grid */}
      {analysis.totalUnlistedPeople > 0 ? (
        <div className="bidding-prediction-cards-grid">
          {analysis.unlistedPeople.map((p) => (
            <div className="bidding-person-card" key={p.normalizedPerson}>
              {/* Card Header */}
              <div className="bidding-person-card-header">
                <div className="bidding-person-info">
                  <div className="bidding-person-avatar">
                    {p.person.slice(0, 2)}
                  </div>
                  <div className="bidding-person-meta">
                    <h4 className="bidding-person-name">{p.person}</h4>
                    <span className="bidding-person-subtext">
                      Target: {p.totalAssigned} item
                    </span>
                  </div>
                </div>

                <span className="bidding-person-badge">
                  🔥 {p.unlistedCount} di Invoice
                </span>
              </div>

              {/* Card Items List */}
              <div className="bidding-person-items-list">
                {p.unlistedItems.map((item, idx) => (
                  <div className="bidding-person-item-row" key={idx}>
                    <div className="bidding-item-main">
                      <span className="bidding-item-dot"></span>
                      {item.source === 'reserve' && (
                        <span className="bidding-cadangan-tag">Cadangan</span>
                      )}
                      <span className="bidding-item-model">
                        {item.entry.model ? item.entry.model.toUpperCase() : 'HP'}
                      </span>
                      {item.entry.storage && (
                        <span className="bidding-item-spec">{item.entry.storage}GB</span>
                      )}
                      {item.entry.grade && (
                        <span className="bidding-item-spec">{item.entry.grade.toUpperCase()}</span>
                      )}
                      {item.entry.unit && (
                        <span className="bidding-item-unit">({item.entry.unit})</span>
                      )}
                    </div>

                    <div className="bidding-item-tags">
                      {(item.matchedInvoice?.invoicePriceUnit != null || item.entry.priceMax) && (
                        <span className="bidding-item-price">
                          @{item.matchedInvoice?.invoicePriceUnit ?? priceToBidUnit(item.entry.priceMax)}
                        </span>
                      )}
                      {item.matchedInvoice?.account && (
                        <span className="bidding-item-account">
                          {item.matchedInvoice.account}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bidding-all-success-alert">
          <span style={{ fontSize: '22px' }}>🎉</span>
          <div>
            <strong style={{ fontSize: '13px', color: '#14532d' }}>Semua barang di invoice sudah disetorkan / dilist</strong>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#166534', opacity: 0.9 }}>
              Semua anggota yang mendapatkan barang target atau cadangan di invoice sudah mencantumkannya di list didapat.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
