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
    if ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        $item_id = $data['item_id'] ?? null;
        $user_id = $data['user_id'] ?? null; // user assigned to
        $assigned_accounts = isset($data['assigned_accounts']) ? $data['assigned_accounts'] : false;
        
        if ($item_id) {
            if ($assigned_accounts !== false) {
                if ($user_id !== null) {
                    $stmt = $pdo->prepare("UPDATE items SET assigned_to = ?, assigned_accounts = ?, status = 'published' WHERE id = ?");
                    $stmt->execute([$user_id, $assigned_accounts, $item_id]);
                } else {
                    $stmt = $pdo->prepare("UPDATE items SET assigned_to = NULL, assigned_accounts = ?, status = 'parsed' WHERE id = ?");
                    $stmt->execute([$assigned_accounts, $item_id]);
                }
                echo json_encode(['status' => 'success', 'message' => 'Account updated']);
            } else {
                if ($user_id !== null) {
                    $stmt = $pdo->prepare("UPDATE items SET assigned_to = ?, status = 'published' WHERE id = ?");
                    $stmt->execute([$user_id, $item_id]);
                    echo json_encode(['status' => 'success', 'message' => 'Item assigned']);
                } else {
                    $stmt = $pdo->prepare("UPDATE items SET assigned_to = NULL, status = 'parsed' WHERE id = ?");
                    $stmt->execute([$item_id]);
                    echo json_encode(['status' => 'success', 'message' => 'Item unassigned']);
                }
            }
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Missing data']);
        }
    }
} catch (\PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
