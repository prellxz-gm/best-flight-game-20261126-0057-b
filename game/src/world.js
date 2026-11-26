// Sky Rings Rally — world: course, plane physics, scoring, autopilot.
// Lateral position x lives in [-1, 1], altitude y in [0, 1]. Distance ahead is z in
// world units; the plane flies forward at speed units per second and rings sit at fixed z.

import { clamp, lerp, mulberry32, range } from './rng.js';

export const RING_COUNT = 12;
export const RALLY_SECONDS = 60;
export const BASE_SPEED = 34;
export const BOOST_SPEED = 62;
export const RING_SPACING = 130;
export const FIRST_RING_Z = 120;

// Points: a ring is worth 100, a star 25, and every ring in a row without a miss
// adds a growing combo bonus (25 per combo step).
export const RING_POINTS = 100;
export const STAR_POINTS = 25;

export function buildCourse(seed) {
  const rnd = mulberry32(seed);
  const rings = [];
  const stars = [];
  let x = 0;
  let y = 0.55;
  for (let i = 0; i < RING_COUNT; i++) {
    // The course weaves: each ring drifts sideways and up/down from the last one,
    // with a bigger swing the further along the course you get.
    const swing = 0.28 + (i / RING_COUNT) * 0.45;
    x = clamp(x + range(rnd, -swing, swing), -0.85, 0.85);
    y = clamp(y + range(rnd, -0.28, 0.28), 0.18, 0.88);
    // Later rings shrink, so the rally gets harder as you go.
    const radius = 0.32 - (i / RING_COUNT) * 0.12;
    rings.push({
      x,
      y,
      z: FIRST_RING_Z + i * RING_SPACING,
      r: radius,
      hit: false,
      passed: false,
    });
    // Two bonus stars tucked near each ring, slightly off its line.
    for (let s = 0; s < 2; s++) {
      stars.push({
        x: clamp(x + range(rnd, -0.45, 0.45), -1, 1),
        y: clamp(y + range(rnd, -0.3, 0.3), 0.08, 0.95),
        z: FIRST_RING_Z + i * RING_SPACING + range(rnd, -28, 28),
        taken: false,
      });
    }
  }
  // Decorative clouds and hills, placed once per course so the scenery is stable.
  const clouds = [];
  for (let i = 0; i < 26; i++) {
    clouds.push({
      x: range(rnd, -1.6, 1.6),
      y: range(rnd, 0.05, 0.95),
      z: range(rnd, 40, 900),
      size: range(rnd, 0.5, 1.4),
    });
  }
  return { rings, stars, clouds };
}

export function newGame(seed) {
  return {
    seed,
    course: buildCourse(seed),
    // Plane state.
    px: 0,
    py: 0.55,
    vx: 0,
    vy: 0,
    bank: 0,
    // Compass heading in degrees: starts at 042, banking left/right turns it.
    heading: 42,
    z: 0,
    speed: BASE_SPEED,
    boosting: false,
    // Rally state.
    timeLeft: RALLY_SECONDS,
    score: 0,
    ringsHit: 0,
    starsHit: 0,
    combo: 0,
    bestCombo: 0,
    finished: false,
    finishReason: '',
    // Juice: recent events the renderer flashes (ring hit, star, miss).
    flash: 0,
    flashKind: '',
    message: '',
    messageT: 0,
    // Distance travelled, drives the scrolling scenery.
    travelled: 0,
  };
}

// The next ring the plane has not passed yet, or null when the course is done.
export function nextRing(state) {
  for (const ring of state.course.rings) {
    if (!ring.passed) return ring;
  }
  return null;
}

// Steer the plane toward a target point (used by the screenshot autopilot).
// Returns { steer, climb, boost } in the same shape as keyboard input.
export function autopilot(state) {
  const ring = nextRing(state);
  if (!ring) return { steer: 0, climb: 0, boost: false };
  const dx = ring.x - state.px;
  const dy = ring.y - state.py;
  return {
    steer: clamp(dx * 2.2, -1, 1),
    climb: clamp(dy * 2.2, -1, 1),
    boost: Math.abs(dx) < 0.25 && Math.abs(dy) < 0.2,
  };
}

// One fixed step of the rally. input: { steer (-1..1), climb (-1..1), boost }.
// Returns a list of event strings ('ring', 'star', 'miss', 'finish') for sounds.
export function stepGame(state, input, dt) {
  const events = [];
  if (state.finished) return events;

  state.timeLeft -= dt;
  state.boosting = !!input.boost;
  const targetSpeed = state.boosting ? BOOST_SPEED : BASE_SPEED;
  state.speed = lerp(state.speed, targetSpeed, Math.min(1, dt * 2.5));

  // Steering: lateral velocity follows the stick, with a little inertia.
  const steerPower = 1.9;
  const climbPower = 1.5;
  state.vx = lerp(state.vx, input.steer * steerPower, Math.min(1, dt * 7));
  state.vy = lerp(state.vy, input.climb * climbPower, Math.min(1, dt * 7));
  state.px = clamp(state.px + state.vx * dt, -1.15, 1.15);
  state.py = clamp(state.py + state.vy * dt, 0.05, 0.98);
  state.bank = lerp(state.bank, -state.vx * 0.55, Math.min(1, dt * 8));
  // Heading follows the bank: steering right turns the nose clockwise.
  state.heading = (((state.heading + state.vx * dt * 14) % 360) + 360) % 360;
  state.z += state.speed * dt;
  state.travelled = state.z;

  // Rings: when one reaches the plane, score it by how close to centre the plane is.
  for (const ring of state.course.rings) {
    if (ring.passed) continue;
    if (ring.z - state.z > 0) continue;
    ring.passed = true;
    const dx = state.px - ring.x;
    const dy = state.py - ring.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= ring.r) {
      ring.hit = true;
      state.ringsHit += 1;
      state.combo += 1;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      const bonus = (state.combo - 1) * 25;
      state.score += RING_POINTS + bonus;
      state.flash = 1;
      state.flashKind = 'ring';
      const perfect = dist <= ring.r * 0.45;
      state.message = perfect ? 'PERFECT!' : `RING ${state.ringsHit}/${RING_COUNT}`;
      state.messageT = 1.1;
      events.push('ring');
    } else {
      state.combo = 0;
      state.flash = 1;
      state.flashKind = 'miss';
      state.message = 'MISSED';
      state.messageT = 1.1;
      events.push('miss');
    }
  }

  // Stars: collected when the plane passes close to one.
  for (const star of state.course.stars) {
    if (star.taken) continue;
    if (star.z - state.z > 0) continue;
    star.taken = true;
    const dist = Math.hypot(state.px - star.x, state.py - star.y);
    if (dist <= 0.22) {
      state.starsHit += 1;
      state.score += STAR_POINTS;
      state.flash = 1;
      state.flashKind = 'star';
      events.push('star');
    }
  }

  if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 2.2);
  if (state.messageT > 0) state.messageT -= dt;

  // Finish: all rings passed, or the clock runs out.
  const done = nextRing(state) === null;
  if (done) {
    state.finished = true;
    state.finishReason = 'COURSE COMPLETE';
    events.push('finish');
  } else if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    state.finished = true;
    state.finishReason = 'TIME UP';
    events.push('finish');
  }
  return events;
}

// A 0..5 star rating for the finish screen.
export function rating(state) {
  const ringShare = state.ringsHit / RING_COUNT;
  if (ringShare >= 1) return 5;
  if (ringShare >= 0.9) return 4;
  if (ringShare >= 0.7) return 3;
  if (ringShare >= 0.5) return 2;
  if (ringShare >= 0.25) return 1;
  return 0;
}
