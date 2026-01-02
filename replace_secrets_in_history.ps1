# PowerShell script to replace secrets in git history using filter-branch
# This will replace actual secrets with placeholders in old commits

Write-Host "=== Replacing Secrets in Git History ===" -ForegroundColor Yellow
Write-Host "This will replace actual secrets with placeholders in all commits" -ForegroundColor Cyan
Write-Host ""

$env:FILTER_BRANCH_SQUELCH_WARNING = "1"

# Use tree-filter to replace secrets in files
Write-Host "Replacing secrets in env.example and google_calendar.py..." -ForegroundColor Cyan

git filter-branch --force --tree-filter '
if [ -f backend/env.example ]; then
    sed -i "s/GOOGLE_CLIENT_ID=.*/GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com/g" backend/env.example
    sed -i "s/GOOGLE_CLIENT_SECRET=.*/GOOGLE_CLIENT_SECRET=your-google-client-secret/g" backend/env.example
fi
if [ -f backend/google_calendar.py ]; then
    sed -i "s/.*googleusercontent\.com.*/your-google-client-id.apps.googleusercontent.com/g" backend/google_calendar.py
    sed -i "s/.*GOCSPX.*/your-google-client-secret/g" backend/google_calendar.py
fi
' --prune-empty --tag-name-filter cat -- --all

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Secrets replaced in history" -ForegroundColor Green
    
    # Clean up
    Write-Host "Cleaning up..." -ForegroundColor Cyan
    Remove-Item -Recurse -Force .git/refs/original -ErrorAction SilentlyContinue
    git reflog expire --expire=now --all
    git gc --prune=now --aggressive
    
    Write-Host "✓ Done! You can now push to GitHub" -ForegroundColor Green
} else {
    Write-Host "✗ Error replacing secrets" -ForegroundColor Red
}
