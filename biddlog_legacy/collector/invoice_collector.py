from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import time
import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from appium_collector import (
    ADB_DUMP_RETRY_LIMIT,
    GRADE_VALUE_RE,
    PRODUCT_LINE_RE,
    STOCK_RE,
    apply_scan_profile,
    collect_page_source_from_adb,
    collect_visible_texts_from_source,
    ensure_target_app_foreground,
    find_sequence_overlap,
    format_text_sample,
    load_config,
    looks_like_product_name,
    parse_bounds,
    reset_list_to_top,
    reset_uiautomator2_server,
    scroll_down_adb,
    send_phone_feedback,
    visual_screen_signature,
)


INVOICE_COLLECTOR_VERSION = "2026-05-03-invoice-v1"
ACCOUNT_NAMES = ("menik", "mubdi", "aldi")
ACCOUNT_APP_PACKAGES = {
    "menik": "id.biddingplus",
    "mubdi": "id.biddingplut",
    "aldi": "com.biddingnativeapp",
}
INVOICE_OUTPUT_DIR = Path(__file__).resolve().parent / "output" / "invoice"
BOTTOM_REPEAT_LIMIT = 4
NO_NEW_ITEM_LIMIT = 25
MIN_CONTINUITY_OVERLAP = 1
PRICE_RE = re.compile(r"\b(?:IDR|Rp)\s*([\d.,]+)", re.IGNORECASE)


@dataclass
class InvoiceItem:
    account: str
    raw_name: str
    grade: str = ""
    status: str = ""
    condition: str = ""
    stock: int | None = None
    invoice_price: int | None = None
    price_source: str = ""
    scan_order: int = 0
    scanned_at: str = ""
    scan_marker: str = ""
    scan_session_id: str = ""
    screen_no: int = 0
    screen_item_no: int = 0
    source_bounds: str = ""
    source_hash: str = ""
    source_text: str = ""


@dataclass
class InvoiceVisibleItem:
    item: InvoiceItem
    key: str
    top: int
    bottom: int
    bounds: str = ""
    source_text: str = ""
    screen_item_no: int = 0


def log(message: str) -> None:
    print(message, flush=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Collect invoice items from the current Bidding Plus account page through Android UI."
    )
    parser.add_argument(
        "--account",
        choices=ACCOUNT_NAMES,
        required=True,
        help="Nama akun invoice yang sedang dibuka di HP.",
    )
    parser.add_argument(
        "--max-scrolls",
        type=int,
        default=500,
        help="Batas scroll invoice. Default 500.",
    )
    parser.add_argument(
        "--scroll-pause",
        type=float,
        default=None,
        help="Override jeda setelah scroll. Default memakai profil scan.",
    )
    parser.add_argument(
        "--scan-profile",
        choices=["accuracy", "balanced", "fast"],
        default="accuracy",
        help="Profil scan. Default accuracy.",
    )
    parser.add_argument(
        "--expected-total",
        type=int,
        default=None,
        help="Total item invoice yang diharapkan untuk akun ini jika diketahui.",
    )
    parser.add_argument(
        "--no-reset-position",
        action="store_true",
        help="Jangan reset daftar invoice ke atas sebelum scan.",
    )
    parser.add_argument(
        "--phone-feedback",
        action="store_true",
        help="Kirim getar pendek di HP setiap layar terbaca dan getar panjang saat selesai.",
    )
    parser.add_argument(
        "--app-package",
        default=None,
        help="Override package aplikasi. Default otomatis sesuai akun: menik asli, mubdi App Cloner, aldi Island.",
    )
    parser.add_argument(
        "--no-launch",
        action="store_true",
        help="Jangan buka aplikasi dari ADB. Dipakai jika kamu sudah standby di halaman invoice yang benar.",
    )
    return parser.parse_args()


def parse_price_values(text: str) -> list[tuple[int, str]]:
    prices: list[tuple[int, str]] = []
    for match in PRICE_RE.finditer(text):
        raw_value = match.group(1)
        digits = re.sub(r"\D", "", raw_value)
        if digits:
            prices.append((int(digits), match.group(0).strip()))
    return prices


def parse_invoice_line(text: str, account: str, scanned_at: str) -> InvoiceItem | None:
    normalized = " ".join(text.split())
    match = PRODUCT_LINE_RE.match(normalized)
    if not match:
        return None

    name = " ".join(match.group("name").split())
    rest = " ".join(match.group("rest").split())
    item = InvoiceItem(account=account, raw_name=name, scanned_at=scanned_at)

    grade = GRADE_VALUE_RE.search(rest)
    if grade:
        item.grade = grade.group(1).upper()

    if re.search(r"\bTerdaftar\b", rest, re.IGNORECASE):
        item.status = "Terdaftar"
    elif re.search(r"\bInternational\b", rest, re.IGNORECASE):
        item.status = "International"

    if re.search(r"Produk\s+Only", rest, re.IGNORECASE):
        item.condition = "Produk Only"
    elif re.search(r"Full\s*Set", rest, re.IGNORECASE):
        item.condition = "Full Set"

    stock = STOCK_RE.search(rest)
    if stock:
        item.stock = int(stock.group(1))

    prices = parse_price_values(rest)
    if prices:
        item.invoice_price, item.price_source = prices[-1]

    return item


def invoice_item_key(item: InvoiceItem) -> str:
    return "|".join(
        [
            item.account.lower(),
            item.raw_name.lower(),
            item.grade.lower(),
            str(item.invoice_price or ""),
            item.condition.lower(),
        ]
    )


def collect_visible_invoice_items_from_source(
    page_source: str,
    account: str,
    scanned_at: str,
) -> list[InvoiceVisibleItem]:
    visible_items: list[InvoiceVisibleItem] = []
    seen_nodes: set[tuple[str, str]] = set()
    try:
        root = ET.fromstring(page_source)
    except ET.ParseError as exc:
        log(f"[WARN] Gagal parse UI XML invoice: {exc}")
        return visible_items

    for node in root.iter():
        raw_bounds = node.attrib.get("bounds", "")
        bounds = parse_bounds(raw_bounds)
        if not bounds:
            continue
            
        top, bottom = bounds
        if bottom - top < 75:
            continue

        raw_values = [node.attrib.get("text") or "", node.attrib.get("content-desc") or ""]
        for raw_value in raw_values:
            text = " ".join(raw_value.split())
            if not looks_like_product_name(text):
                continue

            item = parse_invoice_line(text, account, scanned_at)
            if not item:
                continue

            node_signature = (raw_bounds, text)
            if node_signature in seen_nodes:
                continue
            seen_nodes.add(node_signature)

            visible_items.append(
                InvoiceVisibleItem(
                    item=item,
                    key=invoice_item_key(item),
                    top=bounds[0],
                    bottom=bounds[1],
                    bounds=raw_bounds,
                    source_text=text,
                )
            )

    visible_items.sort(key=lambda entry: (entry.top, entry.bottom, entry.key))
    for index, entry in enumerate(visible_items, start=1):
        entry.screen_item_no = index
    return visible_items


def align_entries_to_text_order(
    texts: list[str],
    entries: list[InvoiceVisibleItem],
    account: str,
    scanned_at: str,
) -> tuple[list[InvoiceVisibleItem], int]:
    entries_by_text: dict[str, list[InvoiceVisibleItem]] = {}
    for entry in entries:
        entries_by_text.setdefault(entry.source_text, []).append(entry)

    aligned_entries: list[InvoiceVisibleItem] = []
    fallback_count = 0
    fallback_index = 0
    for text in texts:
        normalized = " ".join(text.split())
        if not looks_like_product_name(normalized):
            continue

        matching_entries = entries_by_text.get(normalized)
        if matching_entries:
            aligned_entries.append(matching_entries.pop(0))
            continue

        item = parse_invoice_line(normalized, account, scanned_at)
        if not item:
            continue

        fallback_index += 1
        fallback_count += 1
        aligned_entries.append(
            InvoiceVisibleItem(
                item=item,
                key=invoice_item_key(item),
                top=fallback_index * 100,
                bottom=(fallback_index + 1) * 100,
                bounds=f"text-order-{fallback_index}",
                source_text=normalized,
            )
        )

    remaining_entries = [
        entry
        for matching_entries in entries_by_text.values()
        for entry in matching_entries
    ]
    aligned_entries.extend(sorted(remaining_entries, key=lambda item: (item.top, item.bottom, item.key)))

    for index, entry in enumerate(aligned_entries, start=1):
        entry.screen_item_no = index

    return aligned_entries, fallback_count


def collect_visible_invoice_items_reliable(
    account: str,
    scanned_at: str,
) -> tuple[list[str], list[InvoiceVisibleItem], list[str]]:
    best_texts: list[str] = []
    best_entries: list[InvoiceVisibleItem] = []
    best_invalid_count: int | None = None
    best_fallback_count = 0
    warnings: list[str] = []

    for attempt in range(1, ADB_DUMP_RETRY_LIMIT + 1):
        page_source = collect_page_source_from_adb()
        texts = collect_visible_texts_from_source(page_source)
        entries = collect_visible_invoice_items_from_source(page_source, account, scanned_at)
        aligned_entries, fallback_count = align_entries_to_text_order(texts, entries, account, scanned_at)
        product_text_count = sum(1 for text in texts if looks_like_product_name(text))
        invalid_count = max(0, product_text_count - len(aligned_entries))

        if (
            best_invalid_count is None
            or invalid_count < best_invalid_count
            or (invalid_count == best_invalid_count and len(aligned_entries) > len(best_entries))
        ):
            best_texts = texts
            best_entries = aligned_entries
            best_invalid_count = invalid_count
            best_fallback_count = fallback_count

        if invalid_count == 0 and aligned_entries:
            break

        if attempt < ADB_DUMP_RETRY_LIMIT:
            log(
                f"[WARN] UI dump invoice belum stabil: teks produk={product_text_count}, "
                f"item terbaca={len(aligned_entries)}. Retry {attempt}/{ADB_DUMP_RETRY_LIMIT}..."
            )
            time.sleep(0.35)

    if best_fallback_count:
        warnings.append(
            f"UI dump invoice mengandung {best_fallback_count} teks produk tanpa bounds valid; "
            "scanner tetap memasukkan item memakai urutan teks."
        )
    if best_invalid_count:
        warnings.append(f"UI dump invoice masih menyisakan {best_invalid_count} teks produk yang belum bisa diparse.")

    return best_texts, best_entries, warnings


def has_duplicate_keys(entries: list[InvoiceVisibleItem]) -> bool:
    keys = [entry.key for entry in entries]
    return len(keys) != len(set(keys))


def estimate_scroll_delta_robust(
    previous_entries: list[InvoiceVisibleItem],
    current_entries: list[InvoiceVisibleItem],
    last_scroll_delta: int | None = None,
) -> int | None:
    # 1. Try matching unique keys first
    prev_keys = [e.key for e in previous_entries]
    curr_keys = [e.key for e in current_entries]
    
    unique_prev_keys = {k for k in prev_keys if prev_keys.count(k) == 1}
    unique_curr_keys = {k for k in curr_keys if curr_keys.count(k) == 1}
    common_unique_keys = unique_prev_keys.intersection(unique_curr_keys)
    
    unique_deltas: list[int] = []
    if common_unique_keys:
        # Determine standard height and screen middle
        all_entries = previous_entries + current_entries
        heights = [e.bottom - e.top for e in all_entries]
        std_height = max(heights) if heights else 465
        screen_middle = (min(e.top for e in all_entries) + max(e.bottom for e in all_entries)) // 2

        for key in common_unique_keys:
            prev_item = next(e for e in previous_entries if e.key == key)
            curr_item = next(e for e in current_entries if e.key == key)
            
            # Determine if clipped at top on current screen
            curr_clipped_top = (curr_item.bottom - curr_item.top < std_height - 15) and (curr_item.top < screen_middle)
            if curr_clipped_top:
                d = prev_item.bottom - curr_item.bottom
            else:
                d = prev_item.top - curr_item.top
                
            if d > 10:
                unique_deltas.append(d)
                
    if unique_deltas:
        unique_deltas.sort()
        return unique_deltas[len(unique_deltas) // 2]

    # 2. Fallback: robust voting of all candidate Y shifts
    candidates: list[int] = []
    for prev in previous_entries:
        for curr in current_entries:
            if prev.key == curr.key:
                all_entries = previous_entries + current_entries
                heights = [e.bottom - e.top for e in all_entries]
                std_height = max(heights) if heights else 465
                screen_middle = (min(e.top for e in all_entries) + max(e.bottom for e in all_entries)) // 2
                
                curr_clipped_top = (curr.bottom - curr.top < std_height - 15) and (curr.top < screen_middle)
                if curr_clipped_top:
                    d = prev.bottom - curr.bottom
                else:
                    d = prev.top - curr.top
                    
                if d > 10:
                    if last_scroll_delta is not None:
                        if int(last_scroll_delta * 0.8) <= d <= int(last_scroll_delta * 1.2):
                            candidates.append(d)
                    else:
                        candidates.append(d)

    if not candidates:
        return last_scroll_delta

    best_delta = None
    max_votes = -1
    tolerance = 25  # px tolerance for grouping candidate deltas

    for c in candidates:
        votes = sum(1 for other in candidates if abs(other - c) <= tolerance)
        if votes > max_votes:
            max_votes = votes
            best_delta = c

    if best_delta is not None:
        best_cluster = [other for other in candidates if abs(other - best_delta) <= tolerance]
        return int(sum(best_cluster) / len(best_cluster))

    return last_scroll_delta


def split_new_visible_items(
    previous_entries: list[InvoiceVisibleItem],
    current_entries: list[InvoiceVisibleItem],
    last_scroll_delta: int | None = None,
) -> tuple[list[InvoiceVisibleItem], int, int | None]:
    if not previous_entries:
        filtered_current = [e for e in current_entries if not e.bounds.startswith("text-order-")]
        return filtered_current, 0, None

    has_dupes = has_duplicate_keys(previous_entries) or has_duplicate_keys(current_entries)

    # 1. If there are duplicates, try position-based matching first
    if has_dupes:
        delta = estimate_scroll_delta_robust(previous_entries, current_entries, last_scroll_delta)
        if delta is not None:
            new_entries, overlap_count, delta = split_new_visible_items_by_position(previous_entries, current_entries, delta)
            filtered_new = [e for e in new_entries if not e.bounds.startswith("text-order-")]
            return filtered_new, overlap_count, delta

    # 2. Otherwise (no duplicates, or delta could not be estimated), try standard sequence overlap
    sequence_overlap = find_sequence_overlap(previous_entries, current_entries)
    if sequence_overlap > 0:
        if has_dupes:
            delta = estimate_scroll_delta_robust(previous_entries, current_entries, last_scroll_delta)
            if delta is not None:
                new_entries, overlap_count, delta = split_new_visible_items_by_position(previous_entries, current_entries, delta)
                filtered_new = [e for e in new_entries if not e.bounds.startswith("text-order-")]
                return filtered_new, overlap_count, delta
        new_entries = current_entries[sequence_overlap:]
        filtered_new = [e for e in new_entries if not e.bounds.startswith("text-order-")]
        return filtered_new, sequence_overlap, None

    # 3. If no sequence overlap, estimate delta robustly and do position-based match
    delta = estimate_scroll_delta_robust(previous_entries, current_entries, last_scroll_delta)
    if delta is None:
        if [entry.key for entry in previous_entries] == [entry.key for entry in current_entries]:
            return [], len(current_entries), 0
        filtered_current = [e for e in current_entries if not e.bounds.startswith("text-order-")]
        return filtered_current, 0, None

    new_entries, overlap_count, delta = split_new_visible_items_by_position(previous_entries, current_entries, delta)
    filtered_new = [e for e in new_entries if not e.bounds.startswith("text-order-")]
    return filtered_new, overlap_count, delta


def split_new_visible_items_by_position(
    previous_entries: list[InvoiceVisibleItem],
    current_entries: list[InvoiceVisibleItem],
    delta: int,
) -> tuple[list[InvoiceVisibleItem], int, int | None]:
    # Determine standard height and screen middle
    all_entries = previous_entries + current_entries
    heights = [e.bottom - e.top for e in all_entries]
    std_height = max(heights) if heights else 465
    
    tops = [e.top for e in all_entries]
    bottoms = [e.bottom for e in all_entries]
    min_top = min(tops) if tops else 558
    max_bottom = max(bottoms) if bottoms else 2673
    screen_middle = (min_top + max_bottom) // 2

    matched_previous_indexes: set[int] = set()
    new_entries: list[InvoiceVisibleItem] = []
    overlap_count = 0
    for current_entry in current_entries:
        best_index: int | None = None
        best_distance: int | None = None
        
        # Decide if the current entry is clipped at the top
        curr_clipped_top = (current_entry.bottom - current_entry.top < std_height - 15) and (current_entry.top < screen_middle)
        
        for previous_index, previous_entry in enumerate(previous_entries):
            if previous_index in matched_previous_indexes:
                continue
            if current_entry.key != previous_entry.key:
                continue
                
            if curr_clipped_top:
                predicted_bottom = previous_entry.bottom - delta
                distance = abs(predicted_bottom - current_entry.bottom)
            else:
                predicted_top = previous_entry.top - delta
                distance = abs(predicted_top - current_entry.top)
                
            if distance > 95:
                continue
            if best_distance is None or distance < best_distance:
                best_index = previous_index
                best_distance = distance

        if best_index is None:
            new_entries.append(current_entry)
        else:
            matched_previous_indexes.add(best_index)
            overlap_count += 1

    filtered_new = [e for e in new_entries if not e.bounds.startswith("text-order-")]
    return filtered_new, overlap_count, delta



def mark_scanned_item(
    entry: InvoiceVisibleItem,
    scan_order: int,
    scan_session_id: str,
    screen_no: int,
) -> InvoiceItem:
    item = entry.item
    item.scan_order = scan_order
    item.scan_session_id = scan_session_id
    item.screen_no = screen_no
    item.screen_item_no = entry.screen_item_no
    item.source_bounds = entry.bounds
    item.source_text = entry.source_text
    item.source_hash = hashlib.sha1(entry.source_text.encode("utf-8")).hexdigest()[:12]
    item.scan_marker = f"{item.account.upper()}-S{screen_no:04d}-I{entry.screen_item_no:02d}-O{scan_order:04d}"
    return item


def save_debug_texts(account: str, texts: list[str]) -> None:
    debug_path = INVOICE_OUTPUT_DIR / f"last-invoice-ui-texts-{account}.txt"
    debug_path.parent.mkdir(parents=True, exist_ok=True)
    debug_path.write_text("\n".join(texts), encoding="utf-8")


def per_account_json_path(account: str) -> Path:
    return INVOICE_OUTPUT_DIR / f"invoice-{account}.json"


def per_account_csv_path(account: str) -> Path:
    return INVOICE_OUTPUT_DIR / f"invoice-{account}.csv"


def write_items_json_csv(items: list[InvoiceItem], json_path: Path, csv_path: Path) -> None:
    json_path.parent.mkdir(parents=True, exist_ok=True)
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    payload = [asdict(item) for item in items]
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    if not payload:
        csv_path.write_text("", encoding="utf-8")
        return

    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(payload[0].keys()))
        writer.writeheader()
        writer.writerows(payload)


def load_existing_account_items(account: str) -> list[InvoiceItem]:
    path = per_account_json_path(account)
    if not path.exists():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    return [InvoiceItem(**row) for row in payload if isinstance(row, dict)]


def save_outputs(account: str, items: list[InvoiceItem]) -> tuple[Path, Path, Path, Path]:
    account_json = per_account_json_path(account)
    account_csv = per_account_csv_path(account)
    write_items_json_csv(items, account_json, account_csv)

    combined_items: list[InvoiceItem] = []
    for account_name in ACCOUNT_NAMES:
        if account_name == account:
            combined_items.extend(items)
        else:
            combined_items.extend(load_existing_account_items(account_name))

    combined_items.sort(key=lambda item: (ACCOUNT_NAMES.index(item.account), item.scan_order))
    combined_json = INVOICE_OUTPUT_DIR / "invoice-items.json"
    combined_csv = INVOICE_OUTPUT_DIR / "invoice-items.csv"
    write_items_json_csv(combined_items, combined_json, combined_csv)
    return account_json, account_csv, combined_json, combined_csv


def save_scan_summary(
    account: str,
    items: list[InvoiceItem],
    started_at: str,
    target_total: int | None,
    scan_warnings: list[str],
    output_paths: tuple[Path, Path, Path, Path],
) -> None:
    account_json, account_csv, combined_json, combined_csv = output_paths
    summary_path = INVOICE_OUTPUT_DIR / f"invoice-scan-summary-{account}.json"
    payload: dict[str, Any] = {
        "collector_version": INVOICE_COLLECTOR_VERSION,
        "account": account,
        "started_at": started_at,
        "finished_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "expected_total": target_total,
        "collected_count": len(items),
        "target_reached": bool(target_total and len(items) >= target_total),
        "output_json": str(account_json.relative_to(Path(__file__).resolve().parent)),
        "output_csv": str(account_csv.relative_to(Path(__file__).resolve().parent)),
        "combined_json": str(combined_json.relative_to(Path(__file__).resolve().parent)),
        "combined_csv": str(combined_csv.relative_to(Path(__file__).resolve().parent)),
        "audit_fields": [
            "scan_marker",
            "scan_session_id",
            "screen_no",
            "screen_item_no",
            "source_bounds",
            "source_hash",
            "source_text",
        ],
        "warnings": {
            "missing_price_count": len([item for item in items if item.invoice_price is None]),
            "missing_grade_count": len([item for item in items if not item.grade]),
            "scan_warning_count": len(scan_warnings),
            "scan_warnings": scan_warnings[:50],
        },
    }
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def run_invoice_scan(config: dict[str, Any], account: str, expected_total: int | None) -> None:
    if not config.get("noLaunch"):
        ensure_target_app_foreground(str(config["appPackage"]))
    else:
        log("Mode no-launch aktif. Scanner memakai layar yang sudah standby di HP.")
    if not config.get("noResetPosition"):
        reset_list_to_top(int(config.get("resetTopSwipes", 45)))

    collected: list[InvoiceItem] = []
    previous_visible_entries: list[InvoiceVisibleItem] = []
    previous_signature = ""
    seen_screen_signatures: set[str] = set()
    repeated_signature_count = 0
    no_new_item_count = 0
    scan_warnings: list[str] = []
    scan_started_at = time.strftime("%Y-%m-%d %H:%M:%S")
    scan_session_id = f"invoice-{account}-{time.strftime('%Y%m%d-%H%M%S')}"
    last_scroll_delta = None

    log(f"Invoice Collector {INVOICE_COLLECTOR_VERSION}")
    log(f"Akun invoice: {account}")
    log(f"Package aplikasi: {config['appPackage']}")
    log("Buka halaman invoice/riwayat barang didapat untuk akun ini, lalu biarkan scanner scroll otomatis.")
    time.sleep(2)

    for scroll_index in range(int(config["maxScrolls"])):
        scanned_at = time.strftime("%Y-%m-%d %H:%M:%S")
        started_at = time.perf_counter()
        log(f"[{scroll_index + 1}] Membaca teks UI invoice...")
        texts, visible_entries, dump_warnings = collect_visible_invoice_items_reliable(account, scanned_at)
        save_debug_texts(account, texts)

        for warning in dump_warnings:
            tagged_warning = f"screen {scroll_index + 1}: {warning}"
            if tagged_warning not in scan_warnings:
                scan_warnings.append(tagged_warning)
                log(f"[WARN] {tagged_warning}")

        current_signature = visual_screen_signature(visible_entries)
        screen_seen_before = bool(current_signature and current_signature in seen_screen_signatures)
        elapsed = time.perf_counter() - started_at
        log(
            f"[{scroll_index + 1}] Teks terbaca: {len(texts)} | {elapsed:.1f}s | "
            f"invoice terlihat: {len(visible_entries)} | contoh: {format_text_sample(texts)}"
        )
        if config.get("phoneFeedback"):
            send_phone_feedback("screen")

        sequence_overlap = find_sequence_overlap(previous_visible_entries, visible_entries)
        new_entries, overlap_count, scroll_delta = split_new_visible_items(
            previous_visible_entries,
            visible_entries,
            last_scroll_delta,
        )
        if scroll_delta is not None:
            last_scroll_delta = scroll_delta

        if previous_visible_entries and visible_entries and sequence_overlap == 0:
            warning = (
                f"screen {scroll_index + 1}: overlap urutan invoice tidak ditemukan. "
                "Kontinuitas scan tidak bisa dibuktikan."
            )
            if warning not in scan_warnings:
                scan_warnings.append(warning)
                log(f"[WARN] {warning}")

        if (
            previous_visible_entries
            and visible_entries
            and 0 < sequence_overlap < MIN_CONTINUITY_OVERLAP
        ):
            warning = f"screen {scroll_index + 1}: overlap urutan invoice hanya {sequence_overlap} item."
            if warning not in scan_warnings:
                scan_warnings.append(warning)
                log(f"[WARN] {warning}")

        if current_signature and current_signature == previous_signature:
            repeated_signature_count += 1
        else:
            repeated_signature_count = 0
        previous_signature = current_signature

        if repeated_signature_count > 0 or screen_seen_before:
            new_entries = []
            overlap_count = len(visible_entries)
            if screen_seen_before:
                log(f"[{scroll_index + 1}] Layar invoice ini sudah pernah discan; tidak dihitung ulang.")

        if current_signature:
            seen_screen_signatures.add(current_signature)
        previous_visible_entries = visible_entries

        added_this_scroll = 0
        for entry in new_entries:
            if expected_total and len(collected) >= expected_total:
                break
            item = mark_scanned_item(
                entry=entry,
                scan_order=len(collected) + 1,
                scan_session_id=scan_session_id,
                screen_no=scroll_index + 1,
            )
            collected.append(item)
            added_this_scroll += 1
            log(
                f"  + {item.scan_marker}: {item.raw_name} | "
                f"grade={item.grade or '-'} | invoice={item.invoice_price or '-'}"
            )

        if added_this_scroll == 0:
            no_new_item_count += 1
        else:
            no_new_item_count = 0

        log(
            f"[{scroll_index + 1}] Baru: {added_this_scroll} | overlap: {overlap_count} | "
            f"delta: {scroll_delta if scroll_delta is not None else '-'} | "
            f"total invoice akun: {len(collected)}{f'/{expected_total}' if expected_total else ''} | "
            f"layar sama: {repeated_signature_count} | tanpa item baru: {no_new_item_count}"
        )

        if expected_total and len(collected) >= expected_total:
            log(f"Stop: target total invoice {expected_total} item sudah tercapai.")
            break

        if repeated_signature_count >= BOTTOM_REPEAT_LIMIT:
            log("Stop: layar invoice sudah berulang beberapa kali. Scanner menganggap sudah sampai bawah.")
            break

        if no_new_item_count >= NO_NEW_ITEM_LIMIT:
            log("Stop: terlalu banyak scroll invoice tanpa item baru. Scanner menganggap daftar sudah habis.")
            break

        can_scroll_more = scroll_down_adb(config)
        log(f"[{scroll_index + 1}] Scroll dikirim. Bisa lanjut: {'ya' if can_scroll_more else 'tidak'}")
        if not can_scroll_more:
            break
        time.sleep(float(config["scrollPauseSeconds"]))

    output_paths = save_outputs(account, collected)
    save_scan_summary(account, collected, scan_started_at, expected_total, scan_warnings, output_paths)
    if config.get("phoneFeedback"):
        send_phone_feedback("finished")
    log(f"Selesai. {len(collected)} item invoice akun {account} disimpan.")
    log(f"Output akun: {output_paths[0].name} dan {output_paths[1].name}")
    log(f"Output gabungan 3 akun: {output_paths[2].name} dan {output_paths[3].name}")
    if expected_total and len(collected) != expected_total:
        log(
            f"[WARN] Total invoice terkumpul ({len(collected)}) belum sama dengan target ({expected_total}). "
            "Cek apakah halaman invoice sudah benar atau ada item yang tidak terekspos di UI dump."
        )


def main() -> None:
    args = parse_args()
    config = load_config()
    apply_scan_profile(config, args.scan_profile)
    config["maxScrolls"] = max(1, args.max_scrolls)
    if args.scroll_pause is not None:
        config["scrollPauseSeconds"] = max(0, args.scroll_pause)
    config["phoneFeedback"] = bool(args.phone_feedback)
    config["noResetPosition"] = bool(args.no_reset_position)
    config["noLaunch"] = bool(args.no_launch)
    config["appPackage"] = args.app_package or ACCOUNT_APP_PACKAGES[args.account]

    reset_uiautomator2_server()
    run_invoice_scan(config, args.account, args.expected_total)


if __name__ == "__main__":
    main()
