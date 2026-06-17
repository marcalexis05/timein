<?php
header('Content-Type: application/json');
require 'config.php';

$result = [];

// Check tables
$stmt = $pdo->query("SHOW TABLES");
$result['tables'] = $stmt->fetchAll(PDO::FETCH_COLUMN);

// Check accounts structure
try {
    $stmt = $pdo->query("DESCRIBE accounts");
    $result['accounts_columns'] = $stmt->fetchAll(PDO::FETCH_COLUMN);
} catch (Exception $e) {
    $result['accounts_error'] = $e->getMessage();
}

// Auto-fix: add user_id column if missing
try {
    $cols = array_map('strtolower', $result['accounts_columns'] ?? []);
    if (!in_array('user_id', $cols)) {
        $pdo->exec("ALTER TABLE accounts ADD COLUMN user_id INT NULL DEFAULT NULL AFTER id");
        $result['fix_applied'] = 'Added user_id column to accounts table.';
    } else {
        $result['fix_applied'] = 'user_id column already exists.';
    }
} catch (Exception $e) {
    $result['fix_error'] = $e->getMessage();
}

echo json_encode($result, JSON_PRETTY_PRINT);
?>
