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
        // Read audit logs
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 100;
        $stmt = $pdo->prepare("SELECT a.*, u.username FROM audit_trail a LEFT JOIN users u ON a.user_id = u.id ORDER BY a.timestamp DESC LIMIT ?");
        // PDO needs bindParam for LIMIT clause when using prepared statements, or we can just turn off emulation
        $stmt->execute([$limit]);
        echo json_encode(['status' => 'success', 'data' => $stmt->fetchAll()]);
    } else if ($method === 'POST') {
        // Usually called internally, but exposing for frontend if needed
        $data = json_decode(file_get_contents('php://input'), true);
        $user_id = $data['user_id'] ?? null;
        $action = trim($data['action'] ?? '');
        $target = trim($data['target'] ?? '');
        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        
        $stmt = $pdo->prepare("INSERT INTO audit_trail (user_id, action, target, ip_address) VALUES (?, ?, ?, ?)");
        $stmt->execute([$user_id, $action, $target, $ip]);
        echo json_encode(['status' => 'success']);
    }
} catch (\PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
