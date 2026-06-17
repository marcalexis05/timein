<?php
session_start();
date_default_timezone_set('Asia/Manila');
header('Content-Type: application/json');
ob_start();
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/smtp_config.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

function calculateBreakOverlap($start, $end) {
    $startTimestamp = is_numeric($start) ? (int)$start : strtotime($start);
    $endTimestamp = is_numeric($end) ? (int)$end : strtotime($end);
    if (!$startTimestamp || !$endTimestamp || $startTimestamp >= $endTimestamp) {
        return 0;
    }
    
    $totalOverlapSec = 0;
    
    $startDateStr = date('Y-m-d', $startTimestamp);
    $endDateStr = date('Y-m-d', $endTimestamp);
    
    $currentDate = new DateTime($startDateStr);
    $endDateLimit = new DateTime($endDateStr);
    $endDateLimit->modify('+1 day');
    
    while ($currentDate < $endDateLimit) {
        $dateStr = $currentDate->format('Y-m-d');
        
        // Break 1: 12 MN - 1 AM
        $b1Start = strtotime($dateStr . ' 00:00:00');
        $b1End = strtotime($dateStr . ' 01:00:00');
        
        // Break 2: 12 NN - 1 PM
        $b2Start = strtotime($dateStr . ' 12:00:00');
        $b2End = strtotime($dateStr . ' 13:00:00');
        
        $overlap1 = max(0, min($endTimestamp, $b1End) - max($startTimestamp, $b1Start));
        $overlap2 = max(0, min($endTimestamp, $b2End) - max($startTimestamp, $b2Start));
        
        $totalOverlapSec += ($overlap1 + $overlap2);
        
    }
    return $totalOverlapSec;
}

function sendAutoTimeoutEmail($email, $fullName, $date, $timeIn, $timeOut) {
    if (empty($email)) return;
    require_once __DIR__ . '/PHPMailer/src/Exception.php';
    require_once __DIR__ . '/PHPMailer/src/PHPMailer.php';
    require_once __DIR__ . '/PHPMailer/src/SMTP.php';
    
    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host       = SMTP_HOST;
        $mail->SMTPAuth   = true;
        $mail->Username   = SMTP_USER;
        $mail->Password   = SMTP_PASS;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = SMTP_PORT;
        $mail->SMTPOptions = array(
            'ssl' => array(
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true
            )
        );

        $mail->setFrom(SMTP_USER, 'Concentrix Attendance System');
        $mail->addAddress($email, $fullName);
        $mail->isHTML(true);
        $mail->Subject = 'Auto Time-Out Alert - ' . $fullName;

        $logoPath = dirname(__DIR__) . '/assets/logo.png';
        $logoSrc = '';
        if (file_exists($logoPath)) {
            $mail->addEmbeddedImage($logoPath, 'logo');
            $logoSrc = 'cid:logo';
        }

        $formattedTimeIn = date('h:i A', strtotime($timeIn));
        $formattedTimeOut = date('h:i A', strtotime($timeOut));
        $formattedDate = date('F j, Y', strtotime($date));

        $mail->Body = "
            <html>
            <body style='font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif; padding: 0; margin: 0; background-color: #f4f7fa;'>
                <div style='width: 95%; max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;'>
                    <div style='background-color: #ffffff; padding: 45px 45px 20px; text-align: center; border-bottom: 1px solid #f1f5f9;'>
                        " . ($logoSrc ? "<img src='$logoSrc' alt='Concentrix' style='height: 60px; object-fit: contain;'>" : "<h1 style='color: #002f6c; margin: 0;'>Concentrix</h1>") . "
                    </div>
                    <div style='padding: 40px; text-align: center;'>
                        <h2 style='color: #e53e3e; margin: 0; font-size: 22px; font-weight: 800;'>FORGOT TO TIME-OUT NOTICE</h2>
                        <p style='color: #4a5568; font-size: 15px; line-height: 1.6; margin-top: 20px;'>
                            Hello <strong>{$fullName}</strong>,<br><br>
                            Our system detected that you did not Time Out for your shift on <strong>{$formattedDate}</strong>. 
                            As a result, you have been <strong>automatically timed out</strong> after 12 hours.
                        </p>
                        <div style='background-color: #f7fafc; padding: 20px; border-radius: 16px; margin: 30px 0; text-align: left;'>
                            <p style='margin: 5px 0; font-size: 14px; color: #4a5568;'><strong>Date:</strong> {$formattedDate}</p>
                            <p style='margin: 5px 0; font-size: 14px; color: #4a5568;'><strong>Time In:</strong> {$formattedTimeIn}</p>
                            <p style='margin: 5px 0; font-size: 14px; color: #4a5568;'><strong>Auto Time Out:</strong> {$formattedTimeOut} (12 Hrs Duration)</p>
                        </div>
                        <p style='color: #718096; font-size: 13px; line-height: 1.6;'>
                            To correct this log, please log in to the Intern Portal, locate the warning icon next to the 12 hrs duration on your dashboard or attendance history, and submit a <strong>Time Adjustment Request</strong> with your actual Time Out and the reason.
                        </p>
                    </div>
                    <div style='background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #f1f5f9;'>
                        <p style='margin: 0; color: #94a3b8; font-size: 10px; font-weight: 600;'>Concentrix IT Department &bull; &copy; " . date('Y') . "</p>
                    </div>
                </div>
            </body>
            </html>
        ";
        $mail->send();
    } catch (\Throwable $e) {
        error_log("Failed to send auto timeout email: " . $e->getMessage());
    }
}

function sendAdjustmentEmail($email, $fullName, $date, $timeIn, $timeOut, $status, $remarks, $requestType = 'edit') {
    if (empty($email)) return;
    require_once __DIR__ . '/PHPMailer/src/Exception.php';
    require_once __DIR__ . '/PHPMailer/src/PHPMailer.php';
    require_once __DIR__ . '/PHPMailer/src/SMTP.php';
    
    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host       = SMTP_HOST;
        $mail->SMTPAuth   = true;
        $mail->Username   = SMTP_USER;
        $mail->Password   = SMTP_PASS;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = SMTP_PORT;
        $mail->SMTPOptions = array(
            'ssl' => array(
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true
            )
        );

        $mail->setFrom(SMTP_USER, 'Concentrix Attendance System');
        $mail->addAddress($email, $fullName);
        $mail->isHTML(true);
        $statusUpper = strtoupper($status);
        $subjectType = ($requestType === 'delete') ? "Deletion" : "Adjustment";
        $mail->Subject = "Time $subjectType Request $statusUpper - " . $fullName;

        $logoPath = dirname(__DIR__) . '/assets/logo.png';
        $logoSrc = '';
        if (file_exists($logoPath)) {
            $mail->addEmbeddedImage($logoPath, 'logo');
            $logoSrc = 'cid:logo';
        }

        $formattedTimeIn = date('h:i A', strtotime($timeIn));
        $formattedTimeOut = date('h:i A', strtotime($timeOut));
        $formattedDate = date('F j, Y', strtotime($date));

        $statusColor = $status === 'approved' ? '#38a169' : '#e53e3e';
        $remarksHtml = !empty($remarks) ? "<p style='margin-top: 15px; color: #4a5568; font-size: 14px;'><strong>Admin Remarks:</strong> \"{$remarks}\"</p>" : "";

        $titleText = ($requestType === 'delete') ? "TIME DELETION REQUEST " . strtoupper($status) : "TIME ADJUSTMENT REQUEST " . strtoupper($status);
        
        $bodyIntro = ($requestType === 'delete') 
            ? "Your request to delete the attendance record on <strong>{$formattedDate}</strong> has been <strong>{$status}</strong>."
            : "Your time adjustment request for <strong>{$formattedDate}</strong> has been <strong>{$status}</strong>.";

        if ($requestType === 'delete') {
            $detailsHtml = "
                <p style='margin: 5px 0; font-size: 14px; color: #4a5568;'><strong>Date:</strong> {$formattedDate}</p>
                <p style='margin: 5px 0; font-size: 14px; color: #e53e3e; font-weight: bold;'><strong>Action Requested:</strong> Delete Attendance Record</p>
            ";
        } else {
            $detailsHtml = "
                <p style='margin: 5px 0; font-size: 14px; color: #4a5568;'><strong>Date:</strong> {$formattedDate}</p>
                <p style='margin: 5px 0; font-size: 14px; color: #4a5568;'><strong>Requested Time In:</strong> {$formattedTimeIn}</p>
                <p style='margin: 5px 0; font-size: 14px; color: #4a5568;'><strong>Requested Time Out:</strong> {$formattedTimeOut}</p>
            ";
        }

        $mail->Body = "
            <html>
            <body style='font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif; padding: 0; margin: 0; background-color: #f4f7fa;'>
                <div style='width: 95%; max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;'>
                    <div style='background-color: #ffffff; padding: 45px 45px 20px; text-align: center; border-bottom: 1px solid #f1f5f9;'>
                        " . ($logoSrc ? "<img src='$logoSrc' alt='Concentrix' style='height: 60px; object-fit: contain;'>" : "<h1 style='color: #002f6c; margin: 0;'>Concentrix</h1>") . "
                    </div>
                    <div style='padding: 40px; text-align: center;'>
                        <h2 style='color: {$statusColor}; margin: 0; font-size: 22px; font-weight: 800;'>{$titleText}</h2>
                        <p style='color: #4a5568; font-size: 15px; line-height: 1.6; margin-top: 20px;'>
                            Hello <strong>{$fullName}</strong>,<br><br>
                            {$bodyIntro}
                        </p>
                        <div style='background-color: #f7fafc; padding: 20px; border-radius: 16px; margin: 30px 0; text-align: left;'>
                            {$detailsHtml}
                        </div>
                        {$remarksHtml}
                    </div>
                    <div style='background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #f1f5f9;'>
                        <p style='margin: 0; color: #94a3b8; font-size: 10px; font-weight: 600;'>Concentrix IT Department &bull; &copy; " . date('Y') . "</p>
                    </div>
                </div>
            </body>
            </html>
        ";
        $mail->send();
    } catch (\Throwable $e) {
        error_log("Failed to send adjustment email: " . $e->getMessage());
    }
}


function checkAndApplyAutoTimeouts($pdo) {
    try {
        $stmt = $pdo->prepare("
            SELECT a.id as attendance_id, a.user_id, a.date, a.time_in, u.full_name, u.email
            FROM attendance a
            JOIN users u ON a.user_id = u.id
            WHERE a.time_out IS NULL 
            AND TIMESTAMPDIFF(SECOND, CONCAT(a.date, ' ', a.time_in), NOW()) >= 43200
        ");
        $stmt->execute();
        $records = $stmt->fetchAll();

        foreach ($records as $row) {
            $timeInTimestamp = strtotime($row['date'] . ' ' . $row['time_in']);
            $autoTimeoutTime = date('H:i:s', $timeInTimestamp + 43200);
            
            $update = $pdo->prepare("UPDATE attendance SET time_out = ? WHERE id = ?");
            $update->execute([$autoTimeoutTime, $row['attendance_id']]);

            sendAutoTimeoutEmail($row['email'], $row['full_name'], $row['date'], $row['time_in'], $autoTimeoutTime);
        }
    } catch (\Throwable $e) {
        error_log("Error applying auto timeouts: " . $e->getMessage());
    }
}

checkAndApplyAutoTimeouts($pdo);

$action = $_GET['action'] ?? '';

if (($action === 'record' || $action === 'recordBySerial') && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $userId = $data['user_id'] ?? null;
    $serialNumber = $data['serial_number'] ?? null;
    $type = $data['type'] ?? null; // 'in' or 'out'

    if ($action === 'recordBySerial' && $serialNumber) {
        $stmt = $pdo->prepare("SELECT id, is_archived FROM users WHERE serial_number = ?");
        $stmt->execute([$serialNumber]);
        $user = $stmt->fetch();
        if (!$user) {
            http_response_code(404);
            echo json_encode(['status' => 'error', 'message' => 'Invalid Serial Number.']);
            exit;
        }
        if ($user['is_archived'] == 1) {
            http_response_code(403);
            echo json_encode(['status' => 'error', 'message' => 'This account has been archived. Scanning is disabled.']);
            exit;
        }
        $userId = $user['id'];
    } else if ($userId) {
        $stmt = $pdo->prepare("SELECT is_archived FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        if ($user && $user['is_archived'] == 1) {
            http_response_code(403);
            echo json_encode(['status' => 'error', 'message' => 'This account has been archived. Scanning is disabled.']);
            exit;
        }
    }

    if ($userId && $type) {
        
        // PHP default timezone should ideally be set, or rely on MySQL if needed.
        // Assuming server timezone matches local requirement.
        date_default_timezone_set('Asia/Manila'); // Set to default reasonable timezone, can be adjusted
        
        $currentDate = date('Y-m-d');
        $currentTime = date('H:i:s');
        
        // Check if there's an open session (no time_out)
        $stmt = $pdo->prepare("SELECT * FROM attendance WHERE user_id = ? AND time_out IS NULL ORDER BY date DESC, time_in DESC LIMIT 1");
        $stmt->execute([$userId]);
        $openRecord = $stmt->fetch();
        
        // Also check if there's any record for today
        $stmt = $pdo->prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?");
        $stmt->execute([$userId, $currentDate]);
        $todayRecord = $stmt->fetch();
        
        // Check if the open session is expired (older than 24 hours)
        $isExpired = false;
        if ($openRecord) {
            $startTime = strtotime($openRecord['date'] . ' ' . $openRecord['time_in']);
            if (time() - $startTime >= 86400) { // 24 hours
                $isExpired = true;
            }
        }

        // Handle 'auto' type for physical scanners
        if ($type === 'auto') {
            if (!$todayRecord && (!$openRecord || $isExpired)) {
                $type = 'in';
            } else if ($openRecord && !$isExpired) {
                $type = 'out';
            } else if ($todayRecord && $todayRecord['time_out']) {
                http_response_code(400);
                echo json_encode(['status' => 'error', 'message' => 'Shift already completed for today.']);
                exit;
            } else if ($isExpired) {
                // If the only open record is expired, force a new Time In for today if not already timed in
                if ($todayRecord) {
                    http_response_code(400);
                    echo json_encode(['status' => 'error', 'message' => 'Previous session expired. Please contact admin.']);
                    exit;
                }
                $type = 'in';
            }
        }
        
        if ($type === 'in') {
            if ($todayRecord) {
                http_response_code(400);
                echo json_encode(['status' => 'error', 'message' => 'Already timed in today.']);
            } else {
                $stmt = $pdo->prepare("INSERT INTO attendance (user_id, date, time_in) VALUES (?, ?, ?)");
                $stmt->execute([$userId, $currentDate, $currentTime]);
                echo json_encode(['status' => 'success', 'message' => 'Time In successful!', 'type' => 'in']);
            }
        } else if ($type === 'out') {
            if (!$openRecord || $isExpired) {
                http_response_code(400);
                $msg = $isExpired ? 'Session expired (over 24hrs). Please Time In again.' : 'Please Time In first before Timing Out.';
                echo json_encode(['status' => 'error', 'message' => $msg]);
            } else {
                // Check for 1 hour minimum duration
                $timeIn = strtotime($openRecord['date'] . ' ' . $openRecord['time_in']);
                $timeNow = time();
                $diffSeconds = $timeNow - $timeIn;
                
                if ($diffSeconds < 3600) {
                    $minutesRemaining = ceil((3600 - $diffSeconds) / 60);
                    http_response_code(400);
                    echo json_encode(['status' => 'error', 'message' => "Minimum 1 hour of work required. Please wait $minutesRemaining more minutes."]);
                } else {
                    $stmt = $pdo->prepare("UPDATE attendance SET time_out = ? WHERE id = ?");
                    $stmt->execute([$currentTime, $openRecord['id']]);
                    echo json_encode(['status' => 'success', 'message' => 'Time Out successful!', 'type' => 'out']);
                }
            }
        } else {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Invalid type.']);
        }
    } else {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Missing parameters.']);
    }
} else if ($action === 'history' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $specificDate = $_GET['date'] ?? null;
    $month = $_GET['month'] ?? date('m');
    $year = $_GET['year'] ?? date('Y');
    $userId = $_GET['user_id'] ?? null;
    $allMode = (isset($_GET['all']) && $_GET['all'] == '1') || $month === 'all';

    $params = [];
    if ($specificDate) {
        // Master List Mode: Show all users and their logs for this date
        $query = "
            SELECT 
                u.id as user_id,
                u.full_name,
                u.serial_number,
                a.id as attendance_id,
                ? as raw_date,
                DATE_FORMAT(?, '%M %d, %Y') as formatted_date,
                a.time_in as raw_time_in,
                a.time_out as raw_time_out,
                IFNULL(TIME_FORMAT(a.time_in, '%h:%i %p'), '--:--') as formatted_time_in,
                IFNULL(TIME_FORMAT(a.time_out, '%h:%i %p'), '--:--') as formatted_time_out,
                CASE 
                    WHEN a.time_in IS NULL AND ? < CURRENT_DATE() THEN 1
                    WHEN a.time_in IS NOT NULL AND a.time_out IS NULL AND TIMESTAMPDIFF(HOUR, CONCAT(a.date, ' ', a.time_in), NOW()) >= 24 THEN 1
                    ELSE 0
                END as is_absent,
                CASE 
                    WHEN a.time_in IS NOT NULL AND a.time_out IS NULL AND TIMESTAMPDIFF(HOUR, CONCAT(a.date, ' ', a.time_in), NOW()) >= 24 THEN 0
                    WHEN a.time_out < a.time_in THEN 86400 + TIME_TO_SEC(TIMEDIFF(a.time_out, a.time_in))
                    ELSE TIME_TO_SEC(TIMEDIFF(a.time_out, a.time_in))
                END as total_seconds
            FROM users u
            LEFT JOIN attendance a ON u.id = a.user_id AND a.date = ?
            WHERE 1=1
        ";
        $params[] = $specificDate;
        $params[] = $specificDate;
        $params[] = $specificDate;
        $params[] = $specificDate;
        
        if ($userId) {
            $query .= " AND u.id = ?";
            $params[] = $userId;
        } else {
            $query .= " AND u.is_archived != 1";
        }
    } else {
        // Month Mode: Only show users with logs
        $query = "
            SELECT 
                u.id as user_id,
                u.full_name,
                u.serial_number,
                a.id as attendance_id,
                a.date as raw_date,
                DATE_FORMAT(a.date, '%M %d, %Y') as formatted_date,
                a.time_in as raw_time_in,
                a.time_out as raw_time_out,
                IFNULL(TIME_FORMAT(a.time_in, '%h:%i %p'), '--:--') as formatted_time_in,
                IFNULL(TIME_FORMAT(a.time_out, '%h:%i %p'), '--:--') as formatted_time_out,
                CASE 
                    WHEN a.time_in IS NULL AND a.date < CURRENT_DATE() THEN 1
                    WHEN a.time_in IS NOT NULL AND a.time_out IS NULL AND TIMESTAMPDIFF(HOUR, CONCAT(a.date, ' ', a.time_in), NOW()) >= 24 THEN 1
                    ELSE 0
                END as is_absent,
                CASE 
                    WHEN a.time_in IS NOT NULL AND a.time_out IS NULL AND TIMESTAMPDIFF(HOUR, CONCAT(a.date, ' ', a.time_in), NOW()) >= 24 THEN 0
                    WHEN a.time_out < a.time_in THEN 86400 + TIME_TO_SEC(TIMEDIFF(a.time_out, a.time_in))
                    ELSE TIME_TO_SEC(TIMEDIFF(a.time_out, a.time_in))
                END as total_seconds
            FROM attendance a
            JOIN users u ON a.user_id = u.id
            WHERE 1=1
        ";
        
        if (!$allMode) {
            $query .= " AND MONTH(a.date) = ? AND YEAR(a.date) = ?";
            $params[] = $month;
            $params[] = $year;
        }

        if ($userId) {
            $query .= " AND a.user_id = ?";
            $params[] = $userId;
        } else {
            $query .= " AND u.is_archived != 1";
        }
    }
    
    if ($userId) {
        $query .= " ORDER BY a.date ASC, a.time_in ASC";
    } else {
        $query .= " ORDER BY u.full_name ASC, a.date DESC";
    }
    
    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    $history = $stmt->fetchAll();
    
    foreach ($history as &$row) {
        if ($row['raw_time_in'] && $row['raw_time_out']) {
            $rawSeconds = (int)$row['total_seconds'];
            if ($rawSeconds === 43200) {
                $row['total_seconds'] = 43200;
            } else if ($rawSeconds >= 18000) {
                $row['total_seconds'] = max(0, $rawSeconds - 3600);
            } else {
                $row['total_seconds'] = max(0, $rawSeconds);
            }
        }
    }
    unset($row); // release reference — prevents last element being overwritten
    
    echo json_encode(['status' => 'success', 'history' => $history]);
} else if ($action === 'getHistoryBySerial' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $serial = $_GET['serial'] ?? null;
    if (!$serial) {
        echo json_encode(['status' => 'error', 'message' => 'Serial number required']);
        exit;
    }

    $uStmt = $pdo->prepare("SELECT id, full_name, is_archived FROM users WHERE serial_number = ?");
    $uStmt->execute([$serial]);
    $user = $uStmt->fetch();

    if (!$user) {
        echo json_encode(['status' => 'error', 'message' => 'Invalid serial number']);
        exit;
    }

    if ($user['is_archived'] == 1) {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'This account has been archived. History viewing is disabled.']);
        exit;
    }

    $filterDate = $_GET['date'] ?? null;

    $query = "
        SELECT 
            MIN(a.id) as attendance_id,
            u.full_name,
            a.date as raw_date,
            DATE_FORMAT(a.date, '%M %d, %Y') as formatted_date,
            MIN(a.time_in) as raw_time_in,
            MAX(a.time_out) as raw_time_out,
            IFNULL(TIME_FORMAT(MIN(a.time_in), '%h:%i %p'), '--:--') as formatted_time_in,
            IFNULL(TIME_FORMAT(MAX(a.time_out), '%h:%i %p'), '--:--') as formatted_time_out,
            CASE 
                WHEN MIN(a.time_in) IS NULL AND a.date < CURRENT_DATE() THEN 1
                WHEN MIN(a.time_in) IS NOT NULL AND MAX(a.time_out) IS NULL AND TIMESTAMPDIFF(HOUR, CONCAT(a.date, ' ', MIN(a.time_in)), NOW()) >= 24 THEN 1
                ELSE 0
            END as is_absent,
            CASE 
                WHEN MIN(a.time_in) IS NOT NULL AND MAX(a.time_out) IS NULL AND TIMESTAMPDIFF(HOUR, CONCAT(a.date, ' ', MIN(a.time_in)), NOW()) >= 24 THEN 0
                WHEN MAX(a.time_out) < MIN(a.time_in) THEN 86400 + TIME_TO_SEC(TIMEDIFF(MAX(a.time_out), MIN(a.time_in)))
                ELSE TIME_TO_SEC(TIMEDIFF(MAX(a.time_out), MIN(a.time_in)))
            END as total_seconds
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        WHERE a.user_id = ?
    ";
    $params = [$user['id']];
    if ($filterDate) {
        $query .= " AND a.date = ?";
        $params[] = $filterDate;
    }
    $query .= " GROUP BY a.date ORDER BY a.date ASC";
    
    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    $history = $stmt->fetchAll();

    foreach ($history as &$row) {
        if ($row['raw_time_in'] && $row['raw_time_out']) {
            $rawSeconds = (int)$row['total_seconds'];
            if ($rawSeconds === 43200) {
                $row['total_seconds'] = 43200;
            } else if ($rawSeconds >= 18000) {
                $row['total_seconds'] = max(0, $rawSeconds - 3600);
            } else {
                $row['total_seconds'] = max(0, $rawSeconds);
            }
        }
    }
    unset($row); // release reference
    
    echo json_encode([
        'status' => 'success', 
        'intern_name' => $user['full_name'],
        'history' => $history
    ]);
} else if ($action === 'send_history_report' && $_SERVER['REQUEST_METHOD'] === 'POST') {

    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    $serial = $data['serial'] ?? '';

    if (!$serial) {
        echo json_encode(['status' => 'error', 'message' => 'Serial required']);
        exit;
    }
    $date = $data['date'] ?? null;

    $uStmt = $pdo->prepare("SELECT id, full_name, email FROM users WHERE serial_number = ?");
    $uStmt->execute([$serial]);
    $user = $uStmt->fetch();

    if (!$user) {
        echo json_encode(['status' => 'error', 'message' => 'Intern not found']);
        exit;
    }

    $query = "
        SELECT 
            a.date as pure_date,
            DATE_FORMAT(a.date, '%M %d, %Y') as formatted_date,
            MIN(a.time_in) as raw_time_in,
            MAX(a.time_out) as raw_time_out,
            IFNULL(TIME_FORMAT(MIN(a.time_in), '%h:%i %p'), '--:--') as formatted_time_in,
            IFNULL(TIME_FORMAT(MAX(a.time_out), '%h:%i %p'), '--:--') as formatted_time_out,
            CASE 
                WHEN MIN(a.time_in) IS NOT NULL AND MAX(a.time_out) IS NULL 
                     AND TIMESTAMPDIFF(HOUR, CONCAT(a.date, ' ', MIN(a.time_in)), NOW()) >= 24 THEN 0
                WHEN MAX(a.time_out) < MIN(a.time_in) THEN 86400 + TIME_TO_SEC(TIMEDIFF(MAX(a.time_out), MIN(a.time_in)))
                ELSE TIME_TO_SEC(TIMEDIFF(MAX(a.time_out), MIN(a.time_in)))
            END as total_seconds
        FROM attendance a
        WHERE a.user_id = ?
    ";
    $params = [$user['id']];
    if ($date) {
        $query .= " AND a.date = ?";
        $params[] = $date;
    }
    $query .= " GROUP BY a.date ORDER BY a.date ASC";
    
    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    $history = $stmt->fetchAll();

    foreach ($history as &$row) {
        if ($row['raw_time_in'] && $row['raw_time_out']) {
            $rawSeconds = (int)$row['total_seconds'];
            if ($rawSeconds === 43200) {
                $row['total_seconds'] = 43200;
            } else if ($rawSeconds >= 18000) {
                $row['total_seconds'] = max(0, $rawSeconds - 3600);
            } else {
                $row['total_seconds'] = max(0, $rawSeconds);
            }
        }
    }
    unset($row); // CRITICAL: release reference so the next foreach doesn't corrupt the last element

    $totalSeconds = 0;
    $rowsHtml = '';

    foreach ($history as $row) {
        $durText = '--';
        if ($row['total_seconds']) {
            if ((int)$row['total_seconds'] !== 43200) {
                $totalSeconds += (int)$row['total_seconds'];
            }
            $h = floor((int)$row['total_seconds'] / 3600);
            $m = floor(((int)$row['total_seconds'] % 3600) / 60);
            $durText = "{$h}h {$m}m";
        }

        $rowsHtml .= "
            <tr>
                <td style='padding: 12px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #4a5568;'>{$row['formatted_date']}</td>
                <td style='padding: 12px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #1a202c; font-weight: 800; text-align: center;'>" . ($row['formatted_time_in'] ?: '--:--') . "</td>
                <td style='padding: 12px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #1a202c; font-weight: 800; text-align: center;'>" . ($row['formatted_time_out'] ?: '--:--') . "</td>
                <td style='padding: 12px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: right; font-weight: 800; color: #002f6c;'>$durText</td>
            </tr>
        ";
    }

    $totalH = floor($totalSeconds / 3600);
    $totalM = floor(($totalSeconds % 3600) / 60);
    $totalStr = "{$totalH} Hours, {$totalM} Minutes";

    require_once __DIR__ . '/PHPMailer/src/Exception.php';
    require_once __DIR__ . '/PHPMailer/src/PHPMailer.php';
    require_once __DIR__ . '/PHPMailer/src/SMTP.php';

    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host       = SMTP_HOST;
        $mail->SMTPAuth   = true;
        $mail->Username   = SMTP_USER;
        $mail->Password   = SMTP_PASS;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = SMTP_PORT;
        $mail->SMTPOptions = array('ssl' => array('verify_peer' => false, 'verify_peer_name' => false, 'allow_self_signed' => true));

        $mail->setFrom(SMTP_USER, 'Concentrix Attendance System');
        $mail->addAddress($user['email'], $user['full_name']);
        $mail->isHTML(true);
        $mail->Subject = 'Attendance Report - ' . $user['full_name'];

        $logoPath = dirname(__DIR__) . '/assets/logo.png';
        if (file_exists($logoPath)) {
            $mail->addEmbeddedImage($logoPath, 'logo');
            $logoSrc = 'cid:logo';
        } else { $logoSrc = ''; }

        $mail->Body = "
            <html>
            <head>
                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                <style>
                    @media only screen and (max-width: 600px) {
                        .main-container { width: 95% !important; margin: 15px auto !important; border-radius: 16px !important; }
                        .header-padding { padding: 30px 20px 10px !important; }
                        .content-padding { padding: 0 20px 30px !important; }
                        .table-header { font-size: 8px !important; padding: 10px 5px !important; }
                        .table-cell { font-size: 11px !important; padding: 12px 5px !important; }
                        .total-label { font-size: 9px !important; }
                        .total-value { font-size: 15px !important; }
                        .title-h1 { font-size: 20px !important; }
                    }
                </style>
            </head>
            <body style='font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif; padding: 0; margin: 0; background-color: #f4f7fa;'>
                <div class='main-container' style='width: 95%; max-width: 700px; margin: 30px auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;'>
                    <!-- Branded Header -->
                    <div class='header-padding' style='background-color: #ffffff; padding: 45px 45px 20px; text-align: center;'>
                        " . ($logoSrc ? "<img src='$logoSrc' alt='Concentrix' style='height: 60px; margin-bottom: 15px; object-fit: contain;'>" : "<h1 style='color: #002f6c; margin: 0;'>Concentrix</h1>") . "
                        <h1 class='title-h1' style='color: #0f172a; margin: 0; font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; line-height: 1.2;'>Attendance History Report</h1>
                        <p style='color: #64748b; margin: 8px 0 0; text-transform: uppercase; font-size: 10px; font-weight: 700; letter-spacing: 2.5px;'>Cumulative History &bull; {$user['full_name']}</p>
                    </div>

                    <!-- Report Table -->
                    <div class='content-padding' style='padding: 20px 45px 45px;'>
                        <div style='border: 1px solid #f1f5f9; border-radius: 16px; overflow: hidden;'>
                            <table style='width: 100%; border-collapse: collapse; background-color: white; table-layout: fixed;'>
                                <thead>
                                    <tr style='background-color: #002f6c;'>
                                        <th class='table-header' style='width: 35%; text-align: left; padding: 15px 10px; color: #ffffff; text-transform: uppercase; font-size: 10px; font-weight: 700; letter-spacing: 1px;'>Date</th>
                                        <th class='table-header' style='width: 22.5%; text-align: center; padding: 15px 10px; color: #ffffff; text-transform: uppercase; font-size: 10px; font-weight: 700; letter-spacing: 1px;'>In</th>
                                        <th class='table-header' style='width: 22.5%; text-align: center; padding: 15px 10px; color: #ffffff; text-transform: uppercase; font-size: 10px; font-weight: 700; letter-spacing: 1px;'>Out</th>
                                        <th class='table-header' style='width: 20%; text-align: right; padding: 15px 10px; color: #ffffff; text-transform: uppercase; font-size: 10px; font-weight: 700; letter-spacing: 1px;'>Hrs</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    $rowsHtml
                                </tbody>
                                <tfoot>
                                    <tr style='background-color: #f8fafc;'>
                                        <td colspan='4' style='padding: 30px 20px; text-align: right;'>
                                            <p class='total-label' style='margin: 0; color: #64748b; text-transform: uppercase; font-size: 10px; font-weight: 900; letter-spacing: 1px;'>Total Journey Duration:</p>
                                            <h2 class='total-value' style='margin: 5px 0 0; color: #002f6c; font-weight: 900; font-size: 26px; line-height: 1;'>$totalStr</h2>
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <!-- Footer -->
                        <div style='margin-top: 40px; padding-top: 25px; border-top: 1px solid #f1f5f9; text-align: center;'>
                            <p style='margin: 0; color: #94a3b8; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px;'>Concentrix IT Department &bull; &copy; " . date('Y') . "</p>
                        </div>
                    </div>
                </div>
                <p style='text-align: center; color: #cbd5e0; font-size: 10px; margin-bottom: 40px; padding: 0 20px;'>This is a system-generated report. Please do not reply to this email.</p>
            </body>
            </html>
        ";

        $mail->send();
        ob_clean();
        echo json_encode(['status' => 'success', 'message' => 'History report sent to your Gmail!']);
    } catch (\Throwable $e) {
        ob_clean();
        echo json_encode(['status' => 'error', 'message' => 'Reporting Error: ' . $e->getMessage()]);
    }

} else if ($action === 'send_daily_report' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $date = $data['date'] ?? date('Y-m-d');
    $targetEmail = $data['email'] ?? '';

    if (empty($targetEmail)) {
        echo json_encode(['status' => 'error', 'message' => 'Target email is required.']);
        exit;
    }

    // Fetch all logs for this date
    $query = "
        SELECT 
            u.full_name,
            a.time_in,
            a.time_out,
            TIME_FORMAT(a.time_in, '%h:%i %p') as formatted_time_in,
            TIME_FORMAT(a.time_out, '%h:%i %p') as formatted_time_out,
            CASE 
                WHEN a.time_in IS NULL AND ? < CURRENT_DATE() THEN 1
                WHEN a.time_in IS NOT NULL AND a.time_out IS NULL AND TIMESTAMPDIFF(HOUR, CONCAT(a.date, ' ', a.time_in), NOW()) >= 24 THEN 1
                ELSE 0
            END as is_absent,
            CASE 
                WHEN a.time_in IS NOT NULL AND a.time_out IS NULL AND TIMESTAMPDIFF(HOUR, CONCAT(a.date, ' ', a.time_in), NOW()) >= 24 THEN 0
                ELSE TIME_TO_SEC(TIMEDIFF(a.time_out, a.time_in))
            END as total_seconds

        FROM users u
        INNER JOIN attendance a ON u.id = a.user_id
        WHERE a.date = ?
        ORDER BY u.full_name ASC
    ";

    $stmt = $pdo->prepare($query);
    $stmt->execute([$date, $date]);
    $logs = $stmt->fetchAll();

    foreach ($logs as &$row) {
        if ($row['time_in'] && $row['time_out']) {
            $rawSeconds = (int)$row['total_seconds'];
            if ($rawSeconds === 43200) {
                $row['total_seconds'] = 43200;
            } else if ($rawSeconds >= 18000) {
                $row['total_seconds'] = max(0, $rawSeconds - 3600);
            } else {
                $row['total_seconds'] = max(0, $rawSeconds);
            }
        }
    }

    if (!$logs) {
        echo json_encode(['status' => 'error', 'message' => 'No logs found for this date.']);
        exit;
    }

    require_once __DIR__ . '/PHPMailer/src/Exception.php';
    require_once __DIR__ . '/PHPMailer/src/PHPMailer.php';
    require_once __DIR__ . '/PHPMailer/src/SMTP.php';

    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host       = SMTP_HOST;
        $mail->SMTPAuth   = true;
        $mail->Username   = SMTP_USER;
        $mail->Password   = SMTP_PASS;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = SMTP_PORT;

        $mail->SMTPOptions = array(
            'ssl' => array(
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true
            )
        );

        $mail->setFrom(SMTP_USER, 'Concentrix Attendance System');
        $mail->addAddress($targetEmail);
        $mail->isHTML(true);
        $mail->Subject = 'Daily Attendance Report - ' . date('M d, Y', strtotime($date));

        // Embed the logo
        $logoPath = dirname(__DIR__) . '/assets/logo.png';
        $logoSrc = '';
        if (file_exists($logoPath)) {
            $mail->addEmbeddedImage($logoPath, 'logo');
            $logoSrc = 'cid:logo';
        }

        $rowsHtml = '';
        foreach ($logs as $row) {
            $dur = '--';
            if ($row['total_seconds']) {
                $h = floor($row['total_seconds'] / 3600);
                $m = floor(($row['total_seconds'] % 3600) / 60);
                $dur = ($h > 0 ? "{$h}h " : "") . "{$m}m";
            }
            $rowsHtml .= "
                <tr style='border-bottom: 1px solid #edf2f7;'>
                    <td class='table-cell' style='padding: 10px 5px; color: #718096; font-size: 10px;'>".date('M d', strtotime($date))."</td>
                    <td class='table-cell' style='padding: 10px 5px; color: #1a202c; font-weight: 600; word-break: break-word;'>{$row['full_name']}</td>
                    <td class='table-cell' style='padding: 10px 5px; color: #38a169; text-align: center;'>{$row['formatted_time_in']}</td>
                    <td class='table-cell' style='padding: 10px 5px; color: #e53e3e; text-align: center;'>".($row['formatted_time_out'] ?: '--:--')."</td>
                    <td class='table-cell' style='padding: 10px 5px; text-align: right; font-weight: 700; color: #4a5568;'>$dur</td>
                </tr>
            ";
        }

        $mail->Body = "
            <html>
            <head>
                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                <style>
                    @media only screen and (max-width: 600px) {
                        .main-container { width: 95% !important; margin: 10px auto !important; border-radius: 12px !important; }
                        .table-header { font-size: 8px !important; padding: 10px 5px !important; }
                        .table-cell { font-size: 11px !important; padding: 10px 5px !important; }
                        .title-h1 { font-size: 18px !important; }
                        .subtitle-p { font-size: 8px !important; }
                    }
                </style>
            </head>
            <body style='margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7fa;'>
                <div class='main-container' style='width: 100%; max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e1e8f0;'>
                    <div style='background-color: #ffffff; padding: 20px; text-align: center; border-bottom: 1px solid #f1f5f9;'>
                        " . ($logoSrc ? "<img src='$logoSrc' alt='Concentrix' style='height: 5rem; display: block; margin: 0 auto; object-fit: contain;'>" : "<h1>Concentrix</h1>") . "
                    </div>
                    <div style='background-color: #ffffff; padding: 15px 20px; text-align: center; border-bottom: 2px solid #f1f5f9;'>
                        <h1 class='title-h1' style='color: #002f6c; margin: 0; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;'>Daily Attendance Report</h1>
                        <p class='subtitle-p' style='color: #718096; margin: 5px 0 0; text-transform: uppercase; font-size: 9px; font-weight: 700; letter-spacing: 1px;'>" . date('M d, Y', strtotime($date)) . " &bull; Team Overview</p>
                    </div>
                    <div style='padding: 20px 10px;'>
                        <div style='border: 1px solid #edf2f7; border-radius: 12px; overflow: hidden;'>
                            <table style='width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed;'>
                                <thead>
                                    <tr style='background-color: #f8fafc;'>
                                        <th class='table-header' style='width: 20%; padding: 10px 5px; text-align: left; color: #718096; text-transform: uppercase; font-size: 8px;'>Date</th>
                                        <th class='table-header' style='width: 30%; padding: 10px 5px; text-align: left; color: #718096; text-transform: uppercase; font-size: 8px;'>Intern Name</th>
                                        <th class='table-header' style='width: 15%; padding: 10px 5px; text-align: center; color: #718096; text-transform: uppercase; font-size: 8px;'>Time In</th>
                                        <th class='table-header' style='width: 15%; padding: 10px 5px; text-align: center; color: #718096; text-transform: uppercase; font-size: 8px;'>Time Out</th>
                                        <th class='table-header' style='width: 20%; padding: 10px 5px; text-align: right; color: #718096; text-transform: uppercase; font-size: 8px;'>Duration</th>
                                    </tr>
                                </thead>
                                <tbody>$rowsHtml</tbody>
                                <tfoot>
                                    <tr style='background-color: #f8fafc; border-top: 3px solid #002f6c;'>
                                        <td colspan='3' style='padding: 20px 10px; text-align: right; color: #002f6c; text-transform: uppercase; font-size: 10px; font-weight: 900; letter-spacing: 1px;'>Total Daily Logs:</td>
                                        <td colspan='2' class='table-cell' style='padding: 20px 10px; text-align: right; color: #002f6c; font-weight: 900; font-size: 16px;'>" . count($logs) . " Records</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        <div style='margin-top: 30px; padding-top: 20px; border-top: 1px solid #edf2f7; text-align: center;'>
                            <p style='margin: 0; color: #a0aec0; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;'>Concentrix IT Department &bull; &copy; " . date('Y') . "</p>
                        </div>
                    </div>
                </div>
                <div style='text-align: center; padding: 20px; color: #cbd5e0; font-size: 10px;'>
                    This is an automated report generated by the Concentrix Attendance Portal.
                </div>
            </body>
            </html>";

        $mail->send();
        ob_clean();
        echo json_encode(['status' => 'success', 'message' => 'Daily report sent successfully!']);
    } catch (\Throwable $e) {
        ob_clean();
        echo json_encode(['status' => 'error', 'message' => 'Reporting Error: ' . $e->getMessage()]);
    }
} else if ($action === 'submitAdjustment' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $userId = $_SESSION['user_id'] ?? null;
    $serial = $data['serial'] ?? '';
    $date = $data['date'] ?? null;
    $requestType = $data['request_type'] ?? 'edit';
    $timeIn = $data['time_in'] ?? null;
    $timeOut = $data['time_out'] ?? null;
    $reason = $data['reason'] ?? '';

    if (!$userId) {
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Not authenticated. Please log in again.']);
        exit;
    }

    // If a serial is provided, resolve the real user_id from the 'users' table
    // This fixes the foreign key constraint error for shared accounts
    if (!empty($serial)) {
        $stmtUser = $pdo->prepare("SELECT id FROM users WHERE serial_number = ?");
        $stmtUser->execute([$serial]);
        $u = $stmtUser->fetch();
        if ($u) {
            $userId = $u['id'];
        }
    }

    if ($requestType === 'delete') {
        if (!$date) {
            echo json_encode(['status' => 'error', 'message' => 'Missing requested date.']);
            exit;
        }
        $timeIn = '00:00:00';
        $timeOut = '00:00:00';
    } else {
        if (!$date || !$timeIn || !$timeOut) {
            echo json_encode(['status' => 'error', 'message' => 'Missing required fields.']);
            exit;
        }
    }

    try {
        // Ensure request_type column exists
        try {
            $stmtCheck = $pdo->query("SHOW COLUMNS FROM attendance_requests LIKE 'request_type'");
            if ($stmtCheck->rowCount() == 0) {
                $pdo->exec("ALTER TABLE attendance_requests ADD COLUMN request_type ENUM('edit', 'delete') DEFAULT 'edit'");
            }
        } catch (PDOException $ex) {
            // Table may not exist yet, handled by CREATE TABLE below
        }

        // Auto-create table if it doesn't exist yet
        $pdo->exec("CREATE TABLE IF NOT EXISTS attendance_requests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            requested_date DATE NOT NULL,
            time_in TIME NOT NULL,
            time_out TIME NOT NULL,
            reason TEXT,
            status ENUM('pending','approved','rejected') DEFAULT 'pending',
            admin_remarks TEXT,
            request_type ENUM('edit', 'delete') DEFAULT 'edit',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )");

        $stmt = $pdo->prepare("INSERT INTO attendance_requests (user_id, requested_date, time_in, time_out, reason, request_type) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$userId, $date, $timeIn, $timeOut, $reason, $requestType]);
        echo json_encode(['status' => 'success', 'message' => 'Request submitted for approval.']);
    } catch (PDOException $e) {
        echo json_encode(['status' => 'error', 'message' => 'Failed to submit request: ' . $e->getMessage()]);
    }
} else if ($action === 'getPendingRequests' && $_SESSION['role'] === 'admin') {
    try {
        // Ensure request_type column exists
        try {
            $stmtCheck = $pdo->query("SHOW COLUMNS FROM attendance_requests LIKE 'request_type'");
            if ($stmtCheck->rowCount() == 0) {
                $pdo->exec("ALTER TABLE attendance_requests ADD COLUMN request_type ENUM('edit', 'delete') DEFAULT 'edit'");
            }
        } catch (PDOException $ex) {
            // Table may not exist yet, handled by CREATE TABLE below
        }

        $pdo->exec("CREATE TABLE IF NOT EXISTS attendance_requests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            requested_date DATE NOT NULL,
            time_in TIME NOT NULL,
            time_out TIME NOT NULL,
            reason TEXT,
            status ENUM('pending','approved','rejected') DEFAULT 'pending',
            admin_remarks TEXT,
            request_type ENUM('edit', 'delete') DEFAULT 'edit',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )");
        $stmt = $pdo->query("SELECT r.*, u.full_name, 
                             TIME_FORMAT(r.time_in, '%h:%i %p') as formatted_time_in,
                             TIME_FORMAT(r.time_out, '%h:%i %p') as formatted_time_out
                             FROM attendance_requests r 
                             JOIN users u ON r.user_id = u.id 
                             WHERE r.status = 'pending' 
                             ORDER BY r.created_at DESC");
        $requests = $stmt->fetchAll();
        echo json_encode(['status' => 'success', 'requests' => $requests]);
    } catch (PDOException $e) {
        echo json_encode(['status' => 'error', 'message' => 'Failed to fetch requests.']);
    }
} else if ($action === 'handleAdjustment' && $_SESSION['role'] === 'admin') {
    $data = json_decode(file_get_contents('php://input'), true);
    $requestId = $data['id'] ?? null;
    $decision = $data['decision'] ?? null; // 'approved' or 'rejected'
    $remarks = $data['remarks'] ?? '';

    if (!$requestId || !in_array($decision, ['approved', 'rejected'])) {
        echo json_encode(['status' => 'error', 'message' => 'Invalid parameters.']);
        exit;
    }

    try {
        $pdo->beginTransaction();
        
        $stmt = $pdo->prepare("SELECT * FROM attendance_requests WHERE id = ?");
        $stmt->execute([$requestId]);
        $request = $stmt->fetch();

        if (!$request) throw new Exception("Request not found.");

        if ($decision === 'approved') {
            if (($request['request_type'] ?? 'edit') === 'delete') {
                // Delete the attendance record
                $stmtDel = $pdo->prepare("DELETE FROM attendance WHERE user_id = ? AND date = ?");
                $stmtDel->execute([$request['user_id'], $request['requested_date']]);
            } else {
                // Find or update the attendance record
                $stmtAtt = $pdo->prepare("SELECT id FROM attendance WHERE user_id = ? AND date = ?");
                $stmtAtt->execute([$request['user_id'], $request['requested_date']]);
                $att = $stmtAtt->fetch();

                if ($att) {
                    $stmtUpd = $pdo->prepare("UPDATE attendance SET time_in = ?, time_out = ? WHERE id = ?");
                    $stmtUpd->execute([$request['time_in'], $request['time_out'], $att['id']]);
                } else {
                    $stmtIns = $pdo->prepare("INSERT INTO attendance (user_id, date, time_in, time_out) VALUES (?, ?, ?, ?)");
                    $stmtIns->execute([$request['user_id'], $request['requested_date'], $request['time_in'], $request['time_out']]);
                }
            }
        }

        $stmt = $pdo->prepare("UPDATE attendance_requests SET status = ?, admin_remarks = ? WHERE id = ?");
        $stmt->execute([$decision, $remarks, $requestId]);
        
        $pdo->commit();

        // Fetch user info for sending notification email
        $stmtUser = $pdo->prepare("SELECT email, full_name FROM users WHERE id = ?");
        $stmtUser->execute([$request['user_id']]);
        $user = $stmtUser->fetch();

        if ($user) {
            sendAdjustmentEmail($user['email'], $user['full_name'], $request['requested_date'], $request['time_in'], $request['time_out'], $decision, $remarks, $request['request_type'] ?? 'edit');
        }

        echo json_encode(['status' => 'success', 'message' => 'Request ' . $decision . ' successfully.']);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        echo json_encode(['status' => 'error', 'message' => 'Action failed: ' . $e->getMessage()]);
    }
} else if ($action === 'handleBulkAdjustment' && $_SESSION['role'] === 'admin') {
    $data = json_decode(file_get_contents('php://input'), true);
    $requestIds = $data['ids'] ?? null;
    $decision = $data['decision'] ?? null; // 'approved' or 'rejected'
    $remarks = $data['remarks'] ?? '';

    if (!is_array($requestIds) || empty($requestIds) || !in_array($decision, ['approved', 'rejected'])) {
        echo json_encode(['status' => 'error', 'message' => 'Invalid parameters.']);
        exit;
    }

    try {
        $pdo->beginTransaction();
        
        $processedRequests = [];

        foreach ($requestIds as $requestId) {
            $stmt = $pdo->prepare("SELECT * FROM attendance_requests WHERE id = ?");
            $stmt->execute([$requestId]);
            $request = $stmt->fetch();

            if (!$request) {
                continue;
            }
            if ($request['status'] !== 'pending') {
                continue;
            }

            if ($decision === 'approved') {
                if (($request['request_type'] ?? 'edit') === 'delete') {
                    // Delete the attendance record
                    $stmtDel = $pdo->prepare("DELETE FROM attendance WHERE user_id = ? AND date = ?");
                    $stmtDel->execute([$request['user_id'], $request['requested_date']]);
                } else {
                    // Find or update the attendance record
                    $stmtAtt = $pdo->prepare("SELECT id FROM attendance WHERE user_id = ? AND date = ?");
                    $stmtAtt->execute([$request['user_id'], $request['requested_date']]);
                    $att = $stmtAtt->fetch();

                    if ($att) {
                        $stmtUpd = $pdo->prepare("UPDATE attendance SET time_in = ?, time_out = ? WHERE id = ?");
                        $stmtUpd->execute([$request['time_in'], $request['time_out'], $att['id']]);
                    } else {
                        $stmtIns = $pdo->prepare("INSERT INTO attendance (user_id, date, time_in, time_out) VALUES (?, ?, ?, ?)");
                        $stmtIns->execute([$request['user_id'], $request['requested_date'], $request['time_in'], $request['time_out']]);
                    }
                }
            }

            $stmt = $pdo->prepare("UPDATE attendance_requests SET status = ?, admin_remarks = ? WHERE id = ?");
            $stmt->execute([$decision, $remarks, $requestId]);

            $processedRequests[] = $request;
        }
        
        $pdo->commit();

        // Send email notifications
        foreach ($processedRequests as $request) {
            $stmtUser = $pdo->prepare("SELECT email, full_name FROM users WHERE id = ?");
            $stmtUser->execute([$request['user_id']]);
            $user = $stmtUser->fetch();

            if ($user) {
                sendAdjustmentEmail($user['email'], $user['full_name'], $request['requested_date'], $request['time_in'], $request['time_out'], $decision, $remarks, $request['request_type'] ?? 'edit');
            }
        }

        echo json_encode(['status' => 'success', 'message' => 'Bulk requests processed successfully.']);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        echo json_encode(['status' => 'error', 'message' => 'Action failed: ' . $e->getMessage()]);
    }
} else if ($action === 'adminEditAttendance' && $_SESSION['role'] === 'admin') {
    $data = json_decode(file_get_contents('php://input'), true);
    $attendanceId = $data['id'] ?? null;
    $date = $data['date'] ?? null;
    $timeIn = $data['time_in'] ?? null;
    $timeOut = $data['time_out'] ?? null;

    if (!$attendanceId || !$date || !$timeIn) {
        echo json_encode(['status' => 'error', 'message' => 'Invalid parameters.']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("UPDATE attendance SET date = ?, time_in = ?, time_out = ? WHERE id = ?");
        $stmt->execute([$date, $timeIn, $timeOut, $attendanceId]);
        echo json_encode(['status' => 'success', 'message' => 'Attendance record updated.']);
    } catch (PDOException $e) {
        echo json_encode(['status' => 'error', 'message' => 'Update failed: ' . $e->getMessage()]);
    }
} else if ($action === 'adminDeleteAttendance' && $_SESSION['role'] === 'admin') {
    $data = json_decode(file_get_contents('php://input'), true);
    $attendanceId = $data['id'] ?? null;

    if (!$attendanceId) {
        echo json_encode(['status' => 'error', 'message' => 'Invalid parameters.']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("DELETE FROM attendance WHERE id = ?");
        $stmt->execute([$attendanceId]);
        echo json_encode(['status' => 'success', 'message' => 'Attendance record deleted.']);
    } catch (PDOException $e) {
        echo json_encode(['status' => 'error', 'message' => 'Deletion failed: ' . $e->getMessage()]);
    }
} else if ($action === 'toggleArchiveUser' && $_SESSION['role'] === 'admin') {
    $data = json_decode(file_get_contents('php://input'), true);
    $userId = $data['id'] ?? null;
    $isArchived = isset($data['is_archived']) ? (int)$data['is_archived'] : 0;

    if (!$userId) {
        echo json_encode(['status' => 'error', 'message' => 'User ID is required.']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("UPDATE users SET is_archived = ? WHERE id = ?");
        $stmt->execute([$isArchived, $userId]);
        $statusText = $isArchived ? 'archived' : 'unarchived';
        echo json_encode(['status' => 'success', 'message' => "Intern account successfully {$statusText}."]);
    } catch (PDOException $e) {
        echo json_encode(['status' => 'error', 'message' => 'Action failed: ' . $e->getMessage()]);
    }
} else {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid action.']);
}
ob_end_flush();
?>
