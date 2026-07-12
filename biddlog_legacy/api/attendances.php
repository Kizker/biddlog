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
        if (!empty($_GET['date'])) {
            $stmt = $pdo->prepare("SELECT a.*, u.username FROM attendances a LEFT JOIN users u ON a.user_id = u.id WHERE a.date = ?");
            $stmt->execute([$_GET['date']]);
        } else {
            $stmt = $pdo->query("SELECT a.*, u.username FROM attendances a LEFT JOIN users u ON a.user_id = u.id");
        }
        echo json_encode(['status' => 'success', 'data' => $stmt->fetchAll()]);
    } else if ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        $user_id = $data['user_id'] ?? null;
        $date = date('Y-m-d'); // Force server local time
        $status = trim($data['status'] ?? 'hadir');
        
        if ($user_id) {
            // Check if already exists for today
            $checkStmt = $pdo->prepare("SELECT id FROM attendances WHERE user_id = ? AND date = ?");
            $checkStmt->execute([$user_id, $date]);
            $existing = $checkStmt->fetch();
            
            if ($existing) {
                // Update
                $stmt = $pdo->prepare("UPDATE attendances SET status = ? WHERE id = ?");
                $stmt->execute([$status, $existing['id']]);
            } else {
                // Insert
                $stmt = $pdo->prepare("INSERT INTO attendances (user_id, date, status) VALUES (?, ?, ?)");
                $stmt->execute([$user_id, $date, $status]);
            }
            echo json_encode(['status' => 'success', 'message' => 'Attendance saved']);
        }
    } else if ($method === 'DELETE') {
        $stmt = $pdo->prepare("DELETE FROM attendances");
        $stmt->execute();
        echo json_encode(['status' => 'success', 'message' => 'Semua data presensi berhasil direset']);
    }
} catch (\PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
