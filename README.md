# Starlance Rift Assault

A standalone browser space shooter built with vanilla HTML, CSS, and JavaScript.
Pilot a starfighter through escalating enemy waves, dodge incoming fire, and keep
your shields online as long as possible.

## Play

Open `index.html` in a modern browser. No build step or package install is
required.

You can also serve the project from this directory with any static file server:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Controls

- `Sortie`: start the game
- `WASD` or arrow keys: move
- `Space`: fire
- `Shift`: boost movement speed
- `P`: pause or resume
- `R`: restart from the start screen or game over screen
- Pointer or touch: drag to move and hold to fire
- Sound button: mute or unmute effects

## Features

- Full-screen responsive canvas rendering
- Keyboard, pointer, and touch controls
- Procedural starfield and trench backdrop
- Enemy waves with interceptors, fighters, and bombers
- Player shields, invincibility frames, score, and wave HUD
- Lightweight Web Audio sound effects

## Project Structure

- `index.html`: game shell, HUD, and overlays
- `styles.css`: responsive layout and interface styling
- `game.js`: game loop, rendering, input, audio, waves, and collision logic
