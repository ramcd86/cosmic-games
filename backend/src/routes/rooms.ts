import { Router, Request, Response } from 'express';
import { GameManager } from '../services/GameManager';
import { ApiResponse, CreateRoomRequest, JoinRoomRequest } from '@cosmic-games/shared';

const router = Router();
const gameManager = GameManager.getInstance();

// Create a new room
router.post('/', async (req: Request<{}, ApiResponse, CreateRoomRequest>, res: Response<ApiResponse>) => {
  try {
    const { name, playerName, settings } = req.body;

    if (!name || !playerName) {
      return res.status(400).json({
        success: false,
        error: 'Room name and player name are required'
      });
    }

    const result = await gameManager.createRoom(name, playerName, settings);

    res.status(201).json({
      success: true,
      data: result
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create room'
    });
  }
});

// Get room details
router.get('/:code', async (req: Request, res: Response<ApiResponse>) => {
  try {
    const { code } = req.params;

    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid room code format'
      });
    }

    const room = await gameManager.getRoom(code);

    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }

    res.json({
      success: true,
      data: room
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get room'
    });
  }
});

// Join a room
router.put('/:code/join', async (req: Request<{ code: string }, ApiResponse, JoinRoomRequest>, res: Response<ApiResponse>) => {
  try {
    const { code } = req.params;
    const { playerName } = req.body;

    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid room code format'
      });
    }

    if (!playerName) {
      return res.status(400).json({
        success: false,
        error: 'Player name is required'
      });
    }

    const result = await gameManager.joinRoom(code, playerName);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
                      error instanceof Error && error.message.includes('full') ? 409 :
                      error instanceof Error && error.message.includes('progress') ? 409 : 500;

    res.status(statusCode).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to join room'
    });
  }
});

// Leave a room
router.delete('/:code/leave', async (req: Request, res: Response<ApiResponse>) => {
  try {
    const { code } = req.params;
    const playerId = req.headers['x-player-id'] as string;

    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'Player ID is required'
      });
    }

    const room = await gameManager.leaveRoom(code, playerId);

    res.json({
      success: true,
      data: room
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to leave room'
    });
  }
});

export default router;
