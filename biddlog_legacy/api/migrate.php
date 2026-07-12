<?php
require_once 'config/db.php';
try {
    $pdo->exec("ALTER TABLE obtained_items ADD COLUMN status VARCHAR(20) DEFAULT 'pending'");
    echo "Success";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
