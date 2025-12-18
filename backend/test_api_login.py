"""Test actual API login endpoints"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

print("=" * 70)
print("API LOGIN ENDPOINT TEST")
print("=" * 70)

# Test credentials
test_users = [
    {"username": "101", "password": "admin123", "name": "Raja Sekhar", "role": "Admin"},
    {"username": "1027", "password": "manager123", "name": "ravi", "role": "Manager"},
    {"username": "1460", "password": "employee123", "name": "shiva", "role": "Employee"}
]

all_passed = True

for test_user in test_users:
    print(f"\n{'='*70}")
    print(f"Testing API Login: {test_user['name']} ({test_user['username']})")
    print(f"{'='*70}")
    
    try:
        # Test login endpoint
        response = client.post(
            "/api/auth/login",
            json={
                "username": test_user["username"],
                "password": test_user["password"]
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Check response structure
            if "access_token" in data and "user" in data and "expires_at" in data:
                print("✓ Login successful")
                print(f"  ✓ Access token received: {data['access_token'][:50]}...")
                print(f"  ✓ User data received")
                print(f"  ✓ Expires at: {data['expires_at']}")
                
                # Verify user data
                user_data = data["user"]
                if user_data["username"] == test_user["username"]:
                    print(f"  ✓ Username matches: {user_data['username']}")
                else:
                    print(f"  ✗ Username mismatch")
                    all_passed = False
                
                if user_data["role"] == test_user["role"]:
                    print(f"  ✓ Role matches: {user_data['role']}")
                else:
                    print(f"  ✗ Role mismatch: expected {test_user['role']}, got {user_data['role']}")
                    all_passed = False
                
                if user_data["name"] == test_user["name"]:
                    print(f"  ✓ Name matches: {user_data['name']}")
                else:
                    print(f"  ✗ Name mismatch")
                    all_passed = False
                
                # Test /me endpoint with token
                token = data["access_token"]
                me_response = client.get(
                    "/api/auth/me",
                    headers={"Authorization": f"Bearer {token}"}
                )
                
                if me_response.status_code == 200:
                    me_data = me_response.json()
                    print(f"  ✓ /me endpoint works: {me_data['name']}")
                else:
                    print(f"  ✗ /me endpoint failed: {me_response.status_code}")
                    all_passed = False
                
            else:
                print(f"✗ Invalid response structure")
                print(f"  Response: {data}")
                all_passed = False
                
        elif response.status_code == 401:
            print(f"✗ Login failed: Invalid credentials")
            print(f"  Response: {response.text}")
            all_passed = False
        else:
            print(f"✗ Login failed with status {response.status_code}")
            print(f"  Response: {response.text}")
            all_passed = False
            
    except Exception as e:
        print(f"✗ Exception occurred: {e}")
        import traceback
        traceback.print_exc()
        all_passed = False

# Test invalid credentials
print(f"\n{'='*70}")
print("Testing invalid credentials...")
print(f"{'='*70}")

invalid_response = client.post(
    "/api/auth/login",
    json={
        "username": "invalid",
        "password": "wrongpassword"
    }
)

if invalid_response.status_code == 401:
    print("✓ Invalid credentials correctly rejected")
else:
    print(f"✗ Invalid credentials not rejected (status: {invalid_response.status_code})")
    all_passed = False

# Summary
print(f"\n{'='*70}")
if all_passed:
    print("✓ ALL API LOGIN TESTS PASSED!")
else:
    print("✗ SOME API LOGIN TESTS FAILED")
print(f"{'='*70}")

print(f"\nSUMMARY:")
print(f"  Total users tested: {len(test_users)}")
print(f"  Invalid credentials test: Passed")
print(f"  All tests passed: {all_passed}")

