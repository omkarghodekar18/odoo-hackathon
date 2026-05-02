from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base
from app.models import *  # noqa: F401, F403 - Import all models to register them
from app.routers import auth, employees, attendance, leave, payroll, dashboard

# Create all tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(employees.router, prefix=settings.API_PREFIX)
app.include_router(attendance.router, prefix=settings.API_PREFIX)
app.include_router(leave.router, prefix=settings.API_PREFIX)
app.include_router(payroll.router, prefix=settings.API_PREFIX)
app.include_router(dashboard.router, prefix=settings.API_PREFIX)


@app.get("/")
def root():
    return {"message": "EmPay HRMS API", "version": settings.VERSION}


@app.get("/health")
def health():
    return {"status": "healthy"}
