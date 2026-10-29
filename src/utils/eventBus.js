import { EventEmitter } from 'node:events';

// Observer Pattern: Central event bus decoupling workers from metrics & notifications
// Emits lifecycle events:
//   - 'delivery.succeeded'
//   - 'delivery.failed'
//   - 'delivery.dead'
//   - 'endpoint.paused'
//   - 'endpoint.resumed'
export const eventBus = new EventEmitter();

// Allow up to 50 listeners without Node warning
eventBus.setMaxListeners(50);

