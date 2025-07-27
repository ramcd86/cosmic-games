"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const redis_1 = require("redis");
class RedisService {
    constructor() {
        this.isConnected = false;
        this.memoryStore = new Map(); // In-memory fallback
        this.client = (0, redis_1.createClient)({
            socket: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                reconnectStrategy: false // Disable automatic reconnection
            },
            password: process.env.REDIS_PASSWORD || undefined
        });
        this.client.on('error', (err) => {
            // Only log the first error, then suppress subsequent ones
            if (this.isConnected !== false) {
                console.log('Redis not available, falling back to in-memory storage');
                this.isConnected = false;
            }
        });
        this.client.on('connect', () => {
            console.log('Redis Client Connected');
            this.isConnected = true;
        });
    }
    static getInstance() {
        if (!RedisService.instance) {
            RedisService.instance = new RedisService();
        }
        return RedisService.instance;
    }
    async connect() {
        try {
            await this.client.connect();
            this.isConnected = true;
        }
        catch (error) {
            console.log('⚠️  Redis not available - using in-memory storage (limited to single server instance)');
            this.isConnected = false;
            // Suppress further connection attempts
        }
    }
    async disconnect() {
        if (this.isConnected) {
            await this.client.disconnect();
        }
    }
    // Room operations
    async saveRoom(room) {
        const key = `room:${room.id}`;
        const data = JSON.stringify(room);
        if (this.isConnected) {
            await this.client.setEx(key, 3600, data); // 1 hour TTL
        }
        else {
            this.memoryStore.set(key, data);
        }
    }
    async getRoom(roomId) {
        const key = `room:${roomId}`;
        let data = null;
        if (this.isConnected) {
            data = await this.client.get(key);
        }
        else {
            data = this.memoryStore.get(key) || null;
        }
        return data ? JSON.parse(data) : null;
    }
    async deleteRoom(roomId) {
        const key = `room:${roomId}`;
        if (this.isConnected) {
            await this.client.del(key);
        }
        else {
            this.memoryStore.delete(key);
        }
    }
    async roomExists(roomId) {
        const key = `room:${roomId}`;
        if (this.isConnected) {
            return (await this.client.exists(key)) === 1;
        }
        else {
            return this.memoryStore.has(key);
        }
    }
    // Player session operations
    async savePlayerSession(playerId, roomId, token) {
        const key = `session:${playerId}`;
        const sessionData = { roomId, token, lastActivity: new Date() };
        const data = JSON.stringify(sessionData);
        if (this.isConnected) {
            await this.client.setEx(key, 86400, data); // 24 hours TTL
        }
        else {
            this.memoryStore.set(key, data);
        }
    }
    async getPlayerSession(playerId) {
        const key = `session:${playerId}`;
        let data = null;
        if (this.isConnected) {
            data = await this.client.get(key);
        }
        else {
            data = this.memoryStore.get(key) || null;
        }
        return data ? JSON.parse(data) : null;
    }
    async deletePlayerSession(playerId) {
        const key = `session:${playerId}`;
        if (this.isConnected) {
            await this.client.del(key);
        }
        else {
            this.memoryStore.delete(key);
        }
    }
    // Room code management
    async addRoomCode(roomCode, roomId) {
        const key = `code:${roomCode}`;
        if (this.isConnected) {
            await this.client.setEx(key, 3600, roomId);
        }
        else {
            this.memoryStore.set(key, roomId);
        }
    }
    async getRoomIdByCode(roomCode) {
        const key = `code:${roomCode}`;
        if (this.isConnected) {
            return await this.client.get(key);
        }
        else {
            return this.memoryStore.get(key) || null;
        }
    }
    async deleteRoomCode(roomCode) {
        const key = `code:${roomCode}`;
        if (this.isConnected) {
            await this.client.del(key);
        }
        else {
            this.memoryStore.delete(key);
        }
    }
}
exports.RedisService = RedisService;
//# sourceMappingURL=RedisService.js.map