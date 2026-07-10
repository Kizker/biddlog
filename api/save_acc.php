<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once 'config/db.php';

try {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data) {
        throw new Exception("Invalid payload");
    }

    $person = trim($data['person'] ?? '');
    $model = trim($data['model'] ?? '');
    $grade = trim($data['grade'] ?? '');
    $price = floatval($data['price'] ?? 0);

    // Find user_id from person name (approximate match)
    $stmt = $pdo->prepare("SELECT id FROM users WHERE username LIKE ? LIMIT 1");
    $stmt->execute(["%$person%"]);
    $user = $stmt->fetch();
    
    $user_id = $user ? $user['id'] : null;

    // We can either update an existing pending item or insert a new one as 'acc'
    // Since ResultChecker might be from raw text, let's just insert a new ACC record if we don't find a pending one.
    
    if ($user_id) {
        // Try to find a pending item to update
        $findStmt = $pdo->prepare("SELECT id FROM obtained_items WHERE user_id = ? AND model LIKE ? AND status = 'pending' LIMIT 1");
        $findStmt->execute([$user_id, "%$model%"]);
        $existing = $findStmt->fetch();

        if ($existing) {
            $upd = $pdo->prepare("UPDATE obtained_items SET status = 'acc' WHERE id = ?");
            $upd->execute([$existing['id']]);
        } else {
            // Insert directly as acc
            $ins = $pdo->prepare("INSERT INTO obtained_items (user_id, model, grade, obtained_price, status) VALUES (?, ?, ?, ?, 'acc')");
            $ins->execute([$user_id, $model, $grade, $price]);
        }
    } else {
        // If user not found, insert with null user_id? Or just skip.
        throw new Exception("Pengguna tidak ditemukan di database: $person");
    }

    echo json_encode(['status' => 'success', 'message' => 'Gaji berhasil di-ACC']);
} catch (\Exception $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
