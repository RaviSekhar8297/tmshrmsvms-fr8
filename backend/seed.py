"""
Seed script to create tables and default users
Run: python seed.py
"""
from database import engine, Base, SessionLocal
from models import User, AuthToken
from utils import hash_password

def seed_database():
    # Create all tables
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✅ Tables created successfully!")
    
    # Create session
    db = SessionLocal()
    
    try:
        # Delete all auth tokens first (foreign key constraint)
        db.query(AuthToken).delete()
        db.commit()
        print("🗑️  Cleared all auth tokens")
        
        # Delete existing default users
        db.query(User).filter(User.username.in_(["admin1", "manager1", "employee1"])).delete(synchronize_session=False)
        db.commit()
        print("🗑️  Deleted existing default users")
        
        # Create default users
        default_users = [
            {
                "empid": "EMP001",
                "name": "Admin One",
                "email": "admin@tms.com",
                "phone": "9999999999",
                "username": "admin1",
                "password": hash_password("admin123"),
                "role": "Admin",
                "is_active": True,
                "sms_consent": True,
                "whatsapp_consent": True,
                "email_consent": True
            },
            {
                "empid": "EMP002",
                "name": "Manager One",
                "email": "manager@tms.com",
                "phone": "8888888888",
                "username": "manager1",
                "password": hash_password("manager123"),
                "role": "Manager",
                "is_active": True,
                "sms_consent": True,
                "whatsapp_consent": True,
                "email_consent": True
            },
            {
                "empid": "EMP003",
                "name": "Employee One",
                "email": "employee@tms.com",
                "phone": "7777777777",
                "username": "employee1",
                "password": hash_password("employee123"),
                "role": "Employee",
                "is_active": True,
                "sms_consent": True,
                "whatsapp_consent": True,
                "email_consent": True
            }
        ]
        
        print("Creating default users...")
        for user_data in default_users:
            user = User(**user_data)
            db.add(user)
            print(f"  ✅ Created user: {user_data['username']} ({user_data['role']})")
        
        db.commit()
        print("\n🎉 Database seeded successfully!")
        print("\n📋 Default Credentials:")
        print("  Admin:    admin1 / admin123")
        print("  Manager:  manager1 / manager123")
        print("  Employee: employee1 / employee123")
        
    except Exception as e:
        print(f"❌ Error seeding database: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
