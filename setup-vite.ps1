# Quick Start Script for React + Vite Conversion (Windows PowerShell)
# Run this script with: .\setup-vite.ps1

Write-Host "🚀 Starting React + Vite conversion setup..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Backup old package.json
if (Test-Path "package.json") {
    Write-Host "📦 Backing up old package.json to package-next.json..." -ForegroundColor Yellow
    Move-Item -Path "package.json" -Destination "package-next.json" -Force
    Write-Host "✅ Backup complete" -ForegroundColor Green
} else {
    Write-Host "⚠️  No existing package.json found" -ForegroundColor Yellow
}

# Step 2: Use new Vite package.json
if (Test-Path "package-vite.json") {
    Write-Host "📦 Setting up new Vite package.json..." -ForegroundColor Yellow
    Copy-Item -Path "package-vite.json" -Destination "package.json" -Force
    Write-Host "✅ Package.json updated" -ForegroundColor Green
} else {
    Write-Host "❌ Error: package-vite.json not found!" -ForegroundColor Red
    exit 1
}

# Step 3: Remove old lockfile
if (Test-Path "pnpm-lock.yaml") {
    Write-Host "🗑️  Removing old pnpm-lock.yaml..." -ForegroundColor Yellow
    Remove-Item "pnpm-lock.yaml" -Force
    Write-Host "✅ Old lockfile removed" -ForegroundColor Green
}

# Step 4: Install dependencies
Write-Host ""
Write-Host "📥 Installing dependencies..." -ForegroundColor Cyan
Write-Host "This may take a minute..." -ForegroundColor Gray
npm install

# Check if install was successful
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Dependencies installed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎉 Setup complete! Your project is ready." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📝 Next steps:" -ForegroundColor Yellow
    Write-Host "   1. Run 'npm run dev' to start the development server"
    Write-Host "   2. Open http://localhost:3000 in your browser"
    Write-Host "   3. Check README-VITE.md for more information"
    Write-Host ""
    Write-Host "📁 File structure:" -ForegroundColor Yellow
    Write-Host "   - src/main.jsx       → Entry point"
    Write-Host "   - src/App.jsx        → Main application"
    Write-Host "   - src/components.jsx → All UI components (1 file!)"
    Write-Host "   - src/utils.js       → Utility functions"
    Write-Host "   - src/index.css      → Styles"
    Write-Host ""
    Write-Host "🗑️  Optional: Clean up old Next.js files" -ForegroundColor Yellow
    Write-Host "   After confirming everything works, you can delete:"
    Write-Host "   - app/ components/ hooks/ lib/ styles/ folders"
    Write-Host "   - next.config.mjs tsconfig.json components.json"
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Error: Failed to install dependencies" -ForegroundColor Red
    Write-Host "Please check your internet connection and try again" -ForegroundColor Yellow
    exit 1
}
