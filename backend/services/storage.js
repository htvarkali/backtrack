import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { normalized } from '../utils/errors.js';

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw new Error(`Cannot read local data file ${path}: ${error.message}`);
  }
}

export async function createStorage(directory) {
  await mkdir(directory, { recursive: true });
  const cachePath = join(directory, 'cache.json');
  const contributionsPath = join(directory, 'contributions.json');
  const cache = await readJson(cachePath, {});
  let contributions = await readJson(contributionsPath, []);
  if (!Array.isArray(contributions)) throw new Error('Local contributions file must contain an array.');
  let writes = Promise.resolve();
  let mutations = Promise.resolve();
  const pending = new Map();

  function save(path, value) {
    const snapshot = JSON.stringify(value, null, 2);
    const operation = writes.catch(() => {}).then(async () => {
      const temporaryPath = `${path}.${randomUUID()}.tmp`;
      await writeFile(temporaryPath, snapshot, { mode: 0o600 });
      await rename(temporaryPath, path);
    });
    writes = operation;
    return operation;
  }

  return {
    scope: 'local',
    directory,
    async cached(key, ttl, load, { refresh = false } = {}) {
      const entry = cache[key];
      if (!refresh && entry && entry.expiresAt > Date.now()) return structuredClone(entry.value);
      if (pending.has(key)) return structuredClone(await pending.get(key));
      const operation = (async () => {
        const value = await load();
        cache[key] = { expiresAt: Date.now() + ttl, value };
        const keys = Object.keys(cache);
        for (const oldKey of keys) {
          if (cache[oldKey].expiresAt < Date.now()) delete cache[oldKey];
        }
        for (const oldKey of Object.keys(cache).slice(0, Math.max(0, Object.keys(cache).length - 1000))) delete cache[oldKey];
        // Cache is an optimization; never lose a valid API response because a cache write failed.
        await save(cachePath, cache).catch((error) => console.warn('Cache persistence:', error.message));
        return value;
      })();
      pending.set(key, operation);
      try { return structuredClone(await operation); }
      finally { pending.delete(key); }
    },
    contributions() { return structuredClone(contributions); },
    async contribute(input, validate = () => {}) {
      const key = [input.title, input.artist, input.sampleTitle, input.sampleArtist].map(normalized).join('|');
      const id = createHash('sha256').update(key).digest('hex').slice(0, 24);
      const operation = mutations.catch(() => {}).then(async () => {
        const existing = contributions.find((item) => item.id === id);
        if (existing) return { ...existing, duplicate: true };
        validate(contributions);
        const item = { id, ...input, createdAt: new Date().toISOString(), scope: 'local' };
        const next = [...contributions, item];
        await save(contributionsPath, next);
        contributions = next;
        return item;
      });
      mutations = operation;
      return operation;
    },
  };
}
