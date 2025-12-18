# PowerShell script to create .env file from env.example
# This will help you set up your environment variables

Write-Host "=== Setting up .env file ===" -ForegroundColor Yellow
Write-Host ""

$envExample = "env.example"
$envFile = ".env"

# Check if .env already exists
if (Test-Path $envFile) {
    Write-Host "⚠ .env file already exists!" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to overwrite it? (yes/no)"
    if ($overwrite -ne "yes") {
        Write-Host "Aborted." -ForegroundColor Yellow
        exit
    }
}

# Check if env.example exists
if (-not (Test-Path $envExample)) {
    Write-Host "✗ env.example not found!" -ForegroundColor Red
    exit 1
}

# Copy env.example to .env
Copy-Item $envExample $envFile
Write-Host "✓ Created .env file from env.example" -ForegroundColor Green
Write-Host ""

Write-Host "=== Next Steps ===" -ForegroundColor Yellow
Write-Host "1. Edit .env file and add your Google credentials:" -ForegroundColor White
Write-Host "   - GOOGLE_CLIENT_ID" -ForegroundColor Gray
Write-Host "   - GOOGLE_CLIENT_SECRET" -ForegroundColor Gray
Write-Host ""
Write-Host "2. If you have a service account, place service_account.json in the backend directory" -ForegroundColor White
Write-Host ""
Write-Host "3. Restart your uvicorn server" -ForegroundColor White
Write-Host ""
