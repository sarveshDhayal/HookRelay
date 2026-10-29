import { prisma } from '../db.js';
import { generateApiKey, hashApiKey } from '../utils/crypto.js';
import { AppError } from '../utils/errors.js';

export async function createApiKey({ userId, name, userPlan = 'FREE' }) {
  const rawKey = generateApiKey();
  const keyHash = hashApiKey(rawKey);
  const prefix = rawKey.slice(0, 12);

  // Free tier gets 60 req/min, Pro gets 300 req/min
  const rateLimit = userPlan === 'PRO' ? 300 : 60;

  const apiKey = await prisma.apiKey.create({
    data: {
      userId,
      name,
      keyHash,
      prefix,
      rateLimit,
    },
    select: {
      id: true,
      name: true,
      prefix: true,
      rateLimit: true,
      createdAt: true,
    },
  });

  return {
    ...apiKey,
    apiKey: rawKey, // Displayed once to the developer
  };
}

export async function listApiKeys(userId, userRole) {
  const where = userRole === 'ADMIN' ? {} : { userId };

  return prisma.apiKey.findMany({
    where,
    select: {
      id: true,
      name: true,
      prefix: true,
      rateLimit: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function revokeApiKey(userId, keyId, userRole) {
  const apiKey = await prisma.apiKey.findUnique({
    where: { id: keyId },
  });

  if (!apiKey) {
    throw new AppError('API key not found', 404);
  }

  // Developer can only revoke their own key; Admin can revoke any
  if (userRole !== 'ADMIN' && apiKey.userId !== userId) {
    throw new AppError('Forbidden: You can only revoke your own API keys', 403);
  }

  if (apiKey.revokedAt) {
    throw new AppError('API key is already revoked', 400);
  }

  return prisma.apiKey.update({
    where: { id: keyId },
    data: { revokedAt: new Date() },
    select: {
      id: true,
      name: true,
      revokedAt: true,
    },
  });
}
