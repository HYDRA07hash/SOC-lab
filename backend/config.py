import os
from datetime import timedelta

class Config:
    # Flask settings
    SECRET_KEY = os.environ.get('SECRET_KEY', 'sentinelshield-super-secret-key-12345')
    JWT_SECRET = os.environ.get('JWT_SECRET', 'sentinelshield-jwt-secret-key-54321')
    JWT_EXPIRATION = timedelta(hours=1) # Tokens must expire in 1 hour maximum

    # Database settings
    DB_USER = os.environ.get('POSTGRES_USER', 'postgres')
    DB_PASSWORD = os.environ.get('POSTGRES_PASSWORD', 'admin123')
    DB_HOST = os.environ.get('POSTGRES_HOST', 'localhost')
    DB_PORT = os.environ.get('POSTGRES_PORT', '5432')
    DB_NAME = os.environ.get('POSTGRES_DB', 'sentinelshield')

    POSTGRES_URI = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    SQLITE_URI = "sqlite:///sentinelshield.db"

    # Auto fallback check
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')
    if not SQLALCHEMY_DATABASE_URI:
        if os.environ.get('USE_POSTGRES') == 'true' or os.environ.get('POSTGRES_HOST'):
            SQLALCHEMY_DATABASE_URI = POSTGRES_URI
        else:
            SQLALCHEMY_DATABASE_URI = SQLITE_URI

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Security simulation settings
    SIMULATOR_ENABLED = os.environ.get('SIMULATOR_ENABLED', 'true').lower() == 'true'
    SIMULATOR_INTERVAL = int(os.environ.get('SIMULATOR_INTERVAL', 5))  # seconds between mock attack logs
