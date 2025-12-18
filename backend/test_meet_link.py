"""
Test script to verify Google Meet link generation using service account
Run this script to test if the service account can create working Meet links
"""
import sys
from datetime import datetime, timedelta
from google_calendar import create_calendar_event_with_service_account, get_service_account_credentials

def test_meet_link_creation():
    """Test creating a Google Meet link"""
    print("=" * 60)
    print("Testing Google Meet Link Creation with Service Account")
    print("=" * 60)
    
    # Check if service account credentials can be loaded
    print("\n1. Checking service account credentials...")
    credentials = get_service_account_credentials()
    if not credentials:
        print("❌ FAILED: Service account credentials not available")
        print("   Please ensure service_account.json exists in backend directory")
        return False
    print("✅ Service account credentials loaded successfully")
    print(f"   Service account email: {credentials.service_account_email}")
    
    # Test creating a calendar event with Meet link
    print("\n2. Creating test calendar event with Meet link...")
    try:
        test_title = "Test Meeting - " + datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        test_start = datetime.now() + timedelta(hours=1)  # 1 hour from now
        
        result = create_calendar_event_with_service_account(
            title=test_title,
            description="This is a test meeting to verify Meet link generation",
            start_datetime=test_start,
            duration_minutes=30,
            attendees_emails=[]  # No attendees for test
        )
        
        meet_link = result.get('meeting_link')
        event_id = result.get('calendar_event_id')
        
        print(f"✅ Calendar event created successfully!")
        print(f"   Event ID: {event_id}")
        print(f"   Meet Link: {meet_link}")
        
        # Validate Meet link format
        if meet_link and meet_link.startswith('https://meet.google.com/'):
            print(f"✅ Meet link format is correct")
            print(f"\n📋 Test Results:")
            print(f"   Status: SUCCESS")
            print(f"   Meet Link: {meet_link}")
            print(f"   You can test this link by opening it in a browser")
            return True
        else:
            print(f"❌ Meet link format is incorrect: {meet_link}")
            return False
            
    except Exception as e:
        print(f"❌ FAILED: Error creating calendar event")
        print(f"   Error: {str(e)}")
        print(f"\n📋 Troubleshooting:")
        print(f"   1. Ensure Google Calendar API is enabled in Google Cloud Console")
        print(f"   2. Check that service account has Calendar API permissions")
        print(f"   3. Verify service_account.json file is valid")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_meet_link_creation()
    sys.exit(0 if success else 1)

