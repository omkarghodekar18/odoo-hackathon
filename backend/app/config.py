import os

class Settings:
    PROJECT_NAME: str = "EmPay HRMS"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    
    # JWT Settings
    SECRET_KEY: str = os.getenv("SECRET_KEY", "empay-super-secret-key-change-in-production-2024")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./empay.db")
    
    # CORS
    ALLOWED_ORIGINS: list = ["http://localhost:5173", "http://127.0.0.1:5173"]

settings = Settings()
