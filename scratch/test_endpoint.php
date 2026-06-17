<?php
// Test the endpoint directly
$_GET['action'] = 'getHistoryBySerial';
$_GET['serial'] = 'IT2026123456'; // Replace with a real serial if known
include 'backend/attendance.php';
