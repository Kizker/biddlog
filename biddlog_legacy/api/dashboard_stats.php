<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

require_once 'config/db.php';

try {
    // Total users
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM users");
    $total_users = $stmt->fetch()['total'];

    // Total items
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM items");
    $total_items = $stmt->fetch()['total'];

    // Total attendance today
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM attendances WHERE date = CURDATE()");
    $attendance_today = $stmt->fetch()['total'];

    // Total items obtained today
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM obtained_items WHERE DATE(created_at) = CURDATE()");
    $obtained_today = $stmt->fetch()['total'];

    echo json_encode([
        'status' => 'success',
        'data' => [
            'total_users' => $total_users,
            'total_items' => $total_items,
            'attendance_today' => $attendance_today,
            'obtained_today' => $obtained_today
        ]
    ]);
} catch (\PDOException $e) {
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
?>
