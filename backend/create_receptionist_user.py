"""
Script to create default Receptionist user
Run this script to create the default Front Desk user
"""
from database import SessionLocal
from models import User
from utils import hash_password

def create_receptionist_user():
    db = SessionLocal()
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.empid == "99").first()
        if existing_user:
            print("Receptionist user already exists. Updating...")
            existing_user.name = "Receptionist"
            existing_user.username = "99"
            existing_user.password = hash_password("123123")
            existing_user.role = "Front Desk"
            existing_user.email = "receptionist@brihaspathi.com"
            existing_user.is_active = True
            existing_user.image_base64 = None
            db.commit()
            print("Receptionist user updated successfully!")
            return
        
        # Create new user
        new_user = User(
            empid="99",
            name="Receptionist",
            username="99",
            password=hash_password("123123"),
            role="Front Desk",
            email="receptionist@brihaspathi.com",
            is_active=True,
            image_base64=None
        )
        
        db.add(new_user)
        db.commit()
        print("Receptionist user created successfully!")
        print("Login ID: 99")
        print("Password: 123123")
        print("Role: Front Desk")
    except Exception as e:
        db.rollback()
        print(f"Error creating Receptionist user: {str(e)}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    create_receptionist_user()

