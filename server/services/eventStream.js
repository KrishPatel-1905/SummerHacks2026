import { EventEmitter } from "node:events";

const emitter = globalThis.__eventCapsuleEmitter ??= new EventEmitter();
emitter.setMaxListeners(0);

const channelFor = (eventId) => `event:${eventId}`;

export function publishEventUpdate(eventId, type, data = {}) {
  emitter.emit(channelFor(String(eventId)), { type, data, sentAt: new Date().toISOString() });
}

export function subscribeToEvent(eventId, listener) {
  const channel = channelFor(String(eventId));
  emitter.on(channel, listener);
  return () => emitter.off(channel, listener);
}
