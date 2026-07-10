<?php
// Izinkan CORS dari domain frontend
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

require_once 'config/db.php';

// Jika script berhasil mencapai titik ini, koneksi sukses
echo json_encode([
    'status' => 'success',
    'message' => 'Berhasil terhubung ke database biddlog_db',
    'timestamp' => date('Y-m-d H:i:s')
]);
?>
