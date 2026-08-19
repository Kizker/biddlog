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
        $date = $_GET['date'] ?? null;
        if ($date) {
            $stmt = $pdo->prepare("SELECT o.*, u.username as user_name FROM obtained_items o LEFT JOIN users u ON o.user_id = u.id WHERE o.report_date = ? OR DATE(o.created_at) = ? ORDER BY o.id ASC");
            $stmt->execute([$date, $date]);
        } else {
            $stmt = $pdo->query("SELECT o.*, u.username as user_name FROM obtained_items o LEFT JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC, o.id ASC");
        }
        $data = $stmt->fetchAll();
        echo json_encode(['status' => 'success', 'data' => $data]);
    } else if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) {
            throw new Exception("Invalid JSON payload");
        }

        $action = $input['action'] ?? 'save_item';

        if ($action === 'sync_all') {
            $report_date = $input['report_date'] ?? date('Y-m-d');
            $items = $input['items'] ?? [];

            // If clear_existing is requested or true by default
            $clear_existing = $input['clear_existing'] ?? true;
            if ($clear_existing) {
                $delStmt = $pdo->prepare("DELETE FROM obtained_items WHERE report_date = ? OR DATE(created_at) = ?");
                $delStmt->execute([$report_date, $report_date]);
            }

            $insStmt = $pdo->prepare("INSERT INTO obtained_items 
                (person, model, storage, grade, unit, obtained_price, fee_info, bidder, status, notes, report_date, raw_line) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

            foreach ($items as $it) {
                $insStmt->execute([
                    trim($it['person'] ?? ''),
                    trim($it['model'] ?? ''),
                    isset($it['storage']) ? (string)$it['storage'] : '',
                    trim($it['grade'] ?? ''),
                    intval($it['unit'] ?? 1),
                    floatval($it['obtained_price'] ?? ($it['price'] ?? 0)),
                    trim($it['fee_info'] ?? ''),
                    trim($it['bidder'] ?? ''),
                    trim($it['status'] ?? 'approved'),
                    trim($it['notes'] ?? ''),
                    $report_date,
                    trim($it['raw_line'] ?? '')
                ]);
            }

            echo json_encode(['status' => 'success', 'message' => count($items) . ' item berhasil disinkronisasi', 'count' => count($items)]);
        } else if ($action === 'toggle_status') {
            $id = $input['id'] ?? null;
            if (!$id) throw new Exception("ID required");

            $find = $pdo->prepare("SELECT status FROM obtained_items WHERE id = ?");
            $find->execute([$id]);
            $curr = $find->fetch();
            if (!$curr) throw new Exception("Item tidak ditemukan");

            $newStatus = ($curr['status'] === 'approved') ? 'rejected' : 'approved';
            $upd = $pdo->prepare("UPDATE obtained_items SET status = ? WHERE id = ?");
            $upd->execute([$newStatus, $id]);

            echo json_encode(['status' => 'success', 'new_status' => $newStatus]);
        } else if ($action === 'update_item') {
            $id = $input['id'] ?? null;
            if (!$id) throw new Exception("ID required");

            $stmt = $pdo->prepare("UPDATE obtained_items SET 
                person = ?, model = ?, storage = ?, grade = ?, unit = ?, obtained_price = ?, 
                fee_info = ?, bidder = ?, status = ?, notes = ?, report_date = ? 
                WHERE id = ?");
            $stmt->execute([
                trim($input['person'] ?? ''),
                trim($input['model'] ?? ''),
                isset($input['storage']) ? (string)$input['storage'] : '',
                trim($input['grade'] ?? ''),
                intval($input['unit'] ?? 1),
                floatval($input['obtained_price'] ?? ($input['price'] ?? 0)),
                trim($input['fee_info'] ?? ''),
                trim($input['bidder'] ?? ''),
                trim($input['status'] ?? 'approved'),
                trim($input['notes'] ?? ''),
                $input['report_date'] ?? date('Y-m-d'),
                $id
            ]);

            echo json_encode(['status' => 'success', 'message' => 'Item berhasil diperbarui']);
        } else if ($action === 'delete_item') {
            $id = $input['id'] ?? null;
            if (!$id) throw new Exception("ID required");

            $stmt = $pdo->prepare("DELETE FROM obtained_items WHERE id = ?");
            $stmt->execute([$id]);

            echo json_encode(['status' => 'success', 'message' => 'Item berhasil dihapus']);
        } else if ($action === 'clear_date') {
            $date = $input['date'] ?? date('Y-m-d');
            $stmt = $pdo->prepare("DELETE FROM obtained_items WHERE report_date = ? OR DATE(created_at) = ?");
            $stmt->execute([$date, $date]);

            echo json_encode(['status' => 'success', 'message' => 'Data tanggal ' . $date . ' berhasil dibersihkan']);
        } else {
            // Default single insert
            $insStmt = $pdo->prepare("INSERT INTO obtained_items 
                (person, model, storage, grade, unit, obtained_price, fee_info, bidder, status, notes, report_date, raw_line) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $insStmt->execute([
                trim($input['person'] ?? ''),
                trim($input['model'] ?? ''),
                isset($input['storage']) ? (string)$input['storage'] : '',
                trim($input['grade'] ?? ''),
                intval($input['unit'] ?? 1),
                floatval($input['obtained_price'] ?? ($input['price'] ?? 0)),
                trim($input['fee_info'] ?? ''),
                trim($input['bidder'] ?? ''),
                trim($input['status'] ?? 'approved'),
                trim($input['notes'] ?? ''),
                $input['report_date'] ?? date('Y-m-d'),
                trim($input['raw_line'] ?? '')
            ]);

            echo json_encode(['status' => 'success', 'message' => 'Obtained item saved', 'id' => $pdo->lastInsertId()]);
        }
    }
} catch (\Exception $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
