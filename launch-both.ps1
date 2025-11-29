# Launch BOTH Frontends Simultaneously
# Backend runs on port 8000
# Customized Frontend runs on port 5173
# Generic Frontend runs on port 5174

Write-Host "🚀 Starting BOTH Modes" -ForegroundColor Cyan
Write-Host "Backend: http://localhost:8000" -ForegroundColor Yellow
Write-Host "Customized Frontend: http://localhost:5173" -ForegroundColor Yellow
Write-Host "Generic Frontend: http://localhost:5174" -ForegroundColor Yellow
Write-Host ""

# Start Backend
Write-Host "Starting Backend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\music-eq-backend'; python main.py"

# Wait for backend to start
Start-Sleep -Seconds 3

# Start Customized Frontend
Write-Host "Starting Customized Frontend (port 5173)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\music-eq-frontend'; npm run dev"

# Start Generic Frontend
Write-Host "Starting Generic Frontend (port 5174)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\spare-eqz-frontend'; npm run dev"

Write-Host ""
Write-Host "✅ All services starting..." -ForegroundColor Green
Write-Host "You can now use both frontends with the same backend!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to exit (this will NOT stop the servers)" -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
