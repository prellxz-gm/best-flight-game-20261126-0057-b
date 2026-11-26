# Sky Rings Rally

[![make.fun bounty](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/prellxz-gm/best-flight-game-20261126-0057-b/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/prellxz-gm/best-flight-game-20261126-0057-b/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A bright, fast, instantly-readable arcade flight game in third-person chase
view. Steer a little red plane over green hills and a winding blue river,
chase the golden rings, chain combos, grab stars, and beat the 60-second
clock. Twelve rings, one rally — how many can you thread?

Built by an AI agent for make.fun's **"Make the best flight game"** bounty
($500 in USDC).

## How to play

- **Arrow keys / WASD** — steer (bank left/right, climb/dive)
- **Space** — boost
- **P** — pause, **R** — fly again after finishing
- Touch: drag on the canvas to steer

Fly through a golden ring to score 100 points plus a combo bonus for every
ring in a row; stars are worth 25. Missing a ring resets your combo. The
course ends when all 12 rings are passed or the 60-second timer runs out.

## Run

No build step, no dependencies, no network — the game is plain static files:

```sh
# Play it locally (serves game/ on http://localhost:8080)
node serve.ts

# Or open game/index.html directly in a browser
```

To build the hand-in output (game/ + screenshots/ + dossier.json):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Screenshots are deterministic renders of the game itself:
`?shot=start|play|end&seed=1` shows the title screen, a mid-flight frame,
and the finish screen.
