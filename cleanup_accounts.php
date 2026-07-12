<?php
require 'c:/laragon/www/biddlog/biddlog_legacy/api/config/db.php';

// Get all users and their accounts
$stmt = $pdo->query("SELECT id, accounts FROM users");
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);
$userAccounts = [];
foreach ($users as $u) {
    $userAccounts[$u['id']] = $u['accounts'] ? explode(',', $u['accounts']) : [];
}

// Get all items
$stmt = $pdo->query("SELECT id, assigned_to, assigned_accounts FROM items WHERE assigned_accounts IS NOT NULL AND assigned_accounts != ''");
$items = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($items as $item) {
    if (!$item['assigned_to']) {
        // If not assigned, should not have accounts
        $pdo->query("UPDATE items SET assigned_accounts = NULL WHERE id = " . $item['id']);
        continue;
    }
    
    $accounts = explode(',', $item['assigned_accounts']);
    $validAccounts = [];
    $validForUser = $userAccounts[$item['assigned_to']] ?? [];
    
    foreach ($accounts as $acc) {
        if (in_array($acc, $validForUser)) {
            $validAccounts[] = $acc;
        }
    }
    
    $newAccountsStr = implode(',', $validAccounts);
    if ($newAccountsStr !== $item['assigned_accounts']) {
        $stmt2 = $pdo->prepare("UPDATE items SET assigned_accounts = ? WHERE id = ?");
        $stmt2->execute([$newAccountsStr, $item['id']]);
    }
}
echo "Cleanup complete.";
?>
