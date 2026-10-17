import { createHash } from 'node:crypto';
import { AppError, normalized } from '../utils/errors.js';

/**
 * Serverless storage keeps only bounded public metadata in memory. Contributions
 * belong to the submitting browser and are never retained by a shared instance.
 */
export function createServerlessStorage({ maxEntries = 200, maxBytes = 8 * 1024 * 1024, maxInFlight = 50 } = {}) {
  for (const [name, value] of Object.entries({ maxEntries, maxBytes, maxInFlight })) {
    if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${name} must be a positive integer.`);
  }
  const cache = new Map();
  const pending = new Map();
  let cacheBytes = 0;

  function remove(key) {
    const entry = cache.get(key);
    if (entry) cacheBytes -= entry.bytes;
    cache.delete(key);
  }

  function retain(key, value, ttl) {
    remove(key);
    const now = Date.now();
    for (const [oldKey, entry] of cache) if (entry.expiresAt <= now) remove(oldKey);
    const serialized = JSON.stringify(value);
    if (serialized === undefined || ttl <= 0) return;
    const bytes = Buffer.byteLength(serialized, 'utf8') + Buffer.byteLength(key, 'utf8');
    if (bytes > maxBytes) return;
    while (cache.size >= maxEntries || cacheBytes + bytes > maxBytes) remove(cache.keys().next().value);
    cache.set(key, { serialized, bytes, expiresAt: now + ttl });
    cacheBytes += bytes;
  }

  return {
    scope: 'browser',
    async cached(key, ttl, load, { refresh = false } = {}) {
      const entry = cache.get(key);
      if (!refresh && entry && entry.expiresAt > Date.now()) {
        // Move the entry to the end so eviction removes the least recently used.
        cache.delete(key);
        cache.set(key, entry);
        return JSON.parse(entry.serialized);
      }
      if (entry) remove(key);
      if (pending.has(key)) return structuredClone(await pending.get(key));
      if (pending.size >= maxInFlight) {
        throw new AppError(429, 'Too many catalog lookups are running. Please try again shortly.', 'LOOKUP_BUSY');
      }
      const operation = Promise.resolve().then(load).then((value) => {
        retain(key, value, ttl);
        return value;
      });
      pending.set(key, operation);
      try { return structuredClone(await operation); }
      finally { pending.delete(key); }
    },
    contributions() { return []; },
    async contribute(input, validate = () => {}) {
      // The callback still validates against the curated graph; visitor-local
      // edges are validated in the browser that owns those contributions.
      await validate([]);
      const key = [input.title, input.artist, input.sampleTitle, input.sampleArtist].map(normalized).join('|');
      const id = createHash('sha256').update(key).digest('hex').slice(0, 24);
      return { id, ...structuredClone(input), createdAt: new Date().toISOString(), scope: 'browser', persisted: false };
    },
  };
}
