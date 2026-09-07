#!/usr/bin/env python3
"""
Biddlog SQL Importer
Imports MySQL/MariaDB SQL dump (u141095167_bid.sql) directly into local SQLite database (database/database.sqlite).
"""
import os
import re
import sqlite3
import shutil
from datetime import datetime

SQL_DUMP_FILE = 'u141095167_bid.sql'
DB_PATH = 'database/database.sqlite'

def backup_sqlite():
    if os.path.exists(DB_PATH):
        ts = datetime.now().strftime('%Y%m%d_%H%M%S')
        bak_file = f"{DB_PATH}.bak_{ts}"
        shutil.copy2(DB_PATH, bak_file)
        print(f"[1/5] Backup created: {bak_file}")
    else:
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        print(f"[1/5] New database will be initialized at {DB_PATH}")

def parse_sql_values(values_str):
    rows = []
    current_row = []
    in_str = False
    str_escape = False
    curr_token = []
    in_paren = False
    
    i = 0
    n = len(values_str)
    while i < n:
        c = values_str[i]
        
        if not in_paren:
            if c == '(':
                in_paren = True
                current_row = []
                curr_token = []
            i += 1
            continue
            
        if in_str:
            if str_escape:
                if c == 'n':
                    curr_token.append('\n')
                elif c == 'r':
                    curr_token.append('\r')
                elif c == 't':
                    curr_token.append('\t')
                elif c == '\\':
                    curr_token.append('\\')
                elif c == '\'':
                    curr_token.append('\'')
                elif c == '"':
                    curr_token.append('"')
                else:
                    curr_token.append(c)
                str_escape = False
            elif c == '\\':
                str_escape = True
            elif c == '\'':
                if i + 1 < n and values_str[i+1] == '\'':
                    curr_token.append('\'')
                    i += 1
                else:
                    in_str = False
            else:
                curr_token.append(c)
        else:
            if c == '\'':
                in_str = True
                curr_token = []
            elif c == ',':
                token_val = "".join(curr_token).strip()
                if token_val.upper() == 'NULL':
                    current_row.append(None)
                elif token_val == '':
                    current_row.append("".join(curr_token))
                elif re.match(r'^-?\d+$', token_val):
                    current_row.append(int(token_val))
                elif re.match(r'^-?\d+\.\d+$', token_val):
                    current_row.append(float(token_val))
                else:
                    current_row.append(token_val)
                curr_token = []
            elif c == ')':
                token_val = "".join(curr_token).strip()
                if token_val.upper() == 'NULL':
                    current_row.append(None)
                elif token_val == '':
                    current_row.append("".join(curr_token))
                elif re.match(r'^-?\d+$', token_val):
                    current_row.append(int(token_val))
                elif re.match(r'^-?\d+\.\d+$', token_val):
                    current_row.append(float(token_val))
                else:
                    current_row.append(token_val)
                rows.append(tuple(current_row))
                in_paren = False
                curr_token = []
            else:
                curr_token.append(c)
        i += 1
    return rows

TABLE_SCHEMAS = {
    'assignments': """CREATE TABLE IF NOT EXISTS `assignments` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `item_id` INTEGER NOT NULL,
  `assigned_to` TEXT NOT NULL,
  `assigned_by` TEXT DEFAULT NULL,
  `assigned_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `notes` TEXT DEFAULT NULL,
  `created_at` DATETIME DEFAULT NULL,
  `updated_at` DATETIME DEFAULT NULL
);""",
    'attendances': """CREATE TABLE IF NOT EXISTS `attendances` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `user_id` INTEGER DEFAULT NULL,
  `date` DATE DEFAULT NULL,
  `status` TEXT DEFAULT 'hadir',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
);""",
    'audit_trail': """CREATE TABLE IF NOT EXISTS `audit_trail` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `user_id` INTEGER DEFAULT NULL,
  `action` TEXT DEFAULT NULL,
  `target` TEXT DEFAULT NULL,
  `ip_address` TEXT DEFAULT NULL,
  `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP
);""",
    'bidders': """CREATE TABLE IF NOT EXISTS `bidders` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `name` TEXT NOT NULL,
  `account_name` TEXT DEFAULT NULL,
  `created_at` DATETIME DEFAULT NULL,
  `updated_at` DATETIME DEFAULT NULL
);""",
    'bidder_aliases': """CREATE TABLE IF NOT EXISTS `bidder_aliases` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `bidder_name` TEXT NOT NULL UNIQUE,
  `alias_name` TEXT DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
);""",
    'bid_limits': """CREATE TABLE IF NOT EXISTS `bid_limits` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `category` TEXT NOT NULL UNIQUE,
  `max_price` INTEGER NOT NULL DEFAULT 0,
  `notes` TEXT DEFAULT NULL,
  `updated_by` TEXT DEFAULT NULL,
  `created_at` DATETIME DEFAULT NULL,
  `updated_at` DATETIME DEFAULT NULL
);""",
    'cache': """CREATE TABLE IF NOT EXISTS `cache` (
  `key` TEXT PRIMARY KEY,
  `value` TEXT NOT NULL,
  `expiration` INTEGER NOT NULL
);""",
    'cache_locks': """CREATE TABLE IF NOT EXISTS `cache_locks` (
  `key` TEXT PRIMARY KEY,
  `owner` TEXT NOT NULL,
  `expiration` INTEGER NOT NULL
);""",
    'failed_jobs': """CREATE TABLE IF NOT EXISTS `failed_jobs` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `uuid` TEXT NOT NULL UNIQUE,
  `connection` TEXT NOT NULL,
  `queue` TEXT NOT NULL,
  `payload` TEXT NOT NULL,
  `exception` TEXT NOT NULL,
  `failed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);""",
    'items': """CREATE TABLE IF NOT EXISTS `items` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `item_code` TEXT NOT NULL,
  `item_name` TEXT DEFAULT NULL,
  `category` TEXT NOT NULL DEFAULT 'Umum',
  `scan_date` DATE NOT NULL,
  `bid_price` INTEGER NOT NULL DEFAULT 0,
  `status` TEXT NOT NULL DEFAULT 'pending',
  `assigned_to` TEXT DEFAULT NULL,
  `synced_at` DATETIME DEFAULT NULL,
  `raw_data` TEXT DEFAULT NULL,
  `raw_name` TEXT DEFAULT NULL,
  `brand` TEXT DEFAULT NULL,
  `model` TEXT DEFAULT NULL,
  `storage` INTEGER DEFAULT NULL,
  `grade` TEXT DEFAULT NULL,
  `unit_no` TEXT DEFAULT NULL,
  `auction_price` NUMERIC DEFAULT NULL,
  `assigned_accounts` TEXT DEFAULT NULL,
  `created_at` DATETIME DEFAULT NULL,
  `updated_at` DATETIME DEFAULT NULL
);""",
    'items_legacy': """CREATE TABLE IF NOT EXISTS `items_legacy` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `raw_name` TEXT DEFAULT NULL,
  `brand` TEXT DEFAULT NULL,
  `model` TEXT DEFAULT NULL,
  `storage` INTEGER DEFAULT NULL,
  `grade` TEXT DEFAULT NULL,
  `unit_no` TEXT DEFAULT NULL,
  `auction_price` NUMERIC DEFAULT NULL,
  `assigned_to` INTEGER DEFAULT NULL,
  `assigned_accounts` TEXT DEFAULT NULL,
  `status` TEXT DEFAULT 'parsed',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP
);""",
    'jobs': """CREATE TABLE IF NOT EXISTS `jobs` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `queue` TEXT NOT NULL,
  `payload` TEXT NOT NULL,
  `attempts` INTEGER NOT NULL,
  `reserved_at` INTEGER DEFAULT NULL,
  `available_at` INTEGER NOT NULL,
  `created_at` INTEGER NOT NULL
);""",
    'job_batches': """CREATE TABLE IF NOT EXISTS `job_batches` (
  `id` TEXT PRIMARY KEY,
  `name` TEXT NOT NULL,
  `total_jobs` INTEGER NOT NULL,
  `pending_jobs` INTEGER NOT NULL,
  `failed_jobs` INTEGER NOT NULL,
  `failed_job_ids` TEXT NOT NULL,
  `options` TEXT DEFAULT NULL,
  `cancelled_at` INTEGER DEFAULT NULL,
  `created_at` INTEGER NOT NULL,
  `finished_at` INTEGER DEFAULT NULL
);""",
    'limits_and_fees': """CREATE TABLE IF NOT EXISTS `limits_and_fees` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `model` TEXT DEFAULT NULL,
  `grade` TEXT DEFAULT NULL,
  `limit_price` NUMERIC DEFAULT 0,
  `fee_amount` NUMERIC DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
);""",
    'master_prices': """CREATE TABLE IF NOT EXISTS `master_prices` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `item_code` TEXT NOT NULL,
  `grade` TEXT NOT NULL,
  `max_price` INTEGER NOT NULL,
  `bidder_id` INTEGER DEFAULT NULL,
  `created_at` DATETIME DEFAULT NULL,
  `updated_at` DATETIME DEFAULT NULL
);""",
    'members': """CREATE TABLE IF NOT EXISTS `members` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `name` TEXT NOT NULL UNIQUE,
  `alias` TEXT DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
);""",
    'migrations': """CREATE TABLE IF NOT EXISTS `migrations` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `migration` TEXT NOT NULL,
  `batch` INTEGER NOT NULL
);""",
    'obtained_items': """CREATE TABLE IF NOT EXISTS `obtained_items` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `user_id` INTEGER DEFAULT NULL,
  `item_id` INTEGER DEFAULT NULL,
  `person` TEXT DEFAULT NULL,
  `model` TEXT DEFAULT NULL,
  `storage` TEXT DEFAULT NULL,
  `grade` TEXT DEFAULT NULL,
  `unit` INTEGER DEFAULT 1,
  `obtained_price` NUMERIC DEFAULT 0,
  `fee_info` TEXT DEFAULT NULL,
  `bidder` TEXT DEFAULT NULL,
  `status` TEXT DEFAULT 'approved',
  `notes` TEXT DEFAULT NULL,
  `report_date` DATE DEFAULT NULL,
  `raw_line` TEXT DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
);""",
    'password_reset_tokens': """CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `email` TEXT PRIMARY KEY,
  `token` TEXT NOT NULL,
  `created_at` DATETIME DEFAULT NULL
);""",
    'payroll_batches': """CREATE TABLE IF NOT EXISTS `payroll_batches` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `report_date` TEXT NOT NULL UNIQUE,
  `total_items` INTEGER DEFAULT 0,
  `total_fee_points` INTEGER DEFAULT 0,
  `total_amount` NUMERIC DEFAULT 0,
  `people_count` INTEGER DEFAULT 0,
  `sent_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
);""",
    'reserve_items': """CREATE TABLE IF NOT EXISTS `reserve_items` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `item_code` TEXT NOT NULL,
  `grade` TEXT NOT NULL,
  `max_price` INTEGER NOT NULL,
  `unit_info` TEXT DEFAULT NULL,
  `created_at` DATETIME DEFAULT NULL,
  `updated_at` DATETIME DEFAULT NULL
);""",
    'salary_items': """CREATE TABLE IF NOT EXISTS `salary_items` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `batch_id` INTEGER DEFAULT NULL,
  `report_date` TEXT NOT NULL,
  `person` TEXT NOT NULL,
  `model` TEXT DEFAULT NULL,
  `storage` TEXT DEFAULT NULL,
  `grade` TEXT DEFAULT NULL,
  `unit` INTEGER DEFAULT 1,
  `obtained_price` NUMERIC DEFAULT 0,
  `fee_info` TEXT DEFAULT NULL,
  `fee_value` INTEGER DEFAULT 0,
  `bidder` TEXT DEFAULT NULL,
  `status` TEXT DEFAULT 'approved',
  `notes` TEXT DEFAULT NULL,
  `raw_line` TEXT DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
);""",
    'salary_transfers': """CREATE TABLE IF NOT EXISTS `salary_transfers` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `transfer_batch_id` TEXT DEFAULT NULL,
  `person` TEXT NOT NULL,
  `dates_included` TEXT DEFAULT NULL,
  `total_items` INTEGER DEFAULT 0,
  `total_fee_points` INTEGER DEFAULT 0,
  `total_amount` NUMERIC DEFAULT 0,
  `status` TEXT DEFAULT 'transferred',
  `transferred_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `notes` TEXT DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
);""",
    'sessions': """CREATE TABLE IF NOT EXISTS `sessions` (
  `id` TEXT PRIMARY KEY,
  `user_id` INTEGER DEFAULT NULL,
  `ip_address` TEXT DEFAULT NULL,
  `user_agent` TEXT DEFAULT NULL,
  `payload` TEXT NOT NULL,
  `last_activity` INTEGER NOT NULL
);""",
    'users': """CREATE TABLE IF NOT EXISTS `users` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `name` TEXT NOT NULL,
  `username` TEXT NOT NULL UNIQUE,
  `email` TEXT DEFAULT NULL UNIQUE,
  `email_verified_at` DATETIME DEFAULT NULL,
  `password` TEXT NOT NULL,
  `role` TEXT NOT NULL DEFAULT 'member',
  `remember_token` TEXT DEFAULT NULL,
  `accounts` TEXT DEFAULT NULL,
  `created_at` DATETIME DEFAULT NULL,
  `updated_at` DATETIME DEFAULT NULL
);"""
}

INDEX_STATEMENTS = [
    "CREATE INDEX IF NOT EXISTS `idx_assignments_assigned_to` ON `assignments` (`assigned_to`);",
    "CREATE INDEX IF NOT EXISTS `idx_items_scan_date` ON `items` (`scan_date`);",
    "CREATE INDEX IF NOT EXISTS `idx_items_status` ON `items` (`status`);",
    "CREATE INDEX IF NOT EXISTS `idx_items_assigned_to` ON `items` (`assigned_to`);",
    "CREATE INDEX IF NOT EXISTS `idx_obtained_report_date` ON `obtained_items` (`report_date`);",
    "CREATE INDEX IF NOT EXISTS `idx_obtained_person` ON `obtained_items` (`person`);",
    "CREATE INDEX IF NOT EXISTS `idx_obtained_status` ON `obtained_items` (`status`);",
    "CREATE INDEX IF NOT EXISTS `idx_payroll_sent_at` ON `payroll_batches` (`sent_at`);",
    "CREATE INDEX IF NOT EXISTS `idx_salary_report_date` ON `salary_items` (`report_date`);",
    "CREATE INDEX IF NOT EXISTS `idx_salary_person` ON `salary_items` (`person`);",
    "CREATE INDEX IF NOT EXISTS `idx_salary_batch_id` ON `salary_items` (`batch_id`);",
    "CREATE INDEX IF NOT EXISTS `idx_transfers_person` ON `salary_transfers` (`person`);",
    "CREATE INDEX IF NOT EXISTS `idx_transfers_status` ON `salary_transfers` (`status`);",
    "CREATE INDEX IF NOT EXISTS `idx_transfers_batch_id` ON `salary_transfers` (`transfer_batch_id`);",
]

def run_import():
    if not os.path.exists(SQL_DUMP_FILE):
        print(f"Error: {SQL_DUMP_FILE} not found!")
        return

    backup_sqlite()

    print("[2/5] Reading SQL dump file...")
    with open(SQL_DUMP_FILE, 'r', encoding='utf-8') as f:
        sql_content = f.read()

    con = sqlite3.connect(DB_PATH)
    cursor = con.cursor()

    print("[3/5] Recreating database tables...")
    cursor.execute("PRAGMA foreign_keys = OFF;")
    
    # Drop existing tables
    for tbl in TABLE_SCHEMAS.keys():
        cursor.execute(f"DROP TABLE IF EXISTS `{tbl}`;")

    # Create tables
    for tbl, create_sql in TABLE_SCHEMAS.items():
        cursor.execute(create_sql)

    print("[4/5] Parsing and inserting data from SQL dump...")
    insert_pattern = re.compile(r"INSERT INTO `([^`]+)` \((.*?)\) VALUES\s*(.*?);", re.DOTALL)
    total_rows = 0
    table_counts = {}

    for match in insert_pattern.finditer(sql_content):
        tbl = match.group(1)
        cols = [c.strip(" `") for c in match.group(2).split(",")]
        values_str = match.group(3)
        rows = parse_sql_values(values_str)
        
        if not rows:
            continue

        placeholders = ", ".join(["?" for _ in cols])
        cols_joined = ", ".join([f"`{c}`" for c in cols])
        insert_sql = f"INSERT INTO `{tbl}` ({cols_joined}) VALUES ({placeholders})"

        cursor.executemany(insert_sql, rows)
        total_rows += len(rows)
        table_counts[tbl] = table_counts.get(tbl, 0) + len(rows)

    # Create indexes
    for idx_sql in INDEX_STATEMENTS:
        cursor.execute(idx_sql)

    # Normalize invalid 0000-00-00 dates if any
    cursor.execute("UPDATE `obtained_items` SET `report_date` = DATE(`created_at`) WHERE `report_date` = '0000-00-00' OR `report_date` IS NULL;")
    cursor.execute("UPDATE `attendances` SET `date` = DATE(`created_at`) WHERE `date` = '0000-00-00';")

    con.commit()
    con.close()

    print("[5/5] Import completed successfully!")
    print("\n================ DATA SUMMARY ================")
    for tbl, count in sorted(table_counts.items()):
        print(f" - {tbl:20s}: {count:5d} rows")
    print(f"Total rows imported: {total_rows}")
    print("==============================================")

if __name__ == '__main__':
    run_import()
