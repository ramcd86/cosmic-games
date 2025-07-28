"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketHandler = void 0;
class SocketHandler {
    constructor(io, gameManager) {
        this.playerSessions = new Map();
        this.io = io;
        this.gameManager = gameManager;
        // Pass the socket server to GameManager for emitting player actions
        this.gameManager.setSocketServer(io);
    }
    initialize() {
        this.io.on('connection', (socket) => {
            console.log(`Player connected: ${socket.id}`);
            // Join room event
            socket.on('join-room', async (roomCode, playerName) => {
                try {
                    const result = await this.gameManager.joinRoom(roomCode, playerName);
                    // Find the player (either newly created or reconnected)
                    const player = result.room.players.find(p => p.name === playerName && !p.isAI);
                    if (!player) {
                        throw new Error('Failed to find player in room');
                    }
                    // Store player session
                    this.playerSessions.set(socket.id, {
                        playerId: player.id,
                        playerName: player.name,
                        roomCode: roomCode
                    });
                    console.log(`✅ Session created - Socket: ${socket.id}, Player: ${player.name} (${player.id}), Room: ${roomCode}`);
                    console.log(`📊 Total active sessions: ${this.playerSessions.size}`);
                    console.log(`Player ${playerName} (${player.id}) joined room ${roomCode} via socket ${socket.id}`);
                    // Join socket room for broadcasting
                    socket.join(roomCode);
                    // Send room update to all players in the room
                    this.io.to(roomCode).emit('room-updated', result.room);
                    // Notify others about player joining (only if this is a new player, not a reconnection)
                    const wasReconnection = result.room.players.filter(p => p.name === playerName && !p.isAI).length === 1;
                    if (!wasReconnection) {
                        socket.to(roomCode).emit('player-joined', player);
                    }
                }
                catch (error) {
                    console.error(`Failed to join room ${roomCode}:`, error);
                    socket.emit('error', error instanceof Error ? error.message : 'Failed to join room');
                }
            });
            // Leave room event
            socket.on('leave-room', async (roomCode) => {
                try {
                    const session = this.playerSessions.get(socket.id);
                    if (!session)
                        return;
                    const room = await this.gameManager.leaveRoom(roomCode, session.playerId);
                    socket.leave(roomCode);
                    this.playerSessions.delete(socket.id);
                    if (room) {
                        this.io.to(roomCode).emit('room-updated', room);
                        this.io.to(roomCode).emit('player-left', session.playerId);
                    }
                }
                catch (error) {
                    socket.emit('error', error instanceof Error ? error.message : 'Failed to leave room');
                }
            });
            // Chat message event
            socket.on('chat-message', async (roomCode, message) => {
                try {
                    const session = this.playerSessions.get(socket.id);
                    if (!session)
                        return;
                    // Broadcast chat message to all players in the room
                    this.io.to(roomCode).emit('chat-received', session.playerId, session.playerName, message, new Date());
                }
                catch (error) {
                    socket.emit('error', error instanceof Error ? error.message : 'Failed to send message');
                }
            });
            // Game action event
            socket.on('game-action', async (roomCode, action) => {
                try {
                    console.log('🎮 Game action received:', { roomCode, action: action.type, playerId: action.playerId });
                    const session = this.playerSessions.get(socket.id);
                    if (!session) {
                        console.log('❌ No session found for socket:', socket.id);
                        return;
                    }
                    const room = await this.gameManager.processGameAction(roomCode, session.playerId, action);
                    if (room) {
                        console.log('📡 Emitting room-updated after game action:', {
                            roomCode,
                            roomExists: !!room,
                            playersCount: room.players?.length,
                            hasGameState: !!room.gameState,
                            players: room.players?.map(p => ({ id: p.id, name: p.name, cardsCount: p.cards?.length }))
                        });
                        this.io.to(roomCode).emit('room-updated', room);
                        // Note: Game end handling is now done in GameManager.endGameDueToEmptyDeck()
                    }
                    else {
                        console.log('❌ No room returned from processGameAction');
                    }
                }
                catch (error) {
                    console.error('❌ Error processing game action:', error);
                    socket.emit('error', error instanceof Error ? error.message : 'Failed to process game action');
                }
            });
            // Player ready event
            socket.on('player-ready', async (roomCode) => {
                try {
                    console.log(`🔍 Player ready request - Socket: ${socket.id}, Room: ${roomCode}`);
                    const session = this.playerSessions.get(socket.id);
                    console.log(`🔍 Session found:`, session ? `Player: ${session.playerName} (${session.playerId})` : 'No session');
                    console.log(`🔍 Total sessions:`, this.playerSessions.size);
                    if (!session) {
                        socket.emit('error', 'Player session not found');
                        return;
                    }
                    const room = await this.gameManager.getRoom(roomCode);
                    if (!room) {
                        socket.emit('error', 'Room not found');
                        return;
                    }
                    const player = room.players.find(p => p.id === session.playerId);
                    if (player && !player.isAI) {
                        // Toggle ready status using the new method
                        const updatedRoom = await this.gameManager.setPlayerReady(roomCode, session.playerId, !player.isReady);
                        // Emit room update to all players
                        this.io.to(roomCode).emit('room-updated', updatedRoom);
                        // Check if we can auto-start the game
                        const finalRoom = await this.gameManager.checkAutoStart(roomCode);
                        if (finalRoom && finalRoom.gameState) {
                            // Game has started!
                            this.io.to(roomCode).emit('game-started');
                            this.io.to(roomCode).emit('room-updated', finalRoom);
                        }
                    }
                }
                catch (error) {
                    socket.emit('error', error instanceof Error ? error.message : 'Failed to update ready status');
                }
            });
            // Start game event
            socket.on('start-game', async (roomCode) => {
                try {
                    const session = this.playerSessions.get(socket.id);
                    if (!session)
                        return;
                    const room = await this.gameManager.getRoom(roomCode);
                    if (!room) {
                        socket.emit('error', 'Room not found');
                        return;
                    }
                    if (room.hostId !== session.playerId) {
                        socket.emit('error', 'Only the host can start the game');
                        return;
                    }
                    const gameRoom = await this.gameManager.startGame(roomCode, session.playerId);
                    this.io.to(roomCode).emit('game-started');
                    this.io.to(roomCode).emit('room-updated', gameRoom);
                }
                catch (error) {
                    socket.emit('error', error instanceof Error ? error.message : 'Failed to start game');
                }
            });
            // Handle disconnection
            socket.on('disconnect', async () => {
                console.log(`Player disconnected: ${socket.id}`);
                const session = this.playerSessions.get(socket.id);
                if (session) {
                    try {
                        const room = await this.gameManager.leaveRoom(session.roomCode, session.playerId);
                        if (room) {
                            this.io.to(session.roomCode).emit('room-updated', room);
                            this.io.to(session.roomCode).emit('player-left', session.playerId);
                        }
                    }
                    catch (error) {
                        console.error('Error handling disconnect:', error);
                    }
                    this.playerSessions.delete(socket.id);
                }
            });
        });
    }
}
exports.SocketHandler = SocketHandler;
//# sourceMappingURL=SocketHandler.js.map