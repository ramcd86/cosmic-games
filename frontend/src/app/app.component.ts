import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="min-h-screen cosmic-bg">
      <header class="bg-casino-charcoal/90 backdrop-blur-sm border-b border-casino-silver/20 shadow-lg">
        <div class="container mx-auto px-4 py-4">
          <h1 class="text-3xl font-bold cosmic-logo text-glow">
            🌟 Cosmic Games
          </h1>
          <p class="text-casino-silver/80 mt-1">
            Premium Multiplayer Card Games
          </p>
        </div>
      </header>
      
      <main class="container mx-auto px-4 py-8">
        <router-outlet></router-outlet>
      </main>
      
      <footer class="bg-casino-charcoal/90 backdrop-blur-sm border-t border-casino-silver/20 mt-16">
        <div class="container mx-auto px-4 py-6 text-center">
          <p class="text-casino-silver/60">
            © 2025 Cosmic Games. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    .cosmic-bg {
      background: linear-gradient(135deg, 
        #1a1a1a 0%, 
        #2d1b3d 25%, 
        #1a1a1a 50%, 
        #2d1b3d 75%, 
        #1a1a1a 100%
      );
      background-size: 400% 400%;
      animation: cosmicFlow 20s ease-in-out infinite;
    }

    .cosmic-logo {
      background: linear-gradient(90deg, 
        #ffd700 0%, 
        #9333ea 25%, 
        #ffd700 50%, 
        #9333ea 75%, 
        #ffd700 100%
      );
      background-size: 300% 100%;
      background-clip: text;
      -webkit-background-clip: text;
      color: transparent;
      animation: logoShimmer 8s ease-in-out infinite;
      position: relative;
    }

    .cosmic-logo::before {
      content: '🌟 Cosmic Games';
      position: absolute;
      top: 0;
      left: 0;
      background: linear-gradient(90deg, 
        rgba(255, 215, 0, 0.3) 0%, 
        rgba(147, 51, 234, 0.3) 50%, 
        rgba(255, 215, 0, 0.3) 100%
      );
      background-size: 200% 100%;
      background-clip: text;
      -webkit-background-clip: text;
      color: transparent;
      animation: logoGlow 6s ease-in-out infinite;
      z-index: -1;
    }

    @keyframes cosmicFlow {
      0%, 100% {
        background-position: 0% 0%;
      }
      50% {
        background-position: 100% 100%;
      }
    }

    @keyframes logoShimmer {
      0%, 100% {
        background-position: 0% 50%;
      }
      50% {
        background-position: 100% 50%;
      }
    }

    @keyframes logoGlow {
      0%, 100% {
        background-position: 0% 50%;
        opacity: 0.5;
      }
      50% {
        background-position: 100% 50%;
        opacity: 0.8;
      }
    }
  `]
})
export class AppComponent {
  title = 'Cosmic Games';
}
