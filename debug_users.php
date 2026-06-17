<?php
require 'backend/config.php';
$stmt = $pdo->query("SELECT * FROM users");
print_r($stmt->fetchAll());
?>
