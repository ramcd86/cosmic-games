# CosmicGames - Technical Specification

## Project Overview
CosmicGames is a multiplayer online card game platform, starting with Gin Rummy. Players can create private rooms with shareable codes, support up to 6 players per table, and include AI opponents. The platform features an elegant casino-inspired design with real-time multiplayer gameplay.

## Core Features

### Game Platform
- **Multi-Game Support**: Extensible architecture for multiple card games
- **Room-Based Multiplayer**: Private rooms with shareable 6-digit codes
- **Player Management**: Up to 6 players per table (human + AI)
- **Real-Time Gameplay**: WebSocket-based live game updates
- **AI Integration**: Configurable AI opponents with difficulty levels

### Gin Rummy Implementation
- **Classic Rules**: Traditional 2-player Gin Rummy
- **Extended Multiplayer**: Modified rules for 3-6 players
- **Tournament Mode**: Elimination-style tournaments
- **Spectator Mode**: Watch ongoing games
- **Game Statistics**: Win/loss tracking, scoring history

## Technical Architecture

### Technology Stack
- **Backend**: Node.js + Express.js + TypeScript
- **Real-Time**: Socket.io for WebSocket communication
- **Frontend**: Angular 17+ + TypeScript
- **Styling**: Tailwind CSS with custom casino theme
- **Database**: Redis (in-memory) → PostgreSQL (persistent)
- **Authentication**: JWT tokens
- **Deployment**: Docker containers

### System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Angular App   │    │  Express API    │    │   Redis/DB      │
│   (Frontend)    │◄──►│   (Backend)     │◄──►│   (Storage)     │
│                 │    │                 │    │                 │
│ • Game UI       │    │ • Game Logic    │    │ • Game State    │
│ • Socket Client │    │ • Socket Server │    │ • Player Data   │
│ • State Mgmt    │    │ • API Routes    │    │ • Room Codes    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Core Components

#### 1. Room Management System
- **Room Creation**: Generate unique 6-digit codes
- **Room Discovery**: Join by code or browse public rooms
- **Player Slots**: Flexible 2-6 player configurations
- **AI Management**: Add/remove AI players dynamically
- **Room Settings**: Game variants, time limits, scoring rules

#### 2. Game Engine
- **Turn Management**: Handle player turns and timeouts
- **Rule Enforcement**: Validate moves and game state
- **Score Calculation**: Real-time scoring and statistics
- **Game Events**: Broadcast actions to all players
- **State Persistence**: Save/restore game progress

#### 3. Real-Time Communication
- **WebSocket Events**: Player actions, game updates, chat
- **Room Broadcasting**: Selective message distribution
- **Connection Management**: Handle disconnects gracefully
- **Sync Mechanisms**: Ensure consistent game state

#### 4. AI System
- **Difficulty Levels**: Beginner, Intermediate, Advanced, Expert
- **Playing Styles**: Conservative, Aggressive, Adaptive
- **Decision Engine**: Card selection and strategy algorithms
- **Response Timing**: Human-like delay patterns

## Database Schema

### Initial In-Memory (Redis)
```typescript
// Room Structure
interface GameRoom {
  id: string;              // 6-digit code
  name: string;
  hostId: string;
  players: Player[];       // 2-6 players
  gameState: GameState;
  settings: RoomSettings;
  createdAt: Date;
  lastActivity: Date;
}

// Player Structure
interface Player {
  id: string;
  name: string;
  isAI: boolean;
  difficulty?: AIDifficulty;
  isReady: boolean;
  cards: Card[];
  score: number;
  statistics: PlayerStats;
}

// Game State
interface GameState {
  phase: 'waiting' | 'playing' | 'finished';
  currentPlayer: string;
  deck: Card[];
  discardPile: Card[];
  turnNumber: number;
  lastAction: GameAction;
}
```

## Design System

### Casino-Inspired Color Palette
```css
:root {
  /* Primary Colors */
  --casino-green: #0F4C3A;      /* Deep table green */
  --casino-green-light: #2D5A47; /* Lighter table green */
  
  /* Neutrals */
  --casino-black: #1A1A1A;      /* Deep black */
  --casino-charcoal: #2D2D2D;   /* Charcoal */
  --casino-silver: #C0C0C0;     /* Silver accents */
  
  /* Metallics */
  --casino-gold: #FFD700;       /* Gold trim */
  --casino-bronze: #CD7F32;     /* Bronze details */
  
  /* Accent Colors */
  --casino-blue: #1E40AF;       /* Royal blue */
  --casino-purple: #7C3AED;     /* Deep purple */
  --casino-red: #DC2626;        /* Classic red */
  --casino-yellow: #F59E0B;     /* Warm yellow */
  
  /* Card Colors */
  --card-red: #DC2626;          /* Hearts, Diamonds */
  --card-black: #1F2937;        /* Spades, Clubs */
  --card-background: #FAFAFA;   /* Card background */
}
```

### UI Components
- **Game Table**: Rounded corners, felt texture, subtle shadows
- **Cards**: Realistic proportions, smooth animations, hover effects
- **Buttons**: Gold/silver gradients, elegant typography
- **Panels**: Glass-morphism effects with dark backgrounds
- **Typography**: Clean, readable fonts with gold accents

## Development Phases

### Phase 1: Foundation (Week 1-2)
- [x] Project setup and repository structure
- [x] Basic Express server with TypeScript
- [x] Angular application with routing
- [x] Redis connection and basic data models
- [x] Socket.io integration
- [x] Tailwind CSS setup with casino theme

### Phase 2: Core Game Logic (Week 3-4)
- [x] Card system implementation
- [x] Gin Rummy rules engine
- [x] Game state management
- [x] Turn-based gameplay mechanics
- [x] Basic AI implementation

### Phase 3: Multiplayer Infrastructure (Week 5-6)
- [x] Room creation and management
- [x] Player joining/leaving system
- [x] Real-time game synchronization
- [ ] Spectator mode
- [ ] Chat system

### Phase 4: UI/UX Implementation (Week 7-8)
- [x] Game table interface
- [x] Card animations and interactions
- [x] Player dashboards
- [x] Room browser
- [x] Mobile responsiveness

### Phase 5: Advanced Features (Week 9-10)
- [x] Advanced AI opponents
- [ ] Tournament system
- [ ] Statistics and leaderboards
- [ ] Game replays
- [ ] Admin panel

### Phase 6: Production Ready (Week 11-12)
- [ ] PostgreSQL migration
- [ ] Security hardening
- [ ] Performance optimization
- [ ] Docker deployment
- [ ] Testing and QA

## API Design

### REST Endpoints
```typescript
// Room Management
POST   /api/rooms              // Create room
GET    /api/rooms/:code        // Get room details
PUT    /api/rooms/:code/join   // Join room
DELETE /api/rooms/:code/leave  // Leave room

// Game Actions
POST   /api/games/:roomId/start    // Start game
POST   /api/games/:roomId/action   // Make game move
GET    /api/games/:roomId/state    // Get game state

// Player Management
POST   /api/players/register   // Register player
GET    /api/players/stats      // Get statistics
```

### WebSocket Events
```typescript
// Client → Server
'join-room'     // Join a game room
'leave-room'    // Leave current room
'game-action'   // Make a game move
'chat-message'  // Send chat message

// Server → Client
'room-updated'  // Room state changed
'game-updated'  // Game state changed
'player-joined' // New player joined
'player-left'   // Player disconnected
'chat-received' // New chat message
```

## Security Considerations
- **Input Validation**: Sanitize all user inputs
- **Rate Limiting**: Prevent spam and abuse
- **Room Codes**: Cryptographically secure random generation
- **Game State**: Server-side validation of all moves
- **Authentication**: Optional player accounts with JWT

## Performance Requirements
- **Response Time**: < 100ms for game actions
- **Concurrent Rooms**: Support 1000+ simultaneous rooms
- **Real-Time Updates**: < 50ms latency for live updates
- **Memory Usage**: Efficient game state storage
- **Scalability**: Horizontal scaling capability

## Future Enhancements
- **Additional Games**: Poker, Blackjack, Hearts, Spades
- **Social Features**: Friend lists, private messaging
- **Tournaments**: Scheduled events and competitions
- **Mobile Apps**: Native iOS/Android applications
- **Monetization**: Premium features, cosmetic upgrades
- **Analytics**: Player behavior and game statistics
