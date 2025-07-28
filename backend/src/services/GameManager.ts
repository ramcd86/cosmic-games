import { 
  GameRoom, 
  Player, 
  GameState, 
  Card, 
  GameAction,
  generateRoomCode,
  createDefaultRoomSettings,
  CardUtils,
  AIDifficulty
} from '@cosmic-games/shared';
import { RedisService } from './RedisService';
import { GinRummyEngine } from '../game/GinRummyEngine';
import { AIPlayer } from '../game/AIPlayer';
import { v4 as uuidv4 } from 'uuid';
import { Server } from 'socket.io';

export class GameManager {
  private static instance: GameManager;
  private redisService: RedisService;
  private io: Server | null = null;

  private constructor() {
    this.redisService = RedisService.getInstance();
  }

  public static getInstance(): GameManager {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager();
    }
    return GameManager.instance;
  }

  public setSocketServer(io: Server): void {
    this.io = io;
  }

  private emitPlayerAction(roomCode: string, action: GameAction): void {
    if (this.io) {
      this.io.to(roomCode).emit('player-action', action);
      console.log('📡 Emitted player action:', { roomCode, action: action.type, playerId: action.playerId });
    }
  }

  private emitRoomUpdate(roomCode: string, room: GameRoom): void {
    if (this.io) {
      console.log('📡 Emitting room-updated after AI action:', {
        roomCode,
        roomExists: !!room,
        playersCount: room.players?.length,
        hasGameState: !!room.gameState,
        players: room.players?.map(p => ({ id: p.id, name: p.name, cardsCount: p.cards?.length }))
      });
      
      this.io.to(roomCode).emit('room-updated', room);
    }
  }

  /**
   * Create a new game room
   */
  public async createRoom(name: string, hostName: string, settings: Partial<any> = {}): Promise<{ room: GameRoom; playerToken: string }> {
    const roomCode = await this.generateUniqueRoomCode();
    const hostId = uuidv4();
    
    const host: Player = {
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

    const room: GameRoom = {
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
      settings: { ...createDefaultRoomSettings(), ...settings },
      createdAt: new Date(),
      lastActivity: new Date()
    };

    // Add one AI player initially to make the room more interesting
    // But leave room for more human players to join
    this.addInitialAIPlayerSync(room);

    await this.redisService.saveRoom(room);
    await this.redisService.addRoomCode(roomCode, roomCode);

    const playerToken = this.generatePlayerToken(hostId, roomCode);
    await this.redisService.savePlayerSession(hostId, roomCode, playerToken);

    return { room, playerToken };
  }

  /**
   * Join an existing room
   */
  public async joinRoom(roomCode: string, playerName: string): Promise<{ room: GameRoom; playerToken: string }> {
    const room = await this.redisService.getRoom(roomCode);
    if (!room) {
      throw new Error('Room not found');
    }

    if (room.gameState.phase === 'playing') {
      throw new Error('Game is already in progress');
    }

    // Check if a player with this name already exists (reconnection case)
    const existingPlayer = room.players.find(p => p.name === playerName && !p.isAI);
    if (existingPlayer) {
      // Reconnect existing player
      existingPlayer.isConnected = true;
      existingPlayer.lastActivity = new Date();
      
      await this.redisService.saveRoom(room);
      
      const playerToken = this.generatePlayerToken(existingPlayer.id, roomCode);
      await this.redisService.savePlayerSession(existingPlayer.id, roomCode, playerToken);
      
      console.log(`Player ${playerName} reconnected to room ${roomCode}`);
      return { room, playerToken };
    }

    if (room.players.length >= room.settings.maxPlayers) {
      throw new Error('Room is full');
    }

    const playerId = uuidv4();
    const newPlayer: Player = {
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
  public async leaveRoom(roomCode: string, playerId: string): Promise<GameRoom | null> {
    const room = await this.redisService.getRoom(roomCode);
    if (!room) return null;

    const playerIndex = room.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return room;

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
  public async startGame(roomCode: string, hostId: string): Promise<GameRoom> {
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
    const deck = CardUtils.shuffle(CardUtils.createDeck());
    const gameState: GameState = {
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
  private getRandomAIName(): string {
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
   * Add one AI player when room is created (leaving space for human players) - synchronous version
   */
  private addInitialAIPlayerSync(room: GameRoom): void {
    const maxPlayers = room.settings?.maxPlayers || 4;
    
    // Determine how many AI players to add initially
    // Leave room for human players, but make the room feel populated
    let initialAICount = 1;
    if (maxPlayers >= 6) {
      initialAICount = 3; // For 6+ player games, add 3 AI players (leaves 3 slots for humans)
    } else if (maxPlayers >= 4) {
      initialAICount = 2; // For 4-5 player games, add 2 AI players (leaves 2-3 slots for humans)
    }
    
    const aiDifficulties: AIDifficulty[] = ['beginner', 'intermediate', 'advanced', 'expert'];
    const usedNames = new Set(room.players.map(p => p.name)); // Avoid duplicate names
    
    for (let i = 0; i < initialAICount; i++) {
      const difficulty = aiDifficulties[i % aiDifficulties.length];
      
      // Get a unique name
      let name = this.getRandomAIName();
      let attempts = 0;
      while (usedNames.has(name) && attempts < 10) {
        name = this.getRandomAIName();
        attempts++;
      }
      usedNames.add(name);
      
      const aiPlayer: Player = {
        id: uuidv4(),
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
      console.log(`🤖 Added initial ${difficulty} AI player: ${name} to room ${room.id} (${i + 1}/${initialAICount})`);
    }
  }

  /**
   * Add one AI player when room is created (leaving space for human players)
   */
  private async addInitialAIPlayer(room: GameRoom): Promise<void> {
    this.addInitialAIPlayerSync(room);
    
    // Save the updated room
    await this.redisService.saveRoom(room);
  }

  /**
   * Automatically add AI players to ensure minimum game requirements
   * Fills remaining slots up to maxPlayers when starting the game
   */
  private async autoFillWithAIPlayers(room: GameRoom): Promise<void> {
    const maxPlayers = room.settings?.maxPlayers || 4; // Default to 4 players for Gin Rummy
    
    // Fill remaining slots with AI players
    const aiDifficulties: AIDifficulty[] = ['beginner', 'intermediate', 'advanced', 'expert'];
    const usedNames = new Set(room.players.map(p => p.name)); // Avoid duplicate names
    
    let aiIndex = 0;
    while (room.players.length < maxPlayers) {
      // Cycle through difficulties to create variety
      const difficulty = aiDifficulties[aiIndex % aiDifficulties.length];
      
      // Get a unique name
      let name = this.getRandomAIName();
      let attempts = 0;
      while (usedNames.has(name) && attempts < 10) {
        name = this.getRandomAIName();
        attempts++;
      }
      usedNames.add(name);
      
      const aiPlayer: Player = {
        id: uuidv4(),
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
    await this.redisService.saveRoom(room);
  }

  /**
   * Add initial AI opponents when a room is first created (DEPRECATED)
   */
  private async addInitialAIOpponent(room: GameRoom): Promise<void> {
    // This method is deprecated - use addInitialAIPlayer instead
    await this.addInitialAIPlayer(room);
  }

  /**
   * Process a game action
   */
  public async processGameAction(roomCode: string, playerId: string, action: GameAction): Promise<GameRoom> {
    console.log('🎮 processGameAction called:', { roomCode, playerId, actionType: action.type });
    
    const room = await this.redisService.getRoom(roomCode);
    if (!room) {
      console.log('❌ Room not found:', roomCode);
      throw new Error('Room not found');
    }

    if (room.gameState.phase !== 'playing') {
      console.log('❌ Game not in progress, phase:', room.gameState.phase);
      throw new Error('Game is not in progress');
    }

    console.log('🔍 Validating move with GinRummyEngine...');
    // Validate the move using the game engine - pass the room, not just gameState
    const validation = GinRummyEngine.isValidMove(room, playerId, action);
    console.log('🔍 Validation result:', validation);
    
    if (!validation.valid) {
      console.log('❌ Move validation failed:', validation.reason);
      throw new Error(validation.reason || 'Invalid move');
    }

    console.log('✅ Move validation passed, processing action...');
    
    // Add detailed logging for AI vs Human players
    const currentActionPlayer = room.players.find(p => p.id === playerId);
    console.log('🎭 Player action details:', {
      playerName: currentActionPlayer?.name,
      isAI: currentActionPlayer?.isAI,
      actionType: action.type,
      cardInvolved: action.card ? `${action.card.rank}${action.card.suit}` : 'none',
      playerCardCount: currentActionPlayer?.cards?.length,
      currentPlayer: room.gameState.currentPlayer === playerId ? 'YES' : 'NO'
    });
    
    // Emit player action for visual feedback
    this.emitPlayerAction(roomCode, action);
    
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

    console.log('🔄 Saving room after action processing:', {
      roomCode,
      phase: room.gameState.phase,
      currentPlayer: room.gameState.currentPlayer,
      playersCount: room.players.length,
      players: room.players.map(p => ({ id: p.id, name: p.name, cardsCount: p.cards?.length }))
    });

    await this.redisService.saveRoom(room);
    
    console.log('✅ Room saved successfully');
    
    // After processing action, check if next player is AI
    // Only schedule AI turn continuation for:
    // 1. Human player actions (any type)
    // 2. AI player discard actions (not draw actions, since draw+discard is now atomic)
    const actionPlayer = room.players.find(p => p.id === playerId);
    const shouldScheduleAITurn = !actionPlayer?.isAI || action.type === 'discard';
    
    if (shouldScheduleAITurn) {
      setTimeout(async () => {
        try {
          const updatedRoom = await this.redisService.getRoom(roomCode);
          if (updatedRoom && updatedRoom.gameState.phase === 'playing') {
            console.log('🤖 Checking for AI turn after', action.type, 'by', actionPlayer?.isAI ? 'AI' : 'human');
            await this.processAITurn(roomCode);
          } else {
            console.log('🤖 Skipping AI turn - game not active');
          }
        } catch (error) {
          console.error('🤖 Error in AI turn timeout:', error);
        }
      }, 0); // Removed delay for faster testing
    } else {
      console.log('🤖 Skipping AI turn scheduling - AI draw action (atomic turn in progress)');
    }

    return room;
  }

  /**
   * Add an AI player to a room
   */
  public async addAIPlayer(roomCode: string, name: string, difficulty: AIDifficulty = 'intermediate'): Promise<GameRoom> {
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

    const aiId = uuidv4();
    const aiPlayer: Player = {
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
  public async getRoom(roomCode: string): Promise<GameRoom | null> {
    return await this.redisService.getRoom(roomCode);
  }

  /**
   * Process AI player turns
   */
  public async processAITurn(roomCode: string): Promise<GameRoom | null> {
    try {
      console.log('🤖 processAITurn called for room:', roomCode);
      
      const room = await this.redisService.getRoom(roomCode);
      if (!room) {
        console.log('❌ Room not found for AI turn:', roomCode);
        return null;
      }
      
      if (room.gameState.phase !== 'playing') {
        console.log('❌ Game not in playing phase:', room.gameState.phase);
        return room;
      }

      const currentPlayer = room.players.find(p => p.id === room.gameState.currentPlayer);
      if (!currentPlayer) {
        console.log('❌ Current player not found:', room.gameState.currentPlayer);
        return room;
      }
      
      if (!currentPlayer.isAI) {
        console.log('🎯 Current player is not AI:', currentPlayer.name);
        return room;
      }

      console.log('🤖 Processing AI turn for:', currentPlayer.name, 'with', currentPlayer.cards.length, 'cards');

      // Create AI player instance
      const aiPlayer = new AIPlayer(currentPlayer, currentPlayer.difficulty!);
      
      // PHASE 1: Check for knock opportunity (if previous player discarded)
      // This should happen before drawing, just like human players
      if (room.gameState.discardPile.length > 0) {
        const analysis = GinRummyEngine.analyzeHand(currentPlayer.cards);
        if (aiPlayer.shouldKnock(analysis, room.gameState)) {
          console.log('🤖 AI deciding to knock on opportunity');
          
          const knockAction: GameAction = {
            type: 'knock',
            playerId: currentPlayer.id,
            timestamp: new Date()
          };
          
          // Process knock action through unified interface
          await this.processGameAction(roomCode, currentPlayer.id, knockAction);
          const knockRoom = await this.redisService.getRoom(roomCode);
          if (knockRoom) {
            this.emitRoomUpdate(roomCode, knockRoom);
          }
          return knockRoom;
        }
      }
      
      // PHASE 2: Draw phase (same as human players)
      if (currentPlayer.cards.length === 10) {
        // AI hasn't drawn yet, decide what to draw
        const decision = aiPlayer.decideAction(room.gameState);
        console.log('🤖 AI decided action:', decision);
        
        let drawAction: GameAction;
        
        if (decision.drawFromDiscard && room.gameState.discardPile.length > 0) {
          // Draw from discard pile
          const topCard = room.gameState.discardPile[room.gameState.discardPile.length - 1];
          drawAction = {
            type: 'draw',
            playerId: currentPlayer.id,
            card: topCard,
            timestamp: new Date()
          };
          console.log('🤖 AI drawing from discard pile:', topCard);
        } else {
          // Draw from deck
          drawAction = {
            type: 'draw',
            playerId: currentPlayer.id,
            timestamp: new Date()
          };
          console.log('🤖 AI drawing from deck');
        }

        // Process the draw action through unified interface
        await this.processGameAction(roomCode, currentPlayer.id, drawAction);
        
        // Removed delay for faster testing
        await new Promise(resolve => setTimeout(resolve, 0));
        
        // Re-fetch room to get updated state after draw
        const updatedRoom = await this.redisService.getRoom(roomCode);
        if (!updatedRoom || updatedRoom.gameState.phase !== 'playing') {
          console.log('🤖 Game no longer active after draw');
          return room;
        }
        
        const updatedCurrentPlayer = updatedRoom.players.find(p => p.id === currentPlayer.id);
        if (!updatedCurrentPlayer) {
          console.log('🤖 AI player not found after draw');
          return updatedRoom;
        }

        // PHASE 3: Discard phase (same as human players)
        if (updatedCurrentPlayer.cards.length === 11) {
          console.log('🤖 AI proceeding to discard phase with 11 cards');
          
          // Create new AI instance with updated player state
          const updatedAiPlayer = new AIPlayer(updatedCurrentPlayer, updatedCurrentPlayer.difficulty!);
          
          // Check if AI should knock with new hand before discarding
          const updatedAnalysis = GinRummyEngine.analyzeHand(updatedCurrentPlayer.cards);
          if (updatedAiPlayer.shouldKnock(updatedAnalysis, updatedRoom.gameState)) {
            console.log('🤖 AI deciding to knock after drawing');
            
            const knockAction: GameAction = {
              type: 'knock',
              playerId: currentPlayer.id,
              timestamp: new Date()
            };
            
            await this.processGameAction(roomCode, currentPlayer.id, knockAction);
            const knockRoom2 = await this.redisService.getRoom(roomCode);
            if (knockRoom2) {
              this.emitRoomUpdate(roomCode, knockRoom2);
            }
            return knockRoom2;
          }
          
          // Decide which card to discard
          const discardCard = updatedAiPlayer.decideDiscard(updatedRoom.gameState);
          console.log('🤖 AI discarding:', discardCard);
          
          const discardAction: GameAction = {
            type: 'discard',
            playerId: currentPlayer.id,
            card: discardCard,
            timestamp: new Date()
          };
          
          // Process the discard action through unified interface
          await this.processGameAction(roomCode, currentPlayer.id, discardAction);
          const finalRoom = await this.redisService.getRoom(roomCode);
          if (finalRoom) {
            this.emitRoomUpdate(roomCode, finalRoom);
          }
          return finalRoom;
        } else {
          console.log('🤖 AI player unexpected card count after draw:', updatedCurrentPlayer.cards.length);
          return updatedRoom;
        }
        
      } else if (currentPlayer.cards.length === 11) {
        // Emergency discard if AI somehow has 11 cards already
        console.log('🤖 AI has 11 cards, processing emergency discard...');
        const discardCard = aiPlayer.decideDiscard(room.gameState);
        console.log('🤖 AI emergency discarding:', discardCard);
        
        const discardAction: GameAction = {
          type: 'discard',
          playerId: currentPlayer.id,
          card: discardCard,
          timestamp: new Date()
        };
        
        await this.processGameAction(roomCode, currentPlayer.id, discardAction);
        const emergencyRoom = await this.redisService.getRoom(roomCode);
        if (emergencyRoom) {
          this.emitRoomUpdate(roomCode, emergencyRoom);
        }
        return emergencyRoom;
      } else {
        console.log('🤖 AI player has unexpected card count:', currentPlayer.cards.length);
        return room;
      }
      
    } catch (error) {
      console.error('🤖 Error processing AI turn:', error);
      return null;
    }
  }

  // Private helper methods
  private async generateUniqueRoomCode(): Promise<string> {
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const code = generateRoomCode();
      const exists = await this.redisService.roomExists(code);
      if (!exists) {
        return code;
      }
      attempts++;
    }

    throw new Error('Failed to generate unique room code');
  }

  private generatePlayerToken(playerId: string, roomCode: string): string {
    // In a real implementation, use JWT
    return Buffer.from(`${playerId}:${roomCode}:${Date.now()}`).toString('base64');
  }

  private async handleDrawAction(room: GameRoom, playerId: string, action: GameAction): Promise<void> {
    const player = room.players.find(p => p.id === playerId);
    if (!player) throw new Error('Player not found');

    if (action.card) {
      // Draw from discard pile (specific card provided)
      if (room.gameState.discardPile.length === 0) {
        throw new Error('Discard pile is empty');
      }
      
      const topCard = room.gameState.discardPile[room.gameState.discardPile.length - 1];
      
      // Verify the requested card matches the top of discard pile
      if (topCard.id !== action.card.id || 
          topCard.rank !== action.card.rank || 
          topCard.suit !== action.card.suit) {
        console.log('🚨 Draw card mismatch:', {
          requested: action.card,
          available: topCard
        });
        throw new Error('Requested card does not match top of discard pile');
      }
      
      // Remove card from discard pile and add to player's hand
      const drawnCard = room.gameState.discardPile.pop()!;
      player.cards.push(drawnCard);
      
      console.log('🃏 Player drew from discard pile:', drawnCard);
    } else {
      // Draw from deck (no specific card requested)
      if (room.gameState.deck.length === 0) {
        // When deck is empty, end the game and calculate scores
        console.log('🏁 Deck is empty - ending game and calculating final scores');
        await this.endGameDueToEmptyDeck(room);
        // Game is now ended, return without error to allow proper cleanup
        return;
      }

      const drawnCard = room.gameState.deck.pop()!;
      player.cards.push(drawnCard);
      
      console.log('🃏 Player drew from deck');
    }
  }

  private async handleDiscardAction(room: GameRoom, playerId: string, action: GameAction): Promise<void> {
    console.log('🎯 handleDiscardAction called:', {
      playerId,
      actionCard: action.card,
      actionType: action.type
    });
    
    const player = room.players.find(p => p.id === playerId);
    if (!player || !action.card) {
      console.log('❌ Invalid discard action:', { player: !!player, actionCard: !!action.card });
      throw new Error('Invalid discard action');
    }

    console.log('🃏 Player cards before discard:', player.cards.map(c => ({ id: c.id, rank: c.rank, suit: c.suit })));
    console.log('🗑️ Trying to discard card:', { id: action.card.id, rank: action.card.rank, suit: action.card.suit });

    const cardIndex = player.cards.findIndex(c => c.id === action.card!.id);
    console.log('🔍 Card index found:', cardIndex);
    
    if (cardIndex === -1) {
      console.log('❌ Card not found in hand - trying rank/suit match');
      // Try to find by rank and suit if ID doesn't match
      const cardIndexBySuit = player.cards.findIndex(c => 
        c.rank === action.card!.rank && c.suit === action.card!.suit
      );
      console.log('🔍 Card index by rank/suit:', cardIndexBySuit);
      
      if (cardIndexBySuit === -1) {
        throw new Error('Card not in hand');
      } else {
        // Remove card from player's hand and add to discard pile
        const discardedCard = player.cards.splice(cardIndexBySuit, 1)[0];
        room.gameState.discardPile.push(discardedCard);
        console.log('✅ Card discarded by rank/suit match');
      }
    } else {
      // Remove card from player's hand and add to discard pile
      const discardedCard = player.cards.splice(cardIndex, 1)[0];
      room.gameState.discardPile.push(discardedCard);
      console.log('✅ Card discarded by ID match');
    }

    console.log('🃏 Player cards after discard:', player.cards.map(c => ({ id: c.id, rank: c.rank, suit: c.suit })));
    console.log('🗑️ Discard pile after discard:', room.gameState.discardPile.map(c => ({ id: c.id, rank: c.rank, suit: c.suit })));

    // Move to next player
    this.moveToNextPlayer(room);
    console.log('👤 Moved to next player:', room.gameState.currentPlayer);
  }

  private async handleKnockAction(room: GameRoom, playerId: string): Promise<void> {
    const player = room.players.find(p => p.id === playerId);
    if (!player) throw new Error('Player not found');

    // Analyze player's hand
    const analysis = GinRummyEngine.analyzeHand(player.cards);
    if (!analysis.canKnock) {
      throw new Error('Cannot knock with current hand');
    }

    // For multiplayer, we need to handle this differently
    // For now, let's implement basic 2-player logic
    const opponent = room.players.find(p => p.id !== playerId);
    if (!opponent) throw new Error('No opponent found');

    const opponentAnalysis = GinRummyEngine.analyzeHand(opponent.cards);
    const scoreResult = GinRummyEngine.calculateKnockScore(
      analysis.deadwoodValue,
      opponentAnalysis.deadwoodValue
    );

    // Update scores
    player.score += scoreResult.knockerScore;
    opponent.score += scoreResult.opponentScore;

    // End the game
    room.gameState.phase = 'finished';
    room.gameState.finishedAt = new Date();

    console.log(`${player.name} knocked! Scores - ${player.name}: ${scoreResult.knockerScore}, ${opponent.name}: ${scoreResult.opponentScore}`);
  }

  private async handleGinAction(room: GameRoom, playerId: string): Promise<void> {
    const player = room.players.find(p => p.id === playerId);
    if (!player) throw new Error('Player not found');

    // Analyze player's hand
    const analysis = GinRummyEngine.analyzeHand(player.cards);
    if (!analysis.canGin) {
      throw new Error('Cannot go gin with current hand');
    }

    // Calculate gin score
    const opponent = room.players.find(p => p.id !== playerId);
    if (!opponent) throw new Error('No opponent found');

    const opponentAnalysis = GinRummyEngine.analyzeHand(opponent.cards);
    const ginScore = opponentAnalysis.deadwoodValue + 25; // Gin bonus

    // Update scores
    player.score += ginScore;

    // End the game
    room.gameState.phase = 'finished';
    room.gameState.finishedAt = new Date();

    console.log(`${player.name} went gin! Score: ${ginScore}`);
  }

  private moveToNextPlayer(room: GameRoom): void {
    const currentIndex = room.players.findIndex(p => p.id === room.gameState.currentPlayer);
    const nextIndex = (currentIndex + 1) % room.players.length;
    room.gameState.currentPlayer = room.players[nextIndex].id;
    room.gameState.turnNumber++;
  }

  /**
   * End the game when deck is empty and calculate final scores
   */
  private async endGameDueToEmptyDeck(room: GameRoom): Promise<void> {
    console.log('🏁 Ending game due to empty deck - calculating final scores');
    
    // Analyze each player's hand and calculate deadwood
    const playerScores: Array<{
      player: Player;
      deadwoodValue: number;
      analysis: any;
    }> = [];
    
    for (const player of room.players) {
      const analysis = GinRummyEngine.analyzeHand(player.cards);
      playerScores.push({
        player,
        deadwoodValue: analysis.deadwoodValue,
        analysis
      });
      
      console.log(`📊 ${player.name} final deadwood: ${analysis.deadwoodValue}`, {
        melds: analysis.melds.length,
        deadwoodCards: analysis.deadwood.length
      });
    }
    
    // Find the player(s) with the lowest deadwood
    const lowestDeadwood = Math.min(...playerScores.map(ps => ps.deadwoodValue));
    const winners = playerScores.filter(ps => ps.deadwoodValue === lowestDeadwood);
    
    console.log(`🏆 Winner(s) with ${lowestDeadwood} deadwood:`, winners.map(w => w.player.name));
    
    // Calculate score differences (in traditional Gin Rummy, winner gets points = opponent's deadwood - winner's deadwood)
    for (const winner of winners) {
      const totalOpponentDeadwood = playerScores
        .filter(ps => ps.player.id !== winner.player.id)
        .reduce((sum, ps) => sum + ps.deadwoodValue, 0);
      
      // In multi-player, give winner the difference between their deadwood and average opponent deadwood
      const averageOpponentDeadwood = totalOpponentDeadwood / (room.players.length - 1);
      const pointsEarned = Math.max(0, Math.round(averageOpponentDeadwood - winner.deadwoodValue));
      
      winner.player.score += pointsEarned;
      
      console.log(`🎯 ${winner.player.name} earns ${pointsEarned} points (${averageOpponentDeadwood.toFixed(1)} avg opponent deadwood - ${winner.deadwoodValue} own deadwood)`);
    }
    
    // Update game state to finished
    room.gameState.phase = 'finished';
    room.gameState.finishedAt = new Date();
    room.gameState.endReason = 'deck-empty';
    room.gameState.finalScores = playerScores.map(ps => ({
      playerId: ps.player.id,
      playerName: ps.player.name,
      deadwoodValue: ps.deadwoodValue,
      totalScore: ps.player.score,
      isWinner: ps.deadwoodValue === lowestDeadwood
    }));
    
    console.log('🎮 Game finished - final scores:', room.gameState.finalScores);
    
    // Save the updated room
    await this.redisService.saveRoom(room);
    
    // Emit game end event
    if (this.io) {
      this.io.to(room.id).emit('game-ended', {
        reason: 'deck-empty',
        message: 'Game ended - deck was empty',
        finalScores: room.gameState.finalScores,
        winners: winners.map(w => ({
          id: w.player.id,
          name: w.player.name,
          deadwoodValue: w.deadwoodValue,
          totalScore: w.player.score
        }))
      });
      
      console.log('📡 Emitted game-ended event');
    }
  }

  /**
   * Update player ready status and handle AI auto-ready logic
   */
  public async setPlayerReady(roomCode: string, playerId: string, isReady: boolean): Promise<GameRoom> {
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
  public async updateRoom(room: GameRoom): Promise<void> {
    await this.redisService.saveRoom(room);
  }

  /**
   * Check if all players are ready and auto-start if possible
   */
  public async checkAutoStart(roomCode: string): Promise<GameRoom | null> {
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
