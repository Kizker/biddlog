<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$dataFile = __DIR__ . '/published_data.json';
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        if (file_exists($dataFile)) {
            $content = file_get_contents($dataFile);
            $data = json_decode($content, true);
            echo json_encode(['status' => 'success', 'data' => $data['distribution'], 'published_at' => $data['published_at']]);
        } else {
            echo json_encode(['status' => 'success', 'data' => null]);
        }
    } else if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $distribution = $input['distribution'] ?? [];
        
        $dataToSave = [
            'distribution' => $distribution,
            'published_at' => date('Y-m-d H:i:s')
        ];
        
        file_put_contents($dataFile, json_encode($dataToSave));
        echo json_encode(['status' => 'success', 'message' => 'Published']);
    } else if ($method === 'DELETE') {
        if (file_exists($dataFile)) {
            unlink($dataFile);
        }
        echo json_encode(['status' => 'success', 'message' => 'Unpublished']);
    }
} catch (\Exception $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
