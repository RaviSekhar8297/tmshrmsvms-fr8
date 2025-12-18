"""Test endpoints with Manager and Employee credentials"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

print("=" * 70)
print("TESTING MANAGER AND EMPLOYEE ENDPOINTS")
print("=" * 70)

# Test Manager login
print("\n1. Testing Manager login...")
manager_login = client.post(
    "/api/auth/login",
    json={"username": "1027", "password": "manager123"}
)

if manager_login.status_code != 200:
    print(f"✗ Manager login failed: {manager_login.status_code}")
    print(manager_login.text)
    exit(1)

manager_token = manager_login.json()["access_token"]
manager_headers = {"Authorization": f"Bearer {manager_token}"}
print("✓ Manager login successful")

# Test Employee login
print("\n2. Testing Employee login...")
employee_login = client.post(
    "/api/auth/login",
    json={"username": "1460", "password": "employee123"}
)

if employee_login.status_code != 200:
    print(f"✗ Employee login failed: {employee_login.status_code}")
    print(employee_login.text)
    exit(1)

employee_token = employee_login.json()["access_token"]
employee_headers = {"Authorization": f"Bearer {employee_token}"}
print("✓ Employee login successful")

# Test Manager endpoints
print("\n3. Testing Manager endpoints...")
manager_endpoints = [
    ("GET", "/api/dashboard/stats", "Dashboard stats"),
    ("GET", "/api/meetings/upcoming?days=30", "Upcoming meetings"),
    ("GET", "/api/meetings/calendar?month=12&year=2025", "Calendar meetings"),
]

for method, endpoint, name in manager_endpoints:
    try:
        response = client.get(endpoint, headers=manager_headers)
        if response.status_code == 200:
            print(f"✓ Manager {name}: OK")
        else:
            print(f"✗ Manager {name}: {response.status_code}")
            print(f"  Error: {response.text[:300]}")
    except Exception as e:
        print(f"✗ Manager {name}: Exception - {e}")

# Test Employee endpoints
print("\n4. Testing Employee endpoints...")
employee_endpoints = [
    ("GET", "/api/dashboard/stats", "Dashboard stats"),
    ("GET", "/api/projects/stats", "Projects stats"),
    ("GET", "/api/projects/", "Projects list"),
    ("GET", "/api/meetings/upcoming?days=30", "Upcoming meetings"),
    ("GET", "/api/meetings/calendar?month=12&year=2025", "Calendar meetings"),
]

for method, endpoint, name in employee_endpoints:
    try:
        response = client.get(endpoint, headers=employee_headers)
        if response.status_code == 200:
            print(f"✓ Employee {name}: OK")
        else:
            print(f"✗ Employee {name}: {response.status_code}")
            print(f"  Error: {response.text[:300]}")
    except Exception as e:
        print(f"✗ Employee {name}: Exception - {e}")

print("\n" + "=" * 70)

