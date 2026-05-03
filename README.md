# 🏢 EmPay - Employee Management & Payroll System

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19.2.5-61dafb.svg?logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104.1-009688.svg?logo=fastapi)

EmPay is a modern, comprehensive, and scalable Employee Management and Payroll System designed to streamline HR operations. It offers an intuitive interface for managing employee profiles, tracking attendance, handling leave requests, and calculating complex payroll structures with accuracy.

## 🎥 Demo Video

[![Demo Video](https://img.shields.io/badge/Watch-Demo_Video-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://www.youtube.com/watch?v=mjr0J8JFmuk)

**[Watch the full demo here!](https://www.youtube.com/watch?v=mjr0J8JFmuk)**

## ✨ Features

- **🛡️ Authentication & Authorization**: Secure login and registration with JWT-based authentication.
- **📊 Interactive Dashboard**: Real-time analytics, charts, and overviews of company statistics using Recharts.
- **👥 Employee Management**: Comprehensive directory, detailed employee profiles, and structural management.
- **⏰ Attendance Tracking**: Daily attendance logging, status tracking, and reporting.
- **🏖️ Leave Management**: Request, approve, or reject leave applications seamlessly.
- **💰 Payroll Processing**: Advanced hours-based payroll calculation, salary structure management, and payslip generation.
- **📄 Reporting**: Insightful reports and analytics for HR and management.

## 🛠️ Tech Stack

### Frontend
- **React (v19)** with **Vite** for blazing-fast development and performance.
- **React Router DOM** for seamless SPA navigation.
- **Recharts** for beautiful data visualization.
- **Axios** for robust API communication.
- **React Hot Toast** for user notifications.
- **React Icons** for a modern UI.

### Backend
- **FastAPI** for high-performance, asynchronous REST APIs.
- **SQLAlchemy** for powerful ORM capabilities.
- **Pydantic** for rigorous data validation.
- **SQLite** as the database (easily scalable to PostgreSQL).
- **JWT (python-jose)** & **bcrypt** for top-tier security.

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Python](https://www.python.org/) (v3.9 or higher)

### 1. Backend Setup

Navigate to the backend directory:
```bash
cd backend
```

Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`
```

Install the required Python packages:
```bash
pip install -r requirements.txt
```

Run the FastAPI server:
```bash
uvicorn app.main:app --reload
```
The backend API will be running at `http://localhost:8000`. You can view the interactive API documentation (Swagger UI) at `http://localhost:8000/docs`.

### 2. Frontend Setup

Open a new terminal and navigate to the frontend directory:
```bash
cd frontend
```

Install the Node.js dependencies:
```bash
npm install
```

Start the Vite development server:
```bash
npm run dev
```
The frontend application will be running at `http://localhost:5173`.

## 📂 Project Structure

```text
.
├── backend/
│   ├── app/
│   │   ├── models/          # SQLAlchemy database models
│   │   ├── routers/         # FastAPI route handlers
│   │   ├── schemas/         # Pydantic schemas for validation
│   │   ├── services/        # Business logic and services
│   │   └── main.py          # FastAPI application entry point
│   ├── requirements.txt     # Python dependencies
│   └── empay.db             # SQLite Database
│
└── frontend/
    ├── src/
    │   ├── pages/           # React component pages (Dashboard, Payroll, etc.)
    │   ├── components/      # Reusable React components
    │   └── App.jsx          # Main application routing
    ├── package.json         # Node.js dependencies
    └── vite.config.js       # Vite configuration
```

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the issues page if you want to contribute.

## 📝 License

This project is open-source and available under the [MIT License](LICENSE).
