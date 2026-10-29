import { prisma } from '../db.js';
import { hashApiKey } from '../utils/crypto.js';
import { AppError } from '../utils/errors.js';

// Authenticates ingestion requests using an API Key header
export async function requireApiKey(req, res, next) {
  try {
    const rawKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

    if (!rawKey) {
      throw new AppError('API key required in X-API-Key header', 401);
    }

    const hashed = hashApiKey(rawKey);

    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash: hashed },
      include: {
        user: {
          select: { id: true, email: true, role: true, plan: true },
        },
      },
    });

    if (!apiKey) {
      throw new AppError('Invalid API key', 401);
    }

    if (apiKey.revokedAt) {
      throw new AppError('This API key has been revoked', 401);
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      throw new AppError('This API key has expired', 401);
    }

    // Fire-and-forget update lastUsedAt to avoid blocking response latency
    prisma.apiKey
      .update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      })
      .catch((err) => console.error('[ApiKey] Failed to update lastUsedAt:', err.message));

    req.apiKey = apiKey;
    req.user = apiKey.user;
    next();
  } catch (err) {
    next(err);
  }
}
