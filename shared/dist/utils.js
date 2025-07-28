"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDefaultRoomSettings = exports.isValidRoomCode = exports.generateRoomCode = exports.CardUtils = void 0;
/**
 * Utility functions for card operations
 */
class CardUtils {
    /**
     * Create a standard 52-card deck
     */
    static createDeck() {
        const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
        const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        const deck = [];
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
    static shuffle(cards) {
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
    static getCardValue(card) {
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
    static getSortValue(card) {
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
    static sortCards(cards) {
        const suitOrder = {
            'clubs': 0,
            'diamonds': 1,
            'hearts': 2,
            'spades': 3
        };
        return [...cards].sort((a, b) => {
            const suitDiff = suitOrder[a.suit] - suitOrder[b.suit];
            if (suitDiff !== 0)
                return suitDiff;
            return CardUtils.getSortValue(a) - CardUtils.getSortValue(b);
        });
    }
    /**
     * Check if cards form a valid sequence (consecutive ranks of same suit)
     */
    static isSequence(cards) {
        if (cards.length < 3)
            return false;
        const sorted = CardUtils.sortCards(cards);
        const suit = sorted[0].suit;
        // All cards must be same suit
        if (!sorted.every(card => card.suit === suit))
            return false;
        // Check consecutive ranks
        for (let i = 1; i < sorted.length; i++) {
            const prevValue = CardUtils.getSortValue(sorted[i - 1]);
            const currValue = CardUtils.getSortValue(sorted[i]);
            if (currValue !== prevValue + 1)
                return false;
        }
        return true;
    }
    /**
     * Check if cards form a valid set (same rank, different suits)
     */
    static isSet(cards) {
        if (cards.length < 3)
            return false;
        const rank = cards[0].rank;
        const suits = new Set(cards.map(card => card.suit));
        // All cards must have same rank and different suits
        return cards.every(card => card.rank === rank) && suits.size === cards.length;
    }
}
exports.CardUtils = CardUtils;
/**
 * Generate a random 6-digit room code
 */
function generateRoomCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
exports.generateRoomCode = generateRoomCode;
/**
 * Validate room code format
 */
function isValidRoomCode(code) {
    return /^\d{6}$/.test(code);
}
exports.isValidRoomCode = isValidRoomCode;
/**
 * Create a default room settings object
 */
function createDefaultRoomSettings() {
    return {
        maxPlayers: 4, // Gin Rummy optimal for 2-4 players (52 card deck limit)
        allowSpectators: true,
        isPrivate: false,
        gameVariant: 'classic',
        turnTimeLimit: 30,
        pointLimit: 100
    };
}
exports.createDefaultRoomSettings = createDefaultRoomSettings;
//# sourceMappingURL=utils.js.map