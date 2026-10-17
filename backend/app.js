import express from 'express';
import { readFile, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStorage } from './services/storage.js';
import { createUpstream } from './services/upstream.js';
import { createCatalog } from './services/catalog.js';
import { createListening } from './services/listening.js';
import { createSamples } from './services/samples.js';
import { AppError, requiredText, normalized } from './utils/errors.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const songKey = (title, artist) => `${normalized(title)}|${normalized(artist)}`;

function validateContribution(body) {
  const input = Object.fromEntries(['title', 'artist', 'sampleTitle', 'sampleArtist'].map((key) =>
    [key, requiredText(body?.[key], key, 300)]));
  if (body.part != null && body.part !== '') input.part = requiredText(body.part, 'Sample description', 1000);
  if (body.sampleYear != null && body.sampleYear !== '') {
    const year = Number(body.sampleYear);
    if (!Number.isInteger(year) || year < 1000 || year > new Date().getFullYear() + 1) {
      throw new AppError(400, 'Sample year must be a valid four-digit year.', 'INVALID_INPUT');
    }
    input.sampleYear = year;
  }
  if (songKey(input.title, input.artist) === songKey(input.sampleTitle, input.sampleArtist)) {
    throw new AppError(400, 'A song cannot sample itself.', 'SELF_SAMPLE');
  }
  return input;
}

function cycleGuard(graph, contribution, saved) {
  const keys = new Map(graph.songs.map((song) => [song.id, songKey(song.title, song.artist)]));
  const adjacency = new Map();
  const edge = (from, to) => {
    if (!from || !to) return;
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from).push(to);
  };
  for (const item of graph.samples) edge(keys.get(item.from), keys.get(item.to));
  for (const item of saved) edge(songKey(item.title, item.artist), songKey(item.sampleTitle, item.sampleArtist));
  const parent = songKey(contribution.title, contribution.artist);
  const sample = songKey(contribution.sampleTitle, contribution.sampleArtist);
  const todo = [sample];
  const seen = new Set();
  while (todo.length) {
    const current = todo.pop();
    if (current === parent) throw new AppError(409, 'That connection creates a circular sample chain. Check which song sampled which.', 'SAMPLE_CYCLE');
    if (seen.has(current)) continue;
    seen.add(current);
    todo.push(...(adjacency.get(current) || []));
  }
}

export async function createApp(options = {}) {
  const graph = options.graph || JSON.parse(await readFile(options.graphPath || join(projectRoot, 'frontend/public/data/graph.json'), 'utf8'));
  const storage = options.storage || await createStorage(options.dataDir || process.env.BACK_TRACK_DATA_DIR || join(projectRoot, '.local'));
  const storageScope = storage.scope || 'local';
  const upstream = createUpstream({ fetchImpl: options.fetchImpl, timeoutMs: options.timeoutMs });
  const catalog = createCatalog({ upstream, storage, graph });
  const samples = createSamples({ upstream, storage, graph });
  const listening = createListening({ upstream, storage,
    spotifyClientId: options.spotifyClientId ?? process.env.SPOTIFY_CLIENT_ID,
    spotifyClientSecret: options.spotifyClientSecret ?? process.env.SPOTIFY_CLIENT_SECRET });
  const app = express();
  app.disable('x-powered-by');
  app.use('/api', (request, response, next) => {
    response.set('Cache-Control', 'no-store');
    response.set('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.use(express.json({ limit: '16kb', strict: true }));
  app.get('/api/health', (_request, response) => response.json({
    ok: true, service: 'back-track', storage: storageScope, songs: graph.songs.length, samples: graph.samples.length,
  }));
  app.get('/api/search', async (request, response) => {
    response.json(await catalog.search(requiredText(request.query.q ?? request.query.term, 'Search term', 300)));
  });
  app.get('/api/preview', async (request, response) => {
    response.json(await catalog.preview(requiredText(request.query.title, 'Title'), requiredText(request.query.artist, 'Artist'), { refresh: request.query.refresh === '1' }));
  });
  app.get('/api/samples', async (request, response) => {
    response.json(await samples(requiredText(request.query.title, 'Title'), requiredText(request.query.artist, 'Artist')));
  });
  app.get('/api/listening', async (request, response) => {
    response.json(await listening(requiredText(request.query.from, 'A playlist, album, or username', 1000)));
  });
  app.get('/api/contributions', (_request, response) => response.json({ contributions: storage.contributions(), scope: storageScope }));
  app.post('/api/contribute', async (request, response) => {
    if (!request.is('application/json')) throw new AppError(415, 'Send contributions as JSON.', 'INVALID_CONTENT_TYPE');
    if (request.headers.origin) {
      let origin;
      try { origin = new URL(request.headers.origin); } catch { throw new AppError(403, 'Invalid request origin.', 'INVALID_ORIGIN'); }
      const localOrigin = storageScope === 'local' && ['http:', 'https:'].includes(origin.protocol) &&
        ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
      // Compare with the actual request Host, never a visitor-supplied forwarded
      // host. Vercel terminates TLS before forwarding requests to the function.
      const hostedOrigin = storageScope !== 'local' && origin.protocol === 'https:' &&
        origin.host === request.get('host')?.toLowerCase();
      if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash ||
        (!localOrigin && !hostedOrigin)) {
        throw new AppError(403, 'Contributions must be sent from this app.', 'INVALID_ORIGIN');
      }
    }
    const input = validateContribution(request.body);
    const item = await storage.contribute(input, (saved) => cycleGuard(graph, input, saved));
    response.status(item.duplicate ? 200 : 201).json({ ok: true, ...item });
  });
  app.get('/api/catalog/itunes', async (request, response) => response.json(await catalog.itunes(request.query)));
  app.get('/api/catalog/wikipedia', async (request, response) => response.json(await catalog.wikipedia(request.query)));
  app.get(/^\/api\/catalog\/musicbrainz\/(.*)$/, async (request, response) => response.json(await catalog.musicbrainz(request.params[0], request.query)));
  app.use('/api', (_request, _response, next) => next(new AppError(404, 'API endpoint not found.', 'NOT_FOUND')));

  const dist = options.staticDir === false ? null : options.staticDir || join(projectRoot, 'dist');
  if (dist) {
    try {
      await access(join(dist, 'index.html'));
      app.use(express.static(dist, { dotfiles: 'deny', index: false }));
      app.get(/.*/, (_request, response) => response.sendFile(join(dist, 'index.html')));
    } catch { /* npm run dev uses Vite; npm start serves this directory after npm run build. */ }
  }
  app.use((error, _request, response, _next) => {
    const malformedJson = error instanceof SyntaxError && error.type === 'entity.parse.failed';
    const tooLarge = error.type === 'entity.too.large';
    const status = malformedJson ? 400 : tooLarge ? 413 : error.status || 500;
    if (status >= 500 && !(error instanceof AppError)) console.error('Back track API:', error);
    response.status(status).json({ error: malformedJson ? 'The request contains invalid JSON.' : tooLarge ? 'The request is too large.' :
      error instanceof AppError ? error.message : 'The local server could not save or load this request. Please try again.',
      code: malformedJson ? 'INVALID_JSON' : tooLarge ? 'REQUEST_TOO_LARGE' : error.code || 'SERVER_ERROR' });
  });
  return app;
}

export default createApp;
