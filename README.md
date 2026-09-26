# Oddly — The Contraption Club

A small Rube Goldberg puzzle game about taking the delightfully long way to ring a bell. Build a chain reaction with ramps, fans, spring bumpers, and dominoes, then release the marble and see what happens.

## Run locally

Requires Node.js 22.18+ (Node 24 recommended).

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. For a production build:

```sh
npm run build
npm run preview
```

The built `dist/` directory can be served by a static web server. No backend or API keys are required. Google Fonts are optional; system fonts are used if unavailable.

## How to play

1. Drag a part from the toolbox onto the workbench, or click a tool and then the board.
2. Drag placed parts to reposition them. Select a part and use the rotation buttons or **R** / **Shift+R** to turn it.
3. Press **Let it roll** or **Space** to release the marble. The goal is to hit the brass bell.
4. Reset to edit your machine. Its previous trail stays visible so you can diagnose a miss. Undo restores the previous edit; clearing the board is also undoable.
5. Open the hint for a nudge, or load an example arrangement and experiment with it.

Keyboard-only play: Tab to a toolbox button and press Enter to place a part in the center. Use arrow keys to move it 10 units, or Shift+arrow keys for 1-unit adjustments. R rotates clockwise; Shift+R rotates counterclockwise. Delete or Backspace removes the selected part. Ctrl/Cmd+Z undoes an edit. Tab leaves the selected part normally.

Four puzzles progress from bridging a gap to a reversed, four-part ramp → domino → fan → bumper chain. Every puzzle is available from the workshop chooser. Builds, completed puzzles, and the sound preference save in this browser when local storage is available. Sound is off by default. Touch layouts, reduced-motion preferences, and paused instructions are supported.

## Checks

```sh
npm run check
npm run format:check
```

The deterministic engine tests check all four solutions, failure without required parts, frame-rate independence, individual gadget behavior, control-reachable solution angles, placement tolerance, snapshot isolation, and bounded full-attempt trail history.

Browser validation covers keyboard placement/movement/rotation, pointer placement and dragging, undo/removal, help, hints, speed and pause/reset controls, winning and losing, progression, persisted builds, and desktop/mobile layouts.

## Implementation

- `src/engine.ts`: deterministic 240 Hz marble simulation, collision response, gadget forces, four level definitions, and bounded trail/event history.
- `src/main.ts`: SVG workbench, interaction state, accessible controls, optional synthesized audio, and validated local saves.
- `src/art.ts`: original SVG illustrations and icons.
- `src/style.css`: responsive workshop layout and motion preferences.
- `tests/engine.test.ts`: Node's built-in test runner; no browser or test-service dependency.

The simulation is intentionally playful: fans apply local forces, bumpers add spring energy, and a triggered domino row gives the marble a single kick. Wooden rails are fixed; the toolbox supplies the editable parts.
