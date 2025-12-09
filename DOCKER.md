# Docker Setup for Social Network

This guide will help you run the social network application using Docker.

## Prerequisites

- Docker installed on your system
- Docker Compose installed on your system

## Quick Start

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone <your-repo-url>
   cd social-network
   ```

2. **Build and run the application**:
   ```bash
   docker-compose up --build
   ```

3. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8080

## Individual Services

### Backend Only
```bash
# Build the backend image
docker build -t social-network-backend ./backend

# Run the backend container
docker run -p 8080:8080 -v $(pwd)/backend/uploads:/root/uploads -v $(pwd)/backend/SN.db:/root/SN.db social-network-backend
```

### Frontend Only
```bash
# Build the frontend image
docker build -t social-network-frontend ./frontend/next

# Run the frontend container
docker run -p 3000:3000 -e NEXT_PUBLIC_API_URL=http://localhost:8080 social-network-frontend
```

## Development Mode

For development, you can use the following commands:

```bash
# Run in detached mode (background)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

## Environment Variables

You can customize the application by setting environment variables:

### Backend
- `PORT`: Port for the backend server (default: 8080)

### Frontend
- `NEXT_PUBLIC_API_URL`: URL of the backend API (default: http://localhost:8080)

## Data Persistence

The following data is persisted using Docker volumes:
- Database file (`SN.db`)
- Uploaded files (`uploads/` directory)

## Troubleshooting

### Port Conflicts
If you get port conflicts, you can change the ports in `docker-compose.yml`:
```yaml
ports:
  - "8081:8080"  # Change 8081 to any available port
```

### Build Issues
If you encounter build issues:
1. Clean Docker cache: `docker system prune -a`
2. Rebuild without cache: `docker-compose build --no-cache`

### Database Issues
If the database doesn't persist:
1. Check if the volume is properly mounted
2. Ensure the `SN.db` file exists in the backend directory
3. Check file permissions

## Production Deployment

For production deployment, consider:
1. Using environment-specific docker-compose files
2. Setting up proper SSL/TLS certificates
3. Using a reverse proxy (nginx)
4. Setting up proper logging and monitoring
5. Using Docker secrets for sensitive data

## Useful Commands

```bash
# View running containers
docker ps

# View logs for a specific service
docker-compose logs backend
docker-compose logs frontend

# Execute commands in running containers
docker-compose exec backend sh
docker-compose exec frontend sh

# Restart a specific service
docker-compose restart backend

# Scale services (if needed)
docker-compose up --scale backend=2
``` 