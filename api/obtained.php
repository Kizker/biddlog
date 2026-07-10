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
        $stmt = $pdo->query("SELECT o.*, u.username FROM obtained_items o LEFT JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC");
        echo json_encode(['status' => 'success', 'data' => $stmt->fetchAll()]);
    } else if ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        $user_id = $data['user_id'] ?? null;
        $item_id = $data['item_id'] ?? null; // Can be null if it's a new unassigned item
        $model = trim($data['model'] ?? '');
        $grade = trim($data['grade'] ?? '');
        $storage = isset($data['storage']) ? intval($data['storage']) : null;
        $obtained_price = floatval($data['obtained_price'] ?? 0);
        
        $stmt = $pdo->prepare("INSERT INTO obtained_items (user_id, item_id, model, storage, grade, obtained_price) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$user_id, $item_id, $model, $storage, $grade, $obtained_price]);
        echo json_encode(['status' => 'success', 'message' => 'Obtained item saved']);
    }
} catch (\PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
