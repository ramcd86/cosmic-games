"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameManager = void 0;
const shared_1 = require("@cosmic-games/shared");
const RedisService_1 = require("./RedisService");
const GinRummyEngine_1 = require("../game/GinRummyEngine");
const AIPlayer_1 = require("../game/AIPlayer");
const uuid_1 = require("uuid");
class GameManager {
    constructor() {
        this.redisService = RedisService_1.RedisService.getInstance();
    }
    static getInstance() {
        if (!GameManager.instance) {
            GameManager.instance = new GameManager();
        }
        return GameManager.instance;
    }
    /**
     * Create a new game room
     */
    async createRoom(name, hostName, settings = {}) {
        const roomCode = await this.generateUniqueRoomCode();
        const hostId = (0, uuid_1.v4)();
        const host = {
            id: hostId,
            name: hostName,
            isAI: false,
            isReady: false,
            cards: [],
            score: 0,
            statistics: {
                gamesPlayed: 0,
                gamesWon: 0,
                totalScore: 0,
                averageScore: 0,
                winRate: 0
            },
            isConnected: true,
            lastActivity: new Date()
        };
        const room = {
            id: roomCode,
            name,
            hostId,
            players: [host],
            spectators: [],
            gameState: {
                phase: 'waiting',
                currentPlayer: '',
                deck: [],
                discardPile: [],
                turnNumber: 0
            },
            settings: { ...(0, shared_1.createDefaultRoomSettings)(), ...settings },
            createdAt: new Date(),
            lastActivity: new Date()
        };
        // Auto-add one AI opponent to get started
        await this.addInitialAIOpponent(room);
        await this.redisService.saveRoom(room);
        await this.redisService.addRoomCode(roomCode, roomCode);
        const playerToken = this.generatePlayerToken(hostId, roomCode);
        await this.redisService.savePlayerSession(hostId, roomCode, playerToken);
        return { room, playerToken };
    }
    /**
     * Join an existing room
     */
    async joinRoom(roomCode, playerName) {
        const room = await this.redisService.getRoom(roomCode);
        if (!room) {
            throw new Error('Room not found');
        }
        if (room.players.length >= room.settings.maxPlayers) {
            throw new Error('Room is full');
        }
        if (room.gameState.phase === 'playing') {
            throw new Error('Game is already in progress');
        }
        const playerId = (0, uuid_1.v4)();
        const newPlayer = {
            id: playerId,
            name: playerName,
            isAI: false,
            isReady: false,
            cards: [],
            score: 0,
            statistics: {
                gamesPlayed: 0,
                gamesWon: 0,
                totalScore: 0,
                averageScore: 0,
                winRate: 0
            },
            isConnected: true,
            lastActivity: new Date()
        };
        room.players.push(newPlayer);
        room.lastActivity = new Date();
        await this.redisService.saveRoom(room);
        const playerToken = this.generatePlayerToken(playerId, roomCode);
        await this.redisService.savePlayerSession(playerId, roomCode, playerToken);
        return { room, playerToken };
    }
    /**
     * Remove a player from a room
     */
    async leaveRoom(roomCode, playerId) {
        const room = await this.redisService.getRoom(roomCode);
        if (!room)
            return null;
        const playerIndex = room.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1)
            return room;
        room.players.splice(playerIndex, 1);
        room.lastActivity = new Date();
        // If host leaves, assign new host
        if (room.hostId === playerId && room.players.length > 0) {
            room.hostId = room.players[0].id;
        }
        // If no players left, delete room
        if (room.players.length === 0) {
            await this.redisService.deleteRoom(roomCode);
            await this.redisService.deleteRoomCode(roomCode);
            return null;
        }
        await this.redisService.saveRoom(room);
        await this.redisService.deletePlayerSession(playerId);
        return room;
    }
    /**
     * Start a game in a room
     */
    async startGame(roomCode, hostId) {
        const room = await this.redisService.getRoom(roomCode);
        if (!room) {
            throw new Error('Room not found');
        }
        if (room.hostId !== hostId) {
            throw new Error('Only the host can start the game');
        }
        // Auto-fill empty slots with AI players (ensure we have at least 2 players total)
        await this.autoFillWithAIPlayers(room);
        if (room.players.length < 2) {
            throw new Error('Need at least 2 players to start');
        }
        // Set all AI players as ready automatically
        room.players.forEach(player => {
            if (player.isAI) {
                player.isReady = true;
            }
        });
        if (!room.players.every(p => p.isReady)) {
            throw new Error('All players must be ready');
        }
        // Initialize game state
        const deck = shared_1.CardUtils.shuffle(shared_1.CardUtils.createDeck());
        const gameState = {
            phase: 'playing',
            currentPlayer: room.players[0].id,
            deck: deck.slice(20), // Reserve cards for dealing
            discardPile: [deck[19]], // Top card goes to discard pile
            turnNumber: 1,
            startedAt: new Date()
        };
        // Deal cards to players (10 cards each for Gin Rummy)
        let cardIndex = 0;
        room.players.forEach(player => {
            player.cards = deck.slice(cardIndex, cardIndex + 10);
            cardIndex += 10;
        });
        room.gameState = gameState;
        room.lastActivity = new Date();
        await this.redisService.saveRoom(room);
        return room;
    }
    /**
     * Get a random AI name from our curated list
     */
    getRandomAIName() {
        const aiNames = [
            // Male names
            'Alex', 'Blake', 'Cole', 'Derek', 'Ethan', 'Felix', 'Gabriel', 'Henry',
            'Ivan', 'Jake', 'Kyle', 'Logan', 'Marcus', 'Nathan', 'Oscar', 'Parker',
            'Quinn', 'Ryan', 'Samuel', 'Tyler', 'Victor', 'Wesley', 'Xavier', 'Zachary',
            // Female names
            'Aria', 'Bella', 'Chloe', 'Diana', 'Emma', 'Faith', 'Grace', 'Hannah',
            'Iris', 'Julia', 'Kira', 'Luna', 'Maya', 'Nova', 'Olivia', 'Paige',
            'Quinn', 'Riley', 'Sophia', 'Tessa', 'Uma', 'Violet', 'Willow', 'Zara'
        ];
        return aiNames[Math.floor(Math.random() * aiNames.length)];
    }
    /**
     * Automatically fill ALL empty player slots with AI players of varying difficulties
     */
    async autoFillWithAIPlayers(room) {
        const maxPlayers = room.settings?.maxPlayers || 4; // Default to 4 players for Gin Rummy
        // Fill ALL remaining slots up to maxPlayers
        const aiDifficulties = ['beginner', 'intermediate', 'advanced', 'expert'];
        let aiIndex = 0;
        while (room.players.length < maxPlayers) {
            // Cycle through difficulties to create variety
            const difficulty = aiDifficulties[aiIndex % aiDifficulties.length];
            const name = this.getRandomAIName();
            const aiPlayer = {
                id: (0, uuid_1.v4)(),
                name: name,
                isAI: true,
                difficulty: difficulty,
                isReady: true, // AI players are always ready
                cards: [],
                score: 0,
                statistics: {
                    gamesPlayed: 0,
                    gamesWon: 0,
                    totalScore: 0,
                    averageScore: 0,
                    winRate: 0
                },
                isConnected: true,
                lastActivity: new Date()
            };
            room.players.push(aiPlayer);
            aiIndex++;
            console.log(`🤖 Added ${difficulty} AI player: ${name} to room ${room.id}`);
        }
        // Save the updated room with AI players
        if (aiIndex > 0) {
            await this.redisService.saveRoom(room);
        }
    }
    /**
     * Add initial AI opponents when a room is first created to fill remaining slots
     */
    async addInitialAIOpponent(room) {
        // Fill all remaining slots with AI players immediately upon room creation
        await this.autoFillWithAIPlayers(room);
    }
    /**
     * Process a game action
     */
    async processGameAction(roomCode, playerId, action) {
        const room = await this.redisService.getRoom(roomCode);
        if (!room) {
            throw new Error('Room not found');
        }
        if (room.gameState.phase !== 'playing') {
            throw new Error('Game is not in progress');
        }
        // Validate the move using the game engine
        const validation = GinRummyEngine_1.GinRummyEngine.isValidMove(room.gameState, playerId, action);
        if (!validation.valid) {
            throw new Error(validation.reason || 'Invalid move');
        }
        // Process the action based on type
        switch (action.type) {
            case 'draw':
                await this.handleDrawAction(room, playerId, action);
                break;
            case 'discard':
                await this.handleDiscardAction(room, playerId, action);
                break;
            case 'knock':
                await this.handleKnockAction(room, playerId);
                break;
            case 'gin':
                await this.handleGinAction(room, playerId);
                break;
            default:
                throw new Error('Invalid action type');
        }
        room.gameState.lastAction = action;
        room.lastActivity = new Date();
        await this.redisService.saveRoom(room);
        // After processing human player action, check if next player is AI
        setTimeout(async () => {
            const updatedRoom = await this.redisService.getRoom(roomCode);
            if (updatedRoom) {
                await this.processAITurn(roomCode);
            }
        }, 500); // Small delay before AI turn
        return room;
    }
    /**
     * Add an AI player to a room
     */
    async addAIPlayer(roomCode, name, difficulty = 'intermediate') {
        const room = await this.redisService.getRoom(roomCode);
        if (!room) {
            throw new Error('Room not found');
        }
        if (room.players.length >= room.settings.maxPlayers) {
            throw new Error('Room is full');
        }
        if (room.gameState.phase === 'playing') {
            throw new Error('Cannot add AI player during game');
        }
        const aiId = (0, uuid_1.v4)();
        const aiPlayer = {
            id: aiId,
            name: name || `AI ${difficulty}`,
            isAI: true,
            difficulty,
            isReady: true, // AI players are always ready
            cards: [],
            score: 0,
            statistics: {
                gamesPlayed: 0,
                gamesWon: 0,
                totalScore: 0,
                averageScore: 0,
                winRate: 0
            },
            isConnected: true,
            lastActivity: new Date()
        };
        room.players.push(aiPlayer);
        room.lastActivity = new Date();
        await this.redisService.saveRoom(room);
        return room;
    }
    /**
     * Get room by code
     */
    async getRoom(roomCode) {
        return await this.redisService.getRoom(roomCode);
    }
    /**
     * Process AI player turns
     */
    async processAITurn(roomCode) {
        const room = await this.redisService.getRoom(roomCode);
        if (!room || room.gameState.phase !== 'playing') {
            return room;
        }
        const currentPlayer = room.players.find(p => p.id === room.gameState.currentPlayer);
        if (!currentPlayer || !currentPlayer.isAI) {
            return room;
        }
        try {
            // Create AI player instance
            const aiPlayer = new AIPlayer_1.AIPlayer(currentPlayer, currentPlayer.difficulty);
            // Get AI decision
            const action = aiPlayer.decideAction(room.gameState);
            // Create game action
            const gameAction = {
                type: action.type,
                playerId: currentPlayer.id,
                card: action.card,
                timestamp: new Date()
            };
            // Process the action
            const updatedRoom = await this.processGameAction(roomCode, currentPlayer.id, gameAction);
            // If AI drew a card, it needs to discard
            if (action.type === 'draw') {
                // Small delay for realism
                setTimeout(async () => {
                    const discardCard = aiPlayer.decideDiscard(updatedRoom.gameState);
                    const discardAction = {
                        type: 'discard',
                        playerId: currentPlayer.id,
                        card: discardCard,
                        timestamp: new Date()
                    };
                    await this.processGameAction(roomCode, currentPlayer.id, discardAction);
                }, 1000 + Math.random() * 2000); // 1-3 second delay
            }
            return updatedRoom;
        }
        catch (error) {
            console.error('Error processing AI turn:', error);
            return room;
        }
    }
    // Private helper methods
    async generateUniqueRoomCode() {
        let attempts = 0;
        const maxAttempts = 10;
        while (attempts < maxAttempts) {
            const code = (0, shared_1.generateRoomCode)();
            const exists = await this.redisService.roomExists(code);
            if (!exists) {
                return code;
            }
            attempts++;
        }
        throw new Error('Failed to generate unique room code');
    }
    generatePlayerToken(playerId, roomCode) {
        // In a real implementation, use JWT
        return Buffer.from(`${playerId}:${roomCode}:${Date.now()}`).toString('base64');
    }
    async handleDrawAction(room, playerId, action) {
        const player = room.players.find(p => p.id === playerId);
        if (!player)
            throw new Error('Player not found');
        if (room.gameState.deck.length === 0) {
            throw new Error('Deck is empty');
        }
        // Draw from deck
        const drawnCard = room.gameState.deck.pop();
        player.cards.push(drawnCard);
    }
    async handleDiscardAction(room, playerId, action) {
        const player = room.players.find(p => p.id === playerId);
        if (!player || !action.card)
            throw new Error('Invalid discard action');
        const cardIndex = player.cards.findIndex(c => c.id === action.card.id);
        if (cardIndex === -1)
            throw new Error('Card not in hand');
        // Remove card from player's hand and add to discard pile
        const discardedCard = player.cards.splice(cardIndex, 1)[0];
        room.gameState.discardPile.push(discardedCard);
        // Move to next player
        this.moveToNextPlayer(room);
    }
    async handleKnockAction(room, playerId) {
        const player = room.players.find(p => p.id === playerId);
        if (!player)
            throw new Error('Player not found');
        // Analyze player's hand
        const analysis = GinRummyEngine_1.GinRummyEngine.analyzeHand(player.cards);
        if (!analysis.canKnock) {
            throw new Error('Cannot knock with current hand');
        }
        // For multiplayer, we need to handle this differently
        // For now, let's implement basic 2-player logic
        const opponent = room.players.find(p => p.id !== playerId);
        if (!opponent)
            throw new Error('No opponent found');
        const opponentAnalysis = GinRummyEngine_1.GinRummyEngine.analyzeHand(opponent.cards);
        const scoreResult = GinRummyEngine_1.GinRummyEngine.calculateKnockScore(analysis.deadwoodValue, opponentAnalysis.deadwoodValue);
        // Update scores
        player.score += scoreResult.knockerScore;
        opponent.score += scoreResult.opponentScore;
        // End the game
        room.gameState.phase = 'finished';
        room.gameState.finishedAt = new Date();
        console.log(`${player.name} knocked! Scores - ${player.name}: ${scoreResult.knockerScore}, ${opponent.name}: ${scoreResult.opponentScore}`);
    }
    async handleGinAction(room, playerId) {
        const player = room.players.find(p => p.id === playerId);
        if (!player)
            throw new Error('Player not found');
        // Analyze player's hand
        const analysis = GinRummyEngine_1.GinRummyEngine.analyzeHand(player.cards);
        if (!analysis.canGin) {
            throw new Error('Cannot go gin with current hand');
        }
        // Calculate gin score
        const opponent = room.players.find(p => p.id !== playerId);
        if (!opponent)
            throw new Error('No opponent found');
        const opponentAnalysis = GinRummyEngine_1.GinRummyEngine.analyzeHand(opponent.cards);
        const ginScore = opponentAnalysis.deadwoodValue + 25; // Gin bonus
        // Update scores
        player.score += ginScore;
        // End the game
        room.gameState.phase = 'finished';
        room.gameState.finishedAt = new Date();
        console.log(`${player.name} went gin! Score: ${ginScore}`);
    }
    moveToNextPlayer(room) {
        const currentIndex = room.players.findIndex(p => p.id === room.gameState.currentPlayer);
        const nextIndex = (currentIndex + 1) % room.players.length;
        room.gameState.currentPlayer = room.players[nextIndex].id;
        room.gameState.turnNumber++;
    }
    /**
     * Update player ready status and handle AI auto-ready logic
     */
    async setPlayerReady(roomCode, playerId, isReady) {
        const room = await this.redisService.getRoom(roomCode);
        if (!room) {
            throw new Error('Room not found');
        }
        const player = room.players.find(p => p.id === playerId);
        if (!player) {
            throw new Error('Player not found in room');
        }
        if (player.isAI) {
            throw new Error('Cannot manually set AI player ready status');
        }
        player.isReady = isReady;
        player.lastActivity = new Date();
        room.lastActivity = new Date();
        // Auto-ready all AI players when any human player becomes ready
        if (isReady) {
            room.players.forEach(p => {
                if (p.isAI) {
                    p.isReady = true;
                }
            });
        }
        await this.redisService.saveRoom(room);
        return room;
    }
    /**
     * Update room state
     */
    async updateRoom(room) {
        await this.redisService.saveRoom(room);
    }
    /**
     * Check if all players are ready and auto-start if possible
     */
    async checkAutoStart(roomCode) {
        const room = await this.redisService.getRoom(roomCode);
        if (!room) {
            return null;
        }
        // Only auto-start if all players are ready and we have at least 2 players
        if (room.players.length >= 2 && room.players.every(p => p.isReady) && !room.gameState) {
            console.log(`🎮 Auto-starting game in room ${roomCode} - all players ready!`);
            return await this.startGame(roomCode, room.hostId);
        }
        return room;
    }
}
exports.GameManager = GameManager;
//# sourceMappingURL=GameManager.js.map