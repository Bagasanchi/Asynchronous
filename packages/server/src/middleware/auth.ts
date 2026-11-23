/**
 * Authentication middleware
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db';
import { users, refreshTokens } from '../db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { JWTPayload } from '@async-card-game/shared/types';

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyRequest {
    user?: JWTPayload & { id: string };
  }
}

/**
 * Verify JWT token and attach user to request
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Verify JWT token
    const decoded = await request.jwtVerify<JWTPayload>();

    // Get user from database
    const user = await db.select()
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1);

    if (user.length === 0) {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    // Attach user to request
    request.user = {
      ...decoded,
      id: decoded.userId,
    };
  } catch (error) {
    return reply.code(401).send({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
      },
    });
  }
}

/**
 * Optional authentication - doesn't fail if no token
 */
export async function optionalAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const decoded = await request.jwtVerify<JWTPayload>();
    const user = await db.select()
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1);

    if (user.length > 0) {
      request.user = {
        ...decoded,
        id: decoded.userId,
      };
    }
  } catch {
    // Ignore errors - authentication is optional
  }
}

/**
 * Require specific permission/role
 */
export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    // For now, we don't have roles in the user object
    // This would be extended when roles are added
    // if (!roles.includes(request.user.role)) {
    //   return reply.code(403).send({
    //     success: false,
    //     error: {
    //       code: 'FORBIDDEN',
    //       message: 'Insufficient permissions',
    //     },
    //   });
    // }
  };
}

/**
 * Verify refresh token
 */
export async function verifyRefreshToken(token: string): Promise<string | null> {
  const stored = await db.select()
    .from(refreshTokens)
    .where(and(
      eq(refreshTokens.token, token),
      eq(refreshTokens.revokedAt, null),
      gt(refreshTokens.expiresAt, new Date())
    ))
    .limit(1);

  if (stored.length === 0) {
    return null;
  }

  return stored[0].userId;
}

/**
 * Revoke refresh token
 */
export async function revokeRefreshToken(token: string): Promise<void> {
  await db.update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.token, token));
}

/**
 * Revoke all refresh tokens for a user
 */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  await db.update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.userId, userId));
}

/**
 * Create new refresh token
 */
export async function createRefreshToken(userId: string): Promise<string> {
  const { v4: uuidv4 } = await import('uuid');
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await db.insert(refreshTokens).values({
    id: uuidv4(),
    userId,
    token,
    expiresAt,
  });

  return token;
}