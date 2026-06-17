<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }

require 'config.php';

// GET: fetch serial number for a user
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $userId = $_GET['user_id'] ?? null;
    if (!$userId) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'user_id required.']);
        exit;
    }

    $stmt = $pdo->prepare("SELECT id, full_name, employee_type, serial_number FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'User not found.']);
        exit;
    }

    // If no serial yet, generate one
    if (empty($user['serial_number'])) {
        $serial = generateUniqueSerial($pdo);
        $upd = $pdo->prepare("UPDATE users SET serial_number = ? WHERE id = ?");
        $upd->execute([$serial, $userId]);
        $user['serial_number'] = $serial;
    }

    echo json_encode(['status' => 'success', 'user' => $user]);
    exit;
}

// POST: regenerate serial
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $userId = $data['user_id'] ?? null;
    if (!$userId) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'user_id required.']);
        exit;
    }
    $serial = generateUniqueSerial($pdo);
    $upd = $pdo->prepare("UPDATE users SET serial_number = ? WHERE id = ?");
    $upd->execute([$serial, $userId]);
    echo json_encode(['status' => 'success', 'serial_number' => $serial]);
    exit;
}

function generateUniqueSerial(PDO $pdo): string {
    do {
        $random = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $serial = 'IT' . date('Y') . $random;
        $check = $pdo->prepare("SELECT COUNT(*) FROM users WHERE serial_number = ?");
        $check->execute([$serial]);
    } while ($check->fetchColumn() > 0);
    return $serial;
}
?>
