<?php
require 'backend/config.php';
echo "--- USERS ---\n";
$stmt = $pdo->query("SELECT * FROM users");
print_r($stmt->fetchAll());
echo "\n--- ACCOUNTS ---\n";
$stmt = $pdo->query("SELECT * FROM accounts");
print_r($stmt->fetchAll());
?>
