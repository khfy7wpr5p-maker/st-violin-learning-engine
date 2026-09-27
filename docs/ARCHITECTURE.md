# Architecture

## Purpose

VIOLIN-01 is a deterministic domain engine. It converts a trusted sounding pitch into
first-position violin fingering information without owning UI, rendering, audio, or
transport state.

## Boundary

Input:

```json
{
  "noteId": "m3-n2",
  "pitch": {
    "step": "F",
    "alter": 1,
    "octave": 4
  }
}
```

Output shape:

```json
{
  "noteId": "m3-n2",
  "pitch": { "step": "F", "alter": 1, "octave": 4, "midi": 66 },
  "supported": true,
  "position": 1,
  "primary": {
    "stringId": "D",
    "finger": 2,
    "placement": "HIGH",
    "semitoneOffset": 4,
    "normalizedPosition": 0.206299,
    "distanceFromNutMm": 67.666
  },
  "alternatives": []
}
```

The engine deliberately accepts the MusicXML pitch model rather than parsing XML.
The host remains responsible for MusicXML safety, note identity, timing, repeats,
ties, transposition policy, and canonical sounding pitch.

## First-position policy

Supported stopped-note offsets above each open string are 1..7 semitones:

| Offset | Finger | Placement |
|---:|---:|---|
| 0 | 0 | OPEN |
| 1 | 1 | LOW |
| 2 | 1 | NORMAL |
| 3 | 2 | LOW |
| 4 | 2 | HIGH |
| 5 | 3 | NORMAL |
| 6 | 3 | HIGH |
| 7 | 4 | NORMAL |

This is intentionally a beginner-oriented deterministic policy. Same-string
advanced alternatives are not inferred in VIOLIN-01. If the same sounding pitch
is playable on multiple strings, all valid first-position string candidates are
returned. Open strings are primary by default; a host/teacher may supply
`preferredStringId`.

## Physical coordinate policy

Fingerboard coordinates are derived from equal-tempered string shortening, not
from equally spaced UI markers:

```
normalized = 1 - 2^(-n/12)
distanceMm = stringLengthMm * normalized
```

The default vibrating string length is 328 mm. Hosts may provide a different
instrument measurement without changing pitch/fingering semantics.

## Integration target

```
trusted score / MusicXML
        |
        v
Student playback timeline
        |
        +----------------------------+
        |                            |
        v                            v
st-score-audio-engine      st-violin-learning-engine
VIOLIN audition            fingering + fingerboard data
        |                            |
        +-------------+--------------+
                      v
                Student App
```

The shared synchronization key should be the host-owned stable `noteId`.

## Explicit non-goals for VIOLIN-01

- no Web Audio or samples
- no duplication of `st-score-audio-engine`
- no score rendering
- no SVG/DOM pitch inference
- no microphone/pitch detection
- no posture or bow analysis
- no position shifting
- no teacher-edit UI
- no automatic fingering optimization beyond first-position candidate ordering
