import requests
import json

base_url = "http://localhost:8000/api"

# Test login for each user
users = [
    {"username": "101", "password": "admin123", "role": "Admin"},
    {"username": "1027", "password": "manager123", "role": "Manager"},
    {"username": "1460", "password": "employee123", "role": "Employee"}
]

print("Testing login for all users...\n")

for user in users:
    try:
        response = requests.post(
            f"{base_url}/auth/login",
            json={"username": user["username"], "password": user["password"]}
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ {user['role']} login successful!")
            print(f"  Username: {user['username']}")
            print(f"  Name: {data['user']['name']}")
            print(f"  Email: {data['user']['email']}")
            print(f"  Role: {data['user']['role']}")
            print(f"  EmpID: {data['user']['empid']}")
            print(f"  Report To: {data['user'].get('report_to_id', 'None')}")
            print()
        else:
            print(f"✗ {user['role']} login failed: {response.status_code}")
            print(f"  Error: {response.text}\n")
    except Exception as e:
        print(f"✗ {user['role']} login error: {str(e)}\n")

print("Login test completed!")

