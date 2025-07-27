import { Card, CardUtils } from '@cosmic-games/shared';

/**
 * Gin Rummy specific game logic and rules
 */
export class GinRummyEngine {
  
  /**
   * Check if a hand can form valid melds (sets and runs)
   * @param cards - Array of cards to analyze
   * @returns Object with meld information and deadwood count
   */
  static analyzeHand(cards: Card[]): {
    melds: Card[][];
    deadwood: Card[];
    deadwoodValue: number;
    canKnock: boolean;
    canGin: boolean;
  } {
    const bestCombination = this.findBestMeldCombination(cards);
    const deadwoodValue = this.calculateDeadwoodValue(bestCombination.deadwood);
    
    return {
      melds: bestCombination.melds,
      deadwood: bestCombination.deadwood,
      deadwoodValue,
      canKnock: deadwoodValue <= 10,
      canGin: deadwoodValue === 0
    };
  }

  /**
   * Find the best combination of melds to minimize deadwood
   */
  private static findBestMeldCombination(cards: Card[]): {
    melds: Card[][];
    deadwood: Card[];
  } {
    const allPossibleMelds = this.findAllPossibleMelds(cards);
    const bestCombination = this.findOptimalMeldCombination(cards, allPossibleMelds);
    
    return bestCombination;
  }

  /**
   * Find all possible sets and runs in the hand
   */
  private static findAllPossibleMelds(cards: Card[]): Card[][] {
    const melds: Card[][] = [];
    
    // Find all possible sets (3+ cards of same rank)
    const sets = this.findAllSets(cards);
    melds.push(...sets);
    
    // Find all possible runs (3+ consecutive cards of same suit)
    const runs = this.findAllRuns(cards);
    melds.push(...runs);
    
    return melds;
  }

  /**
   * Find all possible sets in the cards
   */
  private static findAllSets(cards: Card[]): Card[][] {
    const sets: Card[][] = [];
    const rankGroups = this.groupCardsByRank(cards);
    
    Object.values(rankGroups).forEach(rankCards => {
      if (rankCards.length >= 3) {
        // Add all possible combinations of 3+ cards of the same rank
        for (let size = 3; size <= rankCards.length; size++) {
          const combinations = this.getCombinations(rankCards, size);
          sets.push(...combinations);
        }
      }
    });
    
    return sets;
  }

  /**
   * Find all possible runs in the cards
   */
  private static findAllRuns(cards: Card[]): Card[][] {
    const runs: Card[][] = [];
    const suitGroups = this.groupCardsBySuit(cards);
    
    Object.values(suitGroups).forEach(suitCards => {
      if (suitCards.length >= 3) {
        const sortedCards = CardUtils.sortCards(suitCards);
        const foundRuns = this.findRunsInSortedCards(sortedCards);
        runs.push(...foundRuns);
      }
    });
    
    return runs;
  }

  /**
   * Find runs in a sorted array of cards of the same suit
   */
  private static findRunsInSortedCards(sortedCards: Card[]): Card[][] {
    const runs: Card[][] = [];
    
    for (let start = 0; start < sortedCards.length - 2; start++) {
      for (let end = start + 2; end < sortedCards.length; end++) {
        const potentialRun = sortedCards.slice(start, end + 1);
        if (this.isValidRun(potentialRun)) {
          runs.push(potentialRun);
        }
      }
    }
    
    return runs;
  }

  /**
   * Check if cards form a valid run
   */
  private static isValidRun(cards: Card[]): boolean {
    if (cards.length < 3) return false;
    
    for (let i = 1; i < cards.length; i++) {
      const prevValue = CardUtils.getSortValue(cards[i - 1]);
      const currValue = CardUtils.getSortValue(cards[i]);
      
      if (currValue !== prevValue + 1) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Find the optimal combination of melds that minimizes deadwood
   */
  private static findOptimalMeldCombination(
    allCards: Card[], 
    possibleMelds: Card[][]
  ): { melds: Card[][]; deadwood: Card[] } {
    let bestCombination = { melds: [] as Card[][], deadwood: allCards };
    let lowestDeadwoodValue = this.calculateDeadwoodValue(allCards);

    // Try all combinations of melds
    const meldCombinations = this.getAllMeldCombinations(possibleMelds);
    
    for (const combination of meldCombinations) {
      if (this.hasOverlappingCards(combination)) continue;
      
      const usedCards = combination.flat();
      const deadwood = allCards.filter(card => 
        !usedCards.some(used => used.id === card.id)
      );
      
      const deadwoodValue = this.calculateDeadwoodValue(deadwood);
      
      if (deadwoodValue < lowestDeadwoodValue) {
        lowestDeadwoodValue = deadwoodValue;
        bestCombination = { melds: combination, deadwood };
      }
    }
    
    return bestCombination;
  }

  /**
   * Check if melds have overlapping cards
   */
  private static hasOverlappingCards(melds: Card[][]): boolean {
    const usedCardIds = new Set<string>();
    
    for (const meld of melds) {
      for (const card of meld) {
        if (usedCardIds.has(card.id)) {
          return true;
        }
        usedCardIds.add(card.id);
      }
    }
    
    return false;
  }

  /**
   * Calculate total value of deadwood cards
   */
  private static calculateDeadwoodValue(cards: Card[]): number {
    return cards.reduce((total, card) => total + CardUtils.getCardValue(card), 0);
  }

  /**
   * Group cards by rank
   */
  private static groupCardsByRank(cards: Card[]): Record<string, Card[]> {
    return cards.reduce((groups, card) => {
      if (!groups[card.rank]) {
        groups[card.rank] = [];
      }
      groups[card.rank].push(card);
      return groups;
    }, {} as Record<string, Card[]>);
  }

  /**
   * Group cards by suit
   */
  private static groupCardsBySuit(cards: Card[]): Record<string, Card[]> {
    return cards.reduce((groups, card) => {
      if (!groups[card.suit]) {
        groups[card.suit] = [];
      }
      groups[card.suit].push(card);
      return groups;
    }, {} as Record<string, Card[]>);
  }

  /**
   * Get all combinations of n items from array
   */
  private static getCombinations<T>(array: T[], n: number): T[][] {
    if (n === 0) return [[]];
    if (n > array.length) return [];
    
    const [first, ...rest] = array;
    const withFirst = this.getCombinations(rest, n - 1).map(combo => [first, ...combo]);
    const withoutFirst = this.getCombinations(rest, n);
    
    return [...withFirst, ...withoutFirst];
  }

  /**
   * Get all possible combinations of melds
   */
  private static getAllMeldCombinations(melds: Card[][]): Card[][][] {
    if (melds.length === 0) return [[]];
    
    const combinations: Card[][][] = [[]]; // Start with empty combination
    
    for (const meld of melds) {
      const newCombinations: Card[][][] = [];
      
      for (const combination of combinations) {
        // Add combination without this meld
        newCombinations.push(combination);
        
        // Add combination with this meld (if no overlap)
        if (!this.hasOverlappingCards([...combination, meld])) {
          newCombinations.push([...combination, meld]);
        }
      }
      
      combinations.length = 0;
      combinations.push(...newCombinations);
    }
    
    return combinations;
  }

  /**
   * Calculate score for knocking
   */
  static calculateKnockScore(
    knockerDeadwood: number,
    opponentDeadwood: number
  ): { knockerScore: number; opponentScore: number; undercut: boolean } {
    
    if (knockerDeadwood === 0) {
      // Gin bonus
      return {
        knockerScore: opponentDeadwood + 25, // Gin bonus
        opponentScore: 0,
        undercut: false
      };
    }
    
    if (opponentDeadwood <= knockerDeadwood) {
      // Undercut - opponent wins
      return {
        knockerScore: 0,
        opponentScore: (knockerDeadwood - opponentDeadwood) + 25, // Undercut bonus
        undercut: true
      };
    }
    
    // Normal knock
    return {
      knockerScore: opponentDeadwood - knockerDeadwood,
      opponentScore: 0,
      undercut: false
    };
  }

  /**
   * Check if a move is valid
   */
  static isValidMove(
    room: any, // GameRoom with players and gameState
    playerId: string,
    action: { type: 'draw' | 'discard' | 'knock' | 'gin' | 'pass'; card?: Card }
  ): { valid: boolean; reason?: string } {
    
    if (room.gameState.currentPlayer !== playerId) {
      return { valid: false, reason: 'Not your turn' };
    }

    switch (action.type) {
      case 'draw':
        if (room.gameState.deck.length === 0 && room.gameState.discardPile.length === 0) {
          return { valid: false, reason: 'No cards available to draw' };
        }
        const drawPlayer = room.players.find((p: any) => p.id === playerId);
        if (!drawPlayer) {
          return { valid: false, reason: 'Player not found' };
        }
        // Player should have 10 cards before drawing (normal hand size)
        if (drawPlayer.cards.length !== 10) {
          return { valid: false, reason: 'Must have exactly 10 cards to draw' };
        }
        return { valid: true };

      case 'discard':
        if (!action.card) {
          return { valid: false, reason: 'No card specified for discard' };
        }
        const player = room.players.find((p: any) => p.id === playerId);
        if (!player) {
          return { valid: false, reason: 'Player not found' };
        }
        // Player should have 11 cards before discarding (after drawing)
        if (player.cards.length !== 11) {
          return { valid: false, reason: 'Must draw a card before discarding' };
        }
        if (!player.cards.some((c: Card) => c.id === action.card!.id)) {
          return { valid: false, reason: 'Card not in hand' };
        }
        return { valid: true };

      case 'knock':
      case 'gin':
        const knockPlayer = room.players.find((p: any) => p.id === playerId);
        if (!knockPlayer) {
          return { valid: false, reason: 'Player not found' };
        }
        
        const analysis = this.analyzeHand(knockPlayer.cards);
        
        if (action.type === 'gin' && !analysis.canGin) {
          return { valid: false, reason: 'Cannot go gin with current hand' };
        }
        
        if (action.type === 'knock' && !analysis.canKnock) {
          return { valid: false, reason: 'Cannot knock with current deadwood value' };
        }
        
        return { valid: true };

      default:
        return { valid: false, reason: 'Invalid action type' };
    }
  }
}
