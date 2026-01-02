# PowerShell script to update .env file
# Note: API keys are now stored in .env file directly
# This script only handles .env file creation from env.example if needed

Write-Host "=== Checking .env file ===" -ForegroundColor Yellow
Write-Host ""

$envFile = ".env"
$envExample = "env.example"

# Check if .env exists
if (-not (Test-Path $envFile)) {
    Write-Host "Creating .env from env.example..." -ForegroundColor Cyan
    Copy-Item $envExample $envFile
    Write-Host "✓ Created .env file from env.example" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️  Please update the API keys in .env file manually" -ForegroundColor Yellow
} else {
    Write-Host "✓ .env file already exists" -ForegroundColor Green
    Write-Host ""
    Write-Host "Note: API keys should be configured in .env file" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Yellow
Write-Host "1. Ensure all API keys are set in .env file" -ForegroundColor White
Write-Host "2. Restart your backend server:" -ForegroundColor White
Write-Host "   Press Ctrl+C to stop, then run: uvicorn main:app --reload --host 0.0.0.0 --port 8000" -ForegroundColor Gray
Write-Host ""
