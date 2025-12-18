# PowerShell script to remove secrets from git history
# Run this script to clean up your git history

Write-Host "=== Removing Secrets from Git History ===" -ForegroundColor Yellow
Write-Host ""

# Step 1: Remove service_account.json from git tracking (if still tracked)
Write-Host "Step 1: Removing service_account.json from git tracking..." -ForegroundColor Cyan
git rm --cached backend/service_account.json 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Removed service_account.json from git tracking" -ForegroundColor Green
} else {
    Write-Host "  (File not in current index)" -ForegroundColor Gray
}

# Step 2: Stage the fixed files
Write-Host ""
Write-Host "Step 2: Staging fixed files..." -ForegroundColor Cyan
git add .gitignore backend/env.example backend/google_calendar.py
Write-Host "✓ Staged fixed files" -ForegroundColor Green

# Step 3: Check if we need to clean history
Write-Host ""
Write-Host "Step 3: Checking git history for secrets..." -ForegroundColor Cyan
$commitsWithSecrets = git log --oneline --all -- "*service_account.json" | Select-Object -First 1
if ($commitsWithSecrets) {
    Write-Host "⚠ Found secrets in git history!" -ForegroundColor Yellow
    Write-Host "  Commits containing secrets:" -ForegroundColor Yellow
    git log --oneline --all -- "*service_account.json" | ForEach-Object { Write-Host "    $_" -ForegroundColor Yellow }
    Write-Host ""
    Write-Host "You need to remove secrets from git history before pushing." -ForegroundColor Red
    Write-Host ""
    Write-Host "OPTION A: Use git filter-branch (recommended for multiple commits)" -ForegroundColor Cyan
    Write-Host "  Run these commands:" -ForegroundColor White
    Write-Host "    git filter-branch --force --index-filter `"git rm --cached --ignore-unmatch backend/service_account.json`" --prune-empty --tag-name-filter cat -- --all" -ForegroundColor Gray
    Write-Host "    git for-each-ref --format=`"delete %(refname)`" refs/original | git update-ref --stdin" -ForegroundColor Gray
    Write-Host "    git reflog expire --expire=now --all" -ForegroundColor Gray
    Write-Host "    git gc --prune=now --aggressive" -ForegroundColor Gray
    Write-Host ""
    Write-Host "OPTION B: Interactive rebase (if secrets are in recent commits)" -ForegroundColor Cyan
    Write-Host "  Run: git rebase -i 363ffac^" -ForegroundColor Gray
    Write-Host "  Then edit each commit and remove the file" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "✓ No secrets found in git history" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Yellow
Write-Host "1. Commit the current changes:" -ForegroundColor White
Write-Host "   git commit -m 'Remove secrets and update configuration'" -ForegroundColor Gray
Write-Host ""
Write-Host "2. If secrets are in history, clean them using one of the options above" -ForegroundColor White
Write-Host ""
Write-Host "3. After cleaning, force push (⚠ WARNING: This rewrites history!):" -ForegroundColor White
Write-Host "   git push origin main --force" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Create a .env file with your actual secrets (not tracked by git)" -ForegroundColor White
Write-Host ""
