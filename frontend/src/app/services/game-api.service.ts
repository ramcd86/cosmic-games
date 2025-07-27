import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { 
  GameRoom, 
  CreateRoomRequest, 
  CreateRoomResponse, 
  JoinRoomRequest, 
  JoinRoomResponse,
  ApiResponse 
} from '@cosmic-games/shared';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class GameApiService {
  private readonly baseUrl = environment.apiUrl;
  
  // Room state management
  private currentRoomSubject = new BehaviorSubject<GameRoom | null>(null);
  public currentRoom$ = this.currentRoomSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Create a new game room
   */
  createRoom(request: CreateRoomRequest): Observable<ApiResponse<CreateRoomResponse>> {
    return this.http.post<ApiResponse<CreateRoomResponse>>(`${this.baseUrl}/api/rooms`, request);
  }

  /**
   * Join an existing room
   */
  joinRoom(roomCode: string, request: JoinRoomRequest): Observable<ApiResponse<JoinRoomResponse>> {
    return this.http.put<ApiResponse<JoinRoomResponse>>(`${this.baseUrl}/api/rooms/${roomCode}/join`, request);
  }

  /**
   * Get room details
   */
  getRoom(roomCode: string): Observable<ApiResponse<GameRoom>> {
    return this.http.get<ApiResponse<GameRoom>>(`${this.baseUrl}/api/rooms/${roomCode}`);
  }

  /**
   * Leave current room
   */
  leaveRoom(roomCode: string): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.baseUrl}/api/rooms/${roomCode}/leave`);
  }

  /**
   * Start a game
   */
  startGame(roomCode: string): Observable<ApiResponse<GameRoom>> {
    return this.http.post<ApiResponse<GameRoom>>(`${this.baseUrl}/api/games/${roomCode}/start`, {});
  }

  /**
   * Make a game action
   */
  makeGameAction(roomCode: string, action: any): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.baseUrl}/api/games/${roomCode}/action`, action);
  }

  /**
   * Get current game state
   */
  getGameState(roomCode: string): Observable<ApiResponse> {
    return this.http.get<ApiResponse>(`${this.baseUrl}/api/games/${roomCode}/state`);
  }

  /**
   * Update current room state
   */
  setCurrentRoom(room: GameRoom | null): void {
    this.currentRoomSubject.next(room);
  }

  /**
   * Get current room state
   */
  getCurrentRoom(): GameRoom | null {
    return this.currentRoomSubject.value;
  }
}
