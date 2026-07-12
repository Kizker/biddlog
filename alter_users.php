<?php
require 'c:/laragon/www/biddlog/public/api/config/db.php';
try {
    $pdo->exec('ALTER TABLE users ADD COLUMN accounts VARCHAR(255) NULL');
    echo 'Success';
} catch (Exception $e) {
    echo $e->getMessage();
}
?>
