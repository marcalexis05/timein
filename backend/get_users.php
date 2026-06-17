<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require 'config.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->query("SELECT id, full_name, employee_type, serial_number, is_archived FROM users");
    $users = $stmt->fetchAll();
    
    echo json_encode(['status' => 'success', 'users' => $users]);
} else {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed.']);
}
?>
