# SocialHub - Full-Stack Social Networking Platform

A modern, full-stack social networking platform built with Go and Next.js, featuring real-time messaging, groups, events, and comprehensive privacy controls.

## 📋 Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Running the Project](#running-the-project)
- [Technologies Used](#technologies-used)
- [API Endpoints](#api-endpoints)
- [Troubleshooting](#troubleshooting)

## ✨ Features

- **User Management**
  - User registration and authentication
  - Public and private profiles
  - Profile customization with avatar uploads

- **Social Features**
  - Follow/Unfollow system with request management
  - Posts with multiple privacy levels (Public, Almost-Private, Private)
  - Comments on posts with image support
  - Like and interact with posts

- **Groups**
  - Create and manage groups
  - Group invitations and join requests
  - Group posts and discussions
  - Group events with RSVP functionality

- **Real-Time Communication**
  - Private messaging between users
  - Group chat with WebSocket support
  - Real-time notifications

- **Privacy & Security**
  - Multi-level post privacy controls
  - Session-based authentication
  - SQL injection prevention
  - Secure password hashing (bcrypt)

## 🔧 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **Go** (v1.23.4 or higher) - [Download](https://golang.org/dl/)
- **npm** (comes with Node.js) or **yarn**
- **Git** - [Download](https://git-scm.com/)

## 📁 Project Structure

```
Social-Hub/
├── backend/                 # Go backend server
│   ├── database/           # Database operations
│   ├── handlers/           # HTTP handlers and WebSocket
│   ├── sessions/           # Session management
│   ├── followers/          # Follow system logic
│   ├── migrations/         # Database migrations
│   ├── main.go            # Entry point
│   └── go.mod             # Go dependencies
│
├── frontend/               # Next.js frontend
│   └── next/              # Next.js application
│       ├── src/
│       │   ├── app/       # Next.js app router pages
│       │   └── components/ # React components
│       ├── package.json   # Node.js dependencies
│       └── ...
│
└── README.md              # This file
```

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Social-Hub
```

### 2. Install Backend Dependencies

Navigate to the backend directory and install Go dependencies:

```bash
cd backend
go mod download
```

### 3. Install Frontend Dependencies

Navigate to the frontend/next directory and install Node.js dependencies:

```bash
cd ../frontend/next
npm install
```

## ▶️ Running the Project

The project consists of two parts that need to run simultaneously: the **backend server** and the **frontend application**.

### Running the Backend Server

1. Open a terminal/command prompt
2. Navigate to the backend directory:

```bash
cd backend
```

3. Run the Go server:

```bash
go run .
```

The backend server will start on `http://localhost:8080`

You should see output like:
```
Starting server on http://localhost:8080
✅ Unified WebSocket system ready!
✅ Group membership system ready!
✅ Group posts system ready!
✅ Group invite system ready!
📊 Database tables created automatically
```

### Running the Frontend Application

1. Open a **separate** terminal/command prompt (keep the backend running)
2. Navigate to the frontend/next directory:

```bash
cd frontend/next
```

3. Install dependencies (if you haven't already):

```bash
npm install
```

4. Build the Next.js application:

```bash
npm run build
```

5. Start the development server:

```bash
npm run dev
```

Or if you want to run in production mode:

```bash
npm start
```

The frontend application will start on `http://localhost:3000`

### Quick Start Summary

**Terminal 1 (Backend):**
```bash
cd backend
go run .
```

**Terminal 2 (Frontend):**
```bash
cd frontend/next
npm install
npm run build
npm run dev
```

## 🌐 Accessing the Application

Once both servers are running:

- **Frontend**: Open your browser and navigate to `http://localhost:3000`
- **Backend API**: Available at `http://localhost:8080`

## 🛠 Technologies Used

### Backend
- **Go 1.23.4** - Programming language
- **SQLite** - Database
- **Gorilla WebSocket** - Real-time communication
- **bcrypt** - Password hashing
- **golang-migrate** - Database migrations

### Frontend
- **Next.js 15.1.6** - React framework
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Styling
- **React Context API** - State management
- **Radix UI** - UI components
- **Lucide React** - Icons

## 📡 API Endpoints

The backend provides RESTful API endpoints for:

- `/register` - User registration
- `/login` - User authentication
- `/posts` - Post management
- `/comments` - Comment operations
- `/groups` - Group management
- `/messages` - Private messaging
- `/notifications` - Notification system
- `/ws` - WebSocket connection for real-time features

For detailed API documentation, refer to the backend handlers in `backend/handlers/`.

## 🐛 Troubleshooting

### Backend Issues

**Problem: Port 8080 already in use**
```bash
# Find and kill the process using port 8080
# On Windows:
netstat -ano | findstr :8080
taskkill /PID <PID> /F

# On Linux/Mac:
lsof -ti:8080 | xargs kill
```

**Problem: Go modules not found**
```bash
cd backend
go mod tidy
go mod download
```

**Problem: Database connection errors**
- Ensure SQLite is properly installed
- Check that the `SN.db` file has proper permissions
- The database will be created automatically on first run

### Frontend Issues

**Problem: Port 3000 already in use**
```bash
# Kill the process or use a different port
npm run dev -- -p 3001
```

**Problem: npm install fails**
```bash
# Clear npm cache and try again
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

**Problem: Build errors**
```bash
# Clear Next.js cache
rm -rf .next
npm run build
```

**Problem: Cannot connect to backend**
- Ensure the backend server is running on `http://localhost:8080`
- Check CORS settings in `backend/main.go`
- Verify the API endpoints in frontend code match the backend

### Common Issues

**Problem: WebSocket connection fails**
- Ensure both frontend and backend are running
- Check that port 8080 is accessible
- Verify WebSocket endpoint is `/ws`

**Problem: Images not loading**
- Check that the `uploads` directory exists in the backend
- Verify file permissions
- Ensure image upload endpoints are working

## 📝 Development Notes

### Database

The database (`SN.db`) is automatically created and migrated on first run. The migration files are located in `backend/migrations/`.

### Environment Variables

Currently, the project uses default configurations. For production, consider adding:
- Environment variables for database connection
- API keys for external services
- CORS configuration
- Session secret keys

### Building for Production

**Backend:**
```bash
cd backend
go build -o socialhub
./socialhub
```

**Frontend:**
```bash
cd frontend/next
npm run build
npm start
```

## 📄 License

This project is for educational purposes.

## 👥 Contributing

This is an academic project. For questions or issues, please refer to the project documentation.

## 📚 Additional Resources

- [Go Documentation](https://golang.org/doc/)
- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)

---

**Happy Coding! 🚀**

