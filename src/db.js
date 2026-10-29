import { PrismaClient } from '@prisma/client';

// PrismaClient singleton instance to prevent multiple connections in development
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
