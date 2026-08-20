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

// Helper to extract ISO date (YYYY-MM-DD)
function extractIsoDate($rawDate) {
    if (empty($rawDate)) return date('Y-m-d');
    $trimmed = trim($rawDate);
    if (preg_match('/(\d{1,2})[\/\-](\d{1,2})[\/\-]\s*(\d{4})/', $trimmed, $m)) {
        $d = str_pad($m[1], 2, '0', STR_PAD_LEFT);
        $mo = str_pad($m[2], 2, '0', STR_PAD_LEFT);
        $y = $m[3];
        return "$y-$mo-$d";
    }
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $trimmed)) {
        return $trimmed;
    }
    return date('Y-m-d');
}

// Helper to normalize display date (e.g. "Enb tgl 19/08/ 2026")
function normalizeDisplayDate($rawDate) {
    if (empty($rawDate)) {
        $today = new DateTime('now', new DateTimeZone('Asia/Jakarta'));
        return "Enb tgl " . $today->format('d/m/ Y');
    }
    $trimmed = trim($rawDate);
    if (preg_match('/(\d{1,2})[\/\-](\d{1,2})[\/\-]\s*(\d{4})/', $trimmed, $m)) {
        $d = str_pad($m[1], 2, '0', STR_PAD_LEFT);
        $mo = str_pad($m[2], 2, '0', STR_PAD_LEFT);
        $y = $m[3];
        return "Enb tgl $d/$mo/ $y";
    }
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $trimmed, $m)) {
        return "Enb tgl {$m[3]}/{$m[2]}/ {$m[1]}";
    }
    return $trimmed;
}

try {
    if ($method === 'GET') {
        $action = $_GET['action'] ?? '';
        
        // List unique dates stored in database
        if ($action === 'get_dates' || isset($_GET['get_dates'])) {
            $stmt = $pdo->query("SELECT DISTINCT report_date, DATE(created_at) as created_date, COUNT(*) as item_count FROM obtained_items WHERE report_date IS NOT NULL AND report_date != '' GROUP BY report_date ORDER BY id DESC");
            $dates = $stmt->fetchAll();
            echo json_encode(['status' => 'success', 'data' => $dates]);
            exit;
        }

        $date = $_GET['date'] ?? null;
        $loadAll = isset($_GET['all']) && $_GET['all'] === '1';

        if ($date) {
            $isoDate = extractIsoDate($date);
            $dispDate = normalizeDisplayDate($date);
            $dispNoSpace = preg_replace('/\/\s+/', '/', $dispDate);
            $dispWithSpace = preg_replace('/\/(\d{4})/', '/ $1', $dispNoSpace);

            $stmt = $pdo->prepare("SELECT o.*, u.username as user_name FROM obtained_items o LEFT JOIN users u ON o.user_id = u.id 
                WHERE (o.report_date = ? OR o.report_date = ? OR o.report_date = ? OR o.report_date = ? OR ((o.report_date IS NULL OR o.report_date = '') AND DATE(o.created_at) = ?))
                ORDER BY o.id ASC");
            $stmt->execute([$date, $dispDate, $dispNoSpace, $dispWithSpace, $isoDate]);
            $data = $stmt->fetchAll();
            echo json_encode(['status' => 'success', 'data' => $data, 'report_date' => $dispDate]);
        } else if ($loadAll) {
            $stmt = $pdo->query("SELECT o.*, u.username as user_name FROM obtained_items o LEFT JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC, o.id ASC");
            $data = $stmt->fetchAll();
            echo json_encode(['status' => 'success', 'data' => $data]);
        } else {
            // Default: Fetch only the latest date's batch to avoid mixing past dates together
            $stmtLatest = $pdo->query("SELECT report_date FROM obtained_items WHERE report_date IS NOT NULL AND report_date != '' ORDER BY id DESC LIMIT 1");
            $latestRow = $stmtLatest->fetch();
            if ($latestRow && !empty($latestRow['report_date'])) {
                $latestDate = $latestRow['report_date'];
                $isoDate = extractIsoDate($latestDate);
                $dispDate = normalizeDisplayDate($latestDate);
                $dispNoSpace = preg_replace('/\/\s+/', '/', $dispDate);
                $dispWithSpace = preg_replace('/\/(\d{4})/', '/ $1', $dispNoSpace);

                $stmt = $pdo->prepare("SELECT o.*, u.username as user_name FROM obtained_items o LEFT JOIN users u ON o.user_id = u.id 
                    WHERE (o.report_date = ? OR o.report_date = ? OR o.report_date = ? OR o.report_date = ? OR ((o.report_date IS NULL OR o.report_date = '') AND DATE(o.created_at) = ?))
                    ORDER BY o.id ASC");
                $stmt->execute([$latestDate, $dispDate, $dispNoSpace, $dispWithSpace, $isoDate]);
                $data = $stmt->fetchAll();
                echo json_encode(['status' => 'success', 'data' => $data, 'report_date' => $dispDate, 'is_latest' => true]);
            } else {
                echo json_encode(['status' => 'success', 'data' => [], 'report_date' => normalizeDisplayDate(''), 'is_latest' => true]);
            }
        }
    } else if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) {
            throw new Exception("Invalid JSON payload");
        }

        $action = $input['action'] ?? 'save_item';

        if ($action === 'sync_all') {
            $rawDate = $input['report_date'] ?? date('Y-m-d');
            $isoDate = extractIsoDate($rawDate);
            $dispDate = normalizeDisplayDate($rawDate);
            $dispNoSpace = preg_replace('/\/\s+/', '/', $dispDate);
            $dispWithSpace = preg_replace('/\/(\d{4})/', '/ $1', $dispNoSpace);

            $items = $input['items'] ?? [];

            if ($pdo->inTransaction() === false) {
                $pdo->beginTransaction();
            }

            // Clean existing records for this date cleanly to prevent duplicate stacking
            $clear_existing = $input['clear_existing'] ?? true;
            if ($clear_existing) {
                $delStmt = $pdo->prepare("DELETE FROM obtained_items WHERE report_date = ? OR report_date = ? OR report_date = ? OR report_date = ? OR DATE(created_at) = ?");
                $delStmt->execute([$rawDate, $dispDate, $dispNoSpace, $dispWithSpace, $isoDate]);
            }

            $insStmt = $pdo->prepare("INSERT INTO obtained_items 
                (person, model, storage, grade, unit, obtained_price, fee_info, bidder, status, notes, report_date, raw_line) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

            $insertedCount = 0;
            foreach ($items as $it) {
                $person = trim($it['person'] ?? '');
                $model = trim($it['model'] ?? '');
                if (!$person && !$model) continue;

                $insStmt->execute([
                    $person,
                    $model,
                    isset($it['storage']) ? (string)$it['storage'] : '',
                    trim($it['grade'] ?? ''),
                    intval($it['unit'] ?? 1),
                    floatval($it['obtained_price'] ?? ($it['price'] ?? 0)),
                    trim($it['fee_info'] ?? ''),
                    trim($it['bidder'] ?? ''),
                    trim($it['status'] ?? 'approved'),
                    trim($it['notes'] ?? ''),
                    $dispDate,
                    trim($it['raw_line'] ?? '')
                ]);
                $insertedCount++;
            }

            $pdo->commit();

            echo json_encode([
                'status' => 'success', 
                'message' => "{$insertedCount} item berhasil disinkronisasi untuk tanggal {$dispDate}", 
                'count' => $insertedCount,
                'report_date' => $dispDate
            ]);
        } else if ($action === 'clean_duplicates') {
            $rawDate = $input['report_date'] ?? null;
            
            // Delete duplicate entries keeping only the lowest id
            if ($rawDate) {
                $isoDate = extractIsoDate($rawDate);
                $dispDate = normalizeDisplayDate($rawDate);
                $dispNoSpace = preg_replace('/\/\s+/', '/', $dispDate);
                $dispWithSpace = preg_replace('/\/(\d{4})/', '/ $1', $dispNoSpace);

                $sql = "DELETE FROM obtained_items 
                        WHERE (report_date = ? OR report_date = ? OR report_date = ? OR report_date = ? OR DATE(created_at) = ?)
                        AND id NOT IN (
                            SELECT MIN(id) FROM (
                                SELECT MIN(id) as id FROM obtained_items 
                                WHERE (report_date = ? OR report_date = ? OR report_date = ? OR report_date = ? OR DATE(created_at) = ?)
                                GROUP BY person, model, storage, grade, unit, obtained_price, fee_info, bidder, status
                            ) as tmp
                        )";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([
                    $rawDate, $dispDate, $dispNoSpace, $dispWithSpace, $isoDate,
                    $rawDate, $dispDate, $dispNoSpace, $dispWithSpace, $isoDate
                ]);
            } else {
                $sql = "DELETE FROM obtained_items 
                        WHERE id NOT IN (
                            SELECT MIN(id) FROM (
                                SELECT MIN(id) as id FROM obtained_items 
                                GROUP BY report_date, person, model, storage, grade, unit, obtained_price, fee_info, bidder, status
                            ) as tmp
                        )";
                $stmt = $pdo->query($sql);
            }

            echo json_encode(['status' => 'success', 'message' => 'Duplikat berhasil dibersihkan']);
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

            $rawDate = $input['report_date'] ?? date('Y-m-d');
            $dispDate = normalizeDisplayDate($rawDate);

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
                $dispDate,
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
            $rawDate = $input['date'] ?? ($input['report_date'] ?? date('Y-m-d'));
            $isoDate = extractIsoDate($rawDate);
            $dispDate = normalizeDisplayDate($rawDate);
            $dispNoSpace = preg_replace('/\/\s+/', '/', $dispDate);
            $dispWithSpace = preg_replace('/\/(\d{4})/', '/ $1', $dispNoSpace);

            $stmt = $pdo->prepare("DELETE FROM obtained_items WHERE report_date = ? OR report_date = ? OR report_date = ? OR report_date = ? OR DATE(created_at) = ?");
            $stmt->execute([$rawDate, $dispDate, $dispNoSpace, $dispWithSpace, $isoDate]);

            echo json_encode(['status' => 'success', 'message' => 'Data tanggal ' . $dispDate . ' berhasil dibersihkan']);
        } else {
            // Single insert fallback
            $rawDate = $input['report_date'] ?? date('Y-m-d');
            $dispDate = normalizeDisplayDate($rawDate);

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
                $dispDate,
                trim($input['raw_line'] ?? '')
            ]);

            echo json_encode(['status' => 'success', 'message' => 'Obtained item saved', 'id' => $pdo->lastInsertId()]);
        }
    }
} catch (\Exception $e) {
    if ($pdo && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
