"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const GameManager_1 = require("./services/GameManager");
const RedisService_1 = require("./services/RedisService");
const rooms_1 = __importDefault(require("./routes/rooms"));
const games_1 = __importDefault(require("./routes/games"));
const SocketHandler_1 = require("./handlers/SocketHandler");
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
// Socket.IO setup with type safety
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || "http://localhost:4200",
        methods: ["GET", "POST"]
    }
});
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || "http://localhost:4200",
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api', limiter);
app.use(express_1.default.json());
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// API Routes
app.use('/api/rooms', rooms_1.default);
app.use('/api/games', games_1.default);
// Initialize services
async function startServer() {
    try {
        // Initialize Redis connection (optional for development)
        try {
            const redisService = RedisService_1.RedisService.getInstance();
            await redisService.connect();
            console.log('✅ Connected to Redis');
        }
        catch (error) {
            console.log('⚠️  Redis not available - running in development mode without persistence');
        }
        // Initialize Game Manager
        const gameManager = GameManager_1.GameManager.getInstance();
        // Initialize Socket Handler
        const socketHandler = new SocketHandler_1.SocketHandler(io, gameManager);
        socketHandler.initialize();
        console.log('✅ Socket.IO initialized');
        const PORT = process.env.PORT || 3001;
        server.listen(PORT, () => {
            console.log(`🚀 Cosmic Games Server running on port ${PORT}`);
            console.log(`📱 Frontend should connect to http://localhost:${PORT}`);
        });
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}
// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🔄 Shutting down gracefully...');
    const redisService = RedisService_1.RedisService.getInstance();
    await redisService.disconnect();
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
startServer();
//# sourceMappingURL=index.js.map