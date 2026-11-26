// Sky Rings Rally — renderer: saturated pseudo-3D chase view on one canvas.
// The world is projected from (x, y, z) with a simple pinhole: an object d units
// ahead appears at scale = FOCAL / (d + NEAR). The plane is drawn big, low-centre.

import { clamp } from './rng.js';
import { RING_COUNT, nextRing } from './world.js';

const FOCAL = 620;
const NEAR = 26;

// Project a world point into screen space. Returns { x, y, scale } or null when behind.
function project(state, wx, wy, wz, W, H) {
  const d = wz - state.z;
  if (d < 4) return null;
  // World x/y live in roughly [-1, 1]; the * 60 turns the pinhole factor into
  // screen pixels, so a ring a minute ahead is still a big gold circle.
  const scale = (FOCAL / (d + NEAR)) * 60;
  const horizonY = H * 0.46;
  return {
    x: W / 2 + (wx - state.px) * scale * 1.15,
    y: horizonY - (wy - state.py) * scale * 0.85,
    scale,
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function panel(ctx, x, y, w, h, alpha) {
  ctx.fillStyle = `rgba(8, 24, 64, ${alpha})`;
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function text(ctx, s, x, y, size, color, weight, align) {
  ctx.font = `${weight || 800} ${size}px "Arial Black", Arial, sans-serif`;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = Math.max(3, size / 7);
  ctx.strokeStyle = 'rgba(10, 20, 50, 0.85)';
  ctx.strokeText(s, x, y);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

// ---- scenery ----

function drawSky(ctx, W, H, t) {
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.55);
  sky.addColorStop(0, '#1e7fe0');
  sky.addColorStop(0.55, '#4fb0ff');
  sky.addColorStop(1, '#bfe9ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H * 0.55);
  // Sun with a soft halo, top right.
  const sx = W * 0.82;
  const sy = H * 0.12;
  const halo = ctx.createRadialGradient(sx, sy, 6, sx, sy, 120);
  halo.addColorStop(0, 'rgba(255, 240, 150, 0.95)');
  halo.addColorStop(0.35, 'rgba(255, 214, 80, 0.55)');
  halo.addColorStop(1, 'rgba(255, 214, 80, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(sx - 130, sy - 130, 260, 260);
  ctx.fillStyle = '#ffe95e';
  ctx.beginPath();
  ctx.arc(sx, sy, 34, 0, Math.PI * 2);
  ctx.fill();
}

function drawClouds(ctx, state, W, H) {
  // Clouds drift slowly and wrap around the course so the sky never empties.
  for (const c of state.course.clouds) {
    const p = project(state, c.x, c.y + 0.55, c.z, W, H);
    if (!p) continue;
    const s = Math.min(p.scale * c.size, 130);
    if (s < 4) continue;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 1.15 * s, 0.42 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(p.x - 0.75 * s, p.y + 0.12 * s, 0.75 * s, 0.32 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(p.x + 0.8 * s, p.y + 0.12 * s, 0.8 * s, 0.34 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGround(ctx, state, W, H) {
  const horizonY = H * 0.46;
  // Rolling green hills: three sine ridges, far to near, scrolling with distance.
  const ridges = [
    { color: '#5fbf5a', amp: 26, speed: 0.006, base: 0 },
    { color: '#3da33f', amp: 34, speed: 0.011, base: 26 },
    { color: '#2b8a33', amp: 44, speed: 0.02, base: 60 },
  ];
  for (const ridge of ridges) {
    ctx.fillStyle = ridge.color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let sx = 0; sx <= W; sx += 16) {
      const wave = Math.sin(sx * 0.006 + state.travelled * ridge.speed) * ridge.amp
        + Math.sin(sx * 0.013 - state.travelled * ridge.speed * 0.7) * ridge.amp * 0.5;
      ctx.lineTo(sx, horizonY + ridge.base + wave);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }
  // Blue river winding down the ground toward the viewer: walk the left bank
  // down, then the right bank back up, so the shape stays a band, not a zigzag.
  ctx.fillStyle = '#2f9df0';
  const leftBank = [];
  const rightBank = [];
  const riverPhase = state.travelled * 0.02;
  for (let sy = horizonY + 4; sy <= H; sy += 24) {
    const depth = (sy - horizonY) / (H - horizonY);
    const cx = W * 0.42 + Math.sin(riverPhase + depth * 5.2) * W * 0.16 * depth
      + Math.sin(riverPhase * 0.6) * W * 0.05;
    const half = 8 + depth * 46;
    leftBank.push([cx - half, sy]);
    rightBank.push([cx + half, sy]);
  }
  ctx.beginPath();
  ctx.moveTo(leftBank[0][0], leftBank[0][1]);
  for (const [x, y] of leftBank) ctx.lineTo(x, y);
  for (let i = rightBank.length - 1; i >= 0; i--) ctx.lineTo(rightBank[i][0], rightBank[i][1]);
  ctx.closePath();
  ctx.fill();
  // White sparkle on the river.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let sy = horizonY + 30; sy <= H; sy += 90) {
    const depth = (sy - horizonY) / (H - horizonY);
    const cx = W * 0.42 + Math.sin(riverPhase + depth * 5.2) * W * 0.16 * depth;
    ctx.moveTo(cx - 20 * depth, sy);
    ctx.lineTo(cx + 20 * depth, sy);
  }
  ctx.stroke();
}

// ---- course objects ----

function drawRing(ctx, state, ring, W, H) {
  const p = project(state, ring.x, ring.y, ring.z, W, H);
  if (!p) return;
  const r = ring.r * p.scale * 1.15;
  if (r < 3) return;
  // Glow behind the ring so it reads at a glance.
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // Golden torus: outer ring, dark outline, bright inner face.
  ctx.lineWidth = Math.max(4, r * 0.16);
  ctx.strokeStyle = '#b87700';
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.92, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = Math.max(3, r * 0.1);
  ctx.strokeStyle = '#ffe066';
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.92, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 240, 160, 0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.86, r * 0.79, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawStar(ctx, state, star, W, H, t) {
  const p = project(state, star.x, star.y, star.z, W, H);
  if (!p) return;
  const r = clamp(p.scale * 0.09, 3, 26);
  const tw = 0.75 + 0.25 * Math.sin(t * 5 + star.z);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(Math.sin(t * 2 + star.z) * 0.25);
  ctx.globalAlpha = tw;
  ctx.fillStyle = '#ffd23e';
  ctx.strokeStyle = '#b87700';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = (i * Math.PI) / 5 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = Math.cos(ang) * rad;
    const py = Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ---- the plane: a side profile flying right, drawn big, low-centre ----

function drawPlane(ctx, state, W, H, t) {
  const px = W / 2;
  const py = H * 0.74;
  const s = W / 1280; // scale with canvas width
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(state.bank * 0.6);
  ctx.scale(s, s);

  // Speed lines streaming off the tail.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const reach = state.boosting ? 1.6 : 1;
  for (let i = 0; i < 4; i++) {
    const yy = -58 + i * 38;
    const x0 = -150;
    const len = (46 + ((i * 29) % 40)) * reach;
    ctx.beginPath();
    ctx.moveTo(x0, yy);
    ctx.lineTo(x0 - len, yy);
    ctx.stroke();
  }

  // Tail fin (up) and tailplane.
  ctx.fillStyle = '#e63946';
  ctx.beginPath();
  ctx.moveTo(-78, -10);
  ctx.lineTo(-108, -72);
  ctx.lineTo(-84, -72);
  ctx.lineTo(-48, -12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ff5d5d';
  ctx.beginPath();
  ctx.moveTo(-72, 2);
  ctx.lineTo(-128, 26);
  ctx.lineTo(-118, 40);
  ctx.lineTo(-58, 14);
  ctx.closePath();
  ctx.fill();

  // Main wing: a low wing sweeping down-back from the fuselage.
  ctx.fillStyle = '#ff5d5d';
  ctx.beginPath();
  ctx.moveTo(28, 8);
  ctx.lineTo(-58, 108);
  ctx.lineTo(-34, 118);
  ctx.lineTo(58, 16);
  ctx.closePath();
  ctx.fill();
  // Yellow wing tip.
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.moveTo(-58, 108);
  ctx.lineTo(-34, 118);
  ctx.lineTo(-26, 104);
  ctx.lineTo(-48, 96);
  ctx.closePath();
  ctx.fill();

  // Fuselage, nose to the right.
  const body = ctx.createLinearGradient(0, -26, 0, 26);
  body.addColorStop(0, '#fff3f3');
  body.addColorStop(0.5, '#ff8a8a');
  body.addColorStop(1, '#e63946');
  ctx.fillStyle = body;
  roundRect(ctx, -110, -24, 212, 48, 22);
  ctx.fill();
  ctx.strokeStyle = '#8f1d26';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Cockpit canopy on top.
  ctx.fillStyle = '#7fd4ff';
  ctx.beginPath();
  ctx.ellipse(28, -14, 34, 15, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1d5f8a';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(38, -19, 12, 5, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Nose cap + spinning propeller (disc + two blades, nose right).
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.arc(104, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#b87700';
  ctx.lineWidth = 2;
  ctx.stroke();
  const spin = (t * 28) % Math.PI;
  ctx.save();
  ctx.translate(112, 0);
  ctx.rotate(spin);
  ctx.fillStyle = 'rgba(40, 40, 60, 0.85)';
  roundRect(ctx, -3, -44, 6, 88, 3);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(200, 220, 255, 0.28)';
  ctx.beginPath();
  ctx.ellipse(112, 0, 10, 46, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ---- HUD ----

function drawHud(ctx, state, W, H) {
  const pad = 16;
  // Top-left: score, huge.
  panel(ctx, pad, pad, 300, 86, 0.62);
  text(ctx, 'SCORE', pad + 18, pad + 28, 18, '#9fd8ff', 800);
  text(ctx, String(state.score), pad + 18, pad + 72, 46, '#ffffff', 900);
  // Top-centre: rings progress.
  const ringW = 300;
  panel(ctx, W / 2 - ringW / 2, pad, ringW, 86, 0.62);
  text(ctx, 'RINGS', W / 2, pad + 28, 18, '#ffe066', 800, 'center');
  text(ctx, `${state.ringsHit}/${RING_COUNT}`, W / 2, pad + 72, 46, '#ffffff', 900, 'center');
  // Top-right: timer, turns red under 10 seconds.
  panel(ctx, W - pad - 220, pad, 220, 86, 0.62);
  text(ctx, 'TIME', W - pad - 202, pad + 28, 18, '#9fd8ff', 800);
  const tColor = state.timeLeft <= 10 ? '#ff6b6b' : '#ffffff';
  text(ctx, `${Math.ceil(state.timeLeft)}s`, W - pad - 202, pad + 72, 46, tColor, 900);

  // Bottom-left: speed + altitude gauges.
  panel(ctx, pad, H - pad - 86, 300, 86, 0.62);
  text(ctx, 'SPEED', pad + 18, H - pad - 58, 18, '#9fd8ff', 800);
  text(ctx, `${Math.round(state.speed * 3.6)} km/h`, pad + 18, H - pad - 14, 34, '#ffffff', 900);
  // Heading chip, between SPEED and ALT so the three flight gauges sit together.
  panel(ctx, pad + 312, H - pad - 86, 220, 86, 0.62);
  text(ctx, 'HDG', pad + 330, H - pad - 58, 18, '#9fd8ff', 800);
  text(ctx, `${String(Math.round(state.heading ?? 42)).padStart(3, '0')}°`, pad + 330, H - pad - 14, 34, '#ffffff', 900);
  // Bottom-right: altitude + combo.
  panel(ctx, W - pad - 300, H - pad - 86, 300, 86, 0.62);
  text(ctx, 'ALT', W - pad - 282, H - pad - 58, 18, '#9fd8ff', 800);
  text(ctx, `${Math.round(state.py * 900 + 100)} m`, W - pad - 282, H - pad - 14, 34, '#ffffff', 900);

  // Combo badge under the rings panel when a streak is running.
  if (state.combo >= 2) {
    const label = `COMBO x${state.combo}`;
    ctx.font = '900 30px "Arial Black", Arial, sans-serif';
    const w = ctx.measureText(label).width + 36;
    panel(ctx, W / 2 - w / 2, pad + 100, w, 52, 0.75);
    text(ctx, label, W / 2, pad + 136, 30, '#ffd23e', 900, 'center');
  }

  // Boost hint, bottom centre.
  if (!state.boosting) {
    text(ctx, 'SPACE = BOOST', W / 2, H - 18, 18, 'rgba(255,255,255,0.85)', 800, 'center');
  } else {
    text(ctx, 'BOOST!', W / 2, H - 18, 22, '#ffd23e', 900, 'center');
  }

  // Centre flash message (PERFECT! / MISSED / RING n/12).
  if (state.messageT > 0 && state.message) {
    const a = clamp(state.messageT, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    const color = state.flashKind === 'miss' ? '#ff6b6b' : '#ffd23e';
    text(ctx, state.message, W / 2, H * 0.34, 64, color, 900, 'center');
    ctx.restore();
  }

  // Ring-hit flash: a gold vignette on success, red on a miss.
  if (state.flash > 0) {
    const col = state.flashKind === 'miss' ? '255, 80, 80' : '255, 210, 62';
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    g.addColorStop(0, `rgba(${col}, 0)`);
    g.addColorStop(1, `rgba(${col}, ${0.45 * state.flash})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // Next-ring distance readout, small, under the top bar.
  const ring = nextRing(state);
  if (ring) {
    const d = Math.max(0, Math.round(ring.z - state.z));
    text(ctx, `NEXT RING ${d}m`, W / 2, pad + 178, 20, 'rgba(255,255,255,0.9)', 800, 'center');
  }
}

function drawTitle(ctx, state, W, H, t) {
  ctx.fillStyle = 'rgba(6, 20, 60, 0.35)';
  ctx.fillRect(0, 0, W, H);
  const bob = Math.sin(t * 1.6) * 10;
  text(ctx, 'SKY RINGS', W / 2, H * 0.2 + bob, 96, '#ffd23e', 900, 'center');
  text(ctx, 'RALLY', W / 2, H * 0.2 + 96 + bob, 96, '#ffffff', 900, 'center');
  text(ctx, 'FLY THROUGH THE GOLDEN RINGS', W / 2, H * 0.2 + 150 + bob, 26, '#bfe9ff', 800, 'center');
  // Start card, kept clear of the plane low in the frame.
  panel(ctx, W / 2 - 330, H * 0.42, 660, 140, 0.7);
  text(ctx, 'ARROWS steer  •  SPACE boost', W / 2, H * 0.42 + 52, 28, '#ffffff', 800, 'center');
  text(ctx, '12 rings  •  60 seconds  •  chain combos', W / 2, H * 0.42 + 96, 24, '#ffe066', 800, 'center');
  const pulse = 0.65 + 0.35 * Math.sin(t * 4);
  ctx.save();
  ctx.globalAlpha = pulse;
  text(ctx, 'PRESS ENTER OR CLICK TO FLY', W / 2, H - 64, 30, '#ffffff', 900, 'center');
  ctx.restore();
  text(ctx, 'Best score this session: ' + (state.bestScore || 0), W / 2, H - 28, 20, 'rgba(255,255,255,0.85)', 800, 'center');
}

function drawFinish(ctx, state, W, H) {
  ctx.fillStyle = 'rgba(6, 20, 60, 0.55)';
  ctx.fillRect(0, 0, W, H);
  text(ctx, state.finishReason, W / 2, H * 0.22, 54, '#ffd23e', 900, 'center');
  panel(ctx, W / 2 - 320, H * 0.3, 640, 260, 0.78);
  text(ctx, 'FINAL SCORE', W / 2, H * 0.3 + 48, 22, '#9fd8ff', 800, 'center');
  text(ctx, String(state.score), W / 2, H * 0.3 + 128, 84, '#ffffff', 900, 'center');
  text(ctx, `Rings ${state.ringsHit}/${RING_COUNT}   •   Stars ${state.starsHit}   •   Best combo x${state.bestCombo}`, W / 2, H * 0.3 + 180, 26, '#ffe066', 800, 'center');
  const stars = '★'.repeat(Math.max(0, Math.min(5, state.stars5 || 0))) + '☆'.repeat(5 - Math.max(0, Math.min(5, state.stars5 || 0)));
  text(ctx, stars, W / 2, H * 0.3 + 232, 44, '#ffd23e', 900, 'center');
  text(ctx, 'PRESS R TO FLY AGAIN', W / 2, H * 0.3 + 330, 28, '#ffffff', 900, 'center');
}

// ---- frame ----

export function drawFrame(ctx, screen, state, W, H, t) {
  drawSky(ctx, W, H, t);
  drawClouds(ctx, state, W, H);
  drawGround(ctx, state, W, H);

  // Course objects, far to near so near ones draw over far ones.
  const objects = [];
  for (const ring of state.course.rings) {
    if (!ring.passed) objects.push({ z: ring.z, kind: 'ring', obj: ring });
  }
  for (const star of state.course.stars) {
    if (!star.taken) objects.push({ z: star.z, kind: 'star', obj: star });
  }
  objects.sort((a, b) => b.z - a.z);
  for (const o of objects) {
    if (o.kind === 'ring') drawRing(ctx, state, o.obj, W, H);
    else drawStar(ctx, state, o.obj, W, H, t);
  }

  // The next ring gets a chevron pointing at it when it is far away.
  const ring = nextRing(state);
  if (ring && screen === 'play') {
    const p = project(state, ring.x, ring.y, ring.z, W, H);
    if (p && (p.x < 60 || p.x > W - 60 || p.y < 120 || p.y > H - 120)) {
      const cx = clamp(p.x, 80, W - 80);
      const cy = clamp(p.y, 140, H - 160);
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 18);
      ctx.lineTo(cx + 16, cy + 12);
      ctx.lineTo(cx - 16, cy + 12);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawPlane(ctx, state, W, H, t);

  if (screen === 'play') drawHud(ctx, state, W, H);
  else if (screen === 'title') drawTitle(ctx, state, W, H, t);
  else if (screen === 'over') drawFinish(ctx, state, W, H);
}
