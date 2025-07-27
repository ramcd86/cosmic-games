import { createClient, RedisClientType } from 'redis';
import { GameRoom } from '@cosmic-games/shared';

export class RedisService {
  private static instance: RedisService;
  private client: RedisClientType;
  private isConnected = false;
  private memoryStore = new Map<string, string>(); // In-memory fallback

  private constructor() {
    this.client = createClient({
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

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  public async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.isConnected = true;
    } catch (error) {
      console.log('⚠️  Redis not available - using in-memory storage (limited to single server instance)');
      this.isConnected = false;
      // Suppress further connection attempts
    }
  }

  public async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
    }
  }

  // Room operations
  public async saveRoom(room: GameRoom): Promise<void> {
    const key = `room:${room.id}`;
    const data = JSON.stringify(room);
    
    if (this.isConnected) {
      await this.client.setEx(key, 3600, data); // 1 hour TTL
    } else {
      this.memoryStore.set(key, data);
    }
  }

  public async getRoom(roomId: string): Promise<GameRoom | null> {
    const key = `room:${roomId}`;
    let data: string | null = null;
    
    if (this.isConnected) {
      data = await this.client.get(key);
    } else {
      data = this.memoryStore.get(key) || null;
    }
    
    return data ? JSON.parse(data) : null;
  }

  public async deleteRoom(roomId: string): Promise<void> {
    const key = `room:${roomId}`;
    
    if (this.isConnected) {
      await this.client.del(key);
    } else {
      this.memoryStore.delete(key);
    }
  }

  public async roomExists(roomId: string): Promise<boolean> {
    const key = `room:${roomId}`;
    
    if (this.isConnected) {
      return (await this.client.exists(key)) === 1;
    } else {
      return this.memoryStore.has(key);
    }
  }

  // Player session operations
  public async savePlayerSession(playerId: string, roomId: string, token: string): Promise<void> {
    const key = `session:${playerId}`;
    const sessionData = { roomId, token, lastActivity: new Date() };
    const data = JSON.stringify(sessionData);
    
    if (this.isConnected) {
      await this.client.setEx(key, 86400, data); // 24 hours TTL
    } else {
      this.memoryStore.set(key, data);
    }
  }

  public async getPlayerSession(playerId: string): Promise<any> {
    const key = `session:${playerId}`;
    let data: string | null = null;
    
    if (this.isConnected) {
      data = await this.client.get(key);
    } else {
      data = this.memoryStore.get(key) || null;
    }
    
    return data ? JSON.parse(data) : null;
  }

  public async deletePlayerSession(playerId: string): Promise<void> {
    const key = `session:${playerId}`;
    
    if (this.isConnected) {
      await this.client.del(key);
    } else {
      this.memoryStore.delete(key);
    }
  }

  // Room code management
  public async addRoomCode(roomCode: string, roomId: string): Promise<void> {
    const key = `code:${roomCode}`;
    
    if (this.isConnected) {
      await this.client.setEx(key, 3600, roomId);
    } else {
      this.memoryStore.set(key, roomId);
    }
  }

  public async getRoomIdByCode(roomCode: string): Promise<string | null> {
    const key = `code:${roomCode}`;
    
    if (this.isConnected) {
      return await this.client.get(key);
    } else {
      return this.memoryStore.get(key) || null;
    }
  }

  public async deleteRoomCode(roomCode: string): Promise<void> {
    const key = `code:${roomCode}`;
    
    if (this.isConnected) {
      await this.client.del(key);
    } else {
      this.memoryStore.delete(key);
    }
  }
}
