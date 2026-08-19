import sqlite3
import os

def export_to_mysql():
    db_path = 'database/database.sqlite'
    if not os.path.exists(db_path):
        print(f"Error: {db_path} not found")
        return

    con = sqlite3.connect(db_path)
    cursor = con.cursor()

    tables = [
        'users', 'password_reset_tokens', 'sessions', 'cache', 'cache_locks',
        'jobs', 'job_batches', 'failed_jobs', 'items', 'assignments',
        'bid_limits', 'bidders', 'master_prices', 'reserve_items',
        'items_legacy', 'attendances', 'limits_and_fees', 'audit_trail',
        'obtained_items', 'salary_transfers', 'bidder_aliases',
        'payroll_batches', 'salary_items', 'members'
    ]

    sql_output = []
    sql_output.append("-- Biddlog MySQL Database Dump")
    sql_output.append("-- Target Database: u141095167_bid")
    sql_output.append("SET FOREIGN_KEY_CHECKS=0;")
    sql_output.append("SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';")
    sql_output.append("SET NAMES utf8mb4;\n")

    for t in tables:
        sql_output.append(f"DROP TABLE IF EXISTS `{t}`;")

    create_statements = {
        'users': """CREATE TABLE `users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `username` varchar(255) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('admin','member') NOT NULL DEFAULT 'member',
  `remember_token` varchar(100) DEFAULT NULL,
  `accounts` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_username_unique` (`username`),
  UNIQUE KEY `users_email_unique` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",

        'password_reset_tokens': """CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",

        'sessions': """CREATE TABLE `sessions` (
  `id` varchar(255) NOT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `payload` longtext NOT NULL,
  `last_activity` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sessions_user_id_index` (`user_id`),
  KEY `sessions_last_activity_index` (`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",

        'cache': """CREATE TABLE `cache` (
  `key` varchar(255) NOT NULL,
  `value` mediumtext NOT NULL,
  `expiration` int(11) NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",

        'cache_locks': """CREATE TABLE `cache_locks` (
  `key` varchar(255) NOT NULL,
  `owner` varchar(255) NOT NULL,
  `expiration` int(11) NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",

        'jobs': """CREATE TABLE `jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `attempts` tinyint(3) unsigned NOT NULL,
  `reserved_at` int(10) unsigned DEFAULT NULL,
  `available_at` int(10) unsigned NOT NULL,
  `created_at` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `jobs_queue_index` (`queue`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",

        'job_batches': """CREATE TABLE `job_batches` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `total_jobs` int(11) NOT NULL,
  `pending_jobs` int(11) NOT NULL,
  `failed_jobs` int(11) NOT NULL,
  `failed_job_ids` longtext NOT NULL,
  `options` mediumtext DEFAULT NULL,
  `cancelled_at` int(11) DEFAULT NULL,
  `created_at` int(11) NOT NULL,
  `finished_at` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",

        'failed_jobs': """CREATE TABLE `failed_jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) NOT NULL,
  `connection` text NOT NULL,
  `queue` text NOT NULL,
  `payload` longtext NOT NULL,
  `exception` longtext NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",

        'items': """CREATE TABLE `items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `item_code` varchar(255) NOT NULL,
  `item_name` varchar(255) DEFAULT NULL,
  `category` varchar(255) NOT NULL DEFAULT 'Umum',
  `scan_date` date NOT NULL,
  `bid_price` int(11) NOT NULL DEFAULT 0,
  `status` enum('pending','assigned','bidded','won','lost') NOT NULL DEFAULT 'pending',
  `assigned_to` varchar(255) DEFAULT NULL,
  `synced_at` timestamp NULL DEFAULT NULL,
  `raw_data` text DEFAULT NULL,
  `raw_name` text DEFAULT NULL,
  `brand` varchar(100) DEFAULT NULL,
  `model` varchar(255) DEFAULT NULL,
  `storage` int(11) DEFAULT NULL,
  `grade` varchar(50) DEFAULT NULL,
  `unit_no` varchar(50) DEFAULT NULL,
  `auction_price` double DEFAULT NULL,
  `assigned_accounts` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_item_per_date` (`item_code`,`scan_date`),
  KEY `items_scan_date_index` (`scan_date`),
  KEY `items_status_index` (`status`),
  KEY `items_assigned_to_index` (`assigned_to`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",

        'assignments': """CREATE TABLE `assignments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `item_id` bigint(20) unsigned NOT NULL,
  `assigned_to` varchar(255) NOT NULL,
  `assigned_by` varchar(255) DEFAULT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `assignments_assigned_to_index` (`assigned_to`),
  KEY `assignments_assigned_at_index` (`assigned_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",

        'bid_limits': """CREATE TABLE `bid_limits` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `category` varchar(255) NOT NULL,
  `max_price` int(11) NOT NULL DEFAULT 0,
  `notes` text DEFAULT NULL,
  `updated_by` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `bid_limits_category_unique` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",

        'bidders': """CREATE TABLE `bidders` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `account_name` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",

        'master_prices': """CREATE TABLE `master_prices` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `item_code` varchar(255) NOT NULL,
  `grade` varchar(255) NOT NULL,
  `max_price` int(11) NOT NULL,
  `bidder_id` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",

        'reserve_items': """CREATE TABLE `reserve_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `item_code` varchar(255) NOT NULL,
  `grade` varchar(255) NOT NULL,
  `max_price` int(11) NOT NULL,
  `unit_info` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",

        'items_legacy': """CREATE TABLE `items_legacy` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `raw_name` text DEFAULT NULL,
  `brand` varchar(100) DEFAULT NULL,
  `model` varchar(255) DEFAULT NULL,
  `storage` int(11) DEFAULT NULL,
  `grade` varchar(50) DEFAULT NULL,
  `unit_no` varchar(50) DEFAULT NULL,
  `auction_price` double DEFAULT NULL,
  `assigned_to` int(11) DEFAULT NULL,
  `assigned_accounts` text DEFAULT NULL,
  `status` varchar(50) DEFAULT 'parsed',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",

        'attendances': """CREATE TABLE `attendances` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `date` date DEFAULT NULL,
  `status` varchar(50) DEFAULT 'hadir',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",

        'limits_and_fees': """CREATE TABLE `limits_and_fees` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `model` varchar(255) DEFAULT NULL,
  `grade` varchar(50) DEFAULT NULL,
  `limit_price` double DEFAULT 0,
  `fee_amount` double DEFAULT 0,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",

        'audit_trail': """CREATE TABLE `audit_trail` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `action` varchar(255) DEFAULT NULL,
  `target` varchar(255) DEFAULT NULL,
  `ip_address` varchar(100) DEFAULT NULL,
  `timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",

        'obtained_items': """CREATE TABLE `obtained_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `item_id` int(11) DEFAULT NULL,
  `person` varchar(255) DEFAULT NULL,
  `model` varchar(255) DEFAULT NULL,
  `storage` varchar(50) DEFAULT NULL,
  `grade` varchar(50) DEFAULT NULL,
  `unit` int(11) DEFAULT 1,
  `obtained_price` double DEFAULT 0,
  `fee_info` varchar(100) DEFAULT NULL,
  `bidder` varchar(100) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'approved',
  `notes` text DEFAULT NULL,
  `report_date` date DEFAULT NULL,
  `raw_line` text DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",

        'salary_transfers': """CREATE TABLE `salary_transfers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `transfer_batch_id` varchar(100) DEFAULT NULL,
  `person` varchar(255) NOT NULL,
  `dates_included` text DEFAULT NULL,
  `total_items` int(11) DEFAULT 0,
  `total_fee_points` int(11) DEFAULT 0,
  `total_amount` double DEFAULT 0,
  `status` varchar(50) DEFAULT 'transferred',
  `transferred_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `notes` text DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",

        'bidder_aliases': """CREATE TABLE `bidder_aliases` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `bidder_name` varchar(100) NOT NULL,
  `alias_name` varchar(100) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `bidder_name` (`bidder_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",

        'payroll_batches': """CREATE TABLE `payroll_batches` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `report_date` varchar(50) NOT NULL,
  `total_items` int(11) DEFAULT 0,
  `total_fee_points` int(11) DEFAULT 0,
  `total_amount` double DEFAULT 0,
  `people_count` int(11) DEFAULT 0,
  `sent_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `report_date` (`report_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",

        'salary_items': """CREATE TABLE `salary_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_id` int(11) DEFAULT NULL,
  `report_date` varchar(50) NOT NULL,
  `person` varchar(255) NOT NULL,
  `model` varchar(255) DEFAULT NULL,
  `storage` varchar(50) DEFAULT NULL,
  `grade` varchar(50) DEFAULT NULL,
  `unit` int(11) DEFAULT 1,
  `obtained_price` double DEFAULT 0,
  `fee_info` varchar(100) DEFAULT NULL,
  `fee_value` int(11) DEFAULT 0,
  `bidder` varchar(100) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'approved',
  `notes` text DEFAULT NULL,
  `raw_line` text DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",

        'members': """CREATE TABLE `members` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `alias` varchar(100) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"""
    }

    for t, stmt in create_statements.items():
        sql_output.append(stmt + "\n")

    for t in tables:
        if t not in create_statements:
            continue
        cursor.execute(f"SELECT * FROM `{t}`")
        rows = cursor.fetchall()
        if not rows:
            continue
        col_names = [d[0] for d in cursor.description]
        escaped_cols = ", ".join([f"`{c}`" for c in col_names])
        
        values_list = []
        for r in rows:
            escaped_vals = []
            for val in r:
                if val is None:
                    escaped_vals.append("NULL")
                elif isinstance(val, (int, float)):
                    escaped_vals.append(str(val))
                else:
                    s = str(val).replace("\\", "\\\\").replace("'", "''")
                    escaped_vals.append(f"'{s}'")
            values_list.append("(" + ", ".join(escaped_vals) + ")")
        
        sql_output.append(f"INSERT INTO `{t}` ({escaped_cols}) VALUES\n" + ",\n".join(values_list) + ";\n")

    sql_output.append("SET FOREIGN_KEY_CHECKS=1;\n")

    os.makedirs('database', exist_ok=True)
    with open('database/biddlog_mysql_export.sql', 'w', encoding='utf-8') as f:
        f.write('\n'.join(sql_output))

    print("Success: database/biddlog_mysql_export.sql created successfully!")

if __name__ == '__main__':
    export_to_mysql()
