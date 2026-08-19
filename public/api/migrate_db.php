<?php
/**
 * Biddlog MySQL Database Migration / Auto-Installer
 * Endpoint: /api/migrate_db.php
 */
header('Content-Type: application/json');

require_once __DIR__ . '/config/db.php';

try {
    $sqlFile = __DIR__ . '/../../database/biddlog_mysql_export.sql';
    if (!file_exists($sqlFile)) {
        echo json_encode([
            'status' => 'error',
            'message' => 'SQL dump file not found at ' . $sqlFile
        ], JSON_PRETTY_PRINT);
        exit;
    }

    $sql = file_get_contents($sqlFile);
    
    // Execute SQL script
    $pdo->exec($sql);

    // Verify users count
    $stmt = $pdo->query("SELECT count(*) as total_users FROM users");
    $usersCount = $stmt->fetch(PDO::FETCH_ASSOC)['total_users'] ?? 0;

    $stmt2 = $pdo->query("SELECT count(*) as total_members FROM members");
    $membersCount = $stmt2->fetch(PDO::FETCH_ASSOC)['total_members'] ?? 0;

    $stmt3 = $pdo->query("SELECT count(*) as total_batches FROM payroll_batches");
    $batchesCount = $stmt3->fetch(PDO::FETCH_ASSOC)['total_batches'] ?? 0;

    echo json_encode([
        'status' => 'success',
        'message' => 'Database migration and data import completed successfully to MySQL!',
        'database_target' => $env['DB_DATABASE'] ?? 'unknown',
        'stats' => [
            'users' => $usersCount,
            'canonical_members' => $membersCount,
            'payroll_batches' => $batchesCount
        ]
    ], JSON_PRETTY_PRINT);

} catch (\Exception $e) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Migration failed: ' . $e->getMessage()
    ], JSON_PRETTY_PRINT);
}
