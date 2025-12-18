# How to Remove Secrets from Git History

## ⚠️ IMPORTANT: Read this first!

The secrets are already in your git history. You need to remove them before pushing.

## Option 1: If you haven't pushed yet (RECOMMENDED)

If you haven't pushed these commits to GitHub yet, you can amend/reset them:

### Step 1: Remove files from current commit
```bash
# Remove service_account.json from git tracking
git rm --cached backend/service_account.json

# Stage the updated files (google_calendar.py, env.example, .gitignore)
git add backend/google_calendar.py backend/env.example .gitignore

# Amend the last commit (if secrets are in the last commit)
git commit --amend --no-edit

# Or if secrets are in multiple commits, you'll need to do an interactive rebase
```

### Step 2: If secrets are in older commits, use interactive rebase
```bash
# Find the commit hash that contains secrets (from the error message)
# Commit: 363ffaccc97cf611f494831636c883c82109fb11

# Start interactive rebase from before that commit
git rebase -i 363ffaccc97cf611f494831636c883c82109fb11^
# In the editor, mark commits with secrets as 'edit'
# Then for each commit:
git rm --cached backend/service_account.json
git add backend/google_calendar.py backend/env.example .gitignore
git commit --amend --no-edit
git rebase --continue
```

## Option 2: Use git filter-branch (for multiple commits)

```bash
# Remove service_account.json from entire history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch backend/service_account.json" \
  --prune-empty --tag-name-filter cat -- --all

# Clean up
git for-each-ref --format="delete %(refname)" refs/original | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

## Option 3: Use BFG Repo-Cleaner (EASIEST - Recommended)

1. Download BFG: https://rtyley.github.io/bfg-repo-cleaner/
2. Run:
```bash
# Remove the file
java -jar bfg.jar --delete-files service_account.json

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

## After cleaning history:

1. **Force push** (⚠️ WARNING: This rewrites history!)
```bash
git push origin main --force
```

2. **If you're working with others**: Coordinate with your team first!

## Verify secrets are removed:

```bash
# Search for secrets in git history
git log --all --full-history --source -- "*service_account.json"
git log --all --full-history --source -- "*google_calendar.py" | grep -i "client"
```

## Next Steps:

1. Create a `.env` file (not tracked by git) with your actual secrets
2. Never commit secrets again - always use environment variables
3. Use `env.example` for documentation with placeholder values
