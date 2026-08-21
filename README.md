# WRECKERS!

A tiny single-screen arcade game about keeping the last light on the shoal. Built as a love letter to the Atari 2600 — 160×192 playfield, a flat TIA-style palette, one oscillator at a time for sound, and a hand-drawn 3×5 pixel font.

Play it here: **[index.html](index.html)**

## The setup

You are the keeper of the last light on the shoal. Hold the beam on ships to decide their fate:

- **White traders** drift in blind. Hold the light on one until it sees you — it turns for open water and you bank points.
- **Red raiders** steer *toward* the light. Leave them in the dark and they lose the shoal on their own; light them up and you're only luring them onto the rocks.
- Anything — trader or raider — that reaches the rocks costs you a lantern. Lose all your lanterns and the light goes out.
- From **wave 3**, sharks stalk the shoal, hunting ships and mermaids. Catch one in the beam before it reaches its prey to drive it off.
- From **wave 4**, mermaids swim in. Keep the light on them all the way to the lighthouse for a big bonus — and keep sharks and raiders away while they're still dark, or they'll be taken.
- A shark that kills a raider — and, sometimes, a trader you've just saved — leaves behind a **supply point**. Catch it in the beam and it's drawn in like a tractor beam, filling one of 4 slots.
- Fill all 4 slots and press the middle button to unleash the **Light Wave**: a pulse from the lighthouse that shoves every ship off the shoal, scares off every shark, and pulls in every mermaid at once.
- Clear a wave with a lantern missing and you get one back.

## Controls

| Input | Action |
|---|---|
| ◀ / ▶ on-screen buttons | Turn the beam left / right (hold; release to stop) |
| Arrow keys / A, D | Turn the beam left / right |
| Space / Enter / middle button | Start / restart — or, mid-game with a full supply meter, unleash the Light Wave |
| Tap either half of the screen | Turn the beam toward that side |

The beam only moves while you're actively turning it — let go and it stops dead, like a hand on a real lamp.

## Running it

No build step, no dependencies. It's a static page.

- Open [index.html](index.html) directly in a browser, or
- Serve the folder locally, e.g. `npx serve .` or `python -m http.server`, and visit it in a browser.

## Project layout

| File | Purpose |
|---|---|
| [index.html](index.html) | Page shell: the cabinet, canvas, on-screen d-pad, and the instructions panel |
| [styles.css](styles.css) | The "arcade cabinet" chrome — brass-lipped housing, glow, scanline overlay, and responsive layout for portrait/landscape/short viewports |
| [wreckers.js](wreckers.js) | The entire game: rendering, simulation, audio, and input, in a single self-contained IIFE |
| [_smoke.mjs](_smoke.mjs) | A Playwright smoke test — loads the page, presses start, exercises the beam, and checks for console/page errors |

## How it's built

Everything lives in `wreckers.js` with no external libraries:

- **Rendering** — a 160×192 `<canvas>` is drawn pixel-by-pixel with `fillRect` calls (no sprites/images), then stretched by CSS to fill the screen with `image-rendering: pixelated`. Geometry is computed in "screen units" and scaled by a 1.6 pixel-aspect factor to mimic NTSC's non-square pixels.
- **Text** — rendered from a hand-authored 3×5 bitmap font baked into the `FONT` table, not a system font.
- **The beam** — a wedge computed from the lamp's position and the current heading, filled with a dithered checkerboard pattern instead of alpha blending, in the spirit of TIA-era "transparency."
- **Simulation** — a single `step(dt)` function advances ships, sharks, mermaids, and supply points each frame: traders turn for open water once lit, raiders steer toward the light, sharks hunt the nearest ship/mermaid and flee once caught in the beam, mermaids stall in the dark and bolt for the lighthouse once lit, and supply points drift until lit, then get reeled toward the lamp.
- **The Light Wave** — `triggerLightWave()` fires once the 4-slot supply meter is full: every ship is flipped to its "fleeing" state, every shark is scared off, and every mermaid is banked, all at once, for the cost of the whole meter.
- **Audio** — small bleeps and noise bursts synthesized live via the Web Audio API (`OscillatorNode`/`GainNode`), one voice at a time, rather than sample playback.
- **Layout** — the game "cabinet" is a responsive flex layout that adapts between portrait (buttons below the screen) and short/landscape viewports (buttons beside the screen, instructions hidden) so the whole game fits on one screen without scrolling.

## License

MIT — see [LICENSE](LICENSE).
