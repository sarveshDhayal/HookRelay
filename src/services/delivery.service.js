import { prisma } from '../db.js';
import { AppError } from '../utils/errors.js';

export async function listDeliveries({
  userId,
  userRole,
  status,
  endpointId,
  page = 1,
  limit = 20,
}) {
  const where = {};

  if (userRole !== 'ADMIN') {
    where.endpoint = { userId };
  }

  if (status) {
    where.status = status;
  }

  if (endpointId) {
    where.endpointId = endpointId;
  }

  const skip = (Math.max(1, page) - 1) * limit;

  const [deliveries, total] = await Promise.all([
    prisma.delivery.findMany({
      where,
      include: {
        event: {
          select: {
            id: true,
            type: true,
            idempotencyKey: true,
            createdAt: true,
          },
        },
        endpoint: {
          select: {
            id: true,
            url: true,
            description: true,
            isPaused: true,
          },
        },
        _count: {
          select: { attempts: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.delivery.count({ where }),
  ]);

  return {
    deliveries,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getDeliveryById(userId, deliveryId, userRole) {
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: {
      event: true,
      endpoint: true,
      attempts: {
        orderBy: { attemptNumber: 'asc' },
      },
    },
  });

  if (!delivery) {
    throw new AppError('Delivery not found', 404);
  }

  if (userRole !== 'ADMIN' && delivery.endpoint.userId !== userId) {
    throw new AppError('Forbidden: Access denied to this delivery', 403);
  }

  return delivery;
}

export async function listDeadLetters(userId, userRole, page = 1, limit = 20) {
  return listDeliveries({
    userId,
    userRole,
    status: 'DEAD',
    page,
    limit,
  });
}

// Replay a Dead Letter: Resets retry count and schedules immediate attempt
export async function replayDelivery(userId, deliveryId, userRole) {
  const delivery = await getDeliveryById(userId, deliveryId, userRole);

  if (delivery.status !== 'DEAD' && delivery.status !== 'FAILED') {
    throw new AppError(`Cannot replay delivery with status ${delivery.status}`, 400);
  }

  const updated = await prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      status: 'PENDING',
      retryCount: 0,
      nextAttemptAt: new Date(),
    },
    include: {
      event: true,
      endpoint: true,
    },
  });

  return updated;
}

