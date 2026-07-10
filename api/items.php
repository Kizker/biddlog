<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once 'config/db.php';

$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        $stmt = $pdo->query("SELECT i.*, u.username as assignee_name FROM items i LEFT JOIN users u ON i.assigned_to = u.id");
        echo json_encode(['status' => 'success', 'data' => $stmt->fetchAll()]);
    } else if ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        
        // Handle bulk insert for parsed text
        if (isset($data['action']) && $data['action'] === 'bulk_insert' && isset($data['items'])) {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare("INSERT INTO items (raw_name, brand, model, storage, grade, unit_no, auction_price, assigned_to, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
            
            $inserted = 0;
            foreach ($data['items'] as $item) {
                // If a user name was parsed, try to find their ID
                $assigned_to = null;
                if (!empty($item['person'])) {
                    $uStmt = $pdo->prepare("SELECT id FROM users WHERE username LIKE ? LIMIT 1");
                    $uStmt->execute(['%' . $item['person'] . '%']);
                    $user = $uStmt->fetch();
                    if ($user) $assigned_to = $user['id'];
                }
                
                $stmt->execute([
                    $item['raw_line'] ?? '',
                    $item['brand'] ?? '',
                    $item['model'] ?? '',
                    $item['storage'] ?? null,
                    $item['grade'] ?? '',
                    $item['unit'] ?? 1,
                    $item['price'] ?? null,
                    $assigned_to,
                    'parsed'
                ]);
                $inserted++;
            }
            $pdo->commit();
            echo json_encode(['status' => 'success', 'message' => "$inserted items saved"]);
        }
    }
} catch (\PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
