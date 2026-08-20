<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Content-Type: application/json');
header('Cache-Control: private, no-cache, must-revalidate');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once 'config/db.php';

try {
    // 1. Fetch distinct salary dates & summary
    $salaryDatesStmt = $pdo->query("SELECT DISTINCT report_date as report_day, COUNT(*) as item_count FROM salary_items GROUP BY report_date ORDER BY id DESC LIMIT 50");
    $salaryDates = $salaryDatesStmt->fetchAll();

    // 2. Fetch recent salary items (last 500 items)
    $salaryItemsStmt = $pdo->query("SELECT s.*, DATE(s.created_at) as created_day FROM salary_items s ORDER BY s.id DESC LIMIT 500");
    $salaryItems = $salaryItemsStmt->fetchAll();

    // 3. Fetch salary transfers
    $transfersStmt = $pdo->query("SELECT * FROM salary_transfers ORDER BY id DESC");
    $transfers = $transfersStmt->fetchAll();

    // 4. Fetch canonical members
    $membersStmt = $pdo->query("SELECT * FROM members ORDER BY id ASC");
    $members = $membersStmt->fetchAll();

    // 5. Fetch bidder aliases
    $aliasesStmt = $pdo->query("SELECT * FROM bidder_aliases ORDER BY id ASC");
    $aliases = $aliasesStmt->fetchAll();

    // 6. Fetch obtained dates
    $obtainedDatesStmt = $pdo->query("SELECT DISTINCT report_date, DATE(created_at) as created_date, COUNT(*) as item_count FROM obtained_items WHERE report_date IS NOT NULL AND report_date != '' GROUP BY report_date ORDER BY id DESC LIMIT 50");
    $obtainedDates = $obtainedDatesStmt->fetchAll();

    // 7. Fetch latest obtained items
    $latestObtainedStmt = $pdo->query("SELECT report_date FROM obtained_items WHERE report_date IS NOT NULL AND report_date != '' ORDER BY id DESC LIMIT 1");
    $latestRow = $latestObtainedStmt->fetch();
    $obtainedItems = [];
    $latestReportDate = '';
    if ($latestRow && !empty($latestRow['report_date'])) {
        $latestReportDate = $latestRow['report_date'];
        $obtItemsStmt = $pdo->prepare("SELECT * FROM obtained_items WHERE report_date = ? ORDER BY id ASC");
        $obtItemsStmt->execute([$latestReportDate]);
        $obtainedItems = $obtItemsStmt->fetchAll();
    }

    echo json_encode([
        'status' => 'success',
        'timestamp' => time(),
        'salary' => [
            'dates' => $salaryDates,
            'items' => $salaryItems,
            'transfers' => $transfers,
            'members' => $members,
            'bidder_aliases' => $aliases
        ],
        'obtained' => [
            'dates' => $obtainedDates,
            'report_date' => $latestReportDate,
            'items' => $obtainedItems
        ]
    ]);
} catch (\Exception $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
