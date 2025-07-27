import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { GameApiService } from '../../services/game-api.service';
import { CreateRoomRequest } from '@cosmic-games/shared';

@Component({
  selector: 'app-create-room',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-2xl mx-auto">
      <div class="casino-panel">
        <h1 class="text-3xl font-bold text-gold mb-8 text-center">
          Create New Room
        </h1>
        
        <form (ngSubmit)="onCreateRoom()" class="space-y-6">
          <!-- Room Name -->
          <div>
            <label class="block text-casino-silver font-medium mb-2">
              Room Name
            </label>
            <input 
              type="text" 
              [(ngModel)]="roomName"
              name="roomName"
              class="casino-input w-full"
              placeholder="Enter room name..."
              required>
          </div>

          <!-- Player Name -->
          <div>
            <label class="block text-casino-silver font-medium mb-2">
              Your Name
            </label>
            <input 
              type="text" 
              [(ngModel)]="playerName"
              name="playerName"
              class="casino-input w-full"
              placeholder="Enter your name..."
              required>
          </div>

          <!-- Room Settings -->
          <div class="grid md:grid-cols-2 gap-4">
            <div>
              <label class="block text-casino-silver font-medium mb-2">
                Max Players
              </label>
              <select 
                [(ngModel)]="maxPlayers"
                name="maxPlayers"
                class="casino-input w-full">
                <option value="2">2 Players</option>
                <option value="3">3 Players</option>
                <option value="4">4 Players</option>
                <option value="5">5 Players</option>
                <option value="6">6 Players</option>
              </select>
            </div>

            <div>
              <label class="block text-casino-silver font-medium mb-2">
                Game Variant
              </label>
              <select 
                [(ngModel)]="gameVariant"
                name="gameVariant"
                class="casino-input w-full">
                <option value="classic">Classic Gin Rummy</option>
                <option value="multiplayer">Multiplayer Gin Rummy</option>
              </select>
            </div>
          </div>

          <div class="grid md:grid-cols-2 gap-4">
            <div>
              <label class="block text-casino-silver font-medium mb-2">
                Turn Time Limit (seconds)
              </label>
              <select 
                [(ngModel)]="turnTimeLimit"
                name="turnTimeLimit"
                class="casino-input w-full">
                <option value="30">30 seconds</option>
                <option value="60">1 minute</option>
                <option value="120">2 minutes</option>
                <option value="0">No limit</option>
              </select>
            </div>

            <div>
              <label class="block text-casino-silver font-medium mb-2">
                Point Limit
              </label>
              <select 
                [(ngModel)]="pointLimit"
                name="pointLimit"
                class="casino-input w-full">
                <option value="100">100 points</option>
                <option value="250">250 points</option>
                <option value="500">500 points</option>
              </select>
            </div>
          </div>

          <!-- Checkboxes -->
          <div class="space-y-3">
            <label class="flex items-center">
              <input 
                type="checkbox" 
                [(ngModel)]="allowSpectators"
                name="allowSpectators"
                class="mr-3 w-4 h-4 text-casino-gold bg-casino-charcoal border-casino-silver rounded focus:ring-casino-gold">
              <span class="text-casino-silver">Allow spectators</span>
            </label>

            <label class="flex items-center">
              <input 
                type="checkbox" 
                [(ngModel)]="isPrivate"
                name="isPrivate"
                class="mr-3 w-4 h-4 text-casino-gold bg-casino-charcoal border-casino-silver rounded focus:ring-casino-gold">
              <span class="text-casino-silver">Private room (invite only)</span>
            </label>
          </div>

          <!-- Buttons -->
          <div class="flex gap-4 pt-4">
            <button 
              type="button"
              (click)="goBack()"
              class="flex-1 bg-casino-charcoal border border-casino-silver/30 text-casino-silver py-3 px-6 rounded-lg hover:bg-casino-silver/10 transition-colors">
              Cancel
            </button>
            
            <button 
              type="submit"
              [disabled]="!isFormValid()"
              class="flex-1 casino-button">
              Create Room
            </button>
          </div>
        </form>

        <div *ngIf="loading" class="text-center mt-6">
          <div class="text-casino-gold">Creating room...</div>
        </div>

        <div *ngIf="error" class="text-center mt-6">
          <div class="text-red-500">{{ error }}</div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class CreateRoomComponent {
  roomName = '';
  playerName = '';
  maxPlayers = 4;
  gameVariant = 'classic';
  turnTimeLimit = 30;
  pointLimit = 100;
  allowSpectators = true;
  isPrivate = false;
  loading = false;
  error = '';

  constructor(private router: Router, private gameApiService: GameApiService) {}

  isFormValid(): boolean {
    return this.roomName.trim() !== '' && this.playerName.trim() !== '';
  }

  async onCreateRoom() {
    if (!this.isFormValid()) return;

    this.loading = true;
    this.error = '';

    try {
      // Save player name for session tracking
      localStorage.setItem('currentPlayerName', this.playerName);

      const request: CreateRoomRequest = {
        name: this.roomName,
        playerName: this.playerName,
        settings: {
          maxPlayers: this.maxPlayers,
          gameVariant: this.gameVariant as 'classic' | 'multiplayer',
          turnTimeLimit: this.turnTimeLimit,
          pointLimit: this.pointLimit,
          allowSpectators: this.allowSpectators,
          isPrivate: this.isPrivate
        }
      };

      this.gameApiService.createRoom(request).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            // Save room data and navigate
            this.gameApiService.setCurrentRoom(response.data.room);
            
            // Store active session info for rejoining later
            localStorage.setItem('activeRoomCode', response.data.room.id); // room.id is the 6-digit code
            localStorage.setItem('sessionTimestamp', Date.now().toString());
            
            this.router.navigate(['/room', response.data.room.id]);
          } else {
            this.error = response.error || 'Failed to create room';
          }
        },
        error: (error) => {
          console.error('Error creating room:', error);
          this.error = 'Failed to create room. Please try again.';
        },
        complete: () => {
          this.loading = false;
        }
      });

    } catch (error) {
      console.error('Error:', error);
      this.error = 'Failed to create room. Please try again.';
      this.loading = false;
    }
  }

  goBack() {
    this.router.navigate(['/']);
  }
}
