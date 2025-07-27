"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const GameManager_1 = require("../services/GameManager");
const router = (0, express_1.Router)();
const gameManager = GameManager_1.GameManager.getInstance();
// Start a game
router.post('/:roomId/start', async (req, res) => {
    try {
        const { roomId } = req.params;
        const playerId = req.headers['x-player-id'];
        if (!playerId) {
            return res.status(400).json({
                success: false,
                error: 'Player ID is required'
            });
        }
        const room = await gameManager.startGame(roomId, playerId);
        res.json({
            success: true,
            data: room
        });
    }
    catch (error) {
        const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
            error instanceof Error && error.message.includes('host') ? 403 :
                error instanceof Error && error.message.includes('players') ? 400 :
                    error instanceof Error && error.message.includes('ready') ? 400 : 500;
        res.status(statusCode).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to start game'
        });
    }
});
// Make a game action
router.post('/:roomId/action', async (req, res) => {
    try {
        const { roomId } = req.params;
        const action = req.body;
        const playerId = req.headers['x-player-id'];
        if (!playerId) {
            return res.status(400).json({
                success: false,
                error: 'Player ID is required'
            });
        }
        // Validate action
        if (!action.type || !action.playerId || !action.timestamp) {
            return res.status(400).json({
                success: false,
                error: 'Invalid action format'
            });
        }
        const room = await gameManager.processGameAction(roomId, playerId, action);
        res.json({
            success: true,
            data: room.gameState
        });
    }
    catch (error) {
        const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
            error instanceof Error && error.message.includes('turn') ? 400 :
                error instanceof Error && error.message.includes('progress') ? 400 : 500;
        res.status(statusCode).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to process action'
        });
    }
});
// Get current game state
router.get('/:roomId/state', async (req, res) => {
    try {
        const { roomId } = req.params;
        const room = await gameManager.getRoom(roomId);
        if (!room) {
            return res.status(404).json({
                success: false,
                error: 'Room not found'
            });
        }
        res.json({
            success: true,
            data: room.gameState
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get game state'
        });
    }
});
exports.default = router;
//# sourceMappingURL=games.js.map