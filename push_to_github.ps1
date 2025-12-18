# Script to clean git history and push to GitHub
# This will remove secrets from git history before pushing

Write-Host "=== Preparing to Push to GitHub ===" -ForegroundColor Yellow
Write-Host ""

# Check if secrets are in history
Write-Host "Checking for secrets in git history..." -ForegroundColor Cyan
$secretsInHistory = git log --oneline --all -- "*service_account.json" 2>$null

if ($secretsInHistory) {
    Write-Host "⚠ Secrets found in git history!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Commits with secrets:" -ForegroundColor Yellow
    $secretsInHistory | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
    Write-Host ""
    
    $cleanHistory = Read-Host "Do you want to clean git history before pushing? (yes/no)"
    
    if ($cleanHistory -eq "yes") {
        Write-Host ""
        Write-Host "Cleaning git history..." -ForegroundColor Cyan
        
        # Remove service_account.json from all commits
        git filter-branch --force --index-filter "git rm --cached --ignore-unmatch backend/service_account.json" --prune-empty --tag-name-filter cat -- --all
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Removed from history" -ForegroundColor Green
            
            # Clean up backup refs
            Write-Host "Cleaning up backup refs..." -ForegroundColor Cyan
            git for-each-ref --format="delete %(refname)" refs/original | git update-ref --stdin 2>$null
            
            # Expire reflog
            Write-Host "Expiring reflog..." -ForegroundColor Cyan
            git reflog expire --expire=now --all
            
            # Garbage collection
            Write-Host "Running garbage collection..." -ForegroundColor Cyan
            git gc --prune=now --aggressive
            
            Write-Host "✓ Git history cleaned!" -ForegroundColor Green
        } else {
            Write-Host "✗ Error cleaning history" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "Skipping history cleanup. GitHub may block the push if secrets are detected." -ForegroundColor Yellow
    }
} else {
    Write-Host "✓ No secrets found in git history" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Pushing to GitHub ===" -ForegroundColor Yellow

# Check remote
$remote = git remote get-url origin 2>$null
if ($remote) {
    Write-Host "Remote: $remote" -ForegroundColor Cyan
} else {
    Write-Host "✗ No remote configured!" -ForegroundColor Red
    exit 1
}

# Check if repo is empty on GitHub
Write-Host ""
Write-Host "Checking if repository is empty..." -ForegroundColor Cyan
$remoteBranch = git ls-remote --heads origin main 2>$null

if (-not $remoteBranch) {
    Write-Host "Repository appears to be empty. Pushing initial commit..." -ForegroundColor Cyan
    git push -u origin main
} else {
    Write-Host "Repository has existing commits." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "⚠ WARNING: If you cleaned history, you MUST use --force" -ForegroundColor Red
    Write-Host "This will overwrite the remote repository!" -ForegroundColor Red
    Write-Host ""
    $forcePush = Read-Host "Do you want to force push? (yes/no)"
    
    if ($forcePush -eq "yes") {
        git push -u origin main --force
    } else {
        Write-Host "Attempting normal push..." -ForegroundColor Cyan
        git push -u origin main
    }
}

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=== ✓ Successfully pushed to GitHub! ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Repository: $remote" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "✗ Push failed!" -ForegroundColor Red
    Write-Host "Check the error message above." -ForegroundColor Yellow
}
