# How to Solve the 400 Error When Creating Meetings

## The Problem
You're getting `POST http://localhost:3000/api/meetings/ 400 (Bad Request)` when trying to create a meeting.

## Root Cause
The error happens because:
1. You selected **"Google Meet (auto)"** as the platform
2. Google Calendar is **not connected** (OAuth not completed)
3. Service account file is **not available** (was removed for security)
4. Backend tries to create a Google Meet link but fails

## Solution - Choose One:

### ✅ Solution 1: Connect Google Calendar (Recommended)

**Steps:**
1. On the **Meetings page**, you'll see a yellow banner: "Google Calendar Not Connected"
2. Click the **"Connect Google Calendar"** button
3. You'll be redirected to Google to authorize
4. Grant permissions to create calendar events
5. You'll be redirected back - connection complete!
6. Now create your meeting again - it will work! ✅

### ✅ Solution 2: Use a Different Platform (Quick Fix)

**Steps:**
1. In the meeting form, change **"Meeting Platform"** from **"Google Meet (auto)"** to:
   - **"Zoom (enter link)"** - Enter your Zoom link
   - **"Custom link"** - Enter any meeting link
2. Enter your meeting link in the "Meeting Link" field
3. Create the meeting - it will work! ✅

## What I Fixed:

1. **Frontend Validation** - Now blocks submission if Google Calendar isn't connected and you select "Google Meet (auto)"
2. **Better Error Messages** - Clear instructions on what to do
3. **Warning Banners** - Visual warnings when Google Calendar isn't connected
4. **Confirmation Dialogs** - Asks if you want to connect before submitting

## Quick Test:

1. **Try creating a meeting with "Google Meet (auto)"** - You'll get a confirmation dialog
2. **Click OK** - It will redirect you to connect Google Calendar
3. **OR Click Cancel** - Then switch to "Zoom/Custom" and provide a link manually

## After Connecting Google Calendar:

- ✅ Real Google Meet links will be generated automatically
- ✅ Meetings will be added to your Google Calendar
- ✅ Participants will receive proper invitations
- ✅ No more 400 errors!

---

**Note**: The `.env` file needs to have Google credentials uncommented. If you haven't done that yet, see `GOOGLE_CALENDAR_SETUP.md`
