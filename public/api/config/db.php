<?php
date_default_timezone_set('Asia/Jakarta');
$envPath = __DIR__ . '/../../../.env';
$env = [];
if (file_exists($envPath)) {
    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $env[trim($key)] = trim($value, " \t\n\r\0\x0B\"'");
        }
    }
}

$driver = $env['DB_CONNECTION'] ?? 'sqlite';
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    if ($driver === 'sqlite') {
        $sqlitePath = $env['DB_DATABASE'] ?? (__DIR__ . '/../../../database/database.sqlite');
        if (!file_exists($sqlitePath)) {
            $sqlitePath = __DIR__ . '/../../../database/database.sqlite';
        }
        $pdo = new PDO("sqlite:" . $sqlitePath, null, null, $options);
        $pdo->sqliteCreateFunction('CURDATE', fn() => date('Y-m-d'));
        $pdo->sqliteCreateFunction('NOW', fn() => date('Y-m-d H:i:s'));
        $pdo->sqliteCreateFunction('DATE', function ($val) {
            if (empty($val)) return null;
            return date('Y-m-d', strtotime($val));
        });
    } else {
        $host = $env['DB_HOST'] ?? '127.0.0.1';
        $port = $env['DB_PORT'] ?? '3306';
        $db = $env['DB_DATABASE'] ?? 'biddlog_db';
        $user = $env['DB_USERNAME'] ?? 'root';
        $pass = $env['DB_PASSWORD'] ?? '';
        $charset = 'utf8mb4';
        $dsn = "mysql:host=$host;port=$port;dbname=$db;charset=$charset";
        $pdo = new PDO($dsn, $user, $pass, $options);
    }
} catch (\PDOException $e) {
    try {
        $sqlitePath = __DIR__ . '/../../../database/database.sqlite';
        $pdo = new PDO("sqlite:" . $sqlitePath, null, null, $options);
        $pdo->sqliteCreateFunction('CURDATE', fn() => date('Y-m-d'));
        $pdo->sqliteCreateFunction('NOW', fn() => date('Y-m-d H:i:s'));
        $pdo->sqliteCreateFunction('DATE', function ($val) {
            if (empty($val)) return null;
            return date('Y-m-d', strtotime($val));
        });
    } catch (\Exception $ex) {
        header('Content-Type: application/json');
        echo json_encode([
            'status' => 'error',
            'message' => 'Database connection failed: ' . $ex->getMessage()
        ]);
        exit;
    }
}
?>
