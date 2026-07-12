<?php
require 'c:/laragon/www/biddlog/biddlog_legacy/api/config/db.php';
$stmt = $pdo->query('SELECT * FROM attendances ORDER BY id DESC LIMIT 5');
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
?>
