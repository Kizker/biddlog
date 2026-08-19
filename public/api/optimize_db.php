<?php
/**
 * Biddlog Database Optimizer & Index Accelerator
 * Endpoint: /api/optimize_db.php
 */
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

require_once __DIR__ . '/config/db.php';

$results = [];

try {
    $activeDriver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);

    if ($activeDriver === 'sqlite') {
        $queries = [
            "CREATE INDEX IF NOT EXISTS idx_obtained_report_date ON obtained_items (report_date)",
            "CREATE INDEX IF NOT EXISTS idx_obtained_created_at ON obtained_items (created_at)",
            "CREATE INDEX IF NOT EXISTS idx_obtained_person ON obtained_items (person)",
            "CREATE INDEX IF NOT EXISTS idx_transfers_person ON salary_transfers (person)",
            "CREATE INDEX IF NOT EXISTS idx_salary_report_date ON salary_items (report_date)",
            "CREATE INDEX IF NOT EXISTS idx_salary_person ON salary_items (person)",
            "CREATE INDEX IF NOT EXISTS idx_batches_report_date ON payroll_batches (report_date)",
            "PRAGMA optimize"
        ];
        foreach ($queries as $q) {
            try {
                $pdo->exec($q);
                $results[] = ['query' => $q, 'status' => 'OK'];
            } catch (\Exception $e) {
                $results[] = ['query' => $q, 'status' => 'IGNORED', 'error' => $e->getMessage()];
            }
        }
    } else {
        // MySQL / MariaDB Index optimization helper
        $addIndex = function($table, $indexName, $columns) use ($pdo, &$results) {
            try {
                // Check if index exists
                $check = $pdo->query("SHOW INDEX FROM `{$table}` WHERE Key_name = '{$indexName}'");
                if ($check && $check->rowCount() === 0) {
                    $pdo->exec("ALTER TABLE `{$table}` ADD INDEX `{$indexName}` ({$columns})");
                    $results[] = ['table' => $table, 'index' => $indexName, 'status' => 'ADDED'];
                } else {
                    $results[] = ['table' => $table, 'index' => $indexName, 'status' => 'ALREADY_EXISTS'];
                }
            } catch (\Exception $e) {
                $results[] = ['table' => $table, 'index' => $indexName, 'status' => 'ERROR', 'error' => $e->getMessage()];
            }
        };

        $addIndex('obtained_items', 'idx_obtained_report_date', 'report_date');
        $addIndex('obtained_items', 'idx_obtained_created_at', 'created_at');
        $addIndex('obtained_items', 'idx_obtained_person', 'person(100)');
        $addIndex('obtained_items', 'idx_obtained_status', 'status');

        $addIndex('salary_transfers', 'idx_transfers_person', 'person(100)');
        $addIndex('salary_transfers', 'idx_transfers_status', 'status');
        $addIndex('salary_transfers', 'idx_transfers_transferred_at', 'transferred_at');

        $addIndex('salary_items', 'idx_salary_report_date', 'report_date');
        $addIndex('salary_items', 'idx_salary_person', 'person(100)');
        $addIndex('salary_items', 'idx_salary_batch_id', 'batch_id');

        $addIndex('payroll_batches', 'idx_batches_sent_at', 'sent_at');

        // Optimize and analyze tables
        $tables = ['users', 'obtained_items', 'salary_transfers', 'salary_items', 'payroll_batches', 'members', 'bidder_aliases'];
        foreach ($tables as $t) {
            try {
                $pdo->exec("ANALYZE TABLE `{$t}`");
                $results[] = ['table' => $t, 'operation' => 'ANALYZE', 'status' => 'OK'];
            } catch (\Exception $e) {
                // Ignore
            }
        }
    }

    echo json_encode([
        'status' => 'success',
        'message' => 'Database speed optimization and indexing applied successfully! ⚡',
        'driver' => $activeDriver,
        'details' => $results
    ], JSON_PRETTY_PRINT);

} catch (\Exception $e) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Optimization failed: ' . $e->getMessage()
    ], JSON_PRETTY_PRINT);
}
