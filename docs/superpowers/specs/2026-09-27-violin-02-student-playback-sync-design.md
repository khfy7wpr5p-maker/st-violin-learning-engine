# VIOLIN-02 — Student Playback + Fingering Synchronization Design

Date: 2026-09-27  
Status: DESIGN APPROVED / WRITTEN SPEC REVIEW GATE  
Repository: `khfy7wpr5p-maker/st-violin-learning-engine`

## 1. Goal

Connect trusted Student App playback timing to first-position violin fingering presentation so that, while a teacher-approved score plays, the currently active note can be shown on a violin fingerboard with the correct string, finger, placement class, and physically scaled stop position.

VIOLIN-02 does not replace Student playback and does not implement violin audio transport. Violin audio scheduling is deferred to VIOLIN-03.

## 2. User-visible behavior

For a supported first-position note during playback:

1. the existing score-follow path may highlight the active score event;
2. VIOLIN-02 resolves the same trusted score event to a violin fingering;
3. the Student UI receives a bounded immutable fingering snapshot;
4. the fingerboard shows the active string and physical stop position;
5. pause, seek, restart, tempo changes, and one-measure replay update the fingering from the same Student playback position authority.

Example:

```text
Score event: F#4
Playback: active
Score: F# highlighted
Violin: D string / finger 2 / HIGH
Fingerboard: stop position derived from 328 mm string length
```

## 3. Existing authority boundaries

### Student App owns

- teacher-approved Practice Package consumption;
- PlaybackPlan resolution and validation;
- transport state;
- beat/time conversion;
- pause/resume/restart/tempo/repeat;
- playback position snapshots;
- score-follow source/provenance validation;
- renderer cursor/highlight presentation.

The existing `StudentPlaybackPort` and playback engine remain the timing and transport authority.

### st-violin-learning-engine owns

- pitch-to-first-position candidate mapping;
- default or teacher-preferred string choice when permitted;
- finger number;
- LOW / NORMAL / HIGH placement class;
- normalized and physical stop position.

It does not own transport, score rendering, audio, canonical source mutation, or MusicXML document parsing.

### st-score-audio-engine owns

- qualified sample instruments;
- VIOLIN sample selection;
- Web Audio note audition;
- audio lifecycle and sample provenance.

Its current public contract is note-audition oriented, not a score transport scheduler. VIOLIN-02 therefore does not use repeated `audition()` calls as the Student playback clock.

## 4. Required dependency state

VIOLIN-02 depends on:

- VIOLIN-01 first-position core from `st-violin-learning-engine`;
- Student App interactive score-follow foundation from SES-27;
- exact source/provenance rules already enforced by Student App.

VIOLIN-01 must be integrated before VIOLIN-02 production integration is merged.

## 5. Synchronization model

There is exactly one playback clock.

```text
MusicXML / trusted playback context
              |
              v
      StudentPlaybackPort
      TRANSPORT AUTHORITY
              |
        position snapshot
              |
      +-------+--------+
      |                |
      v                v
ScoreFollow       ViolinFollow
Coordinator       Coordinator
      |                |
      v                v
score cursor       fingering snapshot
/highlight         + fingerboard UI
```

No second timer, interval, requestAnimationFrame loop, or audio-engine clock may become semantic timing authority.

## 6. Violin follow input contract

The integration adapter must consume source-bound note/event information produced from the same trusted score/playback context used by score following.

Minimum logical input:

```json
{
  "packageId": "pkg-123",
  "sourceId": "pkg-123",
  "generation": 7,
  "beat": 12.5,
  "activeEvents": [
    {
      "eventId": "stable-source-event-id",
      "partId": "P1",
      "measureIndex": 3,
      "midi": 66,
      "pitch": { "step": "F", "alter": 1, "octave": 4 }
    }
  ]
}
```

The exact storage/API shape may differ, but these invariants are mandatory:

- event identity is source-bound and deterministic;
- pitch comes from trusted score semantics, not SVG/DOM geometry;
- stale package/source/generation evidence is rejected;
- rests produce no fingering;
- unsupported or ambiguous mapping fails closed.

VIOLIN-02 must not add renderer-derived pitch inference.

## 7. Output contract

For one supported active event:

```json
{
  "state": "AVAILABLE",
  "eventId": "stable-source-event-id",
  "position": 1,
  "primary": {
    "stringId": "D",
    "finger": 2,
    "placement": "HIGH",
    "normalizedPosition": 0.206299,
    "distanceFromNutMm": 67.666
  },
  "alternatives": []
}
```

Unavailable states must be explicit, for example:

- `NO_ACTIVE_NOTE`
- `OUTSIDE_FIRST_POSITION`
- `AMBIGUOUS_EVENT`
- `STALE_EVIDENCE`
- `UNSUPPORTED_SCORE_MAPPING`

Failure to resolve fingering must never stop score playback.

## 8. Polyphony policy

VIOLIN-02 is a beginner violin-learning feature. A single student violin line is the supported product target.

Policy:

- one active pitched event -> resolve normally;
- chord or simultaneous multiple pitched events in the target violin part -> `AMBIGUOUS_EVENT` unless a later explicit violin-voice policy is approved;
- simultaneous events in unrelated accompaniment parts must not be interpreted as violin fingerings;
- rests clear the active violin fingering;
- unsupported multi-staff/source traversal fails closed.

No heuristic "highest note" or "first note" selection is allowed.

## 9. Instrument/part selection

The host must explicitly identify which score part is the violin-learning target.

VIOLIN-02 must not guess the violin part from:

- staff position;
- part display name alone;
- clef;
- pitch range;
- DOM/SVG structure.

A trusted package/configuration field or deterministic host binding must select the target part.

## 10. Fingering policy

VIOLIN-01 remains the fingering authority.

For each trusted sounding pitch:

```text
pitch
  -> first-position candidates
  -> optional teacher-preferred string
  -> primary string/finger
  -> LOW/NORMAL/HIGH
  -> normalized physical stop position
```

The default 4/4 vibrating string length remains 328 mm and is host-configurable.

The fingerboard UI must use `normalizedPosition` or the corresponding physical ratio. It must not render finger markers at equal visual spacing.

## 11. Lifecycle behavior

### Play

The currently active trusted violin event is resolved and presented.

### Pause

The current fingering may remain visible, but it must be marked non-playing by the host presentation state. No new event may be inferred.

### Seek / restart

Previous fingering evidence is invalidated before resolving the new position.

### Tempo change

No fingering recomputation rule changes. Only Student playback timing changes.

### Measure replay

The same Student-owned range playback and position subscription drive fingering. No second measure timer exists.

### Package/source change

All violin-follow bindings are invalidated. Stale async results must not update the new package.

## 12. Failure isolation

The following must remain independent:

```text
playback failure        -> existing Student playback behavior
score highlight failure -> audio may continue
violin fingering failure-> playback + score follow may continue
violin UI failure       -> playback remains authoritative
```

A violin-learning presentation error must never mutate teacher-approved score data, PlaybackPlan, source identity, or Student transport state.

## 13. Offline and mobile requirements

VIOLIN-02 must preserve the current Student App offline model:

- private Practice Package data remains in its authorized local store;
- no raw private package is copied into static Cache Storage;
- only static violin-follow runtime modules may be included in the service-worker shell;
- no network dependency is required to compute first-position fingering once the score package is available locally.

iPhone/Safari remains a physical acceptance target.

## 14. Accessibility requirements

The visual fingerboard is supplemental, not the only representation.

For an active fingering the Student UI must be able to expose concise semantic text such as:

```text
Fa diyez. Re teli. İkinci parmak. Yüksek ikinci parmak.
```

Requirements:

- VoiceOver-readable state;
- no meaning conveyed by color alone;
- playback controls remain independently accessible;
- rapid playback updates must not create uncontrolled screen-reader announcement spam.

Exact announcement cadence belongs to Student UI design, not the fingering domain engine.

## 15. Repository responsibilities

### st-violin-learning-engine

VIOLIN-02 may add:

- a source-neutral active-event-to-fingering adapter/contract;
- stale-evidence-safe snapshot helpers if they are independent of Student App internals;
- tests for event-to-fingering behavior and fail-closed states;
- integration documentation.

It must not import Student App UI/runtime internals.

### st-student-app

A later separately authorized Student integration may add:

- violin target-part binding;
- violin-follow coordinator;
- adapter from exact Student score-follow evidence to the violin engine;
- fingerboard presentation;
- offline static module registration;
- unit/browser/device tests.

### st-score-audio-engine

No VIOLIN-02 production change is required.

VIOLIN-03 will separately design a transport-compatible scheduled violin-audio boundary. Existing `audition()` remains valid for note audition and must not be repurposed as the score clock.

## 16. Acceptance criteria

VIOLIN-02 is acceptable when fresh evidence proves:

1. F#4 in the selected violin part resolves to D string / finger 2 / HIGH.
2. physical position uses the equal-tempered stop ratio, not equal UI spacing.
3. playback position changes update the active fingering deterministically.
4. pause does not advance fingering.
5. seek/restart invalidates stale fingering before showing the new event.
6. tempo changes preserve event identity and fingering.
7. one-measure replay uses the existing Student playback clock.
8. rests clear the fingering.
9. outside-first-position notes return an explicit unavailable state.
10. ambiguous simultaneous violin pitches fail closed.
11. accompaniment notes do not become violin fingerings.
12. stale package/source/generation evidence cannot update the fingerboard.
13. fingering failure does not stop playback or mutate score state.
14. no pitch is inferred from renderer DOM/SVG geometry.
15. offline fingering works with a locally authorized Practice Package.
16. VoiceOver has a non-visual semantic representation.
17. existing Student score-follow/playback tests remain green.

## 17. Non-goals

VIOLIN-02 does not include:

- violin sample playback integration;
- microphone pitch detection;
- intonation scoring;
- posture/bow camera analysis;
- bow direction;
- shifting beyond first position;
- automatic advanced fingering optimization;
- teacher fingering editor UI;
- OMR;
- score mutation;
- new Render service/domain.

## 18. Next stage

After this written spec receives explicit human approval:

1. use Superpowers `writing-plans`;
2. write a dependency-ordered VIOLIN-02 implementation plan;
3. self-review the plan;
4. stop at the Human Plan Gate before production implementation.

VIOLIN-03 remains separate and will cover transport-compatible use of the already-qualified `st-score-audio-engine` VIOLIN samples.
