from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import settings

# Update connection string to use psycopg3 driver
database_url = settings.DATABASE_URL.replace("postgresql://", "postgresql+psycopg://")

# Optimize connection pooling for better performance
engine = create_engine(
    database_url,
    pool_size=10,  # Number of connections to maintain in the pool
    max_overflow=20,  # Maximum number of connections beyond pool_size
    pool_pre_ping=True,  # Verify connections before using them
    pool_recycle=3600,  # Recycle connections after 1 hour
    echo=False  # Set to True for SQL query debugging
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
