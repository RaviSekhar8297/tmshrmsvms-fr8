# PowerShell script to update .env file with Google credentials
# This will uncomment and set the Google OAuth credentials

Write-Host "=== Updating .env file with Google Credentials ===" -ForegroundColor Yellow
Write-Host ""

$envFile = ".env"
$envExample = "env.example"

# Check if .env exists
if (-not (Test-Path $envFile)) {
    Write-Host "Creating .env from env.example..." -ForegroundColor Cyan
    Copy-Item $envExample $envFile
}

# Read current .env content
$content = Get-Content $envFile -Raw

# Replace commented Google credentials with actual values
$content = $content -replace '# GOOGLE_CLIENT_ID=your-google-client-id', 'GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com'
$content = $content -replace '# GOOGLE_CLIENT_SECRET=your-google-client-secret', 'GOOGLE_CLIENT_SECRET=your-google-client-secret'
$content = $content -replace '# GOOGLE_REDIRECT_URI=http://localhost:8000/api/calendar/auth/callback', 'GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback'

# Also handle if they're already there but commented differently
$content = $content -replace '# GOOGLE_CLIENT_ID=', 'GOOGLE_CLIENT_ID='
$content = $content -replace '# GOOGLE_CLIENT_SECRET=', 'GOOGLE_CLIENT_SECRET='
$content = $content -replace '# GOOGLE_REDIRECT_URI=', 'GOOGLE_REDIRECT_URI='

# Make sure the values are set correctly
if ($content -notmatch 'GOOGLE_CLIENT_ID=992284845003') {
    # Add if not present
    $content += "`nGOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com`n"
    $content += "GOOGLE_CLIENT_SECRET=your-google-client-secret`n"
    $content += "GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback`n"
}

# Write back to file
Set-Content -Path $envFile -Value $content -NoNewline

Write-Host "✓ Updated .env file with Google credentials" -ForegroundColor Green
Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Yellow
Write-Host "1. Restart your backend server:" -ForegroundColor White
Write-Host "   Press Ctrl+C to stop, then run: uvicorn main:app --reload --host 0.0.0.0 --port 8000" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Go to Meetings page and click 'Connect Google Calendar'" -ForegroundColor White
Write-Host ""
Write-Host "3. Create your meeting - emails will be sent automatically to participants!" -ForegroundColor White
Write-Host ""
