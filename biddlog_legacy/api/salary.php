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

// Lazy table initialization helper (only runs if tables don't exist yet)
function ensureSalaryTablesExist($pdo, $driver) {
    static $checked = false;
    if ($checked) return;
    $checked = true;

    try {
        $isSqlite = !isset($driver) || $driver === 'sqlite';
        if ($isSqlite) {
            $pdo->exec("CREATE TABLE IF NOT EXISTS payroll_batches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                report_date VARCHAR(50) NOT NULL UNIQUE,
                total_items INTEGER DEFAULT 0,
                total_fee_points INTEGER DEFAULT 0,
                total_amount REAL DEFAULT 0,
                people_count INTEGER DEFAULT 0,
                sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )");

            $pdo->exec("CREATE TABLE IF NOT EXISTS salary_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id INTEGER,
                report_date VARCHAR(50) NOT NULL,
                person VARCHAR(255) NOT NULL,
                model VARCHAR(255),
                storage VARCHAR(50),
                grade VARCHAR(50),
                unit INTEGER DEFAULT 1,
                obtained_price REAL DEFAULT 0,
                fee_info VARCHAR(100),
                fee_value INTEGER DEFAULT 0,
                bidder VARCHAR(100),
                status VARCHAR(50) DEFAULT 'approved',
                notes TEXT,
                raw_line TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )");

            $pdo->exec("CREATE TABLE IF NOT EXISTS salary_transfers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transfer_batch_id VARCHAR(100),
                person VARCHAR(255) NOT NULL,
                dates_included TEXT,
                total_items INTEGER DEFAULT 0,
                total_fee_points INTEGER DEFAULT 0,
                total_amount REAL DEFAULT 0,
                status VARCHAR(50) DEFAULT 'transferred',
                transferred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )");

            $pdo->exec("CREATE TABLE IF NOT EXISTS members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(100) NOT NULL UNIQUE,
                alias VARCHAR(100),
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )");

            $pdo->exec("CREATE TABLE IF NOT EXISTS bidder_aliases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bidder_name VARCHAR(100) NOT NULL UNIQUE,
                alias_name VARCHAR(100),
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )");
        } else {
            $pdo->exec("CREATE TABLE IF NOT EXISTS payroll_batches (
                id INT AUTO_INCREMENT PRIMARY KEY,
                report_date VARCHAR(50) NOT NULL UNIQUE,
                total_items INT DEFAULT 0,
                total_fee_points INT DEFAULT 0,
                total_amount DOUBLE DEFAULT 0,
                people_count INT DEFAULT 0,
                sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            $pdo->exec("CREATE TABLE IF NOT EXISTS salary_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                batch_id INT DEFAULT NULL,
                report_date VARCHAR(50) NOT NULL,
                person VARCHAR(255) NOT NULL,
                model VARCHAR(255),
                storage VARCHAR(50),
                grade VARCHAR(50),
                unit INT DEFAULT 1,
                obtained_price DOUBLE DEFAULT 0,
                fee_info VARCHAR(100),
                fee_value INT DEFAULT 0,
                bidder VARCHAR(100),
                status VARCHAR(50) DEFAULT 'approved',
                notes TEXT,
                raw_line TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            $pdo->exec("CREATE TABLE IF NOT EXISTS salary_transfers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                transfer_batch_id VARCHAR(100),
                person VARCHAR(255) NOT NULL,
                dates_included TEXT,
                total_items INT DEFAULT 0,
                total_fee_points INT DEFAULT 0,
                total_amount DOUBLE DEFAULT 0,
                status VARCHAR(50) DEFAULT 'transferred',
                transferred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            $pdo->exec("CREATE TABLE IF NOT EXISTS members (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                alias VARCHAR(100),
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            $pdo->exec("CREATE TABLE IF NOT EXISTS bidder_aliases (
                id INT AUTO_INCREMENT PRIMARY KEY,
                bidder_name VARCHAR(100) NOT NULL UNIQUE,
                alias_name VARCHAR(100),
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        }
    } catch (\Exception $e) {
        // Ignore if already created
    }
}

// Strict owner check helper
function isOwner($name) {
    $norm = strtolower(trim($name ?? ''));
    return in_array($norm, ['menik', 'mubdi'], true);
}

try {
    if ($method === 'GET') {
        // 1. Fetch published batches
        $batchStmt = $pdo->query("SELECT * FROM payroll_batches ORDER BY report_date DESC, id DESC");
        $batches = $batchStmt->fetchAll();

        // 2. Fetch published salary items
        $itemStmt = $pdo->query("SELECT * FROM salary_items ORDER BY report_date DESC, id ASC");
        $salaryItems = $itemStmt->fetchAll();

        // 3. Fetch salary transfers history
        $transferStmt = $pdo->query("SELECT * FROM salary_transfers ORDER BY transferred_at DESC, id DESC");
        $transfers = $transferStmt->fetchAll();

        // 4. Fetch official members list
        $memberStmt = $pdo->query("SELECT * FROM members ORDER BY id ASC");
        $members = $memberStmt->fetchAll();

        // 5. Fetch bidder aliases (fallback / sync)
        $aliasStmt = $pdo->query("SELECT * FROM bidder_aliases ORDER BY bidder_name ASC");
        $bidderAliases = $aliasStmt->fetchAll();

        // 6. Distinct published dates with metrics
        $distinctDates = array_map(function($b) {
            return [
                'report_day' => $b['report_date'],
                'total_items' => $b['total_items'],
                'total_fee_points' => $b['total_fee_points'],
                'total_amount' => $b['total_amount'],
                'people_count' => $b['people_count'],
                'sent_at' => $b['sent_at']
            ];
        }, $batches);

        echo json_encode([
            'status' => 'success',
            'data' => [
                'batches' => $batches,
                'items' => $salaryItems,
                'dates' => $distinctDates,
                'transfers' => $transfers,
                'members' => $members,
                'bidder_aliases' => $bidderAliases
            ]
        ]);
    } else if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) {
            throw new Exception("Invalid JSON payload");
        }

        $action = $input['action'] ?? '';

        if ($action === 'publish_payroll') {
            $rawDate = trim($input['report_date'] ?? date('Y-m-d'));
            $items = $input['items'] ?? [];

            if (empty($rawDate)) {
                $rawDate = date('Y-m-d');
            }

            // Clean previous publish for this date
            $delBatch = $pdo->prepare("DELETE FROM payroll_batches WHERE report_date = ?");
            $delBatch->execute([$rawDate]);

            $delItems = $pdo->prepare("DELETE FROM salary_items WHERE report_date = ?");
            $delItems->execute([$rawDate]);

            // Filter items: only approved items, fee numeric, excluding pure owners (Menik & Mubdi)
            $validItems = [];
            $peopleSet = [];
            $totalFeePoints = 0;
            $totalItemsCount = 0;

            foreach ($items as $it) {
                $person = trim($it['person'] ?? '');
                if (!$person) continue;

                // Owner check: Menik & Mubdi are excluded, but Mubdi 2 is included
                if (isOwner($person)) {
                    continue;
                }

                $status = trim($it['status'] ?? 'approved');
                if ($status !== 'approved') {
                    continue;
                }

                $feeRaw = trim($it['fee_info'] ?? '');
                $feeClean = preg_replace('/[()]/', '', $feeRaw);
                $feeVal = intval($feeClean);

                // Each row counts as 1 unit
                $unit = 1;
                $subtotalFee = $feeVal;
                $totalFeePoints += $subtotalFee;
                $totalItemsCount += $unit;
                $peopleSet[$person] = true;

                $validItems[] = [
                    'person' => $person,
                    'model' => trim($it['model'] ?? ''),
                    'storage' => isset($it['storage']) ? (string)$it['storage'] : '',
                    'grade' => trim($it['grade'] ?? ''),
                    'unit' => $unit,
                    'obtained_price' => floatval($it['obtained_price'] ?? ($it['price'] ?? 0)),
                    'fee_info' => $feeRaw,
                    'fee_value' => $feeVal,
                    'bidder' => trim($it['bidder'] ?? ''),
                    'status' => 'approved',
                    'notes' => trim($it['notes'] ?? ''),
                    'raw_line' => trim($it['raw_line'] ?? '')
                ];
            }

            $totalAmount = $totalFeePoints * 1000;
            $peopleCount = count($peopleSet);
            $now = date('Y-m-d H:i:s');

            // Insert payroll batch record
            $insBatch = $pdo->prepare("INSERT INTO payroll_batches 
                (report_date, total_items, total_fee_points, total_amount, people_count, sent_at) 
                VALUES (?, ?, ?, ?, ?, ?)");
            $insBatch->execute([$rawDate, $totalItemsCount, $totalFeePoints, $totalAmount, $peopleCount, $now]);
            $batchId = $pdo->lastInsertId();

            // Insert salary items
            $insItem = $pdo->prepare("INSERT INTO salary_items 
                (batch_id, report_date, person, model, storage, grade, unit, obtained_price, fee_info, fee_value, bidder, status, notes, raw_line) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

            foreach ($validItems as $v) {
                $insItem->execute([
                    $batchId,
                    $rawDate,
                    $v['person'],
                    $v['model'],
                    $v['storage'],
                    $v['grade'],
                    $v['unit'],
                    $v['obtained_price'],
                    $v['fee_info'],
                    $v['fee_value'],
                    $v['bidder'],
                    $v['status'],
                    $v['notes'],
                    $v['raw_line']
                ]);
            }

            echo json_encode([
                'status' => 'success',
                'message' => "Data gaji tanggal {$rawDate} berhasil dikirim ke menu Gaji! ({$totalItemsCount} item, Rp " . number_format($totalAmount, 0, ',', '.') . ")",
                'batch_id' => $batchId,
                'total_items' => $totalItemsCount,
                'total_amount' => $totalAmount,
                'people_count' => $peopleCount
            ]);
        } else if ($action === 'delete_batch') {
            $reportDate = trim($input['report_date'] ?? '');
            if (!$reportDate) throw new Exception("Tanggal laporan diperlukan");

            $delBatch = $pdo->prepare("DELETE FROM payroll_batches WHERE report_date = ?");
            $delBatch->execute([$reportDate]);

            $delItems = $pdo->prepare("DELETE FROM salary_items WHERE report_date = ?");
            $delItems->execute([$reportDate]);

            echo json_encode(['status' => 'success', 'message' => "Data gaji tanggal {$reportDate} berhasil dihapus dari Gaji"]);
        } else if ($action === 'mark_transferred') {
            $person = trim($input['person'] ?? '');
            if (!$person) throw new Exception("Nama person diperlukan");

            $datesIncluded = is_array($input['dates'] ?? null) ? json_encode($input['dates']) : ($input['dates'] ?? '');
            $totalItems = intval($input['total_items'] ?? 0);
            $totalFeePoints = intval($input['total_fee_points'] ?? 0);
            $totalAmount = floatval($input['total_amount'] ?? ($totalFeePoints * 1000));
            $notes = trim($input['notes'] ?? '');
            $batchId = trim($input['batch_id'] ?? ('batch_' . date('YmdHis') . '_' . uniqid()));
            $now = date('Y-m-d H:i:s');

            $insStmt = $pdo->prepare("INSERT INTO salary_transfers 
                (transfer_batch_id, person, dates_included, total_items, total_fee_points, total_amount, status, transferred_at, notes) 
                VALUES (?, ?, ?, ?, ?, ?, 'transferred', ?, ?)");
            $insStmt->execute([$batchId, $person, $datesIncluded, $totalItems, $totalFeePoints, $totalAmount, $now, $notes]);

            echo json_encode([
                'status' => 'success',
                'message' => "Gaji untuk {$person} berhasil ditandai sudah ditransfer ✅",
                'id' => $pdo->lastInsertId()
            ]);
        } else if ($action === 'mark_batch_transferred') {
            $records = $input['records'] ?? [];
            if (!is_array($records) || count($records) === 0) {
                throw new Exception("Daftar transfer kosong");
            }

            $batchId = 'batch_' . date('YmdHis') . '_' . uniqid();
            $now = date('Y-m-d H:i:s');
            $insStmt = $pdo->prepare("INSERT INTO salary_transfers 
                (transfer_batch_id, person, dates_included, total_items, total_fee_points, total_amount, status, transferred_at, notes) 
                VALUES (?, ?, ?, ?, ?, ?, 'transferred', ?, ?)");

            $count = 0;
            foreach ($records as $rec) {
                $person = trim($rec['person'] ?? '');
                if (!$person) continue;

                $datesIncluded = is_array($rec['dates'] ?? null) ? json_encode($rec['dates']) : ($rec['dates'] ?? '');
                $totalItems = intval($rec['total_items'] ?? 0);
                $totalFeePoints = intval($rec['total_fee_points'] ?? 0);
                $totalAmount = floatval($rec['total_amount'] ?? ($totalFeePoints * 1000));
                $notes = trim($rec['notes'] ?? '');

                $insStmt->execute([$batchId, $person, $datesIncluded, $totalItems, $totalFeePoints, $totalAmount, $now, $notes]);
                $count++;
            }

            echo json_encode([
                'status' => 'success',
                'message' => "{$count} data gaji berhasil ditandai sudah ditransfer ✅",
                'count' => $count,
                'batch_id' => $batchId
            ]);
        } else if ($action === 'unmark_transferred') {
            $id = $input['id'] ?? null;
            $person = $input['person'] ?? null;
            $date = $input['date'] ?? null;

            if ($id) {
                $del = $pdo->prepare("DELETE FROM salary_transfers WHERE id = ?");
                $del->execute([$id]);
            } else if ($person && $date) {
                $del = $pdo->prepare("DELETE FROM salary_transfers WHERE person = ? AND (dates_included LIKE ? OR dates_included = ?)");
                $del->execute([$person, "%{$date}%", $date]);
            } else if ($person) {
                $del = $pdo->prepare("DELETE FROM salary_transfers WHERE person = ?");
                $del->execute([$person]);
            }

            echo json_encode([
                'status' => 'success',
                'message' => 'Status transfer berhasil dibatalkan'
            ]);
        } else if ($action === 'save_member_alias' || $action === 'save_bidder_alias') {
            $name = trim($input['name'] ?? ($input['bidder_name'] ?? ''));
            $aliasName = trim($input['alias_name'] ?? '');
            $notes = trim($input['notes'] ?? '');

            if (!$name) throw new Exception("Nama anggota / bidder diperlukan");

            // 1. Save or update in members table
            $checkMem = $pdo->prepare("SELECT id FROM members WHERE LOWER(name) = LOWER(?)");
            $checkMem->execute([$name]);
            $existingMem = $checkMem->fetch();

            if ($existingMem) {
                $updMem = $pdo->prepare("UPDATE members SET alias = ?, notes = ? WHERE id = ?");
                $updMem->execute([$aliasName, $notes, $existingMem['id']]);
            } else {
                $insMem = $pdo->prepare("INSERT INTO members (name, alias, notes) VALUES (?, ?, ?)");
                $insMem->execute([$name, $aliasName, $notes]);
            }

            // 2. Also keep bidder_aliases in sync
            $check = $pdo->prepare("SELECT id FROM bidder_aliases WHERE LOWER(bidder_name) = LOWER(?)");
            $check->execute([$name]);
            $existing = $check->fetch();

            if ($existing) {
                $upd = $pdo->prepare("UPDATE bidder_aliases SET alias_name = ?, notes = ? WHERE id = ?");
                $upd->execute([$aliasName, $notes, $existing['id']]);
            } else {
                $ins = $pdo->prepare("INSERT INTO bidder_aliases (bidder_name, alias_name, notes) VALUES (?, ?, ?)");
                $ins->execute([$name, $aliasName, $notes]);
            }

            echo json_encode([
                'status' => 'success',
                'message' => "Data anggota {$name} berhasil disimpan ✅"
            ]);
        } else if ($action === 'merge_members') {
            $targetName = trim($input['target_name'] ?? '');
            $sourceName = trim($input['source_name'] ?? '');

            if (!$targetName || !$sourceName) {
                throw new Exception("Nama anggota utama (target) dan anggota yang digabungkan (source) wajib diisi");
            }

            if (strcasecmp($targetName, $sourceName) === 0) {
                throw new Exception("Anggota utama dan anggota yang digabungkan tidak boleh sama");
            }

            // 1. Fetch target member
            $stmtTarget = $pdo->prepare("SELECT * FROM members WHERE LOWER(name) = LOWER(?)");
            $stmtTarget->execute([$targetName]);
            $targetMem = $stmtTarget->fetch();

            // 2. Fetch source member
            $stmtSource = $pdo->prepare("SELECT * FROM members WHERE LOWER(name) = LOWER(?)");
            $stmtSource->execute([$sourceName]);
            $sourceMem = $stmtSource->fetch();

            // 3. Compile all unique aliases
            $aliasList = [];

            // Add existing target aliases
            if ($targetMem && !empty($targetMem['alias'])) {
                $rawTargetAliases = explode(',', $targetMem['alias']);
                foreach ($rawTargetAliases as $a) {
                    $cleaned = trim($a);
                    if ($cleaned && strcasecmp($cleaned, $targetName) !== 0 && !in_array(strtolower($cleaned), array_map('strtolower', $aliasList))) {
                        $aliasList[] = $cleaned;
                    }
                }
            }

            // Add source name as an alias
            if (strcasecmp($sourceName, $targetName) !== 0 && !in_array(strtolower($sourceName), array_map('strtolower', $aliasList))) {
                $aliasList[] = $sourceName;
            }

            // Add existing source aliases
            if ($sourceMem && !empty($sourceMem['alias'])) {
                $rawSourceAliases = explode(',', $sourceMem['alias']);
                foreach ($rawSourceAliases as $a) {
                    $cleaned = trim($a);
                    if ($cleaned && strcasecmp($cleaned, $targetName) !== 0 && !in_array(strtolower($cleaned), array_map('strtolower', $aliasList))) {
                        $aliasList[] = $cleaned;
                    }
                }
            }

            $mergedAliasString = implode(', ', $aliasList);

            // 4. Update or insert target member
            if ($targetMem) {
                $updTarget = $pdo->prepare("UPDATE members SET alias = ? WHERE id = ?");
                $updTarget->execute([$mergedAliasString, $targetMem['id']]);
            } else {
                $insTarget = $pdo->prepare("INSERT INTO members (name, alias, notes) VALUES (?, ?, ?)");
                $insTarget->execute([$targetName, $mergedAliasString, '']);
            }

            // 5. Update bidder_aliases table
            $delOldAliases = $pdo->prepare("DELETE FROM bidder_aliases WHERE LOWER(bidder_name) = LOWER(?) OR LOWER(bidder_name) = LOWER(?)");
            $delOldAliases->execute([$targetName, $sourceName]);

            $insNewAlias = $pdo->prepare("INSERT INTO bidder_aliases (bidder_name, alias_name, notes) VALUES (?, ?, ?)");
            $insNewAlias->execute([$targetName, $mergedAliasString, 'Merged from ' . $sourceName]);

            // 6. Delete source from members
            $delSource = $pdo->prepare("DELETE FROM members WHERE LOWER(name) = LOWER(?)");
            $delSource->execute([$sourceName]);

            // 7. Update historical items and salary records where person = sourceName to targetName
            $updSalary = $pdo->prepare("UPDATE salary_items SET person = ? WHERE LOWER(person) = LOWER(?)");
            $updSalary->execute([$targetName, $sourceName]);

            $updObtained = $pdo->prepare("UPDATE obtained_items SET person = ? WHERE LOWER(person) = LOWER(?)");
            $updObtained->execute([$targetName, $sourceName]);

            $updTransfers = $pdo->prepare("UPDATE salary_transfers SET person = ? WHERE LOWER(person) = LOWER(?)");
            $updTransfers->execute([$targetName, $sourceName]);

            echo json_encode([
                'status' => 'success',
                'message' => "Berhasil menggabungkan '{$sourceName}' ke '{$targetName}'! Alias saat ini: {$mergedAliasString} 🔗",
                'target_name' => $targetName,
                'source_name' => $sourceName,
                'merged_alias' => $mergedAliasString
            ]);
        } else if ($action === 'delete_member_alias') {
            $name = trim($input['name'] ?? ($input['bidder_name'] ?? ''));
            if (!$name) throw new Exception("Nama anggota / bidder diperlukan");

            $updMem = $pdo->prepare("UPDATE members SET alias = '' WHERE LOWER(name) = LOWER(?)");
            $updMem->execute([$name]);

            $del = $pdo->prepare("DELETE FROM bidder_aliases WHERE LOWER(bidder_name) = LOWER(?)");
            $del->execute([$name]);

            echo json_encode([
                'status' => 'success',
                'message' => "Alias untuk {$name} berhasil dihapus"
            ]);
        } else if ($action === 'delete_member') {
            $name = trim($input['name'] ?? ($input['bidder_name'] ?? ''));
            if (!$name) throw new Exception("Nama anggota diperlukan");

            $delMem = $pdo->prepare("DELETE FROM members WHERE LOWER(name) = LOWER(?)");
            $delMem->execute([$name]);

            $delAlias = $pdo->prepare("DELETE FROM bidder_aliases WHERE LOWER(bidder_name) = LOWER(?)");
            $delAlias->execute([$name]);

            echo json_encode([
                'status' => 'success',
                'message' => "Anggota {$name} berhasil dihapus dari sistem"
            ]);
        } else {
            throw new Exception("Action tidak valid");
        }
    }
} catch (\Exception $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
