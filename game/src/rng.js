// Seeded random numbers (mulberry32) so a screenshot seed always builds the same course.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick a value in [min, max) from a random function.
export function range(rnd, min, max) {
  return min + rnd() * (max - min);
}

// Clamp a number into [min, max].
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

// Smooth interpolation between a and b.
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
