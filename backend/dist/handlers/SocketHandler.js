"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketHandler = void 0;
class SocketHandler {
    constructor(io, gameManager) {
        this.playerSessions = new Map();
        this.io = io;
        this.gameManager = gameManager;
    }
    initialize() {
        this.io.on('connection', (socket) => {
            console.log(`Player connected: ${socket.id}`);
            // Join room event
            socket.on('join-room', async (roomCode, playerName) => {
                try {
                    const result = await this.gameManager.joinRoom(roomCode, playerName);
                    // Store player session
                    const newPlayer = result.room.players[result.room.players.length - 1];
                    this.playerSessions.set(socket.id, {
                        playerId: newPlayer.id,
                        playerName: newPlayer.name,
                        roomCode: roomCode
                    });
                    // Join socket room for broadcasting
                    socket.join(roomCode);
                    // Send player their own info (temporarily commented out until types are updated)
                    // socket.emit('player-info', { playerId: newPlayer.id, playerName: newPlayer.name });
                    // Send room update to all players in the room
                    this.io.to(roomCode).emit('room-updated', result.room);
                    // Notify others about new player
                    socket.to(roomCode).emit('player-joined', newPlayer);
                }
                catch (error) {
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
                    const session = this.playerSessions.get(socket.id);
                    if (!session)
                        return;
                    const room = await this.gameManager.processGameAction(roomCode, session.playerId, action);
                    if (room) {
                        this.io.to(roomCode).emit('room-updated', room);
                        if (room.gameState && room.gameState.phase === 'finished') {
                            // Game ended
                            const winner = room.players.reduce((prev, current) => (prev.score > current.score) ? prev : current);
                            const finalScores = {};
                            room.players.forEach(player => {
                                finalScores[player.name] = player.score;
                            });
                            this.io.to(roomCode).emit('game-ended', winner.id, finalScores);
                        }
                    }
                }
                catch (error) {
                    socket.emit('error', error instanceof Error ? error.message : 'Failed to process game action');
                }
            });
            // Player ready event
            socket.on('player-ready', async (roomCode) => {
                try {
                    const session = this.playerSessions.get(socket.id);
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