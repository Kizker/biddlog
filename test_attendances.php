<?php
require 'c:/laragon/www/biddlog/biddlog_legacy/api/config/db.php';
$stmt = $pdo->query('SHOW COLUMNS FROM attendances');
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
?>
