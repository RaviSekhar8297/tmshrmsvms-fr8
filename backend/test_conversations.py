#!/usr/bin/env python
"""Quick test script to check conversation projects filtering"""
from database import SessionLocal
from models import Project, User

db = SessionLocal()

# Find user with empid 1027
user = db.query(User).filter(User.empid == '1027').first()
if user:
    print(f"User found: {user.empid} - {user.name} - Role: {user.role}")
    user_empid = str(user.empid).strip()
    print(f"User empid (cleaned): '{user_empid}'")
else:
    print("User with empid 1027 NOT FOUND!")
    db.close()
    exit(1)

# Get all non-completed projects
all_projects = db.query(Project).filter(Project.status != 'completed').all()
print(f"\nTotal non-completed projects: {len(all_projects)}")

matching_projects = []
for project in all_projects:
    print(f"\n--- Project {project.id}: {project.name} ---")
    print(f"Teams: {project.teams}")
    print(f"Teams type: {type(project.teams)}")
    
    if project.teams and isinstance(project.teams, list):
        print(f"Teams is a list with {len(project.teams)} members")
        for i, member in enumerate(project.teams):
            print(f"  Member {i}: {member} (type: {type(member)})")
            if isinstance(member, dict):
                member_empid = member.get("empid")
                if member_empid:
                    member_empid_str = str(member_empid).strip()
                    print(f"    Comparing '{member_empid_str}' with '{user_empid}'")
                    if member_empid_str == user_empid:
                        print(f"    ✓ MATCH! Adding project {project.id}")
                        matching_projects.append(project)
                        break
    else:
        print(f"Teams is not a list or is None")

print(f"\n=== SUMMARY ===")
print(f"Matching projects: {len(matching_projects)}")
for p in matching_projects:
    print(f"  - {p.id}: {p.name}")

db.close()

