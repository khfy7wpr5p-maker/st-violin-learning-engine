# st-violin-learning-engine

Deterministic violin-learning domain engine for Student App and other ST consumers.

## VIOLIN-01 — First Position Fingering Core

Current scope:

- standard violin tuning: G3, D4, A4, E5
- first-position note-to-string/finger mapping
- low / normal / high finger placement labels
- physically scaled stop positions using violin string length
- alternative string candidates where first position allows them
- MusicXML-compatible pitch input contract (`step`, `alter`, `octave`)
- deterministic, UI-independent output for later playback/fingerboard synchronization

The engine does **not** own score rendering, MusicXML document parsing, audio playback,
transport state, microphone analysis, or Student App UI.

### Example

```js
import { resolveFirstPositionNote } from "./src/index.js";

const result = resolveFirstPositionNote({
  noteId: "m3-n2",
  pitch: { step: "F", alter: 1, octave: 4 }
});

console.log(result.primary);
// D string, finger 2, HIGH, about 67.67 mm from the nut on a 328 mm string
```

### Physical placement

Stopped-note distance from the nut is derived from equal temperament:

```
distance = L * (1 - 2^(-n/12))
```

where `L` is vibrating string length and `n` is the semitone distance above the open string.

Default `L` is 328 mm and is configurable by the host.

## Integration direction

```
MusicXML / trusted score events
        |
        v
Student playback timeline
        |
        +----> st-score-audio-engine (VIOLIN)
        |
        +----> st-violin-learning-engine
                   |
                   v
          string / finger / placement /
          physical fingerboard position
```

Audio remains owned by `st-score-audio-engine`; this repository never duplicates the violin sound engine.

## Development

```bash
npm test
```
