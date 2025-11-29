# Launch Customized Mode (Task4 Frontend + Backend)
# This runs the music-eq-frontend on port 5173

Write-Host "🚀 Starting Customized Mode (Task4)" -ForegroundColor Cyan
Write-Host "Backend: http://localhost:8000" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Yellow
Write-Host ""

# Start Backend
Write-Host "Starting Backend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\music-eq-backend'; python main.py"

# Wait for backend to start
Start-Sleep -Seconds 3

# Start Frontend
Write-Host "Starting Customized Frontend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\music-eq-frontend'; npm run dev"

Write-Host ""
Write-Host "✅ Both services starting..." -ForegroundColor Green
Write-Host "Press any key to exit (this will NOT stop the servers)" -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
