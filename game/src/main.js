// Sky Rings Rally — entry point: game loop, keyboard + touch input, screens,
// and the ?shot= deterministic screenshot mode.

import { drawFrame } from './render.js';
import { autopilot, newGame, rating, stepGame } from './world.js';
import { shotScene } from './shots.js';
import { playEvent } from './sound.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const W = 1280;
const H = 720;

let screen = 'title';
let state = newGame(1);
let bestScore = 0;
let paused = false;
let lastTime = 0;
let elapsed = 0;

// ---- input ----

const keys = new Set();

function readInput() {
  const left = keys.has('ArrowLeft') || keys.has('KeyA');
  const right = keys.has('ArrowRight') || keys.has('KeyD');
  const up = keys.has('ArrowUp') || keys.has('KeyW');
  const down = keys.has('ArrowDown') || keys.has('KeyS');
  return {
    steer: (right ? 1 : 0) - (left ? 1 : 0) + touchSteer,
    climb: (up ? 1 : 0) - (down ? 1 : 0) + touchClimb,
    boost: keys.has('Space') || touchBoost,
  };
}

// Touch / pointer steering: drag on the canvas to steer, second finger (or
// holding the top half) boosts. Simple and forgiving on a phone.
let touchSteer = 0;
let touchClimb = 0;
let touchBoost = false;
let pointerStart = null;

canvas.addEventListener('pointerdown', (e) => {
  pointerStart = { x: e.clientX, y: e.clientY };
  if (screen === 'title') startGame();
});
canvas.addEventListener('pointermove', (e) => {
  if (!pointerStart) return;
  const dx = (e.clientX - pointerStart.x) / 120;
  const dy = (e.clientY - pointerStart.y) / 120;
  touchSteer = Math.max(-1, Math.min(1, dx));
  touchClimb = Math.max(-1, Math.min(1, -dy));
  touchBoost = e.clientY < window.innerHeight * 0.3;
});
function endPointer() {
  pointerStart = null;
  touchSteer = 0;
  touchClimb = 0;
  touchBoost = false;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

window.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
    e.preventDefault();
  }
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'Enter' && screen === 'title') startGame();
  if (e.code === 'KeyR' && screen === 'over') startGame();
  if (e.code === 'KeyP' && screen === 'play') paused = !paused;
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

// ---- flow ----

function startGame() {
  state = newGame((Math.random() * 100000) | 0);
  state.bestScore = bestScore;
  screen = 'play';
  paused = false;
  announce('Flying! Steer with the arrow keys, fly through the golden rings.');
}

function finishGame() {
  bestScore = Math.max(bestScore, state.score);
  state.stars5 = rating(state);
  state.bestScore = bestScore;
  screen = 'over';
  announce(`Finished. Score ${state.score}, ${state.ringsHit} rings. Press R to fly again.`);
}

function announce(msg) {
  if (statusEl) statusEl.textContent = msg;
}

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ---- main loop ----

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
  lastTime = now;
  elapsed += dt;

  if (screen === 'play' && !paused) {
    const events = stepGame(state, readInput(), dt);
    for (const ev of events) playEvent(ev);
    if (state.finished) finishGame();
  }

  drawFrame(ctx, screen, state, W, H, elapsed);

  if (screen === 'play' && paused) {
    ctx.fillStyle = 'rgba(6, 20, 60, 0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.font = '900 64px "Arial Black", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(10, 20, 50, 0.85)';
    ctx.strokeText('PAUSED', W / 2, H / 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('PAUSED', W / 2, H / 2);
    ctx.font = '800 26px Arial, sans-serif';
    ctx.fillText('Press P to resume', W / 2, H / 2 + 48);
  }
}

// ---- screenshot mode ----

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number(params.get('seed') || 1) || 1;

resize();
window.addEventListener('resize', resize);

if (shot) {
  // Deterministic scene: no animation loop, one frozen frame, and a marker
  // the screenshot tool can wait for.
  const scene = shotScene(shot, seed);
  screen = scene.screen;
  state = scene.state;
  drawFrame(ctx, screen, state, W, H, shot === 'play' ? 14 : shot === 'end' ? 0 : 2);
  document.title = `Sky Rings Rally — ${shot}`;
  const done = document.createElement('div');
  done.id = 'shot-ready';
  document.body.appendChild(done);
} else {
  announce('Sky Rings Rally. Press Enter or click to fly.');
  requestAnimationFrame((now) => {
    lastTime = now;
    requestAnimationFrame(frame);
  });
}
