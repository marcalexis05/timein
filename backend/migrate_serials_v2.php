<?php
require_once dirname(__FILE__) . '/config.php';

try {
    $stmt = $pdo->query("SELECT id, serial_number FROM users");
    $users = $stmt->fetchAll();
    
    $updatedCount = 0;
    $year = date('Y');

    foreach ($users as $user) {
        $oldSerial = $user['serial_number'];
        
        // Only update if it's the old 4-digit format (IT + YEAR + 4 digits = 10 chars)
        if (strlen($oldSerial) <= 10) {
            do {
                $rand = str_pad(mt_rand(1, 999999), 6, '0', STR_PAD_LEFT);
                $newSerial = "IT" . $year . $rand;
                
                // Check if new serial already exists
                $check = $pdo->prepare("SELECT id FROM users WHERE serial_number = ?");
                $check->execute([$newSerial]);
            } while ($check->fetch());

            $update = $pdo->prepare("UPDATE users SET serial_number = ? WHERE id = ?");
            $update->execute([$newSerial, $user['id']]);
            $updatedCount++;
            echo "Updated User ID {$user['id']}: $oldSerial -> $newSerial\n";
        }
    }

    echo "\nSuccess: Updated $updatedCount users to 6-digit serial numbers.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
