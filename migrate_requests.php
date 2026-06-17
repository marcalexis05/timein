<?php
require_once 'backend/config.php';

try {
    $sql = "CREATE TABLE IF NOT EXISTS attendance_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        requested_date DATE NOT NULL,
        time_in TIME NOT NULL,
        time_out TIME NOT NULL,
        reason TEXT,
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        admin_remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )";
    
    $pdo->exec($sql);
    echo "Table 'attendance_requests' created successfully.\n";
} catch (PDOException $e) {
    echo "Error creating table: " . $e->getMessage() . "\n";
}
?>
