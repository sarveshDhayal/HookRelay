import { prisma } from '../db.js';
import { generateEndpointSecret } from '../utils/crypto.js';
import { validateEndpointUrl } from '../utils/ssrf.js';
import { AppError } from '../utils/errors.js';

export async function createEndpoint({ userId, url, description, eventTypes }) {
  // SSRF Protection: Check if URL resolves to private or loopback ranges
  // In development mode, allow localhost for demo mock receivers
  const allowLocalDev = process.env.NODE_ENV !== 'production';
  await validateEndpointUrl(url, { allowLocalDev });

  const secret = generateEndpointSecret();

  // Standardize event types array: if empty or undefined, default to wildcard ["*"]
  const types = Array.isArray(eventTypes) && eventTypes.length > 0 ? eventTypes : ['*'];

  return prisma.webhookEndpoint.create({
    data: {
      userId,
      url,
      description: description || null,
      secret,
      eventTypes: types,
      isActive: true,
      isPaused: false,
      consecutiveFailures: 0,
    },
  });
}

export async function listEndpoints(userId, userRole) {
  const where = userRole === 'ADMIN' ? {} : { userId };

  return prisma.webhookEndpoint.findMany({
    where,
    include: {
      _count: {
        select: { deliveries: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getEndpointById(userId, endpointId, userRole) {
  const endpoint = await prisma.webhookEndpoint.findUnique({
    where: { id: endpointId },
    include: {
      _count: {
        select: { deliveries: true },
      },
    },
  });

  if (!endpoint) {
    throw new AppError('Webhook endpoint not found', 404);
  }

  if (userRole !== 'ADMIN' && endpoint.userId !== userId) {
    throw new AppError('Forbidden: Access denied to this endpoint', 403);
  }

  return endpoint;
}

export async function updateEndpoint(userId, endpointId, userRole, data) {
  const endpoint = await getEndpointById(userId, endpointId, userRole);

  // If URL is being updated, perform SSRF check again
  if (data.url && data.url !== endpoint.url) {
    const allowLocalDev = process.env.NODE_ENV !== 'production';
    await validateEndpointUrl(data.url, { allowLocalDev });
  }

  return prisma.webhookEndpoint.update({
    where: { id: endpointId },
    data: {
      url: data.url !== undefined ? data.url : endpoint.url,
      description: data.description !== undefined ? data.description : endpoint.description,
      eventTypes: data.eventTypes !== undefined ? data.eventTypes : endpoint.eventTypes,
      isActive: data.isActive !== undefined ? data.isActive : endpoint.isActive,
    },
  });
}

export async function deleteEndpoint(userId, endpointId, userRole) {
  await getEndpointById(userId, endpointId, userRole);

  return prisma.webhookEndpoint.delete({
    where: { id: endpointId },
  });
}

// Resume an endpoint that was paused by the circuit breaker
export async function resumeEndpoint(userId, endpointId, userRole) {
  await getEndpointById(userId, endpointId, userRole);

  return prisma.webhookEndpoint.update({
    where: { id: endpointId },
    data: {
      isPaused: false,
      consecutiveFailures: 0,
    },
  });
}

// Manually pause an endpoint
export async function pauseEndpoint(userId, endpointId, userRole) {
  await getEndpointById(userId, endpointId, userRole);

  return prisma.webhookEndpoint.update({
    where: { id: endpointId },
    data: {
      isPaused: true,
    },
  });
}

