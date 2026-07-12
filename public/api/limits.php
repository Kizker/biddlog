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
        // Get limits and fees
        $stmt = $pdo->query("SELECT * FROM limits_and_fees");
        echo json_encode(['status' => 'success', 'data' => $stmt->fetchAll()]);
    } else if ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        $model = trim($data['model'] ?? '');
        $grade = trim($data['grade'] ?? '');
        $limit_price = floatval($data['limit_price'] ?? 0);
        $fee_amount = floatval($data['fee_amount'] ?? 0);
        
        $stmt = $pdo->prepare("INSERT INTO limits_and_fees (model, grade, limit_price, fee_amount) VALUES (?, ?, ?, ?)");
        $stmt->execute([$model, $grade, $limit_price, $fee_amount]);
        echo json_encode(['status' => 'success', 'message' => 'Rule created']);
    } else if ($method === 'DELETE') {
        $id = $_GET['id'] ?? null;
        if ($id) {
            $stmt = $pdo->prepare("DELETE FROM limits_and_fees WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['status' => 'success', 'message' => 'Rule deleted']);
        }
    }
} catch (\PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
