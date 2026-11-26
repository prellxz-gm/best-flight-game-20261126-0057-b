// Deterministic screenshot scenes behind ?shot=start|play|end&seed=N.
// Each scene plays the real rules forward from a fresh world, steered by the
// autopilot, so the frame is what a short game really looks like and the same
// seed always gives the same frame.

import { autopilot, newGame, rating, stepGame } from './world.js';

const STEP = 1 / 60;
const START_SECONDS = 1;
const PLAY_SECONDS = 14;
const END_LIMIT_SECONDS = 120;

// Run the autopilot for `seconds` of game time (or until the rally ends).
function runSeconds(state, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    if (state.finished) break;
    stepGame(state, autopilot(state), STEP);
  }
  return state;
}

// The end scene's autopilot is deliberately sloppy: it only looks at the next
// ring every other step and steers at half strength, so it misses a few rings
// the way a hurried player does and the finish screen shows a real score.
function runEnd(state) {
  let i = 0;
  while (!state.finished && i < END_LIMIT_SECONDS / STEP) {
    const input = autopilot(state);
    if (i % 2 === 0) {
      input.steer *= 0.5;
      input.climb *= 0.5;
    }
    stepGame(state, input, STEP);
    i++;
  }
  return state;
}

// Build the state a screenshot query wants. Returns { screen, state } where
// screen is 'title' | 'play' | 'over'. The finish screen's star rating is
// attached to the state as stars5 for the renderer.
export function shotScene(shot, seed) {
  if (shot === 'play') {
    const state = newGame(seed);
    runSeconds(state, PLAY_SECONDS);
    return { screen: 'play', state };
  }
  if (shot === 'end') {
    const state = newGame(seed);
    runEnd(state);
    state.stars5 = rating(state);
    return { screen: 'over', state };
  }
  // start: title screen over a live-looking world, a few seconds in so a big
  // gold ring sits ahead of the plane.
  const state = newGame(seed);
  runSeconds(state, START_SECONDS);
  return { screen: 'title', state };
}
