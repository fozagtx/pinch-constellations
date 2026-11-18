# Pinch Constellations

A seated, hands-first star puzzle for Meta Quest, built with WebXR. Pinch a star, drag to its neighbour, release. Trace every faint outline to light the constellation.

**Play:** https://fozagtx.github.io/pinch-constellations/ (open in the Meta Quest Browser and press Enter VR)
**Desktop emulator:** https://fozagtx.github.io/pinch-constellations/?emulate

## How it works
- **Hands only.** WebXR `hand-tracking`. A pinch is the thumb tip within 2 cm of the index tip, released past 3.5 cm (hysteresis stops jitter). No controllers needed from start to finish.
- **Seated.** Stars sit on a gentle arc 45 cm from your head at session start, so every move fits in a two-foot radius (the airplane-seat test).
- **Short sessions.** Three constellations, about a minute each, with a chime scale for each correct line and a full chord when one completes.
- **Desktop fallback.** Drag with the mouse, or load the IWER Quest 3 emulator with `?emulate`.

## Stack
three.js r170 (CDN, no build step) · WebXR Hand Input · Web Audio · IWER emulator · GitHub Pages

## Run locally
```
npx serve .
```

## Track / division
Meta VR Start Developer Competition 2026 · Gaming · New Experience
