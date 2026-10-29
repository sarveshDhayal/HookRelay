import { app } from './app.js';
import { config } from './config.js';
import { prisma } from './db.js';

const server = app.listen(config.port, () => {
  console.log(`[HookRelay API] Server running on port ${config.port} (${config.nodeEnv})`);
  console.log(`[HookRelay API] Health check available at http://localhost:${config.port}/health`);
});

// Graceful shutdown handling
async function shutdown(signal) {
  console.log(`\n[HookRelay API] Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    console.log('[HookRelay API] HTTP server closed.');
    await prisma.$disconnect();
    console.log('[HookRelay API] Database connections disconnected.');
    process.exit(0);
  });

  // Force shutdown after 10s if stuck
  setTimeout(() => {
    console.error('[HookRelay API] Forcing shutdown after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

