<?php
$ch = curl_init('http://biddlog.test/api/assignments.php');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['item_id' => 7, 'user_id' => null, 'assigned_accounts' => '']));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
$response = curl_exec($ch);
echo $response;
?>
