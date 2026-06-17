<?php
require 'config.php';

try {
    // Check if serial_number column exists
    $stmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'serial_number'");
    $column = $stmt->fetch();

    if (!$column) {
        $pdo->exec("ALTER TABLE users ADD COLUMN serial_number VARCHAR(20) UNIQUE AFTER employee_type");
        echo "Added serial_number column to users table.<br>";
    } else {
        echo "serial_number column already exists.<br>";
    }

    // Function to generate serial
    function generateUniqueSerial(PDO $pdo) {
        do {
            $random = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            $serial = 'IT2026' . $random;
            $check = $pdo->prepare("SELECT COUNT(*) FROM users WHERE serial_number = ?");
            $check->execute([$serial]);
        } while ($check->fetchColumn() > 0);
        return $serial;
    }

    // Update existing users who don't have a serial number
    $stmt = $pdo->query("SELECT id FROM users WHERE serial_number IS NULL OR serial_number = ''");
    $users = $stmt->fetchAll();

    foreach ($users as $user) {
        $serial = generateUniqueSerial($pdo);
        $upd = $pdo->prepare("UPDATE users SET serial_number = ? WHERE id = ?");
        $upd->execute([$serial, $user['id']]);
        echo "Assigned serial $serial to user ID {$user['id']}.<br>";
    }

    echo "Finished processing users.";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
