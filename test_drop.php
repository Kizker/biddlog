<?php
require 'c:/laragon/www/biddlog/biddlog_legacy/api/config/db.php';

// 1. Assign item to User 3 with account 'AccA'
$pdo->query("UPDATE items SET assigned_to = 3, assigned_accounts = 'AccA', status = 'published' WHERE id = 7");

// 2. Simulate handleDrop: Move item 7 to User 4 without sending assigned_accounts
$ch = curl_init('http://biddlog.test/api/assignments.php');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['item_id' => 7, 'user_id' => 4]));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
$response = curl_exec($ch);
curl_close($ch);

// 3. Check DB
$stmt = $pdo->query("SELECT id, assigned_to, assigned_accounts FROM items WHERE id = 7");
print_r($stmt->fetch(PDO::FETCH_ASSOC));
?>
