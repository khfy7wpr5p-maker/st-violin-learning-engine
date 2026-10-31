# Architecture

## Purpose

The engine is a deterministic violin-learning domain layer. VIOLIN-01 converts a
trusted sounding pitch into first-position fingering information. VIOLIN-02 adds a
source-neutral follow snapshot contract so a host playback system can request the
fingering for its currently active trusted violin event without giving this engine
transport, rendering, or audio authority.

## Boundary

VIOLIN-01 input:

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

VIOLIN-01 output shape:

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
The host remains responsible for MusicXML safety, event identity, timing, repeats,
ties, transposition policy, target-part binding, and canonical sounding pitch.

## VIOLIN-02 follow snapshot contract

The host binds one package/source generation and one explicit violin target part:

```json
{
  "packageId": "pkg-123",
  "sourceId": "pkg-123",
  "generation": 7,
  "targetPartId": "P1",
  "stringLengthMm": 328
}
```

A playback snapshot supplies source-bound active events:

```json
{
  "packageId": "pkg-123",
  "sourceId": "pkg-123",
  "generation": 7,
  "playing": true,
  "activeEvents": [{
    "eventId": "P1:3:1:2",
    "partId": "P1",
    "measureIndex": 3,
    "midi": 66,
    "pitch": { "step": "F", "alter": 1, "octave": 4 }
  }]
}
```

`resolveViolinFollowSnapshot()` returns one of:

- `AVAILABLE`
- `NO_ACTIVE_NOTE`
- `OUTSIDE_FIRST_POSITION`
- `AMBIGUOUS_EVENT`
- `STALE_EVIDENCE`
- `UNSUPPORTED_SCORE_MAPPING`

The resolver filters to `targetPartId`, verifies pitch/MIDI agreement and then
delegates fingering to VIOLIN-01. More than one simultaneous pitched event in the
target part is ambiguous in V1 and fails closed. Events from accompaniment parts
are ignored.

The `playing` flag is presentation metadata only. This engine never advances
time and never starts a timer.

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

## Integration

```
trusted score / MusicXML
        |
        v
Student playback timeline  <--- single transport/time authority
        |
        +----------------------------+
        |                            |
        v                            v
st-score-audio-engine      st-violin-learning-engine
VIOLIN audition/sample     follow snapshot -> fingering
        |                            |
        +-------------+--------------+
                      v
                Student App
```

The shared synchronization key is the host-owned stable source event identity.
The engine also requires package/source/generation evidence so stale callbacks
cannot be mistaken for current fingering input.

## Explicit non-goals

- no Web Audio or samples
- no duplication of `st-score-audio-engine`
- no score transport or scheduler
- no score rendering
- no SVG/DOM pitch inference
- no target-part guessing
- no microphone/pitch detection
- no posture or bow analysis
- no position shifting
- no teacher-edit UI
- no automatic fingering optimization beyond first-position candidate ordering
- no scheduled violin score playback inside this domain engine; Student owns transport and integrates the separate audio engine

## Integration status — 2026-10-31

The first-position core and VIOLIN-02 follow snapshot are implemented on this
repository's `main`. [PR #3](https://github.com/khfy7wpr5p-maker/st-violin-learning-engine/pull/3)
merged the follow snapshot contract at `0ec3f3252111db10f9f381d22d29e57fa8cc2c6f`.

[Student architecture](https://github.com/khfy7wpr5p-maker/st-student-app/blob/main/docs/architecture.md)
records that exact vendored runtime revision, its provenance manifest,
`ViolinFollowCoordinator`, and `violinFingerboard` presentation. Student owns
source parsing, explicit target-part configuration, one `StudentPlaybackPort`
clock, rendering, accessibility, and static offline integration. This repository
continues to provide only source-neutral fingering and follow snapshots.

Recorded delivery status:

| Work | Record | Status |
| --- | --- | --- |
| Student follow integration | [SES-45](https://linear.app/seslitab/issue/SES-45) | Done |
| Student violin audio integration | [SES-69](https://linear.app/seslitab/issue/SES-69) | Done |
| Score-adjacent compact fingerboard | [SES-252](https://linear.app/seslitab/issue/SES-252) | Done |
| Synchronized multipart audio | [SES-250](https://linear.app/seslitab/issue/SES-250) | Done; explicit user PASS |
| Target violin follow and acceptance | [SES-251](https://linear.app/seslitab/issue/SES-251) | Done; explicit user PASS |
| Multipart parent work | [SES-247](https://linear.app/seslitab/issue/SES-247) | Done |

These are delivery and acceptance records, not a new runtime or device test run.
SES-247 explicitly keeps broader PWA/device/string-fret VoiceOver acceptance
separate under [SES-242](https://linear.app/seslitab/issue/SES-242); closure of the
violin tasks must not be treated as blanket acceptance of that separate work.

### Historical VIOLIN-02 design

[PR #2](https://github.com/khfy7wpr5p-maker/st-violin-learning-engine/pull/2)
contains the original specification and implementation plan. It was merged on
2026-10-31 into `onderozudogru/violin-01-first-position-core`, not `main`.
Its pending implementation checklists and future-tense integration descriptions
are historical planning evidence. They are not the current backlog and should
not be copied unchanged into the current architecture. The public contracts
above and the linked Student architecture describe the implemented boundaries.
