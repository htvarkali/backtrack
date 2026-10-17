import assert from 'node:assert/strict';
import test from 'node:test';

test('playback recovers, controls the queue, and ignores stale asynchronous results', async () => {
let audio;
const callbacks = new Map();
let nextFrame=0;
globalThis.requestAnimationFrame = callback => {callbacks.set(++nextFrame,callback);return nextFrame;};
globalThis.cancelAnimationFrame = id => callbacks.delete(id);
globalThis.Audio = class extends EventTarget {
  constructor(){super();audio=this;this.currentTime=0;this.duration=30;this.src='';this.fail=false;}
  play(){ if(this.fail){const error = new Error('missing');error.name='NotSupportedError';return Promise.reject(error);} this.dispatchEvent(new Event('playing'));return Promise.resolve();}
  pause(){this.dispatchEvent(new Event('pause'));}
};
const p=await import('../frontend/src/services/player.js');
const settle=()=>new Promise(r=>setTimeout(r,0));
p.setPreviewUrls({first:'/audio/one.mp3',second:'/audio/two.mp3',third:'/audio/three.mp3'});
p.setPreviewResolver(async id=>id==='first'?'/audio/recovered.mp3':undefined,()=>true);
p.playSong('first');assert.equal(p.getPlayerState().playing,true);
p.toggleSong('first');assert.equal(p.getPlayerState().playing,false);
p.toggleSong('first');assert.equal(p.getPlayerState().playing,true);
audio.dispatchEvent(new Event('error'));await settle();assert.equal(audio.src,'/audio/recovered.mp3');assert.equal(p.getPlayerState().playing,true);
p.playQueue(['first','second','third']);assert.deepEqual(p.getPlayerState().queue,['first','second','third']);
p.skipQueue(1);assert.equal(p.getPlayerState().id,'second');p.skipQueue(-1);assert.equal(p.getPlayerState().id,'first');
audio.currentTime=11;const callback=callbacks.get(nextFrame);callbacks.delete(nextFrame);callback();assert.equal(p.getPlayerState().id,'second');
let release;
p.setPreviewResolver(()=>new Promise(r=>release=r),()=>true);
p.playSong('missing');assert.equal(p.getPlayerState().loading,true);await settle();p.playSong('third');release('/late.mp3');await settle();assert.equal(p.getPlayerState().id,'third');assert.equal(audio.src,'/audio/three.mp3');
p.setPreviewResolver(async()=>undefined,()=>true);p.playSong('no-recording');await settle();assert.equal(p.getPlayerState().loading,false);assert.match(p.getPlayerState().error,/No recording/);
p.stopPlayback();assert.equal(p.getPlayerState().id,null);assert.equal(p.getPlayerState().error,null);assert.equal(callbacks.size,0);
});
