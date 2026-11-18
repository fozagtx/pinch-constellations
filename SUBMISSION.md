# Devpost fields: Pinch Constellations

**Name:** Pinch Constellations

**Tagline (≤140):** A seated, hands-only star puzzle for Meta Quest: pinch a star, pull a line of light to the next, and light up the sky.

**Track:** Gaming
**Division:** New Experience
**Project link:** https://fozagtx.github.io/pinch-constellations/
**Code:** https://github.com/fozagtx/pinch-constellations
**Target launch date:** December 2026 (WebXR, playable today in the Meta Quest Browser)

## Description

### Inspiration
The best hand-tracking moment is the first pinch: thumb meets finger and something in the world answers. We wanted a whole game built on that one gesture, and we wanted it to pass Meta's airplane-seat and bus-stop tests. Tracing constellations is something people already do with a finger against the night sky, so it maps naturally onto a pinch-and-pull.

### What it does
Faint outlines of an original constellation float within arm's reach. Pinch a star, pull a glowing line to its neighbour and let go. A correct link locks in gold and plays the next note of a rising scale. A wrong link flashes red and fades. Complete every line and the constellation lights up with a chord, then the next one appears. Three constellations (The Kite, The Lantern, The Heron) take about a minute each, and the session ends with your total time. Pinch any star to replay and beat it.

### How we built it
- WebXR with three.js, using no build step, hosted on GitHub Pages, so it opens instantly in the Meta Quest Browser.
- WebXR Hand Input: we read the `thumb-tip` and `index-finger-tip` joints every frame. A pinch starts under 2 cm and releases over 3.5 cm. That hysteresis stops lines snapping when tracking jitters.
- A `local` reference space anchors the field 45 cm in front of where your head was when the session started, so everything stays inside a two-foot radius whether you're on a couch, a plane or a train.
- Procedural Web Audio for every sound, with no assets.
- The desktop preview supports mouse drag and the IWER Quest 3 emulator (`?emulate`).

### Challenges
Keeping a pinch stable at the edge of tracking, and sizing grab radii (5 cm) so it's forgiving without making wrong links happen by accident.

### What's next
A daily constellation (the reason to come back), a co-op mode where two people trace the same sky, players drawing and sharing their own constellations, and eye-gaze hints for the next star.

## Hand interactions
The whole game is one gesture: pinch. Pinch to grab a star, move your hand to pull the line, release to connect. Either hand works, and both can draw at once. You never need a controller, from entering the game to finishing it. What excites us about VR's future is games like this that feel like magic in small, quiet moments, playable in a seat with nothing but your hands.
