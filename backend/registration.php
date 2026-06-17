<?php
session_start();
header('Content-Type: application/json');
require 'config.php';
require 'smtp_config.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

function sendOTPEmail($toEmail, $toName, $otp) {
    $phpMailerPath = __DIR__ . '/PHPMailer/src/';

    if (!file_exists($phpMailerPath . 'PHPMailer.php')) {
        error_log("PHPMailer not found at $phpMailerPath. OTP for $toEmail: $otp");
        return ['status' => 'simulated', 'otp' => $otp];
    }

    require_once $phpMailerPath . 'Exception.php';
    require_once $phpMailerPath . 'PHPMailer.php';
    require_once $phpMailerPath . 'SMTP.php';

    $mail = new PHPMailer(true);

    try {
        $mail->isSMTP();
        // $mail->SMTPDebug = SMTP::DEBUG_SERVER; // Uncomment for detailed debug logs
        $mail->Host       = SMTP_HOST;
        $mail->SMTPAuth   = true;
        $mail->Username   = SMTP_USER;
        $mail->Password   = SMTP_PASS;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = SMTP_PORT;

        // Add options to bypass SSL certificate verification (common fix for XAMPP)
        $mail->SMTPOptions = array(
            'ssl' => array(
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true
            )
        );

        $mail->setFrom(SMTP_FROM, SMTP_NAME);
        $mail->addAddress($toEmail, $toName);

        // Embed the local logo
        $logoPath = dirname(__DIR__) . '/assets/logo.png';
        if (file_exists($logoPath)) {
            $mail->addEmbeddedImage($logoPath, 'logo');
            $logoSrc = 'cid:logo';
        } else {
            // Fallback to text if file missing
            $logoSrc = ''; 
        }

        $mail->isHTML(true);
        $mail->Subject = "Verification Code: $otp - Concentrix Registration";

        $currentYear = date('Y');
        $mail->Body = "
        <html>
        <head>
            <meta name='viewport' content='width=device-width, initial-scale=1.0'>
        </head>
        <body style='font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6; margin: 0; padding: 0;'>
            <div style='width: 100%; max-width: 600px; margin: 10px auto; border: 1px solid #e2e8f0; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);'>
                <div style='padding: 30px 20px 0; text-align: center;'>
                    " . ($logoSrc ? "<img src='$logoSrc' alt='Concentrix' style='height: 6rem; display: block; margin: 0 auto; max-width: 80%; object-fit: contain;'>" : "<h1 style='color: #003db5; margin: 0;'>Concentrix</h1>") . "
                </div>
                
                <div style='padding: 20px 20px 40px; background: #ffffff;'>
                    <div style='padding: 0 10px;'>
                        <p style='margin-top: 0;'>Dear <strong>$toName</strong>,</p>
                        <p>Thank you for your interest in joining the Concentrix team. We are truly excited to have you begin your journey with us.</p>
                        <p>To ensure the security of your intern profile, please use the following 6-digit verification code to complete your registration:</p>
                    </div>
                    
                    <div style='text-align: center; margin: 30px 0;'>
                        <div style='display: inline-block; font-size: 32px; font-weight: 900; color: #003d5b; letter-spacing: 4px; padding: 15px 25px; background: #f5f3ff; border: 2px solid #ddd6fe; border-radius: 16px; max-width: 90%; word-break: break-all;'>$otp</div>
                        <p style='font-size: 13px; color: #94a3b8; margin-top: 15px;'>This code is valid for the next 10 minutes.</p>
                    </div>

                    <div style='padding: 0 10px;'>
                        <p>If you did not request this code, please disregard this email or contact our support team if you have concerns.</p>
                        <p style='margin-bottom: 0;'>We look forward to working with you!</p>
                    </div>
                </div>

                <div style='background: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #f1f5f9;'>
                    <p style='margin: 0; color: #64748b; font-size: 12px; font-weight: 600;'>&copy; $currentYear Concentrix Management System</p>
                    <p style='margin: 5px 0 0; color: #94a3b8; font-size: 11px;'>This is an automated message, please do not reply.</p>
                </div>
            </div>
        </body>
        </html>";

        $mail->send();
        return ['status' => 'sent'];
    } catch (Exception $e) {
        error_log("PHPMailer Error: " . $mail->ErrorInfo);
        return ['status' => 'error', 'message' => $mail->ErrorInfo];
    }
}

function jsonResponse($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['status' => 'error', 'message' => 'Invalid request.'], 400);
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    jsonResponse(['status' => 'error', 'message' => 'Invalid JSON body.'], 400);
}

error_log("Registration Action: $action | Body: $raw");

try {
    if ($action === 'send_otp') {
        $email = trim($data['email'] ?? '');
        $name  = trim($data['full_name'] ?? '');

        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonResponse(['status' => 'error', 'message' => 'Invalid email address.']);
        }

        // Proactive check if email is already registered
        $stmtCheck = $pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmtCheck->execute([$email]);
        if ($stmtCheck->fetch()) {
            jsonResponse(['status' => 'error', 'message' => 'This email is already registered.']);
        }

        $otp = sprintf("%06d", mt_rand(1, 999999));
        $_SESSION['registration_otp']   = $otp;
        $_SESSION['registration_email'] = $email;
        $_SESSION['otp_expiry']         = time() + 600;

        error_log("Generated OTP: $otp for $email");

        $result = sendOTPEmail($email, $name, $otp);

        if ($result['status'] === 'sent') {
            jsonResponse(['status' => 'success', 'message' => 'OTP sent to your Gmail.']);
        } elseif ($result['status'] === 'simulated') {
            jsonResponse([
                'status'   => 'success',
                'message'  => 'Code generated. Check server logs (PHPMailer not installed).',
                'dev_code' => $otp
            ]);
        } else {
            jsonResponse(['status' => 'error', 'message' => 'Mailer Error: ' . ($result['message'] ?? 'Unknown')]);
        }
    }

    if ($action === 'verify_register') {
        $email = trim($data['email'] ?? '');
        $name  = trim($data['full_name'] ?? '');
        $otp   = trim($data['otp'] ?? '');

        error_log("Verifying OTP: $otp for $email");

        if (!isset($_SESSION['registration_otp'])) {
            error_log("Session Error: registration_otp not set.");
            jsonResponse(['status' => 'error', 'message' => 'Session expired. Please request a new code.']);
        }

        if ($_SESSION['registration_otp'] !== $otp) {
            error_log("OTP Mismatch: Expected {$_SESSION['registration_otp']} but got $otp");
            jsonResponse(['status' => 'error', 'message' => 'Invalid verification code.']);
        }

        if (time() > $_SESSION['otp_expiry']) {
            jsonResponse(['status' => 'error', 'message' => 'Code has expired. Please request a new one.']);
        }

        // Check if email already registered
        $stmtCheck = $pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmtCheck->execute([$email]);
        if ($stmtCheck->fetch()) {
            unset($_SESSION['registration_otp'], $_SESSION['registration_email'], $_SESSION['otp_expiry']);
            jsonResponse(['status' => 'error', 'message' => 'This email is already registered.']);
        }

        // Generate a guaranteed-unique Serial Number
        $year = date('Y');
        do {
            $rand   = str_pad(mt_rand(1, 999999), 6, '0', STR_PAD_LEFT);
            $serial = "IT" . $year . $rand;
            $stmtSn = $pdo->prepare("SELECT id FROM users WHERE serial_number = ?");
            $stmtSn->execute([$serial]);
        } while ($stmtSn->fetch());

        error_log("Creating user: $name, $email, $serial");

        $stmt = $pdo->prepare("INSERT INTO users (full_name, email, serial_number) VALUES (?, ?, ?)");
        $stmt->execute([$name, $email, $serial]);

        unset($_SESSION['registration_otp'], $_SESSION['registration_email'], $_SESSION['otp_expiry']);

        jsonResponse(['status' => 'success', 'message' => 'Registration successful! Your Serial Number is ' . $serial]);
    }

    jsonResponse(['status' => 'error', 'message' => 'Unknown action.'], 400);

} catch (Throwable $t) {
    $msg = $t->getMessage();
    error_log("Registration Fatal Error: " . $msg . " | " . $t->getTraceAsString());
    if (strpos($msg, 'Duplicate entry') !== false || strpos($msg, '1062') !== false) {
        jsonResponse(['status' => 'error', 'message' => 'This email is already registered.']);
    }
    jsonResponse(['status' => 'error', 'message' => 'System Error: ' . $msg]);
}
