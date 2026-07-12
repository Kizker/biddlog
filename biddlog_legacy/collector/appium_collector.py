from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from appium import webdriver
    from appium.options.android import UiAutomator2Options
    from selenium.common.exceptions import WebDriverException


def _import_appium():
    """Lazy-import Appium & Selenium. Only needed for --backend appium."""
    # pylint: disable=import-outside-toplevel
    from appium import webdriver as _webdriver
    from appium.options.android import UiAutomator2Options as _Options
    from selenium.common.exceptions import WebDriverException as _WDE
    return _webdriver, _Options, _WDE


GRADE_RE = re.compile(r"\b(A{1,2}|AB|AC|AD|AE|AF|AG|AH|AI|AJ)\b", re.IGNORECASE)
GRADE_VALUE_RE = re.compile(r"\b(AA|AB|AC|AD|AE|AF|AG|AH|AI|AJ|A)\b", re.IGNORECASE)
PRICE_RE = re.compile(r"IDR\s*([\d.,]+)", re.IGNORECASE)
STOCK_RE = re.compile(r"Stok\s*:\s*(\d+)", re.IGNORECASE)
STORAGE_RE = re.compile(r"\b(?:16|32|64|128|256|512|1024)\s*GB\b", re.IGNORECASE)
PRODUCT_LINE_RE = re.compile(
    r"^(?P<name>.*?\b(?:16|32|64|128|256|512|1024)\s*GB)\s*(?P<rest>.*)$",
    re.IGNORECASE,
)
DEBUG_TEXT_LIMIT = 12
COLLECTOR_VERSION = "2026-05-03-recovery-scroll-v16"
DEFAULT_MAX_SCROLLS = 1500
BOTTOM_REPEAT_LIMIT = 4
NO_NEW_ITEM_LIMIT = 35
OVERLAP_POSITION_TOLERANCE = 95
MIN_CONTINUITY_OVERLAP = 2
ADB_DUMP_RETRY_LIMIT = 3
RECOVERY_SCROLL_LIMIT = 12
DEFAULT_SCAN_PROFILE = "accuracy"
SCAN_PROFILES: dict[str, dict[str, float | int]] = {
    "accuracy": {
        "scrollPauseSeconds": 0.45,
        "scrollStartRatio": 0.68,
        "scrollEndRatio": 0.45,
        "scrollDurationMs": 220,
    },
    "balanced": {
        "scrollPauseSeconds": 0.3,
        "scrollStartRatio": 0.70,
        "scrollEndRatio": 0.42,
        "scrollDurationMs": 180,
    },
    "fast": {
        "scrollPauseSeconds": 0.25,
        "scrollStartRatio": 0.74,
        "scrollEndRatio": 0.34,
        "scrollDurationMs": 160,
    },
}
DEFAULT_SCROLL_START_RATIO = float(SCAN_PROFILES[DEFAULT_SCAN_PROFILE]["scrollStartRatio"])
DEFAULT_SCROLL_END_RATIO = float(SCAN_PROFILES[DEFAULT_SCAN_PROFILE]["scrollEndRatio"])
DEFAULT_SCROLL_DURATION_MS = int(SCAN_PROFILES[DEFAULT_SCAN_PROFILE]["scrollDurationMs"])
SCREEN_SIZE_CACHE: tuple[int, int] | None = None
SCAN_OUTPUT_DIR = Path(__file__).resolve().parent / "output" / "scan-list"


@dataclass
class CollectorItem:
    raw_name: str
    grade: str = ""
    status: str = ""
    condition: str = ""
    stock: int | None = None
    auction_price: int | None = None
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
class VisibleItem:
    item: CollectorItem
    key: str
    top: int
    bottom: int
    bounds: str = ""
    source_text: str = ""
    screen_item_no: int = 0


def load_config() -> dict[str, Any]:
    base_path = Path(__file__).resolve().parent
    config_path = base_path / "config.json"
    if not config_path.exists():
        config_path = base_path / "config.example.json"
    return json.loads(config_path.read_text(encoding="utf-8"))


def apply_scan_profile(config: dict[str, Any], profile_name: str) -> None:
    profile = SCAN_PROFILES.get(profile_name)
    if not profile:
        raise ValueError(f"Profil scan tidak dikenal: {profile_name}")

    config["scanProfile"] = profile_name
    for key, value in profile.items():
        config[key] = value


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect visible Bidding Plus items through Android UI.")
    parser.add_argument(
        "--backend",
        choices=["adb", "appium"],
        default="adb",
        help="Backend scan. Default adb lebih cepat; appium disediakan sebagai fallback.",
    )
    parser.add_argument(
        "--max-scrolls",
        type=int,
        default=None,
        help="Override batas scroll. Jika tidak diisi, collector memakai batas lengkap otomatis.",
    )
    parser.add_argument(
        "--scroll-pause",
        type=float,
        default=None,
        help="Override jeda setelah scroll. Default memakai config.json.",
    )
    parser.add_argument(
        "--no-reset-position",
        action="store_true",
        help="Jangan reset daftar ke atas sebelum scan.",
    )
    parser.add_argument(
        "--expected-total",
        type=int,
        default=None,
        help="Total unit yang diharapkan dari aplikasi. Collector berhenti jika jumlah ini tercapai.",
    )
    parser.add_argument(
        "--scan-profile",
        choices=["accuracy", "balanced", "fast"],
        default=None,
        help="Profil scan. accuracy paling aman, balanced sedang, fast lebih cepat tetapi berisiko melewati item.",
    )
    parser.add_argument(
        "--phone-feedback",
        action="store_true",
        help="Kirim getar pendek di HP setiap layar berhasil dibaca, dan getar panjang saat selesai.",
    )
    parser.add_argument(
        "--no-strict-continuity",
        action="store_true",
        help="Izinkan scan lanjut walau overlap antar layar tidak bisa dibuktikan. Tidak disarankan untuk scan akurat.",
    )
    return parser.parse_args()


def parse_price(text: str) -> int | None:
    match = PRICE_RE.search(text)
    if not match:
        return None
    value = re.sub(r"\D", "", match.group(1))
    return int(value) if value else None


def looks_like_product_name(text: str) -> bool:
    normalized = " ".join(text.split())
    return bool(STORAGE_RE.search(normalized)) and len(normalized) >= 10


def parse_product_line(text: str, scanned_at: str) -> CollectorItem | None:
    match = PRODUCT_LINE_RE.match(text)
    if not match:
        return None

    name = " ".join(match.group("name").split())
    rest = " ".join(match.group("rest").split())
    item = CollectorItem(raw_name=name, scanned_at=scanned_at)

    grade = GRADE_VALUE_RE.search(rest)
    if grade:
        item.grade = grade.group(1).upper()

    if "Terdaftar" in rest:
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

    item.auction_price = parse_price(rest)
    return item


def extract_items_from_texts(texts: list[str], scanned_at: str) -> list[CollectorItem]:
    items: list[CollectorItem] = []
    current: CollectorItem | None = None

    for raw_text in texts:
        text = " ".join(raw_text.split())
        if not text:
            continue

        if looks_like_product_name(text):
            if current:
                items.append(current)
            current = parse_product_line(text, scanned_at) or CollectorItem(raw_name=text, scanned_at=scanned_at)
            continue

        if not current:
            continue

        grade = GRADE_RE.fullmatch(text)
        if grade:
            current.grade = grade.group(1).upper()
            continue

        if "Terdaftar" in text:
            current.status = "Terdaftar"
            continue
        if re.search(r"\bInternational\b", text, re.IGNORECASE):
            current.status = "International"
            continue

        if re.search(r"Produk\s+Only", text, re.IGNORECASE):
            current.condition = "Produk Only"
            continue
        if re.search(r"Full\s*Set", text, re.IGNORECASE):
            current.condition = "Full Set"
            continue

        stock = STOCK_RE.search(text)
        if stock:
            current.stock = int(stock.group(1))
            continue

        price = parse_price(text)
        if price:
            current.auction_price = price

    if current:
        items.append(current)

    return items


def log(message: str) -> None:
    print(message, flush=True)


def collect_visible_texts_from_source(page_source: str) -> list[str]:
    texts: list[str] = []
    try:
        root = ET.fromstring(page_source)
    except ET.ParseError as exc:
        log(f"[WARN] Gagal parse UI XML: {exc}")
        return texts

    for node in root.iter():
        raw_bounds = node.attrib.get("bounds", "")
        bounds = parse_bounds(raw_bounds)
        if bounds and (bounds[1] - bounds[0] < 75):
            continue

        for attr_name in ("text", "content-desc"):
            value = " ".join((node.attrib.get(attr_name) or "").split())
            if value:
                texts.append(value)

    return texts


def parse_bounds(bounds: str) -> tuple[int, int] | None:
    match = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds or "")
    if not match:
        return None
    left, top, right, bottom = (int(match.group(index)) for index in range(1, 5))
    if right <= left or bottom <= top:
        return None
    return top, bottom


def collect_visible_items_from_source(page_source: str, scanned_at: str) -> list[VisibleItem]:
    visible_items: list[VisibleItem] = []
    seen_nodes: set[tuple[str, str]] = set()
    try:
        root = ET.fromstring(page_source)
    except ET.ParseError as exc:
        log(f"[WARN] Gagal parse UI XML: {exc}")
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

            item = parse_product_line(text, scanned_at)
            if not item:
                continue

            node_signature = (raw_bounds, text)
            if node_signature in seen_nodes:
                continue
            seen_nodes.add(node_signature)

            visible_items.append(
                VisibleItem(
                    item=item,
                    key=item_key(item),
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


def collect_visible_texts(driver: webdriver.Remote) -> list[str]:
    _, _, WebDriverException_ = _import_appium()
    try:
        page_source = driver.page_source
        return collect_visible_texts_from_source(page_source)
    except WebDriverException_ as exc:
        log(f"[WARN] Appium page_source gagal, coba baca via ADB: {exc.msg}")
        return collect_visible_texts_from_adb()


def run_adb_command(command: list[str], timeout: int = 8) -> tuple[int, str]:
    adb_path = shutil.which("adb") or str(Path(os.environ.get("ANDROID_HOME", "C:\\")) / "platform-tools" / "adb.exe")
    try:
        completed = subprocess.run(
            [adb_path, *command],
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        return 1, str(exc)

    output = "\n".join(
        part.strip()
        for part in [completed.stdout, completed.stderr]
        if part and part.strip()
    )
    return completed.returncode, output


def extract_xml_from_adb_output(output: str) -> str:
    if not output:
        return ""

    start_index = output.find("<hierarchy")
    if start_index < 0:
        start_index = output.find("<?xml")
    if start_index < 0:
        return ""

    xml_output = output[start_index:].strip()
    end_index = xml_output.rfind("</hierarchy>")
    if end_index >= 0:
        xml_output = xml_output[: end_index + len("</hierarchy>")]
    return xml_output


def collect_visible_texts_from_adb() -> list[str]:
    page_source = collect_page_source_from_adb()
    return collect_visible_texts_from_source(page_source) if page_source else []


def collect_page_source_from_adb() -> str:
    dump_code, dump_output = run_adb_command(
        ["shell", "uiautomator", "dump", "--compressed", "/sdcard/window.xml"],
        timeout=6,
    )
    if dump_code != 0:
        log(f"[WARN] ADB uiautomator dump gagal: {dump_output or '-'}")
        return ""

    cat_code, xml_output = run_adb_command(["exec-out", "cat", "/sdcard/window.xml"], timeout=6)
    if cat_code != 0:
        log(f"[WARN] ADB baca window.xml gagal: {xml_output or '-'}")
        return ""

    return extract_xml_from_adb_output(xml_output) or xml_output


def collect_visible_items_from_adb(scanned_at: str) -> tuple[list[str], list[VisibleItem]]:
    page_source = collect_page_source_from_adb()
    if not page_source:
        return [], []
    return collect_visible_texts_from_source(page_source), collect_visible_items_from_source(page_source, scanned_at)


def count_product_texts(texts: list[str]) -> int:
    return sum(1 for text in texts if looks_like_product_name(text))


def align_entries_to_text_order(
    texts: list[str],
    entries: list[VisibleItem],
    scanned_at: str,
) -> tuple[list[VisibleItem], int]:
    entries_by_text: dict[str, list[VisibleItem]] = {}
    for entry in sorted(entries, key=lambda item: (item.top, item.bottom, item.key)):
        entries_by_text.setdefault(entry.source_text, []).append(entry)

    aligned_entries: list[VisibleItem] = []
    fallback_count = 0
    product_index = 0

    for raw_text in texts:
        text = " ".join(raw_text.split())
        if not looks_like_product_name(text):
            continue

        product_index += 1
        matching_entries = entries_by_text.get(text) or []
        if matching_entries:
            entry = matching_entries.pop(0)
            entry.top = product_index * 100
            entry.bottom = (product_index + 1) * 100
            aligned_entries.append(entry)
            continue

        item = parse_product_line(text, scanned_at)
        if not item:
            continue

        fallback_count += 1
        aligned_entries.append(
            VisibleItem(
                item=item,
                key=item_key(item),
                top=product_index * 100,
                bottom=(product_index + 1) * 100,
                bounds=f"text-order-{product_index:02d}",
                source_text=text,
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


def collect_visible_items_from_adb_reliable(scanned_at: str) -> tuple[list[str], list[VisibleItem], list[str]]:
    best_texts: list[str] = []
    best_entries: list[VisibleItem] = []
    best_invalid_count: int | None = None
    best_fallback_count = 0
    warnings: list[str] = []

    for attempt in range(1, ADB_DUMP_RETRY_LIMIT + 1):
        texts, entries = collect_visible_items_from_adb(scanned_at)
        aligned_entries, fallback_count = align_entries_to_text_order(texts, entries, scanned_at)
        product_text_count = count_product_texts(texts)
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
                f"[WARN] UI dump belum stabil: teks produk={product_text_count}, "
                f"item terbaca={len(aligned_entries)}. Retry {attempt}/{ADB_DUMP_RETRY_LIMIT}..."
            )
            time.sleep(0.35)

    if best_fallback_count:
        warnings.append(
            f"UI dump mengandung {best_fallback_count} teks produk tanpa bounds valid; "
            "collector tetap memasukkan item memakai urutan teks."
        )
    if best_invalid_count:
        warnings.append(f"UI dump masih menyisakan {best_invalid_count} teks produk yang belum bisa diparse.")

    return best_texts, best_entries, warnings


def format_text_sample(texts: list[str]) -> str:
    if not texts:
        return "-"
    return " | ".join(texts[:DEBUG_TEXT_LIMIT])


def parse_total_unit(texts: list[str]) -> int | None:
    joined_text = " ".join(texts)
    match = re.search(r"Total\s+Unit\s*:\s*([\d.,]+)", joined_text, re.IGNORECASE)
    if not match:
        return None

    value = re.sub(r"\D", "", match.group(1))
    return int(value) if value else None


def item_key(item: CollectorItem) -> str:
    return "|".join(
        [
            item.raw_name.lower(),
            item.grade.lower(),
            str(item.auction_price or ""),
            item.condition.lower(),
        ]
    )


def find_sequence_overlap(previous_entries: list[VisibleItem], current_entries: list[VisibleItem]) -> int:
    previous_keys = [entry.key for entry in previous_entries]
    current_keys = [entry.key for entry in current_entries]
    max_overlap = min(len(previous_keys), len(current_keys))

    for size in range(max_overlap, 0, -1):
        if previous_keys[-size:] == current_keys[:size]:
            return size

    return 0


def has_duplicate_keys(entries: list[VisibleItem]) -> bool:
    keys = [entry.key for entry in entries]
    return len(keys) != len(set(keys))


def visual_screen_signature(entries: list[VisibleItem]) -> str:
    return "||".join(f"{entry.key}@{entry.bounds}" for entry in entries)


def estimate_scroll_delta(previous_entries: list[VisibleItem], current_entries: list[VisibleItem]) -> int | None:
    deltas: list[int] = []
    previous_occurrences: dict[str, int] = {}
    current_occurrences: dict[str, int] = {}
    current_by_occurrence: dict[tuple[str, int], VisibleItem] = {}

    for current_entry in current_entries:
        occurrence = current_occurrences.get(current_entry.key, 0) + 1
        current_occurrences[current_entry.key] = occurrence
        current_by_occurrence[(current_entry.key, occurrence)] = current_entry

    for previous_entry in previous_entries:
        occurrence = previous_occurrences.get(previous_entry.key, 0) + 1
        previous_occurrences[previous_entry.key] = occurrence
        current_entry = current_by_occurrence.get((previous_entry.key, occurrence))
        if not current_entry:
            continue
        delta = previous_entry.top - current_entry.top
        if delta > 10:
            deltas.append(delta)

    if not deltas:
        return None

    deltas.sort()
    return deltas[len(deltas) // 2]


def split_new_visible_items(
    previous_entries: list[VisibleItem],
    current_entries: list[VisibleItem],
) -> tuple[list[VisibleItem], int, int | None]:
    if not previous_entries:
        return current_entries, 0, None

    sequence_overlap = find_sequence_overlap(previous_entries, current_entries)
    if sequence_overlap > 0:
        if sequence_overlap == len(current_entries) and has_duplicate_keys(current_entries):
            delta = estimate_scroll_delta(previous_entries, current_entries)
            if delta is not None:
                return split_new_visible_items_by_position(previous_entries, current_entries, delta)
        return current_entries[sequence_overlap:], sequence_overlap, None

    delta = estimate_scroll_delta(previous_entries, current_entries)
    if delta is None:
        if [entry.key for entry in previous_entries] == [entry.key for entry in current_entries]:
            return [], len(current_entries), 0
        return current_entries, 0, None

    return split_new_visible_items_by_position(previous_entries, current_entries, delta)


def split_new_visible_items_by_position(
    previous_entries: list[VisibleItem],
    current_entries: list[VisibleItem],
    delta: int,
) -> tuple[list[VisibleItem], int, int | None]:
    matched_previous_indexes: set[int] = set()
    new_entries: list[VisibleItem] = []
    overlap_count = 0

    for current_entry in current_entries:
        best_index: int | None = None
        best_distance: int | None = None

        for previous_index, previous_entry in enumerate(previous_entries):
            if previous_index in matched_previous_indexes:
                continue
            if current_entry.key != previous_entry.key:
                continue

            predicted_top = previous_entry.top - delta
            distance = abs(predicted_top - current_entry.top)
            if distance > OVERLAP_POSITION_TOLERANCE:
                continue
            if best_distance is None or distance < best_distance:
                best_index = previous_index
                best_distance = distance

        if best_index is None:
            new_entries.append(current_entry)
        else:
            matched_previous_indexes.add(best_index)
            overlap_count += 1

    return new_entries, overlap_count, delta


def mark_scanned_item(
    entry: VisibleItem,
    scan_order: int,
    scan_session_id: str,
    screen_no: int,
) -> CollectorItem:
    item = entry.item
    item.scan_order = scan_order
    item.scan_session_id = scan_session_id
    item.screen_no = screen_no
    item.screen_item_no = entry.screen_item_no
    item.source_bounds = entry.bounds
    item.source_text = entry.source_text
    item.source_hash = hashlib.sha1(entry.source_text.encode("utf-8")).hexdigest()[:12]
    item.scan_marker = f"S{screen_no:04d}-I{entry.screen_item_no:02d}-O{scan_order:04d}"
    return item


def save_outputs(items: list[CollectorItem], config: dict[str, Any]) -> None:
    base_path = Path(__file__).resolve().parent
    json_path = base_path / config["outputJson"]
    csv_path = base_path / config["outputCsv"]
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


def save_scan_summary(
    items: list[CollectorItem],
    config: dict[str, Any],
    started_at: str,
    target_total: int | None,
    backend: str,
    scan_warnings: list[str] | None = None,
    forced_duplicate_count: int = 0,
    recovery_scroll_count: int = 0,
) -> None:
    summary_path = SCAN_OUTPUT_DIR / "scan-summary.json"
    summary_path.parent.mkdir(parents=True, exist_ok=True)

    missing_condition = [item.scan_marker for item in items if not item.condition]
    missing_status = [item.scan_marker for item in items if not item.status]
    payload = {
        "collector_version": COLLECTOR_VERSION,
        "backend": backend,
        "scan_profile": config.get("scanProfile", DEFAULT_SCAN_PROFILE),
        "scroll_settings": {
            "scroll_pause_seconds": config.get("scrollPauseSeconds"),
            "scroll_start_ratio": config.get("scrollStartRatio"),
            "scroll_end_ratio": config.get("scrollEndRatio"),
            "scroll_duration_ms": config.get("scrollDurationMs"),
        },
        "started_at": started_at,
        "finished_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "expected_total": target_total,
        "collected_count": len(items),
        "target_reached": bool(target_total and len(items) >= target_total),
        "output_json": config["outputJson"],
        "output_csv": config["outputCsv"],
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
            "missing_condition_count": len(missing_condition),
            "missing_condition_markers": missing_condition[:30],
            "missing_status_count": len(missing_status),
            "missing_status_markers": missing_status[:30],
            "scan_warning_count": len(scan_warnings or []),
            "scan_warnings": (scan_warnings or [])[:50],
            "forced_duplicate_count": forced_duplicate_count,
            "recovery_scroll_count": recovery_scroll_count,
        },
    }
    summary_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def save_debug_texts(texts: list[str]) -> None:
    debug_path = SCAN_OUTPUT_DIR / "last-ui-texts.txt"
    debug_path.parent.mkdir(parents=True, exist_ok=True)
    debug_path.write_text("\n".join(texts), encoding="utf-8")


def get_screen_size_from_adb() -> tuple[int, int]:
    global SCREEN_SIZE_CACHE
    if SCREEN_SIZE_CACHE:
        return SCREEN_SIZE_CACHE

    code, output = run_adb_command(["shell", "wm", "size"], timeout=5)
    if code != 0:
        raise RuntimeError(f"Gagal membaca ukuran layar via ADB: {output}")

    match = re.search(r"(\d+)x(\d+)", output)
    if not match:
        raise RuntimeError(f"Format ukuran layar tidak dikenali: {output}")

    SCREEN_SIZE_CACHE = (int(match.group(1)), int(match.group(2)))
    return SCREEN_SIZE_CACHE


def scroll_down_adb(config: dict[str, Any]) -> bool:
    screen_width, screen_height = get_screen_size_from_adb()
    start_x = screen_width // 2
    start_ratio = float(config.get("scrollStartRatio", DEFAULT_SCROLL_START_RATIO))
    end_ratio = float(config.get("scrollEndRatio", DEFAULT_SCROLL_END_RATIO))
    duration_ms = int(config.get("scrollDurationMs", DEFAULT_SCROLL_DURATION_MS))
    start_y = int(screen_height * start_ratio)
    end_y = int(screen_height * end_ratio)
    code, output = run_adb_command(
        ["shell", "input", "swipe", str(start_x), str(start_y), str(start_x), str(end_y), str(duration_ms)],
        timeout=5,
    )
    if code != 0:
        raise RuntimeError(f"ADB input swipe gagal: {output}")
    return True


def recovery_scroll_down_adb(attempt: int) -> bool:
    screen_width, screen_height = get_screen_size_from_adb()
    patterns = [
        (0.50, 0.82, 0.18, 650),
        (0.50, 0.88, 0.16, 900),
        (0.62, 0.82, 0.20, 700),
        (0.38, 0.82, 0.20, 700),
    ]
    x_ratio, start_ratio, end_ratio, duration_ms = patterns[(attempt - 1) % len(patterns)]
    start_x = int(screen_width * x_ratio)
    start_y = int(screen_height * start_ratio)
    end_y = int(screen_height * end_ratio)

    code, output = run_adb_command(
        ["shell", "input", "swipe", str(start_x), str(start_y), str(start_x), str(end_y), str(duration_ms)],
        timeout=6,
    )
    if code != 0:
        raise RuntimeError(f"ADB recovery swipe gagal: {output}")

    if attempt % len(patterns) == 0:
        run_adb_command(["shell", "input", "keyevent", "93"], timeout=3)

    return True


def scroll_up_adb() -> bool:
    screen_width, screen_height = get_screen_size_from_adb()
    start_x = screen_width // 2
    start_y = int(screen_height * 0.22)
    end_y = int(screen_height * 0.86)
    code, output = run_adb_command(
        ["shell", "input", "swipe", str(start_x), str(start_y), str(start_x), str(end_y), "180"],
        timeout=5,
    )
    if code != 0:
        raise RuntimeError(f"ADB input reverse swipe gagal: {output}")
    return True


def reset_list_to_top(max_swipes: int) -> None:
    if max_swipes <= 0:
        return

    log(f"Reset posisi daftar ke atas ({max_swipes} reverse swipe)...")
    for index in range(max_swipes):
        scroll_up_adb()
        if (index + 1) % 10 == 0:
            log(f"  reverse swipe {index + 1}/{max_swipes}")
        time.sleep(0.08)
    log("Reset posisi selesai. Mulai scan dari bagian atas daftar.")


def reset_uiautomator2_server() -> None:
    for package_name in ("io.appium.uiautomator2.server", "io.appium.uiautomator2.server.test"):
        run_adb_command(["shell", "am", "force-stop", package_name], timeout=5)


def send_phone_feedback(kind: str) -> None:
    duration_ms = "180" if kind == "finished" else "35"
    run_adb_command(["shell", "cmd", "vibrator", "vibrate", duration_ms], timeout=2)


def get_foreground_package() -> str:
    code, output = run_adb_command(["shell", "dumpsys", "window", "windows"], timeout=6)
    if code != 0:
        return ""

    match = re.search(r"mCurrentFocus=.*? ([A-Za-z0-9_.]+)/", output)
    if match:
        return match.group(1)

    match = re.search(r"mFocusedApp=.*? ([A-Za-z0-9_.]+)/", output)
    return match.group(1) if match else ""


def ensure_target_app_foreground(app_package: str) -> None:
    foreground_package = get_foreground_package()
    if foreground_package == app_package:
        log(f"Aplikasi aktif: {app_package}")
        return

    if foreground_package:
        log(f"[WARN] Aplikasi aktif saat ini: {foreground_package}, bukan {app_package}.")
    else:
        log(f"[WARN] Aplikasi aktif tidak bisa dibaca. Collector akan mencoba membuka {app_package}.")

    code, output = run_adb_command(
        ["shell", "monkey", "-p", app_package, "-c", "android.intent.category.LAUNCHER", "1"],
        timeout=8,
    )
    if code != 0:
        log(f"[WARN] Gagal membuka {app_package}: {output or '-'}")
        return

    log("Aplikasi target dibuka. Pastikan halaman Bidding Reguler sudah tampil sebelum scan lanjut.")
    time.sleep(3)


def scroll_down(driver: webdriver.Remote) -> bool:
    _, _, WebDriverException_ = _import_appium()
    size = driver.get_window_size()
    screen_width = int(size.get("width", 0) or 0)
    screen_height = int(size.get("height", 0) or 0)
    if screen_width <= 0 or screen_height <= 0:
        raise RuntimeError(f"Ukuran layar tidak valid: {size}")

    left = max(1, int(screen_width * 0.08))
    top = max(1, int(screen_height * 0.22))
    width = max(1, int(screen_width * 0.84))
    height = max(1, int(screen_height * 0.62))

    try:
        result = driver.execute_script(
            "mobile: scrollGesture",
            {
                "left": left,
                "top": top,
                "width": width,
                "height": height,
                "direction": "down",
                "percent": 0.78,
            },
        )
        return bool(result) if isinstance(result, bool) else True
    except WebDriverException_ as exc:
        log(f"[WARN] scrollGesture gagal, coba fallback swipe: {exc.msg}")

    start_x = screen_width // 2
    start_y = int(screen_height * 0.78)
    end_y = int(screen_height * 0.28)
    try:
        driver.swipe(start_x, start_y, start_x, end_y, 650)
        return True
    except WebDriverException_ as exc:
        log(f"[WARN] Appium swipe gagal, coba ADB input swipe: {exc.msg}")

    code, output = run_adb_command(
        ["shell", "input", "swipe", str(start_x), str(start_y), str(start_x), str(end_y), "650"],
        timeout=10,
    )
    if code != 0:
        raise RuntimeError(f"ADB input swipe gagal: {output}")

    return True


def assert_appium_server_ready(server_url: str) -> None:
    server = server_url.replace("http://", "").replace("https://", "").rstrip("/")
    host, _, raw_port = server.partition(":")
    port = int(raw_port or "4723")

    try:
        with socket.create_connection((host, port), timeout=3):
            return
    except OSError:
        print("")
        print("ERROR: Appium server belum aktif.")
        print(f"Collector mencoba terhubung ke {server_url}, tetapi koneksi ditolak.")
        print("")
        print("Jalankan Appium server dulu di terminal lain:")
        print("  appium --base-path /")
        print("")
        print("Jika command appium belum dikenali, install dulu:")
        print("  npm install -g appium")
        print("  appium driver install uiautomator2")
        print("")
        print("Pastikan juga ADB/Android Platform Tools sudah terpasang dan HP terdeteksi:")
        print("  adb devices")
        sys.exit(1)


def print_android_sdk_error() -> None:
    print("")
    print("ERROR: Android SDK environment belum siap untuk Appium.")
    print("Appium membutuhkan ANDROID_HOME atau ANDROID_SDK_ROOT sebelum server dijalankan.")
    print("")
    print("Tutup terminal Appium server yang lama, lalu buka lagi dari CMD dengan urutan ini:")
    print('  cd "Documents\\bidlog\\collector"')
    print('  set "PATH=C:\\platform-tools;C:\\laragon\\bin\\nodejs\\node-v20.19.3-win-x64;%PATH%"')
    print("  set ANDROID_HOME=C:\\")
    print("  set ANDROID_SDK_ROOT=C:\\")
    print("  appium --base-path /")
    print("")
    print("Di terminal CMD lain, jalankan perintah set yang sama sebelum menjalankan collector:")
    print('  set "PATH=C:\\platform-tools;C:\\laragon\\bin\\nodejs\\node-v20.19.3-win-x64;%PATH%"')
    print("  set ANDROID_HOME=C:\\")
    print("  set ANDROID_SDK_ROOT=C:\\")
    print('  "C:\\laragon\\bin\\python\\python-3.10\\python.exe" appium_collector.py')
    print("")


def assert_android_sdk_env_ready() -> None:
    sdk_root = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT")
    if not sdk_root:
        print_android_sdk_error()
        sys.exit(1)

    adb_path = Path(sdk_root) / "platform-tools" / "adb.exe"
    if not adb_path.exists():
        print("")
        print("ERROR: ANDROID_HOME/ANDROID_SDK_ROOT tidak mengarah ke Android SDK yang valid.")
        print(f"Path yang dicek: {adb_path}")
        print("Pastikan folder SDK berisi platform-tools\\adb.exe.")
        print("")
        sys.exit(1)


def create_appium_driver(config: dict[str, Any]) -> webdriver.Remote:
    webdriver_, UiAutomator2Options_, WebDriverException_ = _import_appium()
    options = UiAutomator2Options_()
    options.platform_name = config["platformName"]
    options.automation_name = config["automationName"]
    options.device_name = config["deviceName"]
    options.app_package = config["appPackage"]
    if config.get("appActivity"):
        options.app_activity = config["appActivity"]
    options.no_reset = True
    options.new_command_timeout = 180
    options.set_capability("appium:settings[ignoreUnimportantViews]", True)
    options.set_capability("appium:settings[waitForIdleTimeout]", 100)
    options.set_capability("appium:settings[waitForSelectorTimeout]", 1000)

    try:
        log("Menghubungkan ke Appium server...")
        return webdriver_.Remote(config["appiumServer"], options=options)
    except WebDriverException_ as exc:
        message = str(exc)
        if "ANDROID_HOME" in message or "ANDROID_SDK_ROOT" in message:
            print_android_sdk_error()
            sys.exit(1)
        raise


def run_scan(config: dict[str, Any], backend: str, reset_position: bool) -> None:
    driver: webdriver.Remote | None = None
    if backend == "appium":
        assert_appium_server_ready(config["appiumServer"])
        driver = create_appium_driver(config)
    else:
        ensure_target_app_foreground(str(config["appPackage"]))
        if reset_position:
            reset_list_to_top(int(config.get("resetTopSwipes", 45)))

    collected: list[CollectorItem] = []
    repeated_signature_count = 0
    no_new_item_count = 0
    forced_duplicate_count = 0
    recovery_scroll_count = 0
    previous_signature = ""
    seen_screen_signatures: set[str] = set()
    previous_visible_entries: list[VisibleItem] = []
    target_total: int | None = int(config["expectedTotal"]) if config.get("expectedTotal") else None
    strict_continuity = bool(config.get("strictContinuity", True))
    scan_warnings: list[str] = []
    scan_started_at = time.strftime("%Y-%m-%d %H:%M:%S")
    scan_session_id = time.strftime("%Y%m%d-%H%M%S")

    try:
        log(f"Backend scan: {backend.upper()}")
        log("Buka halaman Bidding Reguler, lalu biarkan collector scroll otomatis.")
        time.sleep(2)

        for scroll_index in range(int(config["maxScrolls"])):
            scanned_at = time.strftime("%Y-%m-%d %H:%M:%S")
            started_at = time.perf_counter()
            log(f"[{scroll_index + 1}] Membaca teks UI...")
            if driver:
                texts = collect_visible_texts(driver)
                visible_items = extract_items_from_texts(texts, scanned_at)
                visible_entries = [
                    VisibleItem(
                        item=item,
                        key=item_key(item),
                        top=index * 100,
                        bottom=(index + 1) * 100,
                        bounds=f"appium-index-{index}",
                        source_text=item.raw_name,
                        screen_item_no=index + 1,
                    )
                    for index, item in enumerate(visible_items)
                ]
            else:
                texts, visible_entries, dump_warnings = collect_visible_items_from_adb_reliable(scanned_at)
                for warning in dump_warnings:
                    tagged_warning = f"screen {scroll_index + 1}: {warning}"
                    if tagged_warning not in scan_warnings:
                        scan_warnings.append(tagged_warning)
                        log(f"[WARN] {tagged_warning}")
                visible_items = [entry.item for entry in visible_entries]

            save_debug_texts(texts)
            current_total = parse_total_unit(texts)
            if current_total and not config.get("expectedTotalLocked"):
                target_total = current_total
                log(f"[{scroll_index + 1}] Target total dari UI: {target_total} unit")

            visible_keys = [entry.key for entry in visible_entries]
            current_signature = visual_screen_signature(visible_entries)
            screen_seen_before = bool(current_signature and current_signature in seen_screen_signatures)
            elapsed = time.perf_counter() - started_at
            log(
                f"[{scroll_index + 1}] Teks terbaca: {len(texts)} | {elapsed:.1f}s | "
                f"produk terlihat: {len(visible_items)} | contoh: {format_text_sample(texts)}"
            )
            if backend == "adb" and config.get("phoneFeedback"):
                send_phone_feedback("screen")

            added_this_scroll = 0
            sequence_overlap = find_sequence_overlap(previous_visible_entries, visible_entries)
            new_entries, overlap_count, scroll_delta = split_new_visible_items(
                previous_visible_entries,
                visible_entries,
            )

            if previous_visible_entries and visible_entries and sequence_overlap == 0:
                warning = (
                    f"screen {scroll_index + 1}: overlap urutan tidak ditemukan. "
                    "Kontinuitas scan tidak bisa dibuktikan."
                )
                if warning not in scan_warnings:
                    scan_warnings.append(warning)
                if strict_continuity:
                    log(f"[WARN] {warning}")
                    log("Stop: mode akurasi ketat menghentikan scan agar hasil tidak keliru.")
                    break

            if (
                previous_visible_entries
                and visible_entries
                and 0 < sequence_overlap < MIN_CONTINUITY_OVERLAP
                and len(previous_visible_entries) >= MIN_CONTINUITY_OVERLAP
                and len(visible_entries) >= MIN_CONTINUITY_OVERLAP
            ):
                warning = (
                    f"screen {scroll_index + 1}: overlap urutan hanya {sequence_overlap} item; "
                    f"minimal aman {MIN_CONTINUITY_OVERLAP}."
                )
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
                    log(
                        f"[{scroll_index + 1}] Layar ini sudah pernah discan. "
                        "Item di layar ini tidak dihitung ulang."
                    )

            if (
                target_total
                and len(collected) < target_total
                and not new_entries
                and visible_entries
                and has_duplicate_keys(visible_entries)
                and (repeated_signature_count > 0 or screen_seen_before)
            ):
                new_entries = [visible_entries[-1]]
                forced_duplicate_count += 1
                warning = (
                    f"screen {scroll_index + 1}: layar berisi unit identik berulang; "
                    "collector menambah 1 unit identik karena target total belum tercapai."
                )
                scan_warnings.append(warning)
                log(f"[WARN] {warning}")

            if current_signature:
                seen_screen_signatures.add(current_signature)

            previous_visible_entries = visible_entries

            for entry in new_entries:
                if target_total and len(collected) >= target_total:
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
                    f"grade={item.grade or '-'} | harga={item.auction_price or '-'}"
                )

            if added_this_scroll == 0:
                no_new_item_count += 1
            else:
                no_new_item_count = 0
                recovery_scroll_count = 0

            log(
                f"[{scroll_index + 1}] Baru: {added_this_scroll} | overlap: {overlap_count} | "
                f"delta: {scroll_delta if scroll_delta is not None else '-'} | "
                f"total terkumpul: {len(collected)}{f'/{target_total}' if target_total else ''} | "
                f"layar sama: {repeated_signature_count} | tanpa item baru: {no_new_item_count}"
            )

            if target_total and len(collected) >= target_total:
                log(f"Stop: target total {target_total} unit sudah tercapai.")
                break

            needs_target_recovery = bool(target_total and len(collected) < target_total)

            if (
                needs_target_recovery
                and (repeated_signature_count >= BOTTOM_REPEAT_LIMIT or no_new_item_count >= 5)
                and recovery_scroll_count < RECOVERY_SCROLL_LIMIT
            ):
                recovery_scroll_count += 1
                warning = (
                    f"screen {scroll_index + 1}: target belum tercapai "
                    f"({len(collected)}/{target_total}), layar belum bergerak. "
                    f"Recovery scroll {recovery_scroll_count}/{RECOVERY_SCROLL_LIMIT}."
                )
                scan_warnings.append(warning)
                log(f"[WARN] {warning}")
                recovery_scroll_down_adb(recovery_scroll_count)
                time.sleep(max(float(config["scrollPauseSeconds"]), 0.65))
                continue

            if repeated_signature_count >= BOTTOM_REPEAT_LIMIT and not (
                target_total and len(collected) < target_total and forced_duplicate_count > 0
            ):
                log("Stop: layar sudah berulang beberapa kali. Collector menganggap sudah sampai bawah.")
                break

            if no_new_item_count >= NO_NEW_ITEM_LIMIT:
                log("Stop: terlalu banyak scroll tanpa item baru. Collector menganggap daftar sudah habis atau mentok.")
                break

            can_scroll_more = scroll_down(driver) if driver else scroll_down_adb(config)
            log(f"[{scroll_index + 1}] Scroll dikirim. Bisa lanjut: {'ya' if can_scroll_more else 'tidak'}")
            if not can_scroll_more:
                break
            time.sleep(float(config["scrollPauseSeconds"]))

        save_outputs(collected, config)
        save_scan_summary(
            collected,
            config,
            scan_started_at,
            target_total,
            backend,
            scan_warnings,
            forced_duplicate_count,
            recovery_scroll_count,
        )
        if backend == "adb" and config.get("phoneFeedback"):
            send_phone_feedback("finished")
        log(f"Selesai. {len(collected)} item disimpan.")
        if target_total and len(collected) != target_total:
            log(
                f"[WARN] Total terkumpul ({len(collected)}) belum sama dengan target UI ({target_total}). "
                "Kemungkinan ada item yang tidak terekspos di UI dump atau daftar berubah saat scan."
            )
    finally:
        if driver:
            driver.quit()


def main() -> None:
    args = parse_args()
    config = load_config()
    profile_name = args.scan_profile or str(config.get("scanProfile") or DEFAULT_SCAN_PROFILE)
    apply_scan_profile(config, profile_name)
    config["maxScrolls"] = max(1, args.max_scrolls if args.max_scrolls is not None else DEFAULT_MAX_SCROLLS)
    if args.scroll_pause is not None:
        config["scrollPauseSeconds"] = max(0, args.scroll_pause)
    if args.expected_total is not None:
        config["expectedTotal"] = max(1, args.expected_total)
        config["expectedTotalLocked"] = True
    config["phoneFeedback"] = bool(args.phone_feedback)
    config["strictContinuity"] = not args.no_strict_continuity

    log(f"UI Collector {COLLECTOR_VERSION}")
    if args.backend == "appium":
        assert_android_sdk_env_ready()
    if args.backend == "adb":
        reset_uiautomator2_server()
    run_scan(config, args.backend, not args.no_reset_position)


if __name__ == "__main__":
    main()
