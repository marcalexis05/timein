<?php
$dir = dirname(__DIR__) . '/backend/PHPMailer/src/';
echo "Path: $dir\n";
echo "PHPMailer.php: " . (file_exists($dir . 'PHPMailer.php') ? 'EXISTS' : 'MISSING') . "\n";
echo "SMTP.php: " . (file_exists($dir . 'SMTP.php') ? 'EXISTS' : 'MISSING') . "\n";
echo "Exception.php: " . (file_exists($dir . 'Exception.php') ? 'EXISTS' : 'MISSING') . "\n";
