<?php
require 'config.php';
header('Content-Type: application/json');

try {
    $stmt = $pdo->query("DESCRIBE users");
    $columns = $stmt->fetchAll();
    echo json_encode(['status' => 'success', 'columns' => $columns]);
} catch (Exception $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
