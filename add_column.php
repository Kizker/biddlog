<?php
require 'c:/laragon/www/biddlog/biddlog_legacy/api/config/db.php';
$pdo->query('ALTER TABLE attendances ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
echo "Column added.\n";
?>
