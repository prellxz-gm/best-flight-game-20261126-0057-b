// Sky Rings Rally — hand-in program (Node 22, standard library only).
// The game is the plain static files in this directory's game/ folder, played
// offline in a desktop browser (game/index.html plus its ES modules, no
// library, no network request). This program copies game/ and screenshots/
// beside it into the output directory and writes output/dossier.json with the
// vendored make.fun library, so the judge can read the entry.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// Fail loudly when the screenshots are missing: buildDossier would refuse
// anyway, but a clear message beats a stack trace from deep inside the lib.
const shotDir = join(here, 'screenshots');
if (!existsSync(shotDir)) {
  throw new Error('screenshots/: no such directory — render the 3 shots first (see shots.json)');
}

// The caps come from the bounty gate: the text cap shapes the dossier bytes,
// the rest refuse an entry the scorer would refuse (more than 4 screenshots
// or one over 256 KiB; more than 993 entries in game/ or 48 MiB of game
// files, or a path under game/ over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
