<?php
header('Content-Type: text/plain');

try {
    require_once dirname(__DIR__) . '/backend/config.php';
} catch (Exception $e) {
    echo "ERROR: Failed to load config.php: " . $e->getMessage() . "\n";
    exit(1);
}

echo "=== SQL Injection Security Test Suite ===\n\n";

// --- TEST 1: Parameter Injection Bypass ---
echo "[Test 1] Testing Parameterized Input (OR '1'='1')...\n";
// An attacker inputs: injection' OR '1'='1
$unsafeInput = "injection' OR '1'='1";

// Safe implementation (Prepared Statement)
$stmt = $pdo->prepare("SELECT * FROM users WHERE serial_number = ?");
$stmt->execute([$unsafeInput]);
$results = $stmt->fetchAll();

echo "Input: \"$unsafeInput\"\n";
echo "Number of records returned: " . count($results) . "\n";
if (count($results) === 0) {
    echo "-> SUCCESS: The query treated the input as a literal value, not code. Injection blocked!\n\n";
} else {
    echo "-> FAILURE: The query executed the injection payload and returned records!\n\n";
}


// --- TEST 2: Stacked Query Attack (Database Deletion/Modification) ---
echo "[Test 2] Testing Stacked Query Injection (SELECT 1; SELECT 2;)...\n";
try {
    // Attempting to execute a stacked query
    $pdo->query("SELECT 1; SELECT 2;");
    
    echo "-> FAILURE: Stacked queries were allowed! The driver-level protection is inactive.\n";
} catch (PDOException $e) {
    echo "-> SUCCESS: Stacked query execution was rejected with a PDOException!\n";
    echo "   Error: " . $e->getMessage() . "\n";
}

echo "\n=========================================\n";
?>
