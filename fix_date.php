<?php
require 'c:/laragon/www/biddlog/biddlog_legacy/api/config/db.php';
$pdo->query("UPDATE attendances SET date = '2026-07-12' WHERE date = '2026-07-11' AND DATE(created_at) = '2026-07-12'");
echo 'Fixed';
?>
