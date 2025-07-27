import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { GameApiService } from '../../services/game-api.service';
import { SocketService } from '../../services/socket.service';
import { GameRoom, Player, Card, GameAction } from '@cosmic-games/shared';

@Component({
  selector: 'app-game-room',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-6xl mx-auto">
      <!-- Room Header -->
      <div class="casino-panel mb-6">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-2xl font-bold text-gold">{{ roomName }}</h1>
            <p class="text-casino-silver">Room Code: <span class="font-mono text-casino-gold">{{ roomCode }}</span></p>
          </div>
          <button 
            (click)="leaveRoom()"
            class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors">
            Leave Room
          </button>
        </div>
      </div>

      <div class="grid lg:grid-cols-4 gap-6">
        <!-- Game Area -->
        <div class="lg:col-span-3">
          <div class="casino-table p-8 mb-6">
            <div class="text-center mb-8">
              <h2 class="text-3xl font-bold text-casino-silver mb-2">
                {{ gamePhase === 'waiting' ? 'Waiting for Players' : 
                   gamePhase === 'playing' ? 'Game in Progress' : 'Game Finished' }}
              </h2>
              
              <div *ngIf="gamePhase === 'waiting'" class="text-casino-silver/80">
                Waiting for all players to be ready...
              </div>
              
              <div *ngIf="gamePhase === 'playing' && currentPlayerName" class="text-casino-gold">
                {{ currentPlayerName }}'s turn
              </div>
            </div>

            <!-- Waiting Screen -->
            <div *ngIf="gamePhase === 'waiting'" class="text-center">
              <div class="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-md mx-auto">
                <div 
                  *ngFor="let slot of playerSlots" 
                  class="casino-panel p-4 text-center min-h-[100px] flex flex-col justify-center transition-all duration-300"
                  [ngClass]="getPlayerFrameClass(slot)">
                  <div *ngIf="slot.player; else emptySlot">
                    <div class="text-lg font-bold transition-colors duration-300" 
                         [ngClass]="getPlayerNameClass(slot)">
                      {{ slot.player.name }}
                    </div>
                    <div class="text-sm" [class]="slot.player.isReady ? 'text-green-400' : 'text-yellow-400'">
                      {{ slot.player.isReady ? '✓ Ready' : '⏳ Not Ready' }}
                    </div>
                    <div *ngIf="slot.player.isAI" class="text-xs text-casino-silver/60">
                      🤖 AI Player ({{ slot.player.difficulty }})
                    </div>
                  </div>
                  <ng-template #emptySlot>
                    <div class="text-casino-silver/50">
                      <div class="text-2xl mb-2">👤</div>
                      <div class="text-sm">Empty Slot</div>
                    </div>
                  </ng-template>
                </div>
              </div>

              <div class="mt-8 space-y-4">
                <button 
                  *ngIf="!isPlayerReady"
                  (click)="toggleReady()"
                  class="casino-button mr-4">
                  Ready Up
                </button>
                
                <button 
                  *ngIf="isPlayerReady"
                  (click)="toggleReady()"
                  class="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-lg mr-4">
                  Not Ready
                </button>

                <button 
                  *ngIf="isHost && canStartGame"
                  (click)="startGame()"
                  class="casino-button">
                  Start Game
                </button>
              </div>
            </div>

            <!-- Game Screen -->
            <div *ngIf="gamePhase === 'playing'" class="space-y-6">
              <!-- Table with Players Around It -->
              <div class="table-container">
                <div class="players-around-table">
                  <!-- Players positioned around the table -->
                  <div 
                    *ngFor="let player of players; let i = index" 
                    class="player-position"
                    [ngClass]="getPlayerPositionClass(i, players.length)">
                    <div 
                      class="player-circle"
                      [attr.data-player-id]="player.id"
                      [style.background-color]="getPlayerBackgroundColor(player.name, i)"
                      [ngClass]="getCurrentPlayerTurnStatus(player.id)">
                      {{ generatePlayerInitials(player.name, players) }}
                    </div>
                  </div>
                  
                  <!-- Game Table -->
                  <div class="game-table">
                    <!-- Center Area with Deck and Discard -->
                    <div class="flex justify-center space-x-8">
                      <!-- Deck -->
                      <div class="text-center">
                        <div 
                          class="w-16 h-24 bg-casino-charcoal rounded border-2 border-casino-gold cursor-pointer hover:scale-105 transition-transform flex items-center justify-center"
                          [ngClass]="canDrawCard() ? 'ring-2 ring-green-400' : ''"
                          (click)="drawCard()">
                          <span class="text-casino-gold text-sm">🂠</span>
                        </div>
                        <p class="text-white text-xs mt-1">{{ deckCount }}</p>
                      </div>

                      <!-- Discard Pile -->
                      <div class="text-center">
                        <div 
                          class="discard-card card-style cursor-pointer hover:scale-105 transition-transform" 
                          [ngClass]="[
                            discardPile.length > 0 ? (getCardColor(discardPile[discardPile.length - 1]) === 'red' ? 'card-red' : 'card-black') : '',
                            canDrawFromDiscard() ? 'ring-2 ring-blue-400' : ''
                          ]"
                          (click)="drawFromDiscard()">
                          <div *ngIf="discardPile.length > 0">
                            <div class="card-rank">
                              {{ getCardRank(discardPile[discardPile.length - 1]) }}
                            </div>
                            <div class="card-suit">
                              {{ getCardSuit(discardPile[discardPile.length - 1]) }}
                            </div>
                          </div>
                          <span *ngIf="discardPile.length === 0" class="absolute inset-0 flex items-center justify-center text-gray-400 text-xs">Empty</span>
                        </div>
                        <p class="text-white text-xs mt-1">Discard</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Player Hand -->
              <div class="flex justify-center space-x-1">
                <div 
                  *ngFor="let card of myCards; let i = index" 
                  class="hand-card card-style cursor-pointer hover:scale-105 hover:-translate-y-2 transition-all"
                  [ngClass]="[
                    getCardColor(card) === 'red' ? 'card-red' : 'card-black',
                    selectedCard === i ? 'ring-2 ring-casino-gold -translate-y-1' : ''
                  ]"
                  (click)="selectCard(i)">
                  <div class="card-rank">
                    {{ getCardRank(card) }}
                  </div>
                  <div class="card-suit">
                    {{ getCardSuit(card) }}
                  </div>
                </div>
              </div>

              <!-- Discard Button (shown when card is selected) -->
              <div *ngIf="selectedCard !== null" class="text-center mt-4">
                <button 
                  (click)="discardSelectedCard()"
                  class="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors">
                  Discard Selected Card
                </button>
              </div>

              <!-- Knock Opportunity Notification -->
              <div *ngIf="showKnockOpportunity" class="text-center mb-4 p-4 bg-yellow-600/20 border border-yellow-600 rounded-lg">
                <div class="text-yellow-400 font-bold text-lg mb-2">
                  🥊 Knock Opportunity!
                </div>
                <div class="text-white mb-2">
                  You can knock with your current hand
                </div>
                <div class="text-yellow-300 text-sm mb-3">
                  Time remaining: {{ knockCountdown }}s
                </div>
                <div class="space-x-2">
                  <button 
                    (click)="takeKnockOpportunity()"
                    class="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg transition-colors font-bold">
                    Knock Now!
                  </button>
                  <button 
                    (click)="ignoreKnockOpportunity()"
                    class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors">
                    Ignore
                  </button>
                </div>
              </div>

              <!-- Game Actions -->
              <div class="text-center space-x-4">
                <button 
                  (click)="drawCard()"
                  [disabled]="!canDrawCard()"
                  class="casino-button"
                  [ngClass]="!canDrawCard() ? 'opacity-50 cursor-not-allowed' : ''">
                  Draw Card
                </button>
                <button 
                  (click)="knockAction()"
                  [disabled]="!canKnock()"
                  class="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg transition-colors"
                  [ngClass]="!canKnock() ? 'opacity-50 cursor-not-allowed' : ''">
                  Knock
                </button>
                <button 
                  (click)="ginAction()"
                  [disabled]="!canGin()"
                  class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                  [ngClass]="!canGin() ? 'opacity-50 cursor-not-allowed' : ''">
                  Gin
                </button>
              </div>

              <!-- Secondary Actions -->
              <div class="text-center space-x-4 mt-4">
                <button 
                  (click)="sortCards()"
                  class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors">
                  Sort Cards
                </button>
                <button 
                  (click)="endTurn()"
                  [disabled]="!canEndTurn()"
                  class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                  [ngClass]="!canEndTurn() ? 'opacity-50 cursor-not-allowed' : ''">
                  End Turn
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="space-y-6">
          <!-- Players List -->
          <div class="casino-panel">
            <h3 class="text-lg font-bold text-casino-gold mb-4">Players</h3>
            <div class="space-y-2">
              <div 
                *ngFor="let player of players; let i = index" 
                class="flex justify-between items-center p-3 rounded-lg transition-all duration-300 border-2"
                [class]="getCurrentPlayerTurnStatus(player.id) === 'active-turn' ? 'bg-casino-gold/20 border-casino-gold' : 'border-transparent'"
                [ngClass]="getPlayerColorTheme(i).frame">
                <div class="flex items-center space-x-3">
                  <!-- Player Circle Icon (matching board) -->
                  <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                       [style.background-color]="getPlayerBackgroundColor(player.name, i)">
                    {{ generatePlayerInitials(player.name, players) }}
                  </div>
                  <div>
                    <div class="font-medium transition-colors duration-300 flex items-center space-x-2" 
                         [ngClass]="getPlayerColorTheme(i).name">
                      <span>{{ player.name }}</span>
                      <span *ngIf="player.id === hostId" class="text-casino-gold text-xs">👑</span>
                      <span *ngIf="player.isAI" class="text-xs">🤖</span>
                      <span *ngIf="getCurrentPlayerTurnStatus(player.id) === 'active-turn'" class="text-green-400 text-sm">✓</span>
                    </div>
                    <div class="text-sm text-casino-silver/60">
                      Score: {{ player.score }}
                      <span *ngIf="player.isAI"> | {{ player.difficulty }}</span>
                    </div>
                  </div>
                </div>
                <div class="text-sm">
                  <span 
                    *ngIf="player.isConnected" 
                    class="text-green-400">●</span>
                  <span 
                    *ngIf="!player.isConnected" 
                    class="text-red-400">●</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Chat -->
          <div class="casino-panel">
            <h3 class="text-lg font-bold text-casino-gold mb-4">Chat</h3>
            <div class="space-y-2 max-h-40 overflow-y-auto mb-4">
              <div 
                *ngFor="let message of chatMessages" 
                class="text-sm">
                <span class="text-casino-gold font-medium">{{ message.playerName }}:</span>
                <span class="text-casino-silver ml-1">{{ message.text }}</span>
              </div>
            </div>
            
            <form (ngSubmit)="sendChatMessage()" class="flex gap-2">
              <input 
                [(ngModel)]="chatInput"
                name="chatInput"
                type="text" 
                class="casino-input flex-1 text-sm"
                placeholder="Type a message..."
                maxlength="100">
              <button 
                type="submit"
                [disabled]="!chatInput.trim()"
                class="bg-casino-gold text-casino-black px-3 py-1 rounded text-sm hover:bg-casino-bronze transition-colors">
                Send
              </button>
            </form>
          </div>

          <!-- Room Settings -->
          <div class="casino-panel">
            <h3 class="text-lg font-bold text-casino-gold mb-4">Settings</h3>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-casino-silver">Max Players:</span>
                <span class="text-casino-gold">{{ maxPlayers }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-casino-silver">Game Variant:</span>
                <span class="text-casino-gold">{{ gameVariant }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-casino-silver">Turn Limit:</span>
                <span class="text-casino-gold">{{ turnTimeLimit }}s</span>
              </div>
              <div class="flex justify-between">
                <span class="text-casino-silver">Point Limit:</span>
                <span class="text-casino-gold">{{ pointLimit }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Leave Room Confirmation Modal -->
    <div *ngIf="showLeaveConfirmation" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 modal-backdrop" (click)="cancelLeaveRoom()">
      <div class="casino-panel max-w-md w-full mx-4 modal-content" (click)="$event.stopPropagation()">
        <div class="text-center">
          <div class="text-6xl mb-4">🚪</div>
          <h3 class="text-xl font-bold text-casino-gold mb-2">Leave Room?</h3>
          <p class="text-casino-silver mb-6">
            Are you sure you want to leave <span class="text-casino-gold font-semibold">{{ roomName }}</span>?
            <br><span class="text-sm text-casino-silver/70">This action cannot be undone.</span>
          </p>
          
          <div class="flex space-x-3">
            <button 
              (click)="cancelLeaveRoom()"
              class="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-3 rounded-lg transition-colors font-medium">
              Cancel
            </button>
            <button 
              (click)="confirmLeaveRoom()"
              class="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg transition-colors font-medium">
              Leave Room
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .card-style {
      background: white;
      border-radius: 8px;
      position: relative;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    
    .card-rank {
      position: absolute;
      top: 6px;
      left: 6px;
      font-weight: bold;
      font-size: 0.875rem;
      line-height: 1;
    }
    
    .card-suit {
      position: absolute;
      bottom: 6px;
      right: 6px;
      font-weight: bold;
      font-size: 1.125rem;
      line-height: 1;
    }
    
    .card-red {
      color: #dc2626;
      border: 2px solid #dc2626;
      box-shadow: inset 0 0 0 1px #dc2626;
    }
    
    .card-black {
      color: #1f2937;
      border: 2px solid #1f2937;
      box-shadow: inset 0 0 0 1px #1f2937;
    }
    
    .hand-card {
      width: 3rem;
      height: 4rem;
    }
    
    .discard-card {
      width: 4rem;
      height: 6rem;
    }
    
    .discard-card .card-rank {
      font-size: 1rem;
      top: 8px;
      left: 8px;
    }
    
    .discard-card .card-suit {
      font-size: 1.25rem;
      bottom: 8px;
      right: 8px;
    }

    .player-circle {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 0.875rem;
      color: white;
      position: relative;
      border: 3px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .player-circle.active-turn::after {
      content: '✓';
      position: absolute;
      bottom: -8px;
      left: 50%;
      transform: translateX(-50%);
      background: #10b981;
      color: white;
      border-radius: 50%;
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
      border: 2px solid white;
    }

    .table-container {
      position: relative;
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
    }

    .players-around-table {
      position: relative;
      width: 100%;
      height: 400px;
    }

    .player-position {
      position: absolute;
    }

    .player-top {
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
    }

    .player-top-right {
      top: 30px;
      right: 30px;
    }

    .player-right {
      top: 50%;
      right: 10px;
      transform: translateY(-50%);
    }

    .player-bottom-right {
      bottom: 30px;
      right: 30px;
    }

    .player-bottom {
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
    }

    .player-bottom-left {
      bottom: 30px;
      left: 30px;
    }

    .player-left {
      top: 50%;
      left: 10px;
      transform: translateY(-50%);
    }

    .player-top-left {
      top: 30px;
      left: 30px;
    }

    .game-table {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 300px;
      height: 200px;
      background: linear-gradient(135deg, #0f5132, #198754);
      border-radius: 100px;
      border: 4px solid #ffd700;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.3), 0 4px 16px rgba(0, 0, 0, 0.3);
    }

    /* Modal styles */
    .modal-backdrop {
      backdrop-filter: blur(4px);
      animation: fadeIn 0.2s ease-out;
    }

    .modal-content {
      animation: slideIn 0.3s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideIn {
      from { 
        opacity: 0;
        transform: scale(0.9) translateY(-20px);
      }
      to { 
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    /* Player action animations */
    @keyframes drawAction {
      0% { transform: scale(1); }
      50% { transform: scale(1.1); box-shadow: 0 0 20px rgba(16, 185, 129, 0.6); }
      100% { transform: scale(1); }
    }

    @keyframes discardAction {
      0% { transform: scale(1); }
      50% { transform: scale(1.1); box-shadow: 0 0 20px rgba(239, 68, 68, 0.6); }
      100% { transform: scale(1); }
    }

    @keyframes specialAction {
      0% { transform: scale(1); }
      25% { transform: scale(1.2); box-shadow: 0 0 30px rgba(255, 215, 0, 0.8); }
      50% { transform: scale(1.1); }
      75% { transform: scale(1.2); box-shadow: 0 0 30px rgba(255, 215, 0, 0.8); }
      100% { transform: scale(1); }
    }

    .player-action-draw {
      animation: drawAction 1s ease-in-out;
    }

    .player-action-discard {
      animation: discardAction 1s ease-in-out;
    }

    .player-action-special {
      animation: specialAction 1.5s ease-in-out;
    }
  `]
})
export class GameRoomComponent implements OnInit, OnDestroy {
  roomCode = '';
  roomName = 'Cosmic Game Room';
  gamePhase: 'waiting' | 'playing' | 'finished' = 'waiting';
  isReconnecting = false;
  
  // Real game data
  currentRoom: GameRoom | null = null;
  players: Player[] = [];
  
  // Game state
  myCards: Card[] = [];
  opponentCards: number = 0;
  discardPile: Card[] = [];
  deckCount: number = 0;
  
  // Turn management
  hasDrawnThisTurn: boolean = false;
  currentPhase: 'draw' | 'discard' = 'draw';
  
  // Subscriptions
  private subscriptions: Subscription[] = [];
  
  playerSlots: any[] = [];
  currentPlayerId = '';
  currentPlayerName = '';
  hostId = '';
  isHost = false;
  isPlayerReady = false;
  canStartGame = false;
  myPlayerId = ''; // Track which player this client represents  
  myPlayerName = ''; // Track this client's player name

  // Player color themes for visual differentiation - now synchronized with board icons
  private playerColors = [
    { frame: 'border-red-500 bg-red-500/10', name: 'text-red-400', bgColor: 'hsl(0, 65%, 50%)' },      // Red
    { frame: 'border-orange-500 bg-orange-500/10', name: 'text-orange-400', bgColor: 'hsl(30, 65%, 50%)' }, // Orange  
    { frame: 'border-yellow-500 bg-yellow-500/10', name: 'text-yellow-400', bgColor: 'hsl(60, 65%, 50%)' }, // Yellow
    { frame: 'border-green-500 bg-green-500/10', name: 'text-green-400', bgColor: 'hsl(120, 65%, 50%)' },   // Green
    { frame: 'border-cyan-500 bg-cyan-500/10', name: 'text-cyan-400', bgColor: 'hsl(180, 65%, 50%)' },     // Cyan
    { frame: 'border-blue-500 bg-blue-500/10', name: 'text-blue-400', bgColor: 'hsl(240, 65%, 50%)' },     // Blue
    { frame: 'border-purple-500 bg-purple-500/10', name: 'text-purple-400', bgColor: 'hsl(270, 65%, 50%)' }, // Purple
    { frame: 'border-pink-500 bg-pink-500/10', name: 'text-pink-400', bgColor: 'hsl(300, 65%, 50%)' }       // Magenta
  ];

  // Room settings
  maxPlayers = 6;
  gameVariant = 'classic';
  turnTimeLimit = 30;
  pointLimit = 100;

  // Chat
  chatMessages: { playerName: string; text: string; timestamp: Date }[] = [];
  chatInput = '';

  // Leave room confirmation
  showLeaveConfirmation = false;

  // Card selection
  selectedCard: number | null = null;
  
  // Knock feature
  knockOpportunityTimeout: any = null;
  knockCountdown = 0;
  showKnockOpportunity = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private gameApiService: GameApiService,
    private socketService: SocketService
  ) {}

  ngOnInit() {
    this.roomCode = this.route.snapshot.params['code'];
    console.log('Joining room:', this.roomCode);
    
    // Check if this is a reconnection
    const storedRoomCode = localStorage.getItem('activeRoomCode');
    this.isReconnecting = storedRoomCode === this.roomCode;
    
    if (this.isReconnecting) {
      console.log('🔄 Reconnecting to existing session...');
    }
    
    // Get player name from localStorage (should be set when joining/creating room)
    this.myPlayerName = localStorage.getItem('currentPlayerName') || 'Player';
    
    // Connect to WebSocket
    this.socketService.connect();
    
    // Subscribe to real-time updates
    this.setupSocketSubscriptions();
    
    // Join the room via socket (important for session tracking)
    this.socketService.joinRoom(this.roomCode, this.myPlayerName);
    
    // Load room data
    this.loadRoomData();
  }

  ngOnDestroy() {
    // Cleanup subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
    
    // Clear knock opportunity timeout
    this.clearKnockOpportunity();
    
    // Leave room and disconnect socket
    if (this.roomCode) {
      this.socketService.leaveRoom(this.roomCode);
    }
    this.socketService.disconnect();
    
    // Don't clear session here as user might want to rejoin
    // Session will be cleared when they start a new game or manually clear it
  }

  private setupSocketSubscriptions(): void {
    // Room updates
    this.subscriptions.push(
      this.socketService.roomUpdated$.subscribe(room => {
        if (room) {
          this.updateRoomData(room);
          this.updateSessionActivity(); // Keep session fresh
        }
      })
    );

    // Game updates
    this.subscriptions.push(
      this.socketService.gameUpdated$.subscribe(gameState => {
        if (gameState && this.currentRoom) {
          this.currentRoom.gameState = gameState;
          this.gamePhase = gameState.phase;
        }
      })
    );

    // Player joined
    this.subscriptions.push(
      this.socketService.playerJoined$.subscribe(player => {
        if (player && this.currentRoom) {
          // Player already added via room update, just show notification
          this.addChatMessage('System', `${player.name} joined the room`);
        }
      })
    );

    // Player left
    this.subscriptions.push(
      this.socketService.playerLeft$.subscribe(playerId => {
        if (playerId && this.currentRoom) {
          const player = this.currentRoom.players.find(p => p.id === playerId);
          if (player) {
            this.addChatMessage('System', `${player.name} left the room`);
          }
        }
      })
    );

    // Chat messages
    this.subscriptions.push(
      this.socketService.chatReceived$.subscribe(chat => {
        if (chat) {
          this.addChatMessage(chat.playerName, chat.message);
        }
      })
    );

    // Errors
    this.subscriptions.push(
      this.socketService.error$.subscribe(error => {
        if (error) {
          console.error('Socket error:', error);
          this.addChatMessage('System', `Error: ${error}`);
        }
      })
    );

    // Game started
    this.subscriptions.push(
      this.socketService.gameStarted$.subscribe(started => {
        if (started) {
          this.gamePhase = 'playing';
          this.addChatMessage('System', 'Game started!');
        }
      })
    );

    // Player actions for visual feedback
    this.subscriptions.push(
      this.socketService.playerAction$.subscribe(action => {
        if (action && this.currentRoom) {
          this.handlePlayerActionFeedback(action);
        }
      })
    );
  }

  private loadRoomData(): void {
    this.gameApiService.getRoom(this.roomCode).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.updateRoomData(response.data);
        } else {
          console.error('Failed to load room:', response.error);
          this.router.navigate(['/']);
        }
      },
      error: (error) => {
        console.error('Error loading room:', error);
        this.router.navigate(['/']);
      }
    });
  }

  private updateRoomData(room: GameRoom): void {
    try {
      console.log('🔄 updateRoomData called with:', room);
      
      if (!room) {
        console.error('❌ Room data is null/undefined');
        return;
      }
      
      if (!room.players || !Array.isArray(room.players)) {
        console.error('❌ Room players data is invalid:', room.players);
        return;
      }
      
      this.currentRoom = room;
      this.roomName = room.name;
      this.players = room.players;
      this.hostId = room.hostId;
      this.gamePhase = room.gameState?.phase || 'waiting';
      this.maxPlayers = room.settings?.maxPlayers || 6;
      this.gameVariant = (room.settings?.gameVariant as string) || 'classic';
      this.turnTimeLimit = room.settings?.turnTimeLimit || 30;
      this.pointLimit = room.settings?.pointLimit || 100;
      
      // Find current player by name
      const myPlayer = this.players.find(p => p.name === this.myPlayerName);
      if (myPlayer) {
        this.myPlayerId = myPlayer.id;
        this.isPlayerReady = myPlayer.isReady;
      }
      
      // Update player slots
      this.playerSlots = Array(this.maxPlayers).fill(null).map((_, i) => ({
        index: i,
        player: i < this.players.length ? this.players[i] : null
      }));

      // Determine if current user is host
      this.isHost = this.hostId === this.myPlayerId;
      
      // Check if can start game
      this.canStartGame = this.isHost && 
                         this.players.length >= 2 && 
                         this.players.every(p => p.isReady) &&
                         this.gamePhase === 'waiting';

      // Update current player info for game state
      if (room.gameState?.currentPlayer) {
        // Check if it's a new turn (different player)
        const previousPlayerId = this.currentPlayerId;
        this.currentPlayerId = room.gameState.currentPlayer;
        const currentPlayer = this.players.find(p => p.id === room.gameState.currentPlayer);
        this.currentPlayerName = currentPlayer?.name || '';
        
        // Reset turn state ONLY if it's a new turn (different player)
        if (previousPlayerId !== this.currentPlayerId) {
          console.log('🔄 Resetting turn state - NEW TURN:', {
            previousPlayerId,
            newPlayerId: this.currentPlayerId,
            isMyTurn: this.currentPlayerId === this.myPlayerId,
            resetting: true
          });
          
          this.hasDrawnThisTurn = false;
          this.currentPhase = 'draw';
          this.selectedCard = null; // Clear any selected card
          
          console.log('✅ Turn state reset for new turn:', {
            hasDrawnThisTurn: this.hasDrawnThisTurn,
            currentPhase: this.currentPhase
          });
        } else if (this.currentPlayerId === this.myPlayerId) {
          console.log('🎯 Same turn, my turn - keeping state:', {
            hasDrawnThisTurn: this.hasDrawnThisTurn,
            currentPhase: this.currentPhase,
            currentPlayer: this.currentPlayerId,
            myPlayer: this.myPlayerId
          });
        } else {
          console.log('🎯 Not my turn:', {
            currentPlayer: this.currentPlayerId,
            myPlayer: this.myPlayerId
          });
        }
      }
      
      // Update game data for display
      if (this.gamePhase === 'playing') {
        // Get my cards
        const myPlayer = this.players.find(p => p.id === this.myPlayerId);
        this.myCards = myPlayer?.cards || [];
        
        // Count opponent cards (for display purposes)
        const opponents = this.players.filter(p => p.id !== this.myPlayerId);
        this.opponentCards = opponents.length > 0 ? opponents[0].cards?.length || 0 : 0;
        
        // Game state data
        const previousDiscardPile = [...this.discardPile];
        this.discardPile = room.gameState?.discardPile || [];
        this.deckCount = room.gameState?.deck?.length || 0;
        
        // Force UI update for discard pile
        if (previousDiscardPile.length !== this.discardPile.length) {
          console.log('🗑️ Discard pile updated:', {
            previous: previousDiscardPile.map(c => `${c.rank}${c.suit}`),
            current: this.discardPile.map(c => `${c.rank}${c.suit}`),
            added: this.discardPile.length > previousDiscardPile.length ? 
              this.discardPile[this.discardPile.length - 1] : null
          });
          
          // Force Angular change detection for discard pile
          setTimeout(() => {
            this.discardPile = [...room.gameState?.discardPile || []];
          }, 0);
          
          // Check for knock opportunity after discard pile updates
          setTimeout(() => {
            if (this.discardPile.length > previousDiscardPile.length) {
              // Someone discarded a card, check if I can knock
              this.startKnockOpportunity();
            }
          }, 100);
        }
      }
      
      console.log('Room updated. My player:', { id: this.myPlayerId, name: this.myPlayerName, ready: this.isPlayerReady });
    } catch (error) {
      console.error('❌ Error in updateRoomData:', error, room);
    }
  }

  private addChatMessage(playerName: string, text: string): void {
    this.chatMessages.push({
      playerName,
      text,
      timestamp: new Date()
    });
  }

  /**
   * Get color theme for a player based on their index
   */
  getPlayerColorTheme(playerIndex: number) {
    return this.playerColors[playerIndex % this.playerColors.length];
  }

  /**
   * Get frame class for a player slot
   */
  getPlayerFrameClass(slot: any): string {
    if (!slot.player) return '';
    const playerIndex = this.players.findIndex(p => p.id === slot.player.id);
    const theme = this.getPlayerColorTheme(playerIndex);
    return theme.frame;
  }

  /**
   * Get name class for a player slot
   */
  getPlayerNameClass(slot: any): string {
    if (!slot.player) return 'text-casino-gold';
    const playerIndex = this.players.findIndex(p => p.id === slot.player.id);
    const theme = this.getPlayerColorTheme(playerIndex);
    return theme.name;
  }

  toggleReady() {
    // Don't optimistically update - wait for server confirmation
    this.socketService.togglePlayerReady(this.roomCode);
    console.log('Requesting ready status toggle...');
  }

  startGame() {
    if (!this.canStartGame) return;
    
    this.socketService.startGame(this.roomCode);
    console.log('Starting game...');
  }

  sendChatMessage() {
    if (!this.chatInput.trim()) return;

    this.socketService.sendChatMessage(this.roomCode, this.chatInput.trim());
    this.chatInput = '';
  }

  leaveRoom() {
    console.log('🚪 Showing leave room confirmation...');
    this.showLeaveConfirmation = true;
  }

  cancelLeaveRoom() {
    console.log('🚫 Leave room cancelled by user');
    this.showLeaveConfirmation = false;
  }

  confirmLeaveRoom() {
    console.log('🚪 Leaving room:', this.roomCode);
    this.showLeaveConfirmation = false;
    
    // Clear session data when leaving
    localStorage.removeItem('activeRoomCode');
    localStorage.removeItem('sessionTimestamp');
    localStorage.removeItem('sessionIsAIOnly');
    localStorage.removeItem('currentPlayerName');
    console.log('🧹 Session data cleared');
    
    try {
      // Leave room via socket
      this.socketService.leaveRoom(this.roomCode);
      console.log('📡 Socket leave room called');
      
      // Navigate back to home
      this.router.navigate(['/']);
      console.log('🏠 Navigation to home initiated');
    } catch (error) {
      console.error('❌ Error leaving room:', error);
      // Still try to navigate home even if socket fails
      this.router.navigate(['/']);
    }
  }

  /**
   * Get display string for a card
   */
  getCardDisplay(card: Card): string {
    if (!card) return '';
    
    // Card suit symbols
    const suitSymbols: { [key: string]: string } = {
      'hearts': '♥',
      'diamonds': '♦',
      'clubs': '♣',
      'spades': '♠'
    };
    
    const suit = suitSymbols[card.suit] || card.suit;
    
    return `${card.rank}${suit}`;
  }

  getCardRank(card: Card): string {
    return card?.rank || '';
  }

  getCardSuit(card: Card): string {
    const suitSymbols: { [key: string]: string } = {
      'hearts': '♥',
      'diamonds': '♦',
      'clubs': '♣',
      'spades': '♠'
    };
    
    return suitSymbols[card?.suit] || card?.suit || '';
  }

  getCardColor(card: Card): string {
    if (!card) return 'black';
    return (card.suit === 'hearts' || card.suit === 'diamonds') ? 'red' : 'black';
  }

  private updateSessionActivity(): void {
    // Update session timestamp to keep it fresh
    const currentRoomCode = localStorage.getItem('activeRoomCode');
    if (currentRoomCode === this.roomCode) {
      localStorage.setItem('sessionTimestamp', Date.now().toString());
      
      // Store room composition info for smarter timeout calculation
      if (this.currentRoom) {
        const humanPlayers = this.currentRoom.players.filter(p => !p.isAI);
        const isAIOnly = humanPlayers.length <= 1; // Only this player or less
        localStorage.setItem('sessionIsAIOnly', isAIOnly.toString());
      }
    }
  }

  generatePlayerInitials(name: string, allPlayers: any[]): string {
    // Get all other player names for collision detection
    const otherNames = allPlayers.filter(p => p.name !== name).map(p => p.name);
    
    // Start with first character
    let initials = name.charAt(0).toUpperCase();
    
    // Check if any other player starts with the same character
    const sameFirstChar = otherNames.some(otherName => 
      otherName.charAt(0).toUpperCase() === initials
    );
    
    // If collision, add second character
    if (sameFirstChar && name.length > 1) {
      initials += name.charAt(1).toUpperCase();
    }
    
    return initials;
  }

  getPlayerPositionClass(index: number, totalPlayers: number): string {
    const positions = [
      'player-bottom',     // Current player always at bottom
      'player-top',        // Second player at top
      'player-right',      // Third player at right
      'player-left',       // Fourth player at left
      'player-top-right',  // Fifth player at top-right
      'player-top-left',   // Sixth player at top-left
      'player-bottom-right', // Seventh player at bottom-right
      'player-bottom-left'   // Eighth player at bottom-left
    ];
    
    return positions[index] || 'player-top';
  }

  getPlayerBackgroundColor(playerName: string, playerIndex?: number): string {
    if (playerIndex !== undefined) {
      // Use consistent colors based on player index for synchronization
      const hues = [0, 30, 60, 120, 180, 240, 270, 300]; // Red, Orange, Yellow, Green, Cyan, Blue, Purple, Magenta
      const hue = hues[playerIndex % hues.length];
      return `hsl(${hue}, 65%, 50%)`;
    }
    
    // Fallback to name-based hash (for backward compatibility)
    let hash = 0;
    for (let i = 0; i < playerName.length; i++) {
      hash = playerName.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Create HSL color with good saturation and lightness for visibility
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 65%, 50%)`;
  }

  getCurrentPlayerTurnStatus(playerId: string): string {
    // Check if it's this player's turn based on the current game state
    if (this.currentRoom && this.currentRoom.gameState.currentPlayer === playerId) {
      return 'active-turn';
    }
    return '';
  }

  // Game action methods
  drawCard(): void {
    console.log('🎯 drawCard called - before validation:', {
      hasDrawnThisTurn: this.hasDrawnThisTurn,
      currentPhase: this.currentPhase,
      canDraw: this.canDrawCard()
    });
    
    if (!this.canDrawCard()) {
      console.log('❌ Cannot draw card - validation failed');
      return;
    }
    
    console.log('🃏 Drawing card...');
    
    // Mark that we've drawn this turn
    this.hasDrawnThisTurn = true;
    this.currentPhase = 'discard';
    
    console.log('🎯 After drawing - state updated:', {
      hasDrawnThisTurn: this.hasDrawnThisTurn,
      currentPhase: this.currentPhase
    });
    
    const action = {
      type: 'draw' as const,
      playerId: this.myPlayerId,
      timestamp: new Date()
    };
    
    this.socketService.makeGameAction(this.roomCode, action);
  }

  knockAction(): void {
    if (!this.canKnock()) return;
    
    console.log('✊ Knocking...');
    const action = {
      type: 'knock' as const,
      playerId: this.myPlayerId,
      timestamp: new Date()
    };
    
    this.socketService.makeGameAction(this.roomCode, action);
  }

  ginAction(): void {
    if (!this.canGin()) return;
    
    console.log('🥃 Going Gin...');
    const action = {
      type: 'gin' as const,
      playerId: this.myPlayerId,
      timestamp: new Date()
    };
    
    this.socketService.makeGameAction(this.roomCode, action);
  }

  // Game state validation methods
  canDrawCard(): boolean {
    const canDraw = this.gamePhase === 'playing' && 
           this.currentRoom?.gameState.currentPlayer === this.myPlayerId &&
           this.deckCount > 0 &&
           !this.hasDrawnThisTurn &&
           this.currentPhase === 'draw';
    
    if (this.currentRoom?.gameState.currentPlayer === this.myPlayerId) {
      console.log('🎯 canDrawCard check:', {
        gamePhase: this.gamePhase,
        isMyTurn: this.currentRoom?.gameState.currentPlayer === this.myPlayerId,
        deckCount: this.deckCount,
        hasDrawnThisTurn: this.hasDrawnThisTurn,
        currentPhase: this.currentPhase,
        canDraw
      });
    }
    
    return canDraw;
  }

  canKnock(): boolean {
    // Can knock if it's my turn and I have cards
    // TODO: Add proper gin rummy knock validation (deadwood <= 10)
    return this.gamePhase === 'playing' && 
           this.currentRoom?.gameState.currentPlayer === this.myPlayerId &&
           this.myCards.length > 0;
  }

  canGin(): boolean {
    // Can gin if it's my turn and I have a gin hand
    // TODO: Add proper gin validation (all cards in melds, no deadwood)
    return this.gamePhase === 'playing' && 
           this.currentRoom?.gameState.currentPlayer === this.myPlayerId &&
           this.myCards.length > 0;
  }

  // Knock opportunity methods
  takeKnockOpportunity(): void {
    this.clearKnockOpportunity();
    this.knockAction();
  }

  ignoreKnockOpportunity(): void {
    this.clearKnockOpportunity();
  }

  private startKnockOpportunity(): void {
    if (!this.canKnock()) return;
    
    this.showKnockOpportunity = true;
    this.knockCountdown = 5;
    
    // Update countdown every second
    const countdownInterval = setInterval(() => {
      this.knockCountdown--;
      if (this.knockCountdown <= 0) {
        clearInterval(countdownInterval);
        this.clearKnockOpportunity();
      }
    }, 1000);
    
    // Auto-hide after 5 seconds
    this.knockOpportunityTimeout = setTimeout(() => {
      this.clearKnockOpportunity();
    }, 5000);
  }

  private clearKnockOpportunity(): void {
    this.showKnockOpportunity = false;
    this.knockCountdown = 0;
    if (this.knockOpportunityTimeout) {
      clearTimeout(this.knockOpportunityTimeout);
      this.knockOpportunityTimeout = null;
    }
  }

  // Card selection methods
  selectCard(cardIndex: number): void {
    if (this.selectedCard === cardIndex) {
      // Deselect if clicking the same card
      this.selectedCard = null;
    } else {
      // Select the clicked card
      this.selectedCard = cardIndex;
    }
    console.log('🃏 Selected card index:', this.selectedCard);
  }

  discardSelectedCard(): void {
    console.log('🎯 discardSelectedCard called:', {
      selectedCard: this.selectedCard,
      canDiscard: this.canDiscardCard(),
      hasDrawnThisTurn: this.hasDrawnThisTurn,
      currentPhase: this.currentPhase,
      gamePhase: this.gamePhase,
      isMyTurn: this.currentRoom?.gameState.currentPlayer === this.myPlayerId
    });
    
    if (this.selectedCard === null) {
      console.log('❌ No card selected');
      return;
    }
    
    if (!this.canDiscardCard()) {
      console.log('❌ Cannot discard - validation failed');
      // Let's try without the strict validation for testing
      console.log('🧪 Attempting discard anyway for debugging...');
    }
    
    const cardToDiscard = this.myCards[this.selectedCard];
    console.log('🗑️ Discarding card:', cardToDiscard);
    console.log('🎯 Room code:', this.roomCode);
    console.log('🎯 Player ID:', this.myPlayerId);
    
    const action = {
      type: 'discard' as const,
      playerId: this.myPlayerId,
      card: cardToDiscard,
      timestamp: new Date()
    };
    
    console.log('🚀 Sending discard action:', action);
    this.socketService.makeGameAction(this.roomCode, action);
    
    // Only clear the selection - let the backend handle turn transition
    this.selectedCard = null;
    
    console.log('✅ Discard action sent, selection cleared');
  }

  canDiscardCard(): boolean {
    const canDiscard = this.gamePhase === 'playing' && 
           this.currentRoom?.gameState.currentPlayer === this.myPlayerId &&
           this.selectedCard !== null &&
           this.selectedCard >= 0 &&
           this.selectedCard < this.myCards.length &&
           this.hasDrawnThisTurn &&
           this.currentPhase === 'discard';
    
    // Debug when trying to discard
    if (this.selectedCard !== null) {
      console.log('🎯 canDiscardCard check:', {
        gamePhase: this.gamePhase,
        isMyTurn: this.currentRoom?.gameState.currentPlayer === this.myPlayerId,
        selectedCard: this.selectedCard,
        hasDrawnThisTurn: this.hasDrawnThisTurn,
        currentPhase: this.currentPhase,
        canDiscard,
        cardCount: this.myCards.length
      });
    }
    
    return canDiscard;
  }

  endTurn(): void {
    if (!this.canEndTurn()) return;
    
    console.log('⏭️ Ending turn...');
    
    // Reset turn state
    this.hasDrawnThisTurn = false;
    this.currentPhase = 'draw';
    this.selectedCard = null;
    
    const action = {
      type: 'end-turn' as const,
      playerId: this.myPlayerId,
      timestamp: new Date()
    };
    
    this.socketService.makeGameAction(this.roomCode, action);
  }

  canEndTurn(): boolean {
    // Can end turn if it's my turn, I've drawn a card, and I'm in discard phase
    return this.gamePhase === 'playing' && 
           this.currentRoom?.gameState.currentPlayer === this.myPlayerId &&
           this.hasDrawnThisTurn &&
           this.currentPhase === 'discard';
  }

  sortCards(): void {
    console.log('🔄 Sorting cards...');
    this.myCards.sort((a, b) => {
      // First sort by suit
      const suitOrder = ['♠', '♥', '♦', '♣'];
      const suitDiff = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
      if (suitDiff !== 0) return suitDiff;
      
      // Then sort by rank within suit
      const rankOrder = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
      return rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank);
    });
  }

  drawFromDiscard(): void {
    if (!this.canDrawFromDiscard()) return;
    
    console.log('🃏 Drawing from discard pile...');
    
    // Mark that we've drawn this turn
    this.hasDrawnThisTurn = true;
    this.currentPhase = 'discard';
    
    const action = {
      type: 'draw' as const,
      playerId: this.myPlayerId,
      card: this.discardPile[this.discardPile.length - 1], // Top card of discard pile
      timestamp: new Date()
    };
    
    this.socketService.makeGameAction(this.roomCode, action);
  }

  canDrawFromDiscard(): boolean {
    // Can draw from discard if it's my turn, haven't drawn yet, and there are cards in discard pile
    return this.gamePhase === 'playing' && 
           this.currentRoom?.gameState.currentPlayer === this.myPlayerId &&
           this.discardPile.length > 0 &&
           !this.hasDrawnThisTurn &&
           this.currentPhase === 'draw';
  }

  private handlePlayerActionFeedback(action: GameAction): void {
    if (!this.currentRoom) return;

    // Find the player who performed the action
    const player = this.currentRoom.players.find(p => p.id === action.playerId);
    if (!player) return;

    // Only show visual feedback for AI players since human players see their own actions immediately
    if (!player.isAI) return;

    console.log(`🎭 AI Player ${player.name} performed action: ${action.type}`);

    // Show a brief animation and message for AI actions
    this.showPlayerActionAnimation(player, action);
    
    // Add action to chat for clarity
    let actionMessage = '';
    switch (action.type) {
      case 'draw':
        actionMessage = action.card ? 'drew from discard pile' : 'drew from deck';
        break;
      case 'discard':
        actionMessage = action.card ? `discarded ${this.getCardDisplayName(action.card)}` : 'discarded a card';
        break;
      case 'knock':
        actionMessage = 'knocked!';
        break;
      case 'gin':
        actionMessage = 'declared Gin!';
        break;
    }
    
    if (actionMessage) {
      this.addChatMessage('System', `${player.name} ${actionMessage}`);
    }
  }

  private showPlayerActionAnimation(player: Player, action: GameAction): void {
    // Create a simple visual indicator
    const playerElement = document.querySelector(`[data-player-id="${player.id}"]`);
    if (!playerElement) return;

    // Add animation class based on action type
    let animationClass = '';
    switch (action.type) {
      case 'draw':
        animationClass = 'player-action-draw';
        break;
      case 'discard':
        animationClass = 'player-action-discard';
        break;
      case 'knock':
      case 'gin':
        animationClass = 'player-action-special';
        break;
    }

    if (animationClass) {
      playerElement.classList.add(animationClass);
      // Remove animation class after animation completes
      setTimeout(() => {
        playerElement.classList.remove(animationClass);
      }, 1000);
    }
  }

  private getCardDisplayName(card: Card): string {
    const rankMap: Record<string, string> = {
      'A': 'Ace',
      'J': 'Jack',
      'Q': 'Queen', 
      'K': 'King'
    };
    
    const suitMap: Record<string, string> = {
      'hearts': '♥',
      'diamonds': '♦',
      'clubs': '♣',
      'spades': '♠'
    };

    const rank = rankMap[card.rank] || card.rank;
    const suit = suitMap[card.suit] || card.suit;
    
    return `${rank} of ${suit}`;
  }
}
