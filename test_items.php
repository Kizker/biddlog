<?php
require 'c:/laragon/www/biddlog/biddlog_legacy/api/config/db.php';
$stmt = $pdo->query('SELECT * FROM items WHERE id = 7');
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
?>
