<?php
require 'c:/laragon/www/biddlog/public/api/config/db.php';
$stmt = $pdo->query('SHOW COLUMNS FROM items');
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
?>
