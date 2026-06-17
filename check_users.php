<?php
require 'backend/config.php';
$stmt = $pdo->query("SELECT id, full_name, employee_type, serial_number FROM users");
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($users, JSON_PRETTY_PRINT);
?>
