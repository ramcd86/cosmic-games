# Cosmic Games Development Setup

## Prerequisites

Before running the application, ensure you have:

1. **Node.js 18+** installed
2. **Redis server** running locally (for backend storage)
3. **npm** package manager

## Quick Start

1. **Install all dependencies:**
   ```bash
   npm run install:all
   ```

2. **Build the shared package:**
   ```bash
   cd shared && npm run build
   ```

3. **Start Redis** (if not already running):
   - **Windows**: Download and install Redis, or use Docker
   - **macOS**: `brew install redis && redis-server`
   - **Linux**: `sudo apt-get install redis-server && redis-server`

4. **Start the development servers:**
   ```bash
   npm run dev
   ```

This will start both:
- **Backend API** on `http://localhost:3000`
- **Frontend App** on `http://localhost:4200`

## Manual Setup (Alternative)

If you prefer to start services individually:

### Backend
```bash
cd backend
npm run dev
```

### Frontend  
```bash
cd frontend
npm run dev
```

## Project Structure

```
cosmic-games/
├── backend/          # Node.js + Express + Socket.io API
├── frontend/         # Angular 17+ application  
├── shared/           # Shared TypeScript types and utilities
└── package.json      # Workspace configuration
```

## Environment Configuration

The backend uses environment variables. Copy `.env.example` to `.env` in the backend folder and update as needed:

```bash
cd backend
cp .env.example .env
```

## Current Implementation Status

✅ **Phase 1: Foundation (Completed)**
- [x] Project setup and repository structure
- [x] Basic Express server with TypeScript
- [x] Angular application with routing
- [x] Shared types and utilities
- [x] Tailwind CSS with casino theme
- [x] Basic API routes and Socket.io setup

🚧 **Next Steps:**
- Redis integration testing
- WebSocket connection implementation
- Game logic completion
- API integration in frontend

## Available Scripts

From the root directory:
- `npm run dev` - Start both backend and frontend in development mode
- `npm run build` - Build all packages for production
- `npm run install:all` - Install dependencies for all packages

## Technology Stack

- **Backend**: Node.js, Express.js, TypeScript, Socket.io, Redis
- **Frontend**: Angular 17+, TypeScript, Tailwind CSS
- **Shared**: TypeScript types and utilities
- **Real-time**: WebSocket communication
- **Storage**: Redis (in-memory) for development

## Game Features (Planned)

- **Room-based multiplayer** with 6-digit codes
- **Up to 6 players** per table (human + AI)
- **Gin Rummy** with classic and multiplayer variants
- **Real-time gameplay** with WebSocket updates
- **AI opponents** with multiple difficulty levels
- **Spectator mode** and chat system
