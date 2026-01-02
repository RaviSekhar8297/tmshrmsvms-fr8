# PowerShell script to prepare git push by removing secrets from history
# This will clean the problematic files from git history

Write-Host "=== Preparing Git Push (Removing Secrets from History) ===" -ForegroundColor Yellow
Write-Host ""

# Step 1: Remove problematic files from git history
Write-Host "Step 1: Removing files with secrets from git history..." -ForegroundColor Cyan
Write-Host "This may take a few minutes..." -ForegroundColor Gray
Write-Host ""

$filesToRemove = @(
    "FIX_GOOGLE_CALENDAR_ERRORS.md",
    "FIX_MEETING_ERROR.md",
    "GOOGLE_CALENDAR_SETUP.md"
)

$fileList = $filesToRemove -join " "

# Use git filter-branch to remove files from all commits
Write-Host "Running git filter-branch to remove files from history..." -ForegroundColor Yellow
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch $fileList" --prune-empty --tag-name-filter cat -- --all

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Files removed from git history" -ForegroundColor Green
} else {
    Write-Host "⚠️  Filter-branch may have encountered issues, but continuing..." -ForegroundColor Yellow
}

# Step 2: Clean up git references
Write-Host ""
Write-Host "Step 2: Cleaning up git references..." -ForegroundColor Cyan
Remove-Item -Recurse -Force .git/refs/original -ErrorAction SilentlyContinue
git reflog expire --expire=now --all
git gc --prune=now --aggressive

Write-Host "✓ Git cleanup completed" -ForegroundColor Green

# Step 3: Stage all cleaned files
Write-Host ""
Write-Host "Step 3: Staging cleaned files..." -ForegroundColor Cyan
git add backend/update_env.ps1
git add backend/env.example
git add backend/GOOGLE_MAPS_API_KEY_SETUP.md
git add backend/replace_secrets.sh
git add frontend/src/pages/self/Punch.jsx
git add replace_secrets_in_history.ps1
git add .gitignore

Write-Host "✓ Files staged" -ForegroundColor Green

Write-Host ""
Write-Host "=== Ready to Commit and Push ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next commands:" -ForegroundColor Yellow
Write-Host "1. git commit -m 'Remove API keys and secrets from code files'" -ForegroundColor White
Write-Host "2. git push --force origin main" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  WARNING: Force push will rewrite git history!" -ForegroundColor Red
Write-Host "   Make sure you have a backup or coordinate with your team." -ForegroundColor Red

