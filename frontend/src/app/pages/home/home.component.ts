import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { GameApiService } from '../../services/game-api.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-4xl mx-auto text-center">
      <!-- Active Session Alert -->
      <div *ngIf="activeSession" class="casino-panel mb-8 bg-green-900/30 border-green-500">
        <div class="flex items-center justify-between">
          <div class="text-left">
            <h3 class="text-xl font-bold text-green-400 mb-2">🎮 Active Game Session Found</h3>
            <p class="text-casino-silver">
              Room: <span class="text-gold font-mono">{{ activeSession.roomCode }}</span> • 
              Player: <span class="text-gold">{{ activeSession.playerName }}</span>
            </p>
            <p class="text-sm text-gray-400 mt-1">
              Session from {{ formatSessionTime(activeSession.timestamp) }}
              <span *ngIf="activeSession.isAIOnly" class="text-yellow-400 ml-2">• 5min timeout (AI only)</span>
              <span *ngIf="!activeSession.isAIOnly" class="text-blue-400 ml-2">• 4h timeout (multiplayer)</span>
            </p>
          </div>
          <div class="flex gap-2">
            <button 
              (click)="rejoinSession()" 
              class="casino-button bg-green-600 hover:bg-green-700">
              🚪 Rejoin Game
            </button>
            <button 
              (click)="clearSession()" 
              class="casino-button bg-red-600 hover:bg-red-700">
              ❌ Clear
            </button>
          </div>
        </div>
      </div>

      <!-- Hero Section -->
      <div class="casino-panel mb-12">
        <h1 class="text-5xl font-bold text-gold mb-4 text-glow">
          Welcome to Cosmic Games
        </h1>
        <p class="text-xl text-casino-silver mb-8">
          Premium multiplayer card games with friends and AI opponents
        </p>
        
        <div class="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          <button 
            (click)="createRoom()" 
            class="casino-button text-lg py-4">
            🎮 Create New Room
          </button>
          
          <button 
            (click)="joinRoom()" 
            class="casino-button text-lg py-4">
            🚪 Join Existing Room
          </button>
        </div>
      </div>

      <!-- Game Features -->
      <div class="grid md:grid-cols-3 gap-8 mb-12">
        <div class="casino-panel text-center">
          <div class="text-4xl mb-4">🃏</div>
          <h3 class="text-xl font-bold text-gold mb-2">Gin Rummy</h3>
          <p class="text-casino-silver">
            Classic card game with modern multiplayer features
          </p>
        </div>
        
        <div class="casino-panel text-center">
          <div class="text-4xl mb-4">🤖</div>
          <h3 class="text-xl font-bold text-gold mb-2">AI Opponents</h3>
          <p class="text-casino-silver">
            Challenge smart AI players with different difficulty levels
          </p>
        </div>
        
        <div class="casino-panel text-center">
          <div class="text-4xl mb-4">👥</div>
          <h3 class="text-xl font-bold text-gold mb-2">Multiplayer</h3>
          <p class="text-casino-silver">
            Play with 2-6 players in private rooms
          </p>
        </div>
      </div>

      <!-- How to Play -->
      <div class="casino-panel">
        <h2 class="text-3xl font-bold text-gold mb-6">How to Play</h2>
        <div class="grid md:grid-cols-2 gap-8 text-left">
          <div>
            <h3 class="text-xl font-bold text-casino-silver mb-3">Create a Room</h3>
            <ul class="space-y-2 text-casino-silver/80">
              <li>• Click "Create New Room"</li>
              <li>• Set your room name and preferences</li>
              <li>• Share the 6-digit room code with friends</li>
              <li>• Add AI players if needed</li>
            </ul>
          </div>
          
          <div>
            <h3 class="text-xl font-bold text-casino-silver mb-3">Join a Game</h3>
            <ul class="space-y-2 text-casino-silver/80">
              <li>• Click "Join Existing Room"</li>
              <li>• Enter the 6-digit room code</li>
              <li>• Wait for other players to join</li>
              <li>• Start playing when everyone is ready</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class HomeComponent implements OnInit {
  activeSession: {
    roomCode: string;
    playerName: string;
    timestamp: number;
    isAIOnly?: boolean;
  } | null = null;

  constructor(private router: Router, private gameApiService: GameApiService) {}

  ngOnInit() {
    this.checkForActiveSession();
  }

  private checkForActiveSession() {
    try {
      const roomCode = localStorage.getItem('activeRoomCode');
      const playerName = localStorage.getItem('currentPlayerName');
      const timestampStr = localStorage.getItem('sessionTimestamp');
      
      if (roomCode && playerName && timestampStr) {
        const timestamp = parseInt(timestampStr);
        const now = Date.now();
        const sessionAge = now - timestamp;
        
        // Check room composition to determine session timeout
        this.validateSessionWithRoomCheck(roomCode, playerName, timestamp, sessionAge);
      }
    } catch (error) {
      console.error('Error checking for active session:', error);
    }
  }

  private validateSessionWithRoomCheck(roomCode: string, playerName: string, timestamp: number, sessionAge: number) {
    // Try to get room data to check player composition
    this.gameApiService.getRoom(roomCode).subscribe({
      next: (roomResponse) => {
        if (roomResponse?.success && roomResponse.data) {
          const room = roomResponse.data;
          const humanPlayers = room.players.filter((p: any) => !p.isAI);
          const isOnlyAIPlayersLeft = humanPlayers.length <= 1; // Only this player or less
          
          // Different timeouts based on room composition
          const timeoutMs = isOnlyAIPlayersLeft 
            ? 5 * 60 * 1000  // 5 minutes for AI-only rooms
            : 4 * 60 * 60 * 1000; // 4 hours for rooms with human players
          
          if (sessionAge < timeoutMs) {
            this.activeSession = {
              roomCode,
              playerName,
              timestamp,
              isAIOnly: isOnlyAIPlayersLeft
            };
          } else {
            // Session expired based on room composition
            console.log(`Session expired: ${isOnlyAIPlayersLeft ? '5min timeout (AI only)' : '4h timeout (human players)'}`);
            this.clearSessionData();
          }
        } else {
          // Room doesn't exist anymore, clear session
          console.log('Room no longer exists, clearing session');
          this.clearSessionData();
        }
      },
      error: (error) => {
        // If we can't check the room (network error, etc.), fall back to cached info or basic time check
        console.warn('Could not validate room composition, using fallback timeout:', error);
        
        // Check if we have cached room composition info
        const cachedIsAIOnly = localStorage.getItem('sessionIsAIOnly') === 'true';
        const timeoutMs = cachedIsAIOnly 
          ? 5 * 60 * 1000  // 5 minutes for AI-only rooms
          : 4 * 60 * 60 * 1000; // 4 hours for rooms with human players
        
        if (sessionAge < timeoutMs) {
          this.activeSession = {
            roomCode,
            playerName,
            timestamp,
            isAIOnly: cachedIsAIOnly
          };
        } else {
          this.clearSessionData();
        }
      }
    });
  }

  rejoinSession() {
    if (this.activeSession) {
      this.router.navigate(['/room', this.activeSession.roomCode]);
    }
  }

  clearSession() {
    this.clearSessionData();
    this.activeSession = null;
  }

  private clearSessionData() {
    localStorage.removeItem('activeRoomCode');
    localStorage.removeItem('sessionTimestamp');
    localStorage.removeItem('sessionIsAIOnly');
  }

  formatSessionTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ago`;
    } else {
      return `${minutes}m ago`;
    }
  }

  createRoom() {
    this.router.navigate(['/create-room']);
  }

  joinRoom() {
    this.router.navigate(['/join-room']);
  }
}
