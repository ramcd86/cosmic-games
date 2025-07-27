import { Card } from './types';
/**
 * Utility functions for card operations
 */
export declare class CardUtils {
    /**
     * Create a standard 52-card deck
     */
    static createDeck(): Card[];
    /**
     * Shuffle an array of cards using Fisher-Yates algorithm
     */
    static shuffle(cards: Card[]): Card[];
    /**
     * Get the numeric value of a card for scoring
     */
    static getCardValue(card: Card): number;
    /**
     * Get the numeric value for sorting (Ace = 1, King = 13)
     */
    static getSortValue(card: Card): number;
    /**
     * Sort cards by suit and rank
     */
    static sortCards(cards: Card[]): Card[];
    /**
     * Check if cards form a valid sequence (consecutive ranks of same suit)
     */
    static isSequence(cards: Card[]): boolean;
    /**
     * Check if cards form a valid set (same rank, different suits)
     */
    static isSet(cards: Card[]): boolean;
}
/**
 * Generate a random 6-digit room code
 */
export declare function generateRoomCode(): string;
/**
 * Validate room code format
 */
export declare function isValidRoomCode(code: string): boolean;
/**
 * Create a default room settings object
 */
export declare function createDefaultRoomSettings(): import('./types').RoomSettings;
//# sourceMappingURL=utils.d.ts.map