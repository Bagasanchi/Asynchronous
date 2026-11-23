/**
 * WebSocket handlers for real-time game updates
 */

import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { db } from './db';
import { games, gamePlayers, users } from './db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { GameEngine } from '@async-card-game/shared/game-logic';
import { Game, GameStatus, WSMessageType, PlayerAction, ActionType } from '@async-card-game/shared/types';
import { getOrCreateGameEngine } from './index';
import { wsConnectPayloadSchema, wsJoinGamePayloadSchema, wsPlayerActionPayloadSchema } from '@async-card-game/shared/validation';

// Store active WebSocket connections per game
const gameConnections = new Map<string, Map<string, WebSocket>>(); // gameId -> Map<userId, WebSocket>
// Store user connections
const userConnections = new Map<string, WebSocket>(); // userId -> WebSocket

export async function registerWebSocketHandlers(fastify: FastifyInstance): Promise<void> {
  fastify.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, async (connection, request) => {
      const ws = connection.socket;
      let currentUserId: string | null = null;
      let currentGameId: string | null = null;

      // Handle incoming messages
      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          await handleMessage(ws, message, request);
        } catch (error) {
          console.error('WebSocket message error:', error);
          sendError(ws, 'INVALID_MESSAGE', 'Invalid message format');
        }
      });

      // Handle connection close
      ws.on('close', () => {
        if (currentUserId && currentGameId) {
          leaveGame(currentUserId, currentGameId);
        }
        if (currentUserId) {
          userConnections.delete(currentUserId);
        }
        console.log(`WebSocket disconnected: ${currentUserId}`);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });

      async function handleMessage(ws: WebSocket, message: any, request: any) {
        const { type, payload } = message;

        switch (type) {
          case WSMessageType.CONNECT:
            await handleConnect(ws, payload, request);
            break;
          case WSMessageType.JOIN_GAME:
            await handleJoinGame(ws, payload);
            break;
          case WSMessageType.LEAVE_GAME:
            await handleLeaveGame(ws, payload);
            break;
          case WSMessageType.PLAYER_ACTION:
            await handlePlayerAction(ws, payload);
            break;
          case WSMessageType.PING:
            send(ws, { type: WSMessageType.PONG, payload: { timestamp: Date.now() } });
            break;
          default:
            sendError(ws, 'UNKNOWN_MESSAGE_TYPE', `Unknown message type: ${type}`);
        }
      }

      async function handleConnect(ws: WebSocket, payload: any, request: any) {
        const result = wsConnectPayloadSchema.safeParse(payload);
        if (!result.success) {
          sendError(ws, 'INVALID_PAYLOAD', 'Invalid connect payload');
          return;
        }

        const { userId, token } = result.data;

        // Verify JWT token
        try {
          const decoded = await request.jwtVerify<{ userId: string; username: string }>({
            cookie: { cookieName: 'accessToken', signed: false }
          });

          if (decoded.userId !== userId) {
            sendError(ws, 'TOKEN_MISMATCH', 'Token user ID does not match');
            return;
          }

          currentUserId = userId;
          userConnections.set(userId, ws);

          send(ws, {
            type: WSMessageType.CONNECTED,
            payload: { userId, message: 'Connected successfully' },
          });

          console.log(`WebSocket connected: ${userId}`);
        } catch (error) {
          sendError(ws, 'INVALID_TOKEN', 'Invalid or expired token');
          ws.close();
        }
      }

      async function handleJoinGame(ws: WebSocket, payload: any) {
        if (!currentUserId) {
          sendError(ws, 'NOT_AUTHENTICATED', 'Must connect first');
          return;
        }

        const result = wsJoinGamePayloadSchema.safeParse(payload);
        if (!result.success) {
          sendError(ws, 'INVALID_PAYLOAD', 'Invalid join game payload');
          return;
        }

        const { gameId } = result.data;

        // Verify user is in game
        const player = await db.select()
          .from(gamePlayers)
          .where(and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.userId, currentUserId)))
          .limit(1);

        if (player.length === 0) {
          // Check if game allows spectators
          const game = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
          if (game.length === 0) {
            sendError(ws, 'GAME_NOT_FOUND', 'Game not found');
            return;
          }

          const metadata = game[0].metadata as Record<string, unknown>;
          if (!metadata.allowSpectators) {
            sendError(ws, 'SPECTATORS_NOT_ALLOWED', 'Spectators not allowed');
            return;
          }
        }

        currentGameId = gameId;

        // Add to game connections
        if (!gameConnections.has(gameId)) {
          gameConnections.set(gameId, new Map());
        }
        gameConnections.get(gameId)!.set(currentUserId, ws);

        // Get game state
        const game = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
        if (game.length === 0) {
          sendError(ws, 'GAME_NOT_FOUND', 'Game not found');
          return;
        }

        const players = await db.select().from(gamePlayers).where(eq(gamePlayers.gameId, gameId));
        let currentEnemy = undefined;
        if (game[0].status === GameStatus.ACTIVE) {
          const { currentEnemies } = await import('./db/schema');
          const enemy = await db.select().from(currentEnemies).where(eq(currentEnemies.gameId, gameId)).limit(1);
          if (enemy.length > 0) currentEnemy = enemy[0];
        }

        const fullGame: Game = {
          ...game[0],
          players: players as any,
          currentEnemy,
        } as Game;

        // Find player's seat index
        let yourPlayerIndex = -1;
        for (let i = 0; i < players.length; i++) {
          if (players[i].userId === currentUserId) {
            yourPlayerIndex = players[i].seatIndex;
            break;
          }
        }

        // Send game state
        send(ws, {
          type: WSMessageType.GAME_STATE,
          payload: {
            game: fullGame,
            yourPlayerIndex,
          },
        });

        // Notify others
        broadcastToGame(gameId, {
          type: WSMessageType.PLAYER_CONNECTED,
          payload: { userId: currentUserId, playerIndex: yourPlayerIndex },
        }, currentUserId);
      }

      async function handleLeaveGame(ws: WebSocket, payload: any) {
        if (!currentUserId || !currentGameId) return;

        const { gameId } = payload;
        if (gameId !== currentGameId) return;

        leaveGame(currentUserId, currentGameId);
        currentGameId = null;
      }

      async function handlePlayerAction(ws: WebSocket, payload: any) {
        if (!currentUserId || !currentGameId) {
          sendError(ws, 'NOT_IN_GAME', 'Must join a game first');
          return;
        }

        const result = wsPlayerActionPayloadSchema.safeParse(payload);
        if (!result.success) {
          sendError(ws, 'INVALID_PAYLOAD', 'Invalid action payload');
          return;
        }

        const { action } = result.data;

        // Verify it's the player's turn
        const game = await db.select().from(games).where(eq(games.id, currentGameId)).limit(1);
        if (game.length === 0) {
          sendError(ws, 'GAME_NOT_FOUND', 'Game not found');
          return;
        }

        const currentPlayer = await db.select()
          .from(gamePlayers)
          .where(and(eq(gamePlayers.gameId, currentGameId), eq(gamePlayers.seatIndex, game[0].currentPlayerIndex)))
          .limit(1);

        if (currentPlayer.length === 0 || currentPlayer[0].userId !== currentUserId) {
          sendError(ws, 'NOT_YOUR_TURN', 'It is not your turn');
          return;
        }

        // Process action through game engine
        const players = await db.select().from(gamePlayers).where(eq(gamePlayers.gameId, currentGameId));
        const { currentEnemies } = await import('./db/schema');
        let currentEnemy: any = undefined;
        if (game[0].status === GameStatus.ACTIVE) {
          const enemy = await db.select().from(currentEnemies).where(eq(currentEnemies.gameId, currentGameId)).limit(1);
          if (enemy.length > 0) currentEnemy = enemy[0];
        }

        const fullGame: Game = {
          ...game[0],
          players: players as any,
          currentEnemy,
        } as Game;

        const engine = getOrCreateGameEngine(fullGame);
        const player = engine.getCurrentPlayer();

        let success = false;

        switch (action.type) {
          case ActionType.PLAY_CARD:
            success = engine.playCard(action.data, player);
            break;
          case ActionType.END_TURN:
            engine.endTurn(player);
            success = true;
            break;
          case ActionType.USE_POTION:
            success = engine.usePotion(action.data, player);
            break;
          case ActionType.CHOICE:
            success = true;
            break;
        }

        if (!success) {
          sendError(ws, 'INVALID_ACTION', 'Invalid action');
          return;
        }

        // Check victory/defeat
        const endReason = engine.checkVictory();
        const updatedGame = engine.serialize();

        // Broadcast game update to all players
        broadcastToGame(currentGameId, {
          type: WSMessageType.GAME_UPDATE,
          payload: {
            updates: {
              currentPlayerIndex: updatedGame.currentPlayerIndex,
              turnNumber: updatedGame.turnNumber,
              turnPhase: updatedGame.turnPhase,
              turnStartTime: updatedGame.turnStartTime,
              log: updatedGame.log,
              currentEnemy: updatedGame.currentEnemy,
              status: updatedGame.status,
              winnerId: updatedGame.winnerId,
              endReason,
            },
            playerIndex: player.seatIndex,
          },
        });

        if (endReason) {
          // Game finished
          broadcastToGame(currentGameId, {
            type: WSMessageType.GAME_END,
            payload: {
              winnerId: updatedGame.winnerId,
              endReason,
              finalState: updatedGame,
            },
          });

          // Clean up
          activeGames.delete(currentGameId);
        }
      }
    });
  });
}

function send(ws: WebSocket, message: any): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function sendError(ws: WebSocket, code: string, message: string): void {
  send(ws, {
    type: WSMessageType.ERROR,
    payload: { code, message },
  });
}

function broadcastToGame(gameId: string, message: any, excludeUserId?: string): void {
  const connections = gameConnections.get(gameId);
  if (!connections) return;

  for (const [userId, ws] of connections) {
    if (userId !== excludeUserId) {
      send(ws, message);
    }
  }
}

function leaveGame(userId: string, gameId: string): void {
  const connections = gameConnections.get(gameId);
  if (connections) {
    connections.delete(userId);
    if (connections.size === 0) {
      gameConnections.delete(gameId);
    }
  }

  // Notify others
  broadcastToGame(gameId, {
    type: WSMessageType.PLAYER_DISCONNECTED,
    payload: { userId },
  });
}

// Helper to send notification to specific user
export async function sendNotificationToUser(userId: string, notification: any): Promise<void> {
  const ws = userConnections.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    send(ws, {
      type: WSMessageType.NOTIFICATION,
      payload: notification,
    });
  }
}

// Helper to send turn notification
export async function sendTurnNotification(gameId: string, currentPlayerIndex: number, turnNumber: number, timeRemaining: number): Promise<void> {
  const connections = gameConnections.get(gameId);
  if (!connections) return;

  const message = {
    type: WSMessageType.TURN_CHANGE,
    payload: {
      currentPlayerIndex,
      turnNumber,
      timeRemaining,
    },
  };

  for (const [userId, ws] of connections) {
    send(ws, message);
  }
}

// Cleanup stale connections
setInterval(() => {
  for (const [gameId, connections] of gameConnections) {
    for (const [userId, ws] of connections) {
      if (ws.readyState !== WebSocket.OPEN) {
        connections.delete(userId);
      }
    }
    if (connections.size === 0) {
      gameConnections.delete(gameId);
    }
  }

  for (const [userId, ws] of userConnections) {
    if (ws.readyState !== WebSocket.OPEN) {
      userConnections.delete(userId);
    }
  }
}, 30000); // Every 30 seconds