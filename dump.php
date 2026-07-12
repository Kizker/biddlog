<?php
$host = '127.0.0.1';
$db = 'bidding_helper';
$user = 'root';
$pass = ''; // Default Laragon password
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
    
    $stmt = $pdo->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);

    foreach ($tables as $table) {
        echo "--- Table: $table ---\n";
        $stmt = $pdo->query("SHOW CREATE TABLE $table");
        $create = $stmt->fetch(PDO::FETCH_ASSOC);
        echo $create['Create Table'] . "\n\n";
    }

} catch (\PDOException $e) {
    echo "Error: " . $e->getMessage();
}
