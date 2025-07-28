import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-join-room',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-md mx-auto">
      <div class="casino-panel">
        <h1 class="text-3xl font-bold text-gold mb-8 text-center">
          Join Room
        </h1>
        
        <form (ngSubmit)="onJoinRoom()" class="space-y-6">
          <!-- Room Code -->
          <div>
            <label class="block text-casino-silver font-medium mb-2">
              Room Code
            </label>
            <input 
              type="text" 
              [(ngModel)]="roomCode"
              name="roomCode"
              (input)="onRoomCodeInput($event)"
              class="casino-input w-full text-center text-2xl tracking-widest"
              placeholder="000000"
              maxlength="6"
              pattern="[0-9]{6}"
              required>
            <p class="text-casino-silver/60 text-sm mt-1">
              Enter the 6-digit room code
            </p>
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
              Join Room
            </button>
          </div>
        </form>

        <div *ngIf="loading" class="text-center mt-6">
          <div class="text-casino-gold">Joining room...</div>
        </div>

        <div *ngIf="error" class="text-center mt-6">
          <div class="text-red-500">{{ error }}</div>
        </div>

        <!-- Recent Rooms -->
        <div class="mt-8 pt-6 border-t border-casino-silver/20">
          <h3 class="text-lg font-bold text-casino-silver mb-4">
            Quick Join
          </h3>
          <div class="space-y-2">
            <button 
              *ngFor="let code of recentRoomCodes"
              (click)="quickJoin(code)"
              class="w-full text-left px-4 py-2 bg-casino-charcoal/50 rounded-lg hover:bg-casino-charcoal transition-colors">
              <span class="text-casino-gold font-mono">{{ code }}</span>
              <span class="text-casino-silver/60 ml-2">Recent room</span>
            </button>
            
            <div *ngIf="recentRoomCodes.length === 0" class="text-casino-silver/50 text-center py-4">
              No recent rooms
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class JoinRoomComponent {
  roomCode = '';
  playerName = '';
  loading = false;
  error = '';
  recentRoomCodes: string[] = []; // TODO: Load from localStorage

  constructor(private router: Router) {
    this.loadRecentRooms();
  }

  isFormValid(): boolean {
    return this.roomCode.length === 6 && 
           /^\d{6}$/.test(this.roomCode) && 
           this.playerName.trim() !== '';
  }

  onRoomCodeInput(event: any) {
    // Only allow numbers
    const value = event.target.value;
    this.roomCode = value.replace(/[^0-9]/g, '').substring(0, 6);
  }

  async onJoinRoom() {
    if (!this.isFormValid()) return;

    this.loading = true;
    this.error = '';

    try {
      // Save player name for session tracking
      localStorage.setItem('currentPlayerName', this.playerName);
      
      // Store active session info for rejoining later
      localStorage.setItem('activeRoomCode', this.roomCode);
      localStorage.setItem('sessionTimestamp', Date.now().toString());
      
      // Save to recent rooms
      this.saveRecentRoom(this.roomCode);
      
      // Navigate to room (the room component will handle socket joining)
      this.router.navigate(['/room', this.roomCode]);

    } catch (error) {
      this.error = 'Failed to join room. Please check the room code and try again.';
    } finally {
      this.loading = false;
    }
  }

  quickJoin(roomCode: string) {
    this.roomCode = roomCode;
  }

  goBack() {
    this.router.navigate(['/']);
  }

  private loadRecentRooms() {
    try {
      const stored = localStorage.getItem('cosmic-games-recent-rooms');
      if (stored) {
        this.recentRoomCodes = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load recent rooms:', error);
    }
  }

  private saveRecentRoom(roomCode: string) {
    try {
      // Add to front of array, remove duplicates, keep max 5
      this.recentRoomCodes = [roomCode, ...this.recentRoomCodes.filter(c => c !== roomCode)].slice(0, 5);
      localStorage.setItem('cosmic-games-recent-rooms', JSON.stringify(this.recentRoomCodes));
    } catch (error) {
      console.error('Failed to save recent room:', error);
    }
  }
}
