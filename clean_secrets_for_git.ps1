# PowerShell script to clean secrets from git history and prepare for push
# This will remove files with secrets from git tracking

Write-Host "=== Cleaning Secrets for Git Push ===" -ForegroundColor Yellow
Write-Host ""

# Remove problematic files from git tracking if they exist in history
Write-Host "Removing files with secrets from git tracking..." -ForegroundColor Cyan

# Files that might be in git history but not in current directory
$filesToRemove = @(
    "FIX_GOOGLE_CALENDAR_ERRORS.md",
    "FIX_MEETING_ERROR.md", 
    "GOOGLE_CALENDAR_SETUP.md"
)

foreach ($file in $filesToRemove) {
    if (Test-Path $file) {
        Write-Host "Removing $file from git..." -ForegroundColor Yellow
        git rm --cached $file -f 2>$null
    }
}

# Remove backend/update_env.ps1 from tracking if it has secrets (we already cleaned it)
Write-Host "Checking backend/update_env.ps1..." -ForegroundColor Cyan
git add backend/update_env.ps1

# Stage all cleaned files
Write-Host ""
Write-Host "Staging cleaned files..." -ForegroundColor Cyan
git add backend/env.example
git add backend/GOOGLE_MAPS_API_KEY_SETUP.md
git add backend/replace_secrets.sh
git add frontend/src/pages/self/Punch.jsx
git add replace_secrets_in_history.ps1
git add .gitignore

Write-Host ""
Write-Host "✓ Files cleaned and staged" -ForegroundColor Green
Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Yellow
Write-Host "1. Commit the changes:" -ForegroundColor White
Write-Host "   git commit -m 'Remove API keys from code files'" -ForegroundColor Gray
Write-Host ""
Write-Host "2. If you need to clean git history, run:" -ForegroundColor White
Write-Host "   git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch FIX_GOOGLE_CALENDAR_ERRORS.md FIX_MEETING_ERROR.md GOOGLE_CALENDAR_SETUP.md' --prune-empty --tag-name-filter cat -- --all" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Force push (WARNING: This rewrites history):" -ForegroundColor White
Write-Host "   git push --force origin main" -ForegroundColor Gray
Write-Host ""
Write-Host "⚠️  Note: Force push will rewrite git history. Make sure you have a backup!" -ForegroundColor Red

