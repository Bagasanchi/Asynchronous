/**
 * Main server entry point - Minimal working server
 * Async card game server using Fastify, sql.js (pure JS SQLite), and WebSocket
 */

import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyCors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import path from 'path';

// Import database helpers
import { initializeDatabase, closeDatabase, query, execute, get, all } from './db';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const __filename = new URL(import.meta.url).filename;
const __dirname = path.dirname(__filename);

// Store dbPromise for route access
let dbPromise: Promise<any> | null = null;

// Initialize database early
initializeDatabase().then(promise => {
  dbPromise = promise;
});

// Create Fastify instance
const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV !== 'production' ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    } : undefined,
  },
  ajv: {
    customOptions: {
      coerceTypes: 'array',
      removeAdditional: 'all',
    },
  },
});

// Register plugins
async function registerPlugins(): Promise<void> {
  // CORS
  await fastify.register(fastifyCors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Cookies
  await fastify.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET || 'dev-secret-change-in-production',
    hook: 'onRequest',
  });

  // JWT
  await fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
    cookie: {
      cookieName: 'accessToken',
      signed: false,
    },
    sign: {
      expiresIn: '15m',
    },
  });

  // Rate limiting
  await fastify.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
    hook: 'onRequest',
  });

  // WebSocket
  await fastify.register(fastifyWebsocket);
}

// Authentication middleware
const authenticate = async (request: any, reply: any) => {
  try {
    const token = request.cookies?.accessToken || request.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return reply.code(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'No token provided' } });
    }
    const decoded = fastify.jwt.verify(token);
    request.user = { id: decoded.userId, username: decoded.username };
  } catch (err) {
    return reply.code(401).send({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } });
  }
};

// Register all routes
async function registerRoutes(): Promise<void> {
  // Health check
  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Validation schemas
  const registerRequestSchema = z.object({
    username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
    email: z.string().email(),
    password: z.string().min(8).max(128),
    displayName: z.string().min(1).max(50),
  });

  const loginRequestSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
    rememberMe: z.boolean().optional(),
  });

  const refreshTokenRequestSchema = z.object({
    refreshToken: z.string(),
  });

  // Register
  fastify.post('/auth/register', {
    schema: { body: registerRequestSchema },
    handler: async (request, reply) => {
      const { username, email, password, displayName } = request.body as z.infer<typeof registerRequestSchema>;

      // Check if username or email already exists
      const existing = await get('SELECT id FROM users WHERE username = ?', [username]);
      if (existing) {
        return reply.code(409).send({ success: false, error: { code: 'USERNAME_TAKEN', message: 'Username already taken' } });
      }

      const existingEmail = await get('SELECT id FROM users WHERE email = ?', [email]);
      if (existingEmail) {
        return reply.code(409).send({ success: false, error: { code: 'EMAIL_TAKEN', message: 'Email already registered' } });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create user
      const userId = uuidv4();
      const now = Date.now();

      await execute(
        'INSERT INTO users (id, username, email, password_hash, display_name, elo, wins, losses, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, username, email, passwordHash, displayName, 1000, 0, 0, now, now]
      );

      // Generate tokens
      const accessToken = fastify.jwt.sign({ userId, username });
      const refreshToken = uuidv4(); // Simple refresh token

      // Store refresh token
      await execute(
        'INSERT INTO users (id, username, email, password_hash, display_name, elo, wins, losses, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, username, email, passwordHash, displayName, 1000, 0, 0, now, now]
      );

      // Set cookies
      reply.setCookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60,
        path: '/',
      });

      reply.setCookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60,
        path: '/',
      });

      return reply.code(201).send({
        success: true,
        data: { user: { id: userId, username, email, displayName, elo: 1000 }, accessToken, refreshToken },
      });
    },
  });

  // Login
  fastify.post('/auth/login', {
    schema: { body: loginRequestSchema },
    handler: async (request, reply) => {
      const { email, password, rememberMe } = request.body as z.infer<typeof loginRequestSchema>;

      // Find user by email
      const user = await get('SELECT * FROM users WHERE email = ?', [email]);

      if (!user) {
        return reply.code(401).send({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
      }

      // Verify password
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return reply.code(401).send({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
      }

      // Update last login
      await execute('UPDATE users SET updated_at = ? WHERE id = ?', [Date.now(), user.id]);

      // Generate tokens
      const accessToken = fastify.jwt.sign({ userId: user.id, username: user.username });
      const refreshToken = uuidv4();

      // Set cookies
      const accessMaxAge = rememberMe ? 30 * 24 * 60 * 60 : 15 * 60;
      reply.setCookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: accessMaxAge,
        path: '/',
      });

      reply.setCookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60,
        path: '/',
      });

      return reply.send({
        success: true,
        data: {
          user: { id: user.id, username: user.username, email: user.email, displayName: user.display_name, elo: user.elo, avatarUrl: user.avatar_url },
          accessToken, refreshToken,
        },
      });
    },
  });

  // Refresh token
  fastify.post('/auth/refresh', {
    schema: { body: refreshTokenRequestSchema },
    handler: async (request, reply) => {
      // Simple implementation - just issue new tokens
      const accessToken = fastify.jwt.sign({ userId: 'test', username: 'test' });
      const refreshToken = uuidv4();

      reply.setCookie('accessToken', accessToken, { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 15 * 60, path: '/' });
      reply.setCookie('refreshToken', refreshToken, { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60, path: '/' });

      return reply.send({ success: true, data: { accessToken, refreshToken } });
    },
  });

  // Logout
  fastify.post('/auth/logout', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      reply.clearCookie('accessToken', { path: '/' });
      reply.clearCookie('refreshToken', { path: '/' });
      return reply.send({ success: true, data: { message: 'Logged out successfully' } });
    },
  });

  // Get current user
  fastify.get('/auth/me', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const user = await get('SELECT * FROM users WHERE id = ?', [request.user.id]);
      if (!user) {
        return reply.code(404).send({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
      }
      return reply.send({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            displayName: user.display_name,
            elo: user.elo,
            avatarUrl: user.avatar_url,
            wins: user.wins,
            losses: user.losses,
          },
        },
      });
    },
  });

  // Simple game routes
  fastify.get('/api/games', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const games = await all('SELECT * FROM games WHERE status != "finished" ORDER BY created_at DESC LIMIT 50');
      return reply.send({ success: true, data: games });
    },
  });

  fastify.post('/api/games', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const gameId = uuidv4();
      const now = Date.now();
      await execute(
        'INSERT INTO games (id, status, player_count, max_players, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [gameId, 'lobby', 1, 4, now, now]
      );
      // Add creator as player
      await execute(
        'INSERT INTO game_players (id, game_id, user_id, player_index, seat_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), gameId, request.user.id, 0, 0, now, now]
      );
      const game = await get('SELECT * FROM games WHERE id = ?', [gameId]);
      return reply.code(201).send({ success: true, data: game });
    },
  });

  fastify.get('/api/games/:id', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const game = await get('SELECT * FROM games WHERE id = ?', [request.params.id]);
      if (!game) {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Game not found' } });
      }
      const players = await all('SELECT * FROM game_players WHERE game_id = ?', [request.params.id]);
      return reply.send({ success: true, data: { ...game, players } });
    },
  });

  // Matchmaking routes
  fastify.post('/api/matchmaking/queue', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      // Simple mock response
      return reply.send({ success: true, data: { queueId: uuidv4(), status: 'waiting', estimatedWait: 30 } });
    },
  });

  fastify.delete('/api/matchmaking/queue', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      return reply.send({ success: true, data: { message: 'Left queue' } });
    },
  });

  // Daily runs
  fastify.get('/api/daily-runs', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      return reply.send({ success: true, data: { currentRun: null, timeRemaining: 86400 } });
    },
  });

  // Leaderboards
  fastify.get('/api/leaderboards', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const topUsers = await all('SELECT id, username, display_name, elo, wins, losses FROM users ORDER BY elo DESC LIMIT 50');
      return reply.send({ success: true, data: topUsers });
    },
  });

  // Clubs
  fastify.get('/api/clubs', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      return reply.send({ success: true, data: [] });
    },
  });

  // Tournaments
  fastify.get('/api/tournaments', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      return reply.send({ success: true, data: [] });
    },
  });

  // Replays
  fastify.get('/api/replays', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      return reply.send({ success: true, data: [] });
    },
  });

  // Notifications
  fastify.get('/api/notifications', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      return reply.send({ success: true, data: [] });
    },
  });

  // User profile
  fastify.get('/api/users/:id', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const user = await get('SELECT id, username, display_name, elo, wins, losses, avatar_url, bio, created_at FROM users WHERE id = ?', [request.params.id]);
      if (!user) {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      }
      return reply.send({ success: true, data: user });
    },
  });
}

// Register WebSocket handlers
async function registerWebSockets(): Promise<void> {
  fastify.register(async (fastify) => {
    fastify.get('/ws', { websocket: true }, (connection, request) => {
      console.log('WebSocket connected');

      connection.socket.on('message', (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          console.log('WS message:', data.type);

          // Echo back for now
          connection.socket.send(JSON.stringify({ type: 'ack', data }));
        } catch (err) {
          console.error('WS error:', err);
        }
      });

      connection.socket.on('close', () => {
        console.log('WebSocket disconnected');
      });
    });
  });
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  fastify.log.info('Shutting down...');
  await fastify.close();
  await closeDatabase();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
async function start(): Promise<void> {
  try {
    // Register plugins and routes
    await registerPlugins();
    await registerRoutes();
    await registerWebSockets();

    // Start listening
    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });
    fastify.log.info(`Server listening on ${host}:${port}`);
  } catch (error) {
    fastify.log.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();