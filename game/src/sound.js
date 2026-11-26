// Tiny synthesized sound effects: plain WebAudio oscillators, no audio files.
// Everything is guarded so the game plays silently when audio is unavailable.

let ctx = null;
let enabled = true;

function audio() {
  if (!enabled) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    enabled = false;
    return null;
  }
}

function beep(freq, dur, type, gain) {
  const ac = audio();
  if (!ac) return;
  try {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain || 0.12, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + dur);
  } catch {
    // Sound is garnish; a failure never breaks the game.
  }
}

export function playEvent(event) {
  if (event === 'ring') {
    beep(660, 0.12, 'sine', 0.14);
    setTimeout(() => beep(990, 0.18, 'sine', 0.14), 70);
  } else if (event === 'star') {
    beep(1180, 0.08, 'triangle', 0.1);
  } else if (event === 'miss') {
    beep(180, 0.25, 'sawtooth', 0.08);
  } else if (event === 'finish') {
    beep(523, 0.15, 'sine', 0.14);
    setTimeout(() => beep(659, 0.15, 'sine', 0.14), 140);
    setTimeout(() => beep(784, 0.3, 'sine', 0.14), 280);
  }
}
