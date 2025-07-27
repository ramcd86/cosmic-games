import { Card, AIDifficulty, Player } from '@cosmic-games/shared';
import { GinRummyEngine } from './GinRummyEngine';

/**
 * AI Player that can play Gin Rummy at different difficulty levels
 */
export class AIPlayer {
  
  constructor(
    private player: Player,
    private difficulty: AIDifficulty
  ) {}

  /**
   * Decide what action the AI should take
   */
  public decideAction(gameState: any): {
    type: 'draw' | 'discard' | 'knock' | 'gin';
    card?: Card;
    drawFromDiscard?: boolean;
  } {
    const hand = this.player.cards;
    const analysis = GinRummyEngine.analyzeHand(hand);
    
    // Check if AI can go gin (always do this regardless of difficulty)
    if (analysis.canGin) {
      return { type: 'gin' };
    }
    
    // Check if AI should knock based on difficulty and game state
    if (this.shouldKnock(analysis, gameState)) {
      return { type: 'knock' };
    }
    
    // Decide whether to draw from deck or discard pile
    const shouldDrawFromDiscard = this.shouldDrawFromDiscard(gameState);
    
    if (shouldDrawFromDiscard) {
      return { type: 'draw', drawFromDiscard: true };
    }
    
    // Draw from deck and then decide what to discard
    return { type: 'draw', drawFromDiscard: false };
  }

  /**
   * Decide which card to discard after drawing
   */
  public decideDiscard(gameState: any): Card {
    const hand = this.player.cards;
    
    switch (this.difficulty) {
      case 'beginner':
        return this.beginnerDiscard(hand);
      case 'intermediate':
        return this.intermediateDiscard(hand, gameState);
      case 'advanced':
        return this.advancedDiscard(hand, gameState);
      case 'expert':
        return this.expertDiscard(hand, gameState);
      default:
        return this.beginnerDiscard(hand);
    }
  }

  /**
   * Determine if AI should knock
   */
  private shouldKnock(analysis: any, gameState: any): boolean {
    const { deadwoodValue, canKnock } = analysis;
    
    if (!canKnock) return false;
    
    switch (this.difficulty) {
      case 'beginner':
        // Knock aggressively when possible
        return deadwoodValue <= 8;
        
      case 'intermediate':
        // Consider game progress
        const gameProgress = this.estimateGameProgress(gameState);
        if (gameProgress > 0.7) return deadwoodValue <= 10;
        return deadwoodValue <= 5;
        
      case 'advanced':
        // Consider opponent's likely deadwood
        const estimatedOpponentDeadwood = this.estimateOpponentDeadwood(gameState);
        return deadwoodValue < estimatedOpponentDeadwood - 5;
        
      case 'expert':
        // Complex decision making
        return this.expertKnockDecision(analysis, gameState);
        
      default:
        return deadwoodValue <= 10;
    }
  }

  /**
   * Decide if AI should draw from discard pile
   */
  private shouldDrawFromDiscard(gameState: any): boolean {
    const discardPile = gameState.discardPile;
    if (discardPile.length === 0) return false;
    
    const topCard = discardPile[discardPile.length - 1];
    const hand = this.player.cards;
    
    // Test if drawing this card would improve the hand
    const testHand = [...hand, topCard];
    const currentAnalysis = GinRummyEngine.analyzeHand(hand);
    const testAnalysis = GinRummyEngine.analyzeHand(testHand);
    
    switch (this.difficulty) {
      case 'beginner':
        // Simple check: does it complete a set or run?
        return this.cardCompletesObviousMeld(topCard, hand);
        
      case 'intermediate':
      case 'advanced':
      case 'expert':
        // More sophisticated: would it improve deadwood after optimal discard?
        const bestDiscardAfterDraw = this.findBestDiscard(testHand);
        const handAfterDrawAndDiscard = testHand.filter(c => c.id !== bestDiscardAfterDraw.id);
        const finalAnalysis = GinRummyEngine.analyzeHand(handAfterDrawAndDiscard);
        
        return finalAnalysis.deadwoodValue < currentAnalysis.deadwoodValue;
        
      default:
        return false;
    }
  }

  /**
   * Beginner level discard strategy
   */
  private beginnerDiscard(hand: Card[]): Card {
    // Discard highest value card that doesn't form obvious pairs
    const analysis = GinRummyEngine.analyzeHand(hand);
    
    if (analysis.deadwood.length > 0) {
      // Sort deadwood by value (highest first)
      const sortedDeadwood = analysis.deadwood.sort((a, b) => 
        GinRummyEngine['calculateDeadwoodValue']([b]) - GinRummyEngine['calculateDeadwoodValue']([a])
      );
      return sortedDeadwood[0];
    }
    
    // If no deadwood, discard lowest value card
    const sortedHand = hand.sort((a, b) => 
      GinRummyEngine['calculateDeadwoodValue']([a]) - GinRummyEngine['calculateDeadwoodValue']([b])
    );
    return sortedHand[0];
  }

  /**
   * Intermediate level discard strategy
   */
  private intermediateDiscard(hand: Card[], gameState: any): Card {
    const analysis = GinRummyEngine.analyzeHand(hand);
    
    // Prefer discarding deadwood
    if (analysis.deadwood.length > 0) {
      // Among deadwood, avoid discarding cards that opponent might need
      const safeDeadwood = analysis.deadwood.filter(card => 
        !this.cardLikelyNeededByOpponent(card, gameState)
      );
      
      if (safeDeadwood.length > 0) {
        return this.selectHighestValueCard(safeDeadwood);
      }
      
      return this.selectHighestValueCard(analysis.deadwood);
    }
    
    // If no pure deadwood, break least valuable meld
    return this.breakLeastValuableMeld(analysis.melds);
  }

  /**
   * Advanced level discard strategy
   */
  private advancedDiscard(hand: Card[], gameState: any): Card {
    // Try each possible discard and see which results in best hand
    let bestDiscard = hand[0];
    let bestDeadwoodValue = Infinity;
    
    for (const card of hand) {
      const testHand = hand.filter(c => c.id !== card.id);
      const analysis = GinRummyEngine.analyzeHand(testHand);
      
      // Consider both deadwood value and opponent needs
      let score = analysis.deadwoodValue;
      
      if (this.cardLikelyNeededByOpponent(card, gameState)) {
        score += 10; // Penalty for giving opponent useful cards
      }
      
      if (score < bestDeadwoodValue) {
        bestDeadwoodValue = score;
        bestDiscard = card;
      }
    }
    
    return bestDiscard;
  }

  /**
   * Expert level discard strategy
   */
  private expertDiscard(hand: Card[], gameState: any): Card {
    // Most sophisticated strategy considering multiple factors
    const candidates = hand.map(card => {
      const testHand = hand.filter(c => c.id !== card.id);
      const analysis = GinRummyEngine.analyzeHand(testHand);
      
      let score = analysis.deadwoodValue;
      
      // Factor in opponent analysis
      if (this.cardLikelyNeededByOpponent(card, gameState)) {
        score += 15;
      }
      
      // Factor in potential draws
      score -= this.calculateDrawPotential(testHand, gameState);
      
      // Factor in game state
      score += this.calculateGameStateBonus(card, gameState);
      
      return { card, score };
    });
    
    candidates.sort((a, b) => a.score - b.score);
    return candidates[0].card;
  }

  /**
   * Helper methods
   */
  private cardCompletesObviousMeld(card: Card, hand: Card[]): boolean {
    // Check if card completes a set
    const sameRankCards = hand.filter(c => c.rank === card.rank);
    if (sameRankCards.length >= 2) return true;
    
    // Check if card completes a run
    const sameSuitCards = hand.filter(c => c.suit === card.suit);
    // TODO: Implement run completion check
    
    return false;
  }

  private findBestDiscard(hand: Card[]): Card {
    return this.advancedDiscard(hand, {});
  }

  private cardLikelyNeededByOpponent(card: Card, gameState: any): boolean {
    // Analyze what cards opponent might need based on discards and draws
    // This is a simplified implementation
    if (!gameState || !gameState.discardPile || !Array.isArray(gameState.discardPile)) {
      // If no discard pile information available, assume card might be needed
      return true;
    }
    
    const recentDiscards = gameState.discardPile.slice(-5);
    
    // If opponent recently discarded cards of same rank/suit, they might not need this
    return !recentDiscards.some((discarded: Card) => 
      discarded.rank === card.rank || discarded.suit === card.suit
    );
  }

  private selectHighestValueCard(cards: Card[]): Card {
    return cards.reduce((highest, card) => 
      GinRummyEngine['calculateDeadwoodValue']([card]) > GinRummyEngine['calculateDeadwoodValue']([highest]) 
        ? card : highest
    );
  }

  private breakLeastValuableMeld(melds: Card[][]): Card {
    // Find the meld with lowest total value and break it
    let leastValuableMeld = melds[0];
    let lowestValue = Infinity;
    
    for (const meld of melds) {
      const value = GinRummyEngine['calculateDeadwoodValue'](meld);
      if (value < lowestValue) {
        lowestValue = value;
        leastValuableMeld = meld;
      }
    }
    
    return this.selectHighestValueCard(leastValuableMeld);
  }

  private estimateGameProgress(gameState: any): number {
    const totalCards = 52;
    const cardsRemaining = gameState.deck.length;
    return (totalCards - cardsRemaining) / totalCards;
  }

  private estimateOpponentDeadwood(gameState: any): number {
    // Rough estimation based on game progress and opponent behavior
    const gameProgress = this.estimateGameProgress(gameState);
    
    // Early game: assume high deadwood
    // Late game: assume lower deadwood
    return Math.max(20 - (gameProgress * 15), 5);
  }

  private expertKnockDecision(analysis: any, gameState: any): boolean {
    // Complex decision tree for expert AI
    const { deadwoodValue } = analysis;
    const gameProgress = this.estimateGameProgress(gameState);
    const estimatedOpponentDeadwood = this.estimateOpponentDeadwood(gameState);
    
    // Early game: be more conservative
    if (gameProgress < 0.3) {
      return deadwoodValue <= 3;
    }
    
    // Mid game: consider opponent deadwood
    if (gameProgress < 0.7) {
      return deadwoodValue < estimatedOpponentDeadwood - 8;
    }
    
    // Late game: more aggressive
    return deadwoodValue <= 7;
  }

  private calculateDrawPotential(hand: Card[], gameState: any): number {
    // Calculate how many cards in remaining deck could improve hand
    // This is a simplified implementation
    return 5; // Placeholder
  }

  private calculateGameStateBonus(card: Card, gameState: any): number {
    // Additional scoring based on game state
    // This is a simplified implementation
    return 0; // Placeholder
  }
}
