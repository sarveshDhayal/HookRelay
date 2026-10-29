import { prisma } from '../db.js';
import { AppError } from '../utils/errors.js';

// Matches an event type against subscribed patterns:
// e.g., ["*"] matches everything
// e.g., ["payment.*"] matches "payment.succeeded", "payment.failed"
// e.g., ["order.created"] matches exactly "order.created"
export function matchesEventType(subscribedPatterns, eventType) {
  if (!Array.isArray(subscribedPatterns)) return false;

  return subscribedPatterns.some((pattern) => {
    if (pattern === '*' || pattern === eventType) return true;
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -2);
      return eventType.startsWith(prefix);
    }
    return false;
  });
}

// Ingests an event with idempotency and creates deliveries atomically in one MySQL transaction
export async function ingestEvent({ userId, type, payload, idempotencyKey }) {
  // 1. Idempotency Check: Query existing event by unique idempotencyKey
  const existingEvent = await prisma.event.findUnique({
    where: { idempotencyKey },
    include: {
      deliveries: {
        select: { id: true, endpointId: true, status: true },
      },
    },
  });

  if (existingEvent) {
    // If the event was already created with this idempotency key, return it without duplicating
    return {
      event: existingEvent,
      deliveriesCreated: 0,
      isDuplicate: true,
    };
  }

  // 2. Find all active endpoints for this user
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      userId,
      isActive: true,
      // If an endpoint is paused by circuit breaker, we don't dispatch new deliveries to it
      isPaused: false,
    },
  });

  // Filter endpoints that subscribe to this event type
  const matchingEndpoints = endpoints.filter((ep) =>
    matchesEventType(ep.eventTypes, type)
  );

  // 3. Atomically create Event and Delivery rows in ONE database transaction
  // Satisfies DBMS ACID properties (Atomicity, Consistency, Isolation, Durability)
  const result = await prisma.$transaction(async (tx) => {
    // Create the event record
    const event = await tx.event.create({
      data: {
        userId,
        type,
        payload,
        idempotencyKey,
      },
    });

    // Create delivery rows for each matching endpoint
    const deliveryRows = [];
    for (const ep of matchingEndpoints) {
      const delivery = await tx.delivery.create({
        data: {
          eventId: event.id,
          endpointId: ep.id,
          status: 'PENDING',
          retryCount: 0,
          maxAttempts: 6,
          nextAttemptAt: new Date(),
        },
      });
      deliveryRows.push(delivery);
    }

    return { event, deliveries: deliveryRows };
  });

  return {
    event: result.event,
    deliveriesCreated: result.deliveries.length,
    deliveries: result.deliveries,
    isDuplicate: false,
  };
}

export async function listEvents(userId, userRole, limit = 50) {
  const where = userRole === 'ADMIN' ? {} : { userId };

  return prisma.event.findMany({
    where,
    include: {
      deliveries: {
        select: {
          id: true,
          status: true,
          retryCount: true,
          endpoint: {
            select: { id: true, url: true, description: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function getEventById(userId, eventId, userRole) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      deliveries: {
        include: {
          endpoint: {
            select: { id: true, url: true, description: true },
          },
          attempts: {
            orderBy: { attemptedAt: 'desc' },
          },
        },
      },
    },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  if (userRole !== 'ADMIN' && event.userId && event.userId !== userId) {
    throw new AppError('Forbidden: Access denied to this event', 403);
  }

  return event;
}
