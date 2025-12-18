#!/bin/bash
# Script to replace secrets in files during git filter-branch

if [ "$GIT_COMMIT" ]; then
    # Replace Google Client ID in env.example
    if git show "$GIT_COMMIT:backend/env.example" > /dev/null 2>&1; then
        git show "$GIT_COMMIT:backend/env.example" | \
        sed 's/GOOGLE_CLIENT_ID=992284845003-hnkuf8dmorv8ae44nueber6cr34okv1u\.apps\.googleusercontent\.com/GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com/' | \
        sed 's/GOOGLE_CLIENT_SECRET=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/GOOGLE_CLIENT_SECRET=your-google-client-secret/' | \
        git hash-object -w --stdin | \
        git update-index --cacheinfo 100644 "$(git hash-object -w --stdin)" backend/env.example
    fi
    
    # Replace secrets in google_calendar.py
    if git show "$GIT_COMMIT:backend/google_calendar.py" > /dev/null 2>&1; then
        git show "$GIT_COMMIT:backend/google_calendar.py" | \
        sed 's/992284845003-hnkuf8dmorv8ae44nueber6cr34okv1u\.apps\.googleusercontent\.com/your-google-client-id.apps.googleusercontent.com/' | \
        sed 's/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/your-google-client-secret/' | \
        git hash-object -w --stdin | \
        git update-index --cacheinfo 100644 "$(git hash-object -w --stdin)" backend/google_calendar.py
    fi
fi
