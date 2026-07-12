<?php
require 'c:/laragon/www/biddlog/biddlog_legacy/api/config/db.php';
$stmt = $pdo->query("SELECT id, assigned_to, assigned_accounts FROM items LIMIT 5");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
?>
