import React from "react";

const QUEUE_PREVIEW_SECONDS = 11;
const FADE_OUT_SECONDS = 0.9;
const RESOLVE_TIMEOUT_MS = 15_000;
const BUFFER_TIMEOUT_MS = 20_000;
let playerState = {
  id: null,
  playing: false,
  loading: false,
  progress: 0,
  level: 0,
  queue: [],
  queueIndex: -1,
  error: null,
};
const playerSubscribers = new Set();
const resolvedPreviews = {};
const unavailablePreviews = new Set();
const recoveryAttempts = new Set();
const waveformData = new Uint8Array(256);
let previewUrls = {};
let previewResolver = null;
let canResolvePreview = () => false;
let audioElement = null;
let audioContext = null;
let audioAnalyser = null;
let audioGain = null;
let animationFrame = 0;
let previewEnd = Infinity;
let playbackVersion = 0;
let recoveryVersion = null;
let queueTimer = null;
let bufferTimer = null;

function updatePlayer(update) {
  playerState = { ...playerState, ...update };
  playerSubscribers.forEach((notify) => notify());
}
function setPreviewUrls(urls) {
  previewUrls = { ...urls, ...resolvedPreviews };
}
function setPreviewResolver(resolve, canResolve) {
  previewResolver = resolve;
  canResolvePreview = canResolve;
}
const canPlay = (id) =>
  !!previewUrls[id] || (!unavailablePreviews.has(id) && canResolvePreview(id));
const isCurrent = (id, version) =>
  playerState.id === id && playbackVersion === version;

function clearPlaybackTimers() {
  clearTimeout(queueTimer);
  clearTimeout(bufferTimer);
}
function scheduleAdvance(delay, id, version) {
  if (playerState.queue.length) {
    queueTimer = setTimeout(() => {
      if (isCurrent(id, version)) advanceQueue();
    }, delay);
  }
}
function playbackFailed(message, id, version) {
  if (!isCurrent(id, version)) return;
  clearTimeout(bufferTimer);
  cancelAnimationFrame(animationFrame);
  updatePlayer({ playing: false, loading: false, error: message, level: 0 });
  scheduleAdvance(900, id, version);
}
async function resolvePreview(id, refresh = false) {
  let timeout;
  try {
    return await Promise.race([
      Promise.resolve().then(() => previewResolver?.(id, { refresh })),
      new Promise((resolve) => {
        timeout = setTimeout(() => resolve(undefined), RESOLVE_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}
async function recoverPreview() {
  const { id } = playerState;
  const version = playbackVersion;
  if (!id || recoveryVersion === version) return;
  clearTimeout(bufferTimer);
  if (previewResolver && !recoveryAttempts.has(id)) {
    recoveryAttempts.add(id);
    recoveryVersion = version;
    updatePlayer({ playing: false, loading: true, error: null });
    const url = await resolvePreview(id, true);
    if (!isCurrent(id, version)) return;
    if (url) {
      resolvedPreviews[id] = url;
      previewUrls[id] = url;
      loadAndPlay(id);
      return;
    }
  }
  playbackFailed("Preview unavailable", id, version);
}
function watchBuffering(id, version) {
  clearTimeout(bufferTimer);
  bufferTimer = setTimeout(() => {
    if (isCurrent(id, version) && playerState.loading) recoverPreview();
  }, BUFFER_TIMEOUT_MS);
}
function getAudioElement() {
  if (audioElement) return audioElement;
  audioElement = new Audio();
  audioElement.crossOrigin = "anonymous";
  audioElement.preload = "auto";
  audioElement.addEventListener("playing", () => {
    if (!playerState.id) return;
    clearTimeout(bufferTimer);
    updatePlayer({ playing: true, loading: false, error: null });
  });
  audioElement.addEventListener("pause", () =>
    updatePlayer({ playing: false }),
  );
  audioElement.addEventListener("waiting", () => {
    if (!playerState.id || playerState.error) return;
    updatePlayer({ loading: true });
    watchBuffering(playerState.id, playbackVersion);
  });
  audioElement.addEventListener("ended", () => {
    if (playerState.id) advanceQueue();
  });
  audioElement.addEventListener("error", recoverPreview);
  try {
    audioContext = new AudioContext();
    const source = audioContext.createMediaElementSource(audioElement);
    audioGain = audioContext.createGain();
    audioAnalyser = audioContext.createAnalyser();
    audioAnalyser.fftSize = 512;
    source
      .connect(audioGain)
      .connect(audioAnalyser)
      .connect(audioContext.destination);
  } catch {
    audioContext = null;
  }
  return audioElement;
}
function updatePlaybackFrame() {
  if (!audioElement || !playerState.id) return;
  let level = playerState.level * 0.8;
  if (audioAnalyser && playerState.playing) {
    audioAnalyser.getByteTimeDomainData(waveformData);
    let sum = 0;
    for (const sample of waveformData) sum += ((sample - 128) / 128) ** 2;
    level = Math.max(
      level,
      Math.min(1, Math.sqrt(sum / waveformData.length) * 3.2),
    );
  }
  const duration = audioElement.duration || 30;
  const currentTime = audioElement.currentTime;
  let progress = currentTime / duration;
  if (playerState.queue.length) {
    progress = Math.min(
      1,
      currentTime / Math.min(QUEUE_PREVIEW_SECONDS, duration),
    );
    const remaining = previewEnd - currentTime;
    if (audioGain && audioContext) {
      audioGain.gain.value =
        remaining < FADE_OUT_SECONDS
          ? Math.max(0, remaining / FADE_OUT_SECONDS)
          : Math.min(1, currentTime / 0.4);
    }
    if (currentTime >= previewEnd) {
      advanceQueue();
      return;
    }
  } else if (audioGain) audioGain.gain.value = 1;
  updatePlayer({ progress, level });
  animationFrame = requestAnimationFrame(updatePlaybackFrame);
}
function resumeAudioContext() {
  if (audioContext?.state === "suspended")
    audioContext.resume().catch(() => {});
}
function startAudio(id, version) {
  resumeAudioContext();
  watchBuffering(id, version);
  audioElement.play().catch((error) => {
    if (!isCurrent(id, version) || error.name === "AbortError") return;
    if (error.name === "NotAllowedError") {
      playbackFailed("Tap play to start audio", id, version);
    } else {
      recoverPreview();
    }
  });
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(updatePlaybackFrame);
}
function loadAndPlay(id) {
  const audio = getAudioElement();
  const version = ++playbackVersion;
  recoveryVersion = null;
  clearPlaybackTimers();
  cancelAnimationFrame(animationFrame);
  audio.pause();
  resumeAudioContext();
  updatePlayer({ id, playing: false, loading: true, progress: 0, error: null });
  if (!previewUrls[id] && previewResolver && !unavailablePreviews.has(id)) {
    resolvePreview(id).then((url) => {
      if (url) {
        resolvedPreviews[id] = url;
        previewUrls[id] = url;
      } else {
        unavailablePreviews.add(id);
      }
      if (isCurrent(id, version)) loadAndPlay(id);
    });
    return;
  }
  if (!previewUrls[id]) {
    playbackFailed("No recording found for this one", id, version);
    return;
  }
  audio.src = previewUrls[id];
  audio.currentTime = 0;
  previewEnd = playerState.queue.length ? QUEUE_PREVIEW_SECONDS : Infinity;
  startAudio(id, version);
}
function advanceQueue() {
  if (
    playerState.queue.length &&
    playerState.queueIndex < playerState.queue.length - 1
  ) {
    const index = playerState.queueIndex + 1;
    updatePlayer({ queueIndex: index });
    loadAndPlay(playerState.queue[index]);
  } else {
    stopPlayback();
  }
}
function playSong(id) {
  updatePlayer({ queue: [], queueIndex: -1 });
  loadAndPlay(id);
}
function toggleSong(id) {
  if (playerState.id === id && audioElement && !playerState.error) {
    if (playerState.playing) {
      clearTimeout(bufferTimer);
      cancelAnimationFrame(animationFrame);
      audioElement.pause();
      updatePlayer({ loading: false });
    } else if (!playerState.loading) {
      updatePlayer({ loading: true });
      startAudio(id, playbackVersion);
    }
    return;
  }
  playSong(id);
}
function playQueue(ids, startIndex = 0) {
  const queue = ids.filter(canPlay);
  if (!queue.length) return;
  const queueIndex = Math.max(0, Math.min(queue.length - 1, startIndex));
  updatePlayer({ queue, queueIndex });
  loadAndPlay(queue[queueIndex]);
}
function skipQueue(offset) {
  if (!playerState.queue.length) return;
  const queueIndex = Math.max(
    0,
    Math.min(playerState.queue.length - 1, playerState.queueIndex + offset),
  );
  updatePlayer({ queueIndex });
  loadAndPlay(playerState.queue[queueIndex]);
}
function stopPlayback() {
  playbackVersion++;
  clearPlaybackTimers();
  cancelAnimationFrame(animationFrame);
  audioElement?.pause();
  updatePlayer({
    id: null,
    playing: false,
    loading: false,
    progress: 0,
    level: 0,
    queue: [],
    queueIndex: -1,
    error: null,
  });
}
function compareSongs(firstId, secondId) {
  playQueue([firstId, secondId]);
}
function subscribe(notify) {
  playerSubscribers.add(notify);
  return () => playerSubscribers.delete(notify);
}
function usePlayer() {
  return React.useSyncExternalStore(subscribe, () => playerState);
}
function usePlayerSelector(selectState) {
  return React.useSyncExternalStore(subscribe, () => selectState(playerState));
}
const getPlayerState = () => playerState;
export {
  canPlay,
  compareSongs,
  getPlayerState,
  playQueue,
  playSong,
  setPreviewResolver,
  setPreviewUrls,
  skipQueue,
  stopPlayback,
  toggleSong,
  usePlayer,
  usePlayerSelector,
};
