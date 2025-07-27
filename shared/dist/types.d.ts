export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export interface Card {
    suit: Suit;
    rank: Rank;
    id: string;
}
export type AIDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export interface PlayerStats {
    gamesPlayed: number;
    gamesWon: number;
    totalScore: number;
    averageScore: number;
    winRate: number;
}
export interface Player {
    id: string;
    name: string;
    isAI: boolean;
    difficulty?: AIDifficulty;
    isReady: boolean;
    cards: Card[];
    score: number;
    statistics: PlayerStats;
    isConnected: boolean;
    lastActivity: Date;
}
export type GamePhase = 'waiting' | 'playing' | 'finished';
export interface GameAction {
    type: 'draw' | 'discard' | 'knock' | 'gin' | 'pass';
    playerId: string;
    card?: Card;
    timestamp: Date;
}
export interface GameState {
    phase: GamePhase;
    currentPlayer: string;
    deck: Card[];
    discardPile: Card[];
    turnNumber: number;
    lastAction?: GameAction;
    startedAt?: Date;
    finishedAt?: Date;
}
export interface RoomSettings {
    maxPlayers: number;
    allowSpectators: boolean;
    isPrivate: boolean;
    gameVariant: 'classic' | 'multiplayer';
    turnTimeLimit: number;
    pointLimit: number;
}
export interface GameRoom {
    id: string;
    name: string;
    hostId: string;
    players: Player[];
    spectators: string[];
    gameState: GameState;
    settings: RoomSettings;
    createdAt: Date;
    lastActivity: Date;
}
export interface ClientToServerEvents {
    'join-room': (roomCode: string, playerName: string) => void;
    'leave-room': (roomCode: string) => void;
    'game-action': (roomCode: string, action: GameAction) => void;
    'chat-message': (roomCode: string, message: string) => void;
    'player-ready': (roomCode: string) => void;
    'start-game': (roomCode: string) => void;
}
export interface ServerToClientEvents {
    'room-updated': (room: GameRoom) => void;
    'game-updated': (gameState: GameState) => void;
    'player-joined': (player: Player) => void;
    'player-left': (playerId: string) => void;
    'chat-received': (playerId: string, playerName: string, message: string, timestamp: Date) => void;
    'error': (message: string) => void;
    'game-started': () => void;
    'game-ended': (winnerId: string, finalScores: Record<string, number>) => void;
    'player-info': (data: {
        playerId: string;
        playerName: string;
    }) => void;
}
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}
export interface CreateRoomRequest {
    name: string;
    playerName: string;
    settings: Partial<RoomSettings>;
}
export interface CreateRoomResponse {
    room: GameRoom;
    playerToken: string;
}
export interface JoinRoomRequest {
    roomCode: string;
    playerName: string;
}
export interface JoinRoomResponse {
    room: GameRoom;
    playerToken: string;
}
//# sourceMappingURL=types.d.ts.map