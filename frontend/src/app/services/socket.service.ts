import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { 
  ClientToServerEvents, 
  ServerToClientEvents, 
  GameRoom, 
  GameState, 
  Player,
  GameAction
} from '@cosmic-games/shared';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private connected = false;

  // Observable streams for real-time updates
  private roomUpdatedSubject = new BehaviorSubject<GameRoom | null>(null);
  private gameUpdatedSubject = new BehaviorSubject<GameState | null>(null);
  private playerJoinedSubject = new BehaviorSubject<Player | null>(null);
  private playerLeftSubject = new BehaviorSubject<string | null>(null);
  private chatReceivedSubject = new BehaviorSubject<{
    playerId: string;
    playerName: string;
    message: string;
    timestamp: Date;
  } | null>(null);
  private errorSubject = new BehaviorSubject<string | null>(null);
  private gameStartedSubject = new BehaviorSubject<boolean>(false);
  private gameEndedSubject = new BehaviorSubject<{
    winnerId: string;
    finalScores: Record<string, number>;
  } | null>(null);
  private playerInfoSubject = new BehaviorSubject<{
    playerId: string;
    playerName: string;
  } | null>(null);
  private playerActionSubject = new BehaviorSubject<GameAction | null>(null);

  // Public observables
  public roomUpdated$ = this.roomUpdatedSubject.asObservable();
  public gameUpdated$ = this.gameUpdatedSubject.asObservable();
  public playerJoined$ = this.playerJoinedSubject.asObservable();
  public playerLeft$ = this.playerLeftSubject.asObservable();
  public chatReceived$ = this.chatReceivedSubject.asObservable();
  public error$ = this.errorSubject.asObservable();
  public gameStarted$ = this.gameStartedSubject.asObservable();
  public gameEnded$ = this.gameEndedSubject.asObservable();
  public playerInfo$ = this.playerInfoSubject.asObservable();
  public playerAction$ = this.playerActionSubject.asObservable();

  constructor() {}

  /**
   * Connect to the Socket.IO server
   */
  connect(): void {
    if (this.connected) return;

    this.socket = io(environment.apiUrl, {
      transports: ['websocket', 'polling']
    });

    this.setupEventListeners();
  }

  /**
   * Disconnect from the Socket.IO server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  /**
   * Join a room
   */
  joinRoom(roomCode: string, playerName: string): void {
    if (this.socket) {
      this.socket.emit('join-room', roomCode, playerName);
    }
  }

  /**
   * Leave a room
   */
  leaveRoom(roomCode: string): void {
    if (this.socket) {
      this.socket.emit('leave-room', roomCode);
    }
  }

  /**
   * Make a game action
   */
  makeGameAction(roomCode: string, action: any): void {
    if (this.socket) {
      this.socket.emit('game-action', roomCode, action);
    }
  }

  /**
   * Send a chat message
   */
  sendChatMessage(roomCode: string, message: string): void {
    if (this.socket) {
      this.socket.emit('chat-message', roomCode, message);
    }
  }

  /**
   * Toggle player ready status
   */
  togglePlayerReady(roomCode: string): void {
    if (this.socket) {
      this.socket.emit('player-ready', roomCode);
    }
  }

  /**
   * Start the game
   */
  startGame(roomCode: string): void {
    if (this.socket) {
      this.socket.emit('start-game', roomCode);
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected && this.socket?.connected === true;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.connected = true;
      console.log('Connected to game server');
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      console.log('Disconnected from game server');
    });

    this.socket.on('room-updated', (room: GameRoom) => {
      try {
        console.log('📡 Received room-updated:', {
          roomId: room.id,
          playersCount: room.players?.length,
          currentPlayer: room.gameState?.currentPlayer,
          discardPileLength: room.gameState?.discardPile?.length,
          discardPileTop: room.gameState?.discardPile?.length > 0 ? 
            room.gameState.discardPile[room.gameState.discardPile.length - 1] : null
        });
        if (room && room.players && Array.isArray(room.players)) {
          this.roomUpdatedSubject.next(room);
        } else {
          console.error('❌ Invalid room data received:', room);
        }
      } catch (error) {
        console.error('❌ Error processing room-updated:', error, room);
      }
    });

    this.socket.on('game-updated', (gameState: GameState) => {
      this.gameUpdatedSubject.next(gameState);
    });

    this.socket.on('player-joined', (player: Player) => {
      this.playerJoinedSubject.next(player);
    });

    this.socket.on('player-left', (playerId: string) => {
      this.playerLeftSubject.next(playerId);
    });

    this.socket.on('chat-received', (playerId: string, playerName: string, message: string, timestamp: Date) => {
      this.chatReceivedSubject.next({
        playerId,
        playerName,
        message,
        timestamp
      });
    });

    this.socket.on('error', (message: string) => {
      this.errorSubject.next(message);
      console.error('Socket error:', message);
    });

    this.socket.on('game-started', () => {
      this.gameStartedSubject.next(true);
    });

    this.socket.on('game-ended', (winnerId: string, finalScores: Record<string, number>) => {
      this.gameEndedSubject.next({
        winnerId,
        finalScores
      });
    });

    (this.socket as any).on('player-action', (action: GameAction) => {
      this.playerActionSubject.next(action);
      console.log('📡 Received player action:', action);
    });

    // Temporarily commented until types are updated
    // this.socket.on('player-info', (data: { playerId: string; playerName: string }) => {
    //   this.playerInfoSubject.next(data);
    // });
  }
}
