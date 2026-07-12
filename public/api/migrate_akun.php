<?php
require_once 'config/db.php';

try {
    $pdo->exec("ALTER TABLE users ADD COLUMN accounts VARCHAR(255) DEFAULT NULL");
    echo "Column 'accounts' added to users table.\n";
} catch (Exception $e) {
    echo "Notice/Error users: " . $e->getMessage() . "\n";
}

try {
    $pdo->exec("ALTER TABLE items ADD COLUMN assigned_accounts VARCHAR(255) DEFAULT NULL");
    echo "Column 'assigned_accounts' added to items table.\n";
} catch (Exception $e) {
    echo "Notice/Error items: " . $e->getMessage() . "\n";
}

echo "Migration done.\n";
?>
