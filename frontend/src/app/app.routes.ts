import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/home',
    pathMatch: 'full'
  },
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'create-room',
    loadComponent: () => import('./pages/create-room/create-room.component').then(m => m.CreateRoomComponent)
  },
  {
    path: 'join-room',
    loadComponent: () => import('./pages/join-room/join-room.component').then(m => m.JoinRoomComponent)
  },
  {
    path: 'room/:code',
    loadComponent: () => import('./pages/game-room/game-room.component').then(m => m.GameRoomComponent)
  },
  {
    path: '**',
    redirectTo: '/home'
  }
];
