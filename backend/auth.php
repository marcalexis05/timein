<?php
// Suppress PHP error display so HTML error output never corrupts the JSON response
error_reporting(0);
ini_set('display_errors', 0);

// Output buffer catches any stray output (notices, warnings) before we flush JSON
ob_start();

session_start();
header('Content-Type: application/json');

try {
    require 'config.php';
} catch (\Exception $e) {
    ob_end_clean();
    echo json_encode(['status' => 'error', 'message' => 'Database connection failed.']);
    exit;
}

$action = $_GET['action'] ?? '';

if ($action === 'login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $username = $data['username'] ?? '';
    $password = $data['password'] ?? '';

    $stmt = $pdo->prepare("SELECT * FROM accounts WHERE username = ?");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password_hash'])) {
        // Prefer the linked user_id from the 'users' table, fall back to account ID if none (e.g. for admin)
        // Fetch serial number if this is an intern
        $serialNumber = null;
        if (!empty($user['user_id'])) {
            $stmtUser = $pdo->prepare("SELECT serial_number, is_archived FROM users WHERE id = ?");
            $stmtUser->execute([$user['user_id']]);
            $u = $stmtUser->fetch();
            if ($u) {
                if ($u['is_archived'] == 1) {
                    http_response_code(403);
                    echo json_encode(['status' => 'error', 'message' => 'This account has been archived. Portal access is disabled.']);
                    exit;
                }
                $serialNumber = $u['serial_number'];
            }
        }

        $_SESSION['user_id'] = !empty($user['user_id']) ? $user['user_id'] : $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['role'] = $user['role'];
        
        echo json_encode([
            'status' => 'success', 
            'role' => $user['role'],
            'serial_number' => $serialNumber,
            'redirect' => ($user['role'] === 'admin' ? 'admin.html' : 'index.html')
        ]);
    } else {
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Invalid username or password.']);
    }
} else if ($action === 'loginByBarcode' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $serial = $data['serial_number'] ?? '';

    // Find user by serial
    $stmt = $pdo->prepare("SELECT id, full_name, is_archived FROM users WHERE serial_number = ?");
    $stmt->execute([$serial]);
    $user = $stmt->fetch();

    if ($user) {
        if ($user['is_archived'] == 1) {
            http_response_code(403);
            echo json_encode(['status' => 'error', 'message' => 'This account has been archived. Portal access is disabled.']);
            exit;
        }
        // Check if an account exists for this user
        $stmt = $pdo->prepare("SELECT * FROM accounts WHERE user_id = ?");
        $stmt->execute([$user['id']]);
        $account = $stmt->fetch();

        if ($account) {
            $_SESSION['user_id'] = $user['id']; // Use the user ID, not the account ID
            $_SESSION['username'] = $account['username'];
            $_SESSION['role'] = $account['role'];
            
            echo json_encode([
                'status' => 'success', 
                'role' => $account['role'],
                'redirect' => ($account['role'] === 'admin' ? 'admin.html' : 'index.html')
            ]);
        } else {
            // No account setup yet, but user exists. 
            // In this system, we might want to redirect them to a setup page or just log them in as a default intern role if applicable.
            // For now, let's treat it as success if they are a valid intern.
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['username'] = $user['full_name'];
            $_SESSION['role'] = 'intern';
            
            echo json_encode([
                'status' => 'success', 
                'role' => 'intern',
                'redirect' => 'index.html'
            ]);
        }
    } else {
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Invalid or unrecognized barcode.']);
    }
} else if ($action === 'check_account') {
    $userId = $_GET['user_id'] ?? '';
    $stmt = $pdo->prepare("SELECT id FROM accounts WHERE user_id = ?");
    $stmt->execute([$userId]);
    if ($stmt->fetch()) {
        echo json_encode(['status' => 'exists']);
    } else {
        echo json_encode(['status' => 'missing']);
    }
} else if ($action === 'setup_account' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $userId = $data['user_id'] ?? '';
    $password = $data['password'] ?? '';
    $fullName = $data['full_name'] ?? 'Intern';
    
    // Check if already exists
    $stmt = $pdo->prepare("SELECT id FROM accounts WHERE user_id = ?");
    $stmt->execute([$userId]);
    if ($stmt->fetch()) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Account already exists.']);
        exit;
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    // We'll use the full name as a default username if not provided
    $username = strtolower(str_replace(' ', '.', $fullName));
    
    $stmt = $pdo->prepare("INSERT INTO accounts (user_id, username, password_hash, role) VALUES (?, ?, ?, 'intern')");
    $stmt->execute([$userId, $username, $hash]);
    
    echo json_encode(['status' => 'success', 'message' => 'Account secured!']);
} else if ($action === 'verify_account' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $userId = $data['user_id'] ?? '';
    $password = $data['password'] ?? '';

    $stmt = $pdo->prepare("SELECT password_hash FROM accounts WHERE user_id = ?");
    $stmt->execute([$userId]);
    $acc = $stmt->fetch();

    if ($acc && password_verify($password, $acc['password_hash'])) {
        echo json_encode(['status' => 'success']);
    } else {
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Incorrect password.']);
    }
} else if ($action === 'check') {
    if (isset($_SESSION['user_id'])) {
        $serialNumber = null;
        if ($_SESSION['role'] === 'intern') {
            $stmt = $pdo->prepare("SELECT serial_number, is_archived FROM users WHERE id = ?");
            $stmt->execute([$_SESSION['user_id']]);
            $u = $stmt->fetch();
            if ($u) {
                if ($u['is_archived'] == 1) {
                    session_destroy();
                    http_response_code(403);
                    echo json_encode(['status' => 'error', 'message' => 'Your account has been archived. Portal session terminated.']);
                    exit;
                }
                $serialNumber = $u['serial_number'];
            }
        }
        echo json_encode([
            'status' => 'success', 
            'id' => $_SESSION['user_id'],
            'username' => $_SESSION['username'], 
            'role' => $_SESSION['role'],
            'serial_number' => $serialNumber
        ]);
    } else {
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Not authenticated.']);
    }
} else if ($action === 'logout') {
    session_destroy();
    echo json_encode(['status' => 'success']);
} else if ($action === 'deleteUser' && $_SESSION['role'] === 'admin') {
    $id = $_GET['id'] ?? '';
    if (!$id) {
        echo json_encode(['status' => 'error', 'message' => 'Missing ID.']);
        exit;
    }

    try {
        $pdo->beginTransaction();
        // Delete from attendance
        $stmt = $pdo->prepare("DELETE FROM attendance WHERE user_id = ?");
        $stmt->execute([$id]);
        
        // Delete from requests
        $stmt = $pdo->prepare("DELETE FROM attendance_requests WHERE user_id = ?");
        $stmt->execute([$id]);

        // Delete from accounts
        $stmt = $pdo->prepare("DELETE FROM accounts WHERE user_id = ?");
        $stmt->execute([$id]);

        // Finally delete the user
        $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
        $stmt->execute([$id]);

        $pdo->commit();
        echo json_encode(['status' => 'success', 'message' => 'Intern deleted successfully.']);
    } catch (Exception $e) {
        $pdo->rollBack();
        echo json_encode(['status' => 'error', 'message' => 'Deletion failed: ' . $e->getMessage()]);
    }
}

// Flush only the clean JSON output
$json = ob_get_clean();
echo $json;
?>
