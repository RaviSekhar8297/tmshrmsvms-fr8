# Script to remove service_account.json from entire git history
# This will rewrite git history - use with caution!

Write-Host "=== Cleaning Git History of Secrets ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "This will remove service_account.json from ALL commits in git history." -ForegroundColor Cyan
Write-Host "⚠ WARNING: This rewrites history. Make sure you have a backup!" -ForegroundColor Red
Write-Host ""

$confirm = Read-Host "Do you want to continue? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "Aborted." -ForegroundColor Yellow
    exit
}

Write-Host ""
Write-Host "Step 1: Removing service_account.json from all commits..." -ForegroundColor Cyan
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch backend/service_account.json" --prune-empty --tag-name-filter cat -- --all

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Removed from history" -ForegroundColor Green
} else {
    Write-Host "✗ Error removing from history" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 2: Cleaning up backup refs..." -ForegroundColor Cyan
git for-each-ref --format="delete %(refname)" refs/original | git update-ref --stdin

Write-Host ""
Write-Host "Step 3: Expiring reflog..." -ForegroundColor Cyan
git reflog expire --expire=now --all

Write-Host ""
Write-Host "Step 4: Running garbage collection..." -ForegroundColor Cyan
git gc --prune=now --aggressive

Write-Host ""
Write-Host "=== Done! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Now you can push with:" -ForegroundColor Yellow
Write-Host "  git push origin main --force" -ForegroundColor White
Write-Host ""
Write-Host "⚠ Remember: Force push rewrites remote history!" -ForegroundColor Red
Write-Host "  Make sure no one else is working on this branch!" -ForegroundColor Red
