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

## VIOLIN-02 — Playback Follow Contract

VIOLIN-02 adds a source-neutral bridge from a trusted host playback event to the
VIOLIN-01 fingering result. The host remains the only timing authority.

```js
import { resolveViolinFollowSnapshot } from "./src/index.js";

const result = resolveViolinFollowSnapshot({
  binding: {
    packageId: "pkg-123",
    sourceId: "pkg-123",
    generation: 7,
    targetPartId: "P1"
  },
  snapshot: {
    packageId: "pkg-123",
    sourceId: "pkg-123",
    generation: 7,
    playing: true,
    activeEvents: [{
      eventId: "P1:3:1:2",
      partId: "P1",
      measureIndex: 3,
      midi: 66,
      pitch: { step: "F", alter: 1, octave: 4 }
    }]
  }
});
```

The resolver:

- accepts only the explicitly bound target part;
- rejects stale package/source/generation evidence;
- verifies MIDI against the supplied MusicXML-compatible pitch;
- fails closed for simultaneous target-part pitches;
- returns explicit unavailable states for rests/empty beats and unsupported pitches;
- never creates a playback clock.

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

Audio remains owned by `st-score-audio-engine`; this repository never duplicates the violin sound engine. Scheduled violin score playback is a separate VIOLIN-03 concern.

## Development

```bash
npm test
```
