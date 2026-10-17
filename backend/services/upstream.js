import { setTimeout as delay } from 'node:timers/promises';
import { AppError } from '../utils/errors.js';

const allowedHosts = new Set([
  'itunes.apple.com', 'en.wikipedia.org', 'musicbrainz.org', 'genius.com',
  'api.deezer.com', 'api.listenbrainz.org', 'open.spotify.com', 'api.spotify.com', 'accounts.spotify.com',
]);

export function createUpstream({ fetchImpl = globalThis.fetch, timeoutMs = 12000 } = {}) {
  let musicBrainzSlot = 0;
  return async function upstream(url, { json = true, ...options } = {}) {
    const target = new URL(url);
    if (target.protocol !== 'https:' || !allowedHosts.has(target.hostname) || target.username || target.password) {
      throw new AppError(400, 'Unsupported upstream address.', 'INVALID_UPSTREAM');
    }
    if (target.hostname === 'musicbrainz.org') {
      const wait = Math.max(0, musicBrainzSlot - Date.now());
      if (wait > 20000) throw new AppError(429, 'MusicBrainz is busy. Please try again shortly.', 'UPSTREAM_BUSY');
      musicBrainzSlot = Date.now() + wait + 1100;
      if (wait) await delay(wait);
    }
    try {
      const response = await fetchImpl(target, {
        ...options,
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          Accept: json ? 'application/json' : 'text/html',
          'User-Agent': 'BackTrack/1.0 (local music discovery app)',
          ...options.headers,
        },
      });
      if (!response.ok) {
        throw new AppError(response.status === 404 ? 404 : response.status === 429 ? 429 : 502,
          response.status === 404 ? 'That public resource could not be found.' :
          response.status === 429 ? 'The music service is busy. Please try again shortly.' :
          'The music service could not complete this lookup. Please try again.', 'UPSTREAM_FAILED');
      }
      const body = await response.text();
      if (body.length > 12 * 1024 * 1024) throw new AppError(502, 'The music service returned too much data.', 'UPSTREAM_INVALID');
      return json ? JSON.parse(body) : body;
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        throw new AppError(504, 'The music service took too long. Please try again.', 'UPSTREAM_TIMEOUT');
      }
      throw new AppError(502, 'Could not reach the music service. Check your connection and try again.', 'UPSTREAM_UNAVAILABLE');
    }
  };
}
