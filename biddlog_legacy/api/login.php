<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once 'config/db.php';

// Mendapatkan input JSON
$inputData = json_decode(file_get_contents('php://input'), true);

$username = isset($inputData['username']) ? trim($inputData['username']) : '';
$password = isset($inputData['password']) ? trim($inputData['password']) : '';

if (empty($username) || empty($password)) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Username dan password wajib diisi'
    ]);
    exit;
}

try {
    $stmt = $pdo->prepare('SELECT id, username, password, role FROM users WHERE username = ?');
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if ($user) {
        // Cek password hash atau plaintext (agar fleksibel jika ada user baru dengan password biasa)
        $is_valid = false;
        if (password_verify($password, $user['password'])) {
            $is_valid = true;
        } else if ($password === $user['password']) {
            $is_valid = true;
        }

        if ($is_valid) {
            echo json_encode([
                'status' => 'success',
                'user' => [
                    'id' => $user['id'],
                    'username' => $user['username'],
                    'role' => $user['role']
                ]
            ]);
            exit;
        }
    }

    echo json_encode([
        'status' => 'error',
        'message' => 'Username atau password salah'
    ]);
} catch (\PDOException $e) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Terjadi kesalahan sistem: ' . $e->getMessage()
    ]);
}
?>
