@echo off
echo === ĐANG KHỞI ĐỘNG HỆ THỐNG GIÁM SÁT WEBSITE ===

REM Cài đặt backend
cd BE-website-monitor
if exist node_modules (
    echo [✔] Đã cài backend dependencies.
) else (
    echo [⏳] Cài backend dependencies...
    npm install
)
start cmd /k "npm start"

REM Cài đặt frontend
cd ..\website-monitor
if exist node_modules (
    echo [✔] Đã cài frontend dependencies.
) else (
    echo [⏳] Cài frontend dependencies...
    npm install
)
start cmd /k "npm start"

echo [✔] Đã chạy frontend và backend. Mở trình duyệt tại: http://localhost:3000
pause
