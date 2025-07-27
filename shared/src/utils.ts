import { Card, Suit, Rank } from './types';

/**
 * Utility functions for card operations
 */
export class CardUtils {
  /**
   * Create a standard 52-card deck
   */
  static createDeck(): Card[] {
    const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck: Card[] = [];

    suits.forEach(suit => {
      ranks.forEach(rank => {
        deck.push({
          suit,
          rank,
          id: `${suit}-${rank}-${Date.now()}-${Math.random()}`
        });
      });
    });

    return deck;
  }

  /**
   * Shuffle an array of cards using Fisher-Yates algorithm
   */
  static shuffle(cards: Card[]): Card[] {
    const shuffled = [...cards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Get the numeric value of a card for scoring
   */
  static getCardValue(card: Card): number {
    switch (card.rank) {
      case 'A': return 1;
      case 'J':
      case 'Q':
      case 'K': return 10;
      default: return parseInt(card.rank);
    }
  }

  /**
   * Get the numeric value for sorting (Ace = 1, King = 13)
   */
  static getSortValue(card: Card): number {
    switch (card.rank) {
      case 'A': return 1;
      case 'J': return 11;
      case 'Q': return 12;
      case 'K': return 13;
      default: return parseInt(card.rank);
    }
  }

  /**
   * Sort cards by suit and rank
   */
  static sortCards(cards: Card[]): Card[] {
    const suitOrder: Record<Suit, number> = {
      'clubs': 0,
      'diamonds': 1,
      'hearts': 2,
      'spades': 3
    };

    return [...cards].sort((a, b) => {
      const suitDiff = suitOrder[a.suit] - suitOrder[b.suit];
      if (suitDiff !== 0) return suitDiff;
      return CardUtils.getSortValue(a) - CardUtils.getSortValue(b);
    });
  }

  /**
   * Check if cards form a valid sequence (consecutive ranks of same suit)
   */
  static isSequence(cards: Card[]): boolean {
    if (cards.length < 3) return false;
    
    const sorted = CardUtils.sortCards(cards);
    const suit = sorted[0].suit;
    
    // All cards must be same suit
    if (!sorted.every(card => card.suit === suit)) return false;
    
    // Check consecutive ranks
    for (let i = 1; i < sorted.length; i++) {
      const prevValue = CardUtils.getSortValue(sorted[i - 1]);
      const currValue = CardUtils.getSortValue(sorted[i]);
      if (currValue !== prevValue + 1) return false;
    }
    
    return true;
  }

  /**
   * Check if cards form a valid set (same rank, different suits)
   */
  static isSet(cards: Card[]): boolean {
    if (cards.length < 3) return false;
    
    const rank = cards[0].rank;
    const suits = new Set(cards.map(card => card.suit));
    
    // All cards must have same rank and different suits
    return cards.every(card => card.rank === rank) && suits.size === cards.length;
  }
}

/**
 * Generate a random 6-digit room code
 */
export function generateRoomCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Validate room code format
 */
export function isValidRoomCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

/**
 * Create a default room settings object
 */
export function createDefaultRoomSettings(): import('./types').RoomSettings {
  return {
    maxPlayers: 6,
    allowSpectators: true,
    isPrivate: false,
    gameVariant: 'classic',
    turnTimeLimit: 30,
    pointLimit: 100
  };
}
