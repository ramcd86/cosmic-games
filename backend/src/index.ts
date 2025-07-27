import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { ClientToServerEvents, ServerToClientEvents } from '@cosmic-games/shared';

import { GameManager } from './services/GameManager';
import { RedisService } from './services/RedisService';
import roomRoutes from './routes/rooms';
import gameRoutes from './routes/games';
import { SocketHandler } from './handlers/SocketHandler';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);

// Socket.IO setup with type safety
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:4200",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:4200",
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api', limiter);

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/rooms', roomRoutes);
app.use('/api/games', gameRoutes);

// Initialize services
async function startServer() {
  try {
    // Initialize Redis connection (optional for development)
    try {
      const redisService = RedisService.getInstance();
      await redisService.connect();
      console.log('✅ Connected to Redis');
    } catch (error) {
      console.log('⚠️  Redis not available - running in development mode without persistence');
    }

    // Initialize Game Manager
    const gameManager = GameManager.getInstance();
    
    // Initialize Socket Handler
    const socketHandler = new SocketHandler(io, gameManager);
    socketHandler.initialize();
    console.log('✅ Socket.IO initialized');

    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
      console.log(`🚀 Cosmic Games Server running on port ${PORT}`);
      console.log(`📱 Frontend should connect to http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🔄 Shutting down gracefully...');
  const redisService = RedisService.getInstance();
  await redisService.disconnect();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

startServer();
