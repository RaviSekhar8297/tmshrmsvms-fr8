"""Test all endpoints to verify they work"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

print("=" * 70)
print("TESTING ALL ENDPOINTS")
print("=" * 70)

# First login to get token
print("\n1. Testing login...")
login_response = client.post(
    "/api/auth/login",
    json={"username": "101", "password": "admin123"}
)

if login_response.status_code != 200:
    print(f"✗ Login failed: {login_response.status_code}")
    print(login_response.text)
    exit(1)

token = login_response.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}
print("✓ Login successful")

# Test endpoints
endpoints = [
    ("GET", "/api/projects/", "Projects list"),
    ("GET", "/api/projects/stats", "Projects stats"),
    ("GET", "/api/tasks/", "Tasks list"),
    ("GET", "/api/tasks/stats", "Tasks stats"),
    ("GET", "/api/issues/", "Issues list"),
    ("GET", "/api/issues/stats", "Issues stats"),
    ("GET", "/api/dashboard/stats", "Dashboard stats"),
    ("GET", "/api/dashboard/progress", "Dashboard progress"),
    ("GET", "/api/meetings/upcoming?days=7", "Upcoming meetings"),
    ("GET", "/api/meetings/calendar?month=12&year=2025", "Calendar meetings"),
    ("GET", "/api/reports/filters", "Reports filters"),
]

passed = 0
failed = 0

for method, endpoint, name in endpoints:
    try:
        if method == "GET":
            response = client.get(endpoint, headers=headers)
        
        if response.status_code == 200:
            print(f"✓ {name}: OK")
            passed += 1
        else:
            print(f"✗ {name}: {response.status_code}")
            print(f"  Error: {response.text[:200]}")
            failed += 1
    except Exception as e:
        print(f"✗ {name}: Exception - {e}")
        failed += 1

print(f"\n{'='*70}")
print(f"RESULTS: {passed} passed, {failed} failed")
print(f"{'='*70}")

