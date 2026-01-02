#!/bin/bash
# Script to replace secrets in files during git filter-branch
# Note: This script uses placeholder values - actual secrets should be in .env file only

if [ "$GIT_COMMIT" ]; then
    # Replace Google Client ID in env.example
    if git show "$GIT_COMMIT:backend/env.example" > /dev/null 2>&1; then
        git show "$GIT_COMMIT:backend/env.example" | \
        sed 's/GOOGLE_CLIENT_ID=.*/GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com/' | \
        sed 's/GOOGLE_CLIENT_SECRET=.*/GOOGLE_CLIENT_SECRET=your-google-client-secret/' | \
        git hash-object -w --stdin | \
        git update-index --cacheinfo 100644 "$(git hash-object -w --stdin)" backend/env.example
    fi
    
    # Replace secrets in google_calendar.py
    if git show "$GIT_COMMIT:backend/google_calendar.py" > /dev/null 2>&1; then
        git show "$GIT_COMMIT:backend/google_calendar.py" | \
        sed 's/.*googleusercontent\.com.*/your-google-client-id.apps.googleusercontent.com/' | \
        sed 's/.*GOCSPX.*/your-google-client-secret/' | \
        git hash-object -w --stdin | \
        git update-index --cacheinfo 100644 "$(git hash-object -w --stdin)" backend/google_calendar.py
    fi
fi
