import os

file_path = r'c:\xampp\htdocs\timein\backend\attendance.php'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = "WHEN a.time_in IS NOT NULL AND a.time_out IS NULL AND TIMESTAMPDIFF(HOUR, CONCAT(a.date, ' ', a.time_in), NOW()) >= 24 THEN 1"
replacement = "WHEN a.time_in IS NULL AND ? < CURRENT_DATE() THEN 1\n                    WHEN a.time_in IS NOT NULL AND a.time_out IS NULL AND TIMESTAMPDIFF(HOUR, CONCAT(a.date, ' ', a.time_in), NOW()) >= 24 THEN 1"

if target in content:
    new_content = content.replace(target, replacement, 1)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Replacement successful")
else:
    print("Target not found")
