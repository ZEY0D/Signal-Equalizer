# FFmpeg Installation Script for Demucs
# Run this script in PowerShell as Administrator

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "FFmpeg Installation Helper" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Option 1: Check if ffmpeg is already in PATH
$ffmpegPath = Get-Command ffmpeg -ErrorAction SilentlyContinue
if ($ffmpegPath) {
    Write-Host "✓ FFmpeg is already installed at: $($ffmpegPath.Source)" -ForegroundColor Green
    ffmpeg -version
    exit 0
}

Write-Host "FFmpeg is not installed. Please choose an option:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Option 1: Manual Download (Recommended - Faster)" -ForegroundColor Green
Write-Host "  1. Download from: https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
Write-Host "  2. Extract to C:\ffmpeg"
Write-Host "  3. Add C:\ffmpeg\bin to your PATH"
Write-Host ""
Write-Host "Option 2: Auto Download with Winget" -ForegroundColor Green
Write-Host "  Run: winget install ffmpeg"
Write-Host ""
Write-Host "After installation, restart PowerShell and verify with: ffmpeg -version"
Write-Host ""

# Offer to add to PATH if user has already downloaded
$response = Read-Host "Have you already extracted FFmpeg to C:\ffmpeg? (y/n)"
if ($response -eq 'y') {
    $binPath = "C:\ffmpeg\bin"
    if (Test-Path $binPath) {
        # Add to user PATH
        $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
        if ($currentPath -notlike "*$binPath*") {
            [Environment]::SetEnvironmentVariable("Path", "$currentPath;$binPath", "User")
            Write-Host "✓ Added C:\ffmpeg\bin to PATH" -ForegroundColor Green
            Write-Host "⚠ Please restart PowerShell for changes to take effect" -ForegroundColor Yellow
        } else {
            Write-Host "✓ C:\ffmpeg\bin is already in PATH" -ForegroundColor Green
        }
    } else {
        Write-Host "✗ C:\ffmpeg\bin not found. Please extract FFmpeg first." -ForegroundColor Red
    }
}
