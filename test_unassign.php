<?php
require 'c:/laragon/www/biddlog/biddlog_legacy/api/config/db.php';
try {
    $stmt = $pdo->prepare("UPDATE items SET assigned_to = NULL, assigned_accounts = ?, status = 'parsed' WHERE id = ?");
    $stmt->execute(['AccA', 7]);
    echo "Success";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
