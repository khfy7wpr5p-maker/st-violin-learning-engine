# VIOLIN-02 Student Playback + Fingering Synchronization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the trusted currently-playing violin note on a physically scaled first-position fingerboard in Student App while preserving StudentPlaybackPort as the single transport clock.

**Architecture:** Deliver VIOLIN-02 in two dependent PRs. PR A extends `st-violin-learning-engine` with a source-neutral active-event-to-fingering snapshot contract. After PR A is merged and pinned, PR B vendors that exact runtime into `st-student-app`, enriches exact score-follow events with trusted pitch identity, adds a separate ViolinFollowCoordinator subscribed to the existing Student playback position stream, and renders a read-only accessible fingerboard. `st-score-audio-engine` is read-only in VIOLIN-02; scheduled violin audio remains VIOLIN-03.

**Tech Stack:** JavaScript ES modules, Node.js 20 `node:test`, MusicXML source parsing already present in Student App, browser DOM/SVG, existing Student App Playwright browser suite.

**Spec:** `docs/superpowers/specs/2026-09-27-violin-02-student-playback-sync-design.md`

## Global Constraints

- Exactly one semantic playback clock: existing Student App `StudentPlaybackPort` / playback engine.
- No second timer, interval, requestAnimationFrame loop, or audio-engine clock may become timing authority.
- `st-score-audio-engine` receives no VIOLIN-02 production change.
- Repeated `audition()` calls must not be used as a score transport implementation.
- Pitch must come from trusted MusicXML/source semantics, never renderer DOM/SVG geometry.
- Violin target part must be explicit; no clef, display-name, pitch-range, or visual guessing.
- First-position fingering authority remains VIOLIN-01.
- Default vibrating string length remains 328 mm and is host-configurable.
- Fingerboard placement must use `normalizedPosition` / physical stop ratio, never equally spaced semitone markers.
- Rests clear fingering; outside-first-position notes return explicit unavailable state.
- Simultaneous pitched events in the target violin part fail closed as `AMBIGUOUS_EVENT`.
- Accompaniment parts must never become violin fingering input.
- Stale package/source/generation evidence must not update UI.
- Fingering/UI failure must not stop playback, change score state, or alter teacher-approved source.
- Private Practice Package data remains outside Cache Storage.
- No new Render service/domain.
- Physical iPhone/Safari/VoiceOver remains a release gate after repository verification.
- VIOLIN-01 must be merged before PR B pins the violin-learning runtime.

## Delivery / Branch Structure

### PR A — st-violin-learning-engine
Base: VIOLIN-01 merged `main`  
Purpose: publish the stable VIOLIN-02 follow-snapshot domain seam.

### PR B — st-student-app
Base: fresh Student `main` after SES-27  
Purpose: exact-source event enrichment, violin follow coordinator, fingerboard UI, offline/static integration, browser verification.

Do not combine PR A and PR B into one cross-repository write surface. PR B starts only after PR A is merged and an exact violin-engine commit is available to pin.

## Review Focus

1. **Enharmonic/source mismatch:** event `midi` and MusicXML `pitch` disagree -> fail closed as `UNSUPPORTED_SCORE_MAPPING`, never show a plausible but wrong finger.
2. **Boundary beats:** position exactly at note onset/end or measure end -> exactly one deterministic active-event result; no stale note lingers.
3. **Target-part polyphony:** two simultaneous pitches in the selected violin part -> `AMBIGUOUS_EVENT`; never choose highest/first note.
4. **Package switch during async UI update:** old generation resolves after a new package binds -> old result cannot update the fingerboard.
5. **Offline shell update:** new violin runtime/UI modules absent from network -> installed shell still loads them from cache without caching private package data.

---

## PR A — st-violin-learning-engine

### Task 1: Add the source-neutral violin follow snapshot contract

**Files:**
- Create: `src/followSnapshot.js`
- Modify: `src/index.js`
- Create: `test/followSnapshot.test.js`
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`

**Interfaces:**
- Consumes:
  - `resolveFirstPositionNote(note, options)`
  - `midiFromMusicXmlPitch(pitch)`
- Produces:
  - `VIOLIN_FOLLOW_STATES`
  - `resolveViolinFollowSnapshot({ binding, snapshot, preferredStringId? })`

Binding contract:

```js
{
  packageId: string,
  sourceId: string,
  generation: number,
  targetPartId: string,
  stringLengthMm?: number
}
```

Snapshot contract:

```js
{
  packageId: string,
  sourceId: string,
  generation: number,
  playing: boolean,
  activeEvents: [
    {
      eventId: string,
      partId: string,
      measureIndex: number,
      midi: number,
      pitch: { step: string, alter?: number, octave: number }
    }
  ]
}
```

Result states:
- `AVAILABLE`
- `NO_ACTIVE_NOTE`
- `OUTSIDE_FIRST_POSITION`
- `AMBIGUOUS_EVENT`
- `STALE_EVIDENCE`
- `UNSUPPORTED_SCORE_MAPPING`

When `AVAILABLE`, result carries `eventId`, `playing`, `position: 1`, `primary`, and `alternatives` from VIOLIN-01.

- [ ] **Step 1: Write failing contract tests**

Add tests named:

```js
test("resolves exact F#4 event to D string high second finger", ...)
test("rejects stale package source or generation", ...)
test("returns no active note for rest/empty target-part events", ...)
test("fails closed for simultaneous target-part pitches", ...)
test("ignores accompaniment events outside targetPartId", ...)
test("rejects midi and MusicXML pitch disagreement", ...)
test("returns outside first position without throwing", ...)
test("preserves playing false on paused snapshot", ...)
```

Pin F#4 expected values to:
- MIDI 66
- D string
- finger 2
- placement `HIGH`
- default 328 mm physical distance about 67.666 mm.

- [ ] **Step 2: Run the new test file and verify RED**

Run:

```bash
node --test test/followSnapshot.test.js
```

Expected: FAIL because `followSnapshot.js` / public exports do not exist.

- [ ] **Step 3: Implement the minimal resolver**

Implement:

```js
export function resolveViolinFollowSnapshot({
  binding,
  snapshot,
  preferredStringId = null,
} = {})
```

Rules:
- validate bounded non-empty identities;
- compare `packageId + sourceId + generation` before reading events;
- filter only `binding.targetPartId`;
- zero pitched target events -> `NO_ACTIVE_NOTE`;
- more than one target event -> `AMBIGUOUS_EVENT`;
- require integer MIDI 0..127 and a valid MusicXML pitch object;
- require `midiFromMusicXmlPitch(event.pitch) === event.midi`;
- call `resolveFirstPositionNote({ noteId: event.eventId, pitch: event.pitch }, { stringLengthMm, preferredStringId })`;
- translate unsupported first position to `OUTSIDE_FIRST_POSITION`;
- freeze public results;
- never throw for ordinary unsupported musical input; reserve TypeError/RangeError only for programmer-invalid top-level API shape if consistent with existing repo conventions.

- [ ] **Step 4: Run focused and full engine tests**

Run:

```bash
node --test test/followSnapshot.test.js
npm test
```

Expected: all tests PASS, zero failures.

- [ ] **Step 5: Update public docs and architecture**

Document:
- active-event snapshot contract;
- stale-evidence semantics;
- target-part filtering;
- explicit polyphony fail-closed rule;
- Student App is host/clock authority;
- VIOLIN-03 owns future scheduled violin audio.

- [ ] **Step 6: Commit Task 1**

```bash
git add src/followSnapshot.js src/index.js test/followSnapshot.test.js README.md docs/ARCHITECTURE.md
git commit -m "VIOLIN-02: add follow snapshot contract"
```

- [ ] **Step 7: Open PR A and stop for review/merge gate**

PR must contain:
- exact test output;
- exact head SHA;
- no Student App changes;
- no Audio Engine changes;
- no deploy/Render action.

Do not start PR B until PR A is merged and its exact `main` SHA is recorded.

---

## PR B — st-student-app

### Task 2: Pin the exact violin-learning runtime in Student App

**Files:**
- Create: `vendor/st-violin-learning/runtime-manifest.json`
- Create: `vendor/st-violin-learning/src/firstPosition.js`
- Create: `vendor/st-violin-learning/src/followSnapshot.js`
- Create: `vendor/st-violin-learning/src/index.js`
- Create: `test/violinLearningRuntimeAssets.test.js`
- Modify: `docs/architecture.md`

**Interfaces:**
- Consumes: exact merged PR A source files.
- Produces: same-origin static import surface `./vendor/st-violin-learning/src/index.js`.

Manifest minimum fields:
- source repository;
- exact source commit SHA;
- contract label `VIOLIN-02`;
- file paths;
- SHA-256;
- byte lengths.

- [ ] **Step 1: Write failing provenance tests**

Tests must prove:
- manifest source SHA is non-empty exact 40-hex;
- every listed asset exists;
- SHA-256 and byte length match;
- no unlisted executable violin-learning module is imported by Student App.

- [ ] **Step 2: Run RED**

```bash
node --test test/violinLearningRuntimeAssets.test.js
```

Expected: FAIL because vendor runtime is absent.

- [ ] **Step 3: Copy exact merged PR A runtime files byte-for-byte and generate manifest**

No hand edits inside vendored source. Any engine fix goes back to `st-violin-learning-engine`, is reviewed/merged there, then repinned here.

- [ ] **Step 4: Run focused test**

```bash
node --test test/violinLearningRuntimeAssets.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add vendor/st-violin-learning test/violinLearningRuntimeAssets.test.js docs/architecture.md
git commit -m "STUDENT: pin VIOLIN-02 learning runtime"
```

### Task 3: Enrich exact ScoreFollowIndex events with trusted pitch identity

**Files:**
- Modify: `src/practice/scoreFollowIndex.js`
- Modify: `test/scoreFollowIndex.test.js`

**Interfaces:**
- Consumes: exact-source MusicXML already parsed by `createScoreFollowIndex`.
- Produces: `resolveBeat(beat).activeEvents` when `eventMapping === "EXACT"`.

Each active event:

```js
{
  eventId,
  partId,
  measureIndex,
  midi,
  pitch: { step, alter, octave }
}
```

`eventId` must be source-traversal deterministic from:
`partId + measureIndex + voice + noteIndex`.
It must not depend on DOM/SVG IDs.

- [ ] **Step 1: Write failing exact-event tests**

Add tests proving:
- F#4 produces MIDI 66 and `{step:"F", alter:1, octave:4}`;
- rest produces no active event;
- chord members appear as distinct simultaneous active events;
- accompaniment part events retain their own `partId`;
- beat exactly at note end excludes the ended note;
- malformed/microtonal/non-integer pitch makes event mapping unavailable rather than inventing pitch;
- existing highlight refs remain unchanged.

- [ ] **Step 2: Run RED**

```bash
node --test test/scoreFollowIndex.test.js
```

Expected: FAIL on missing `activeEvents` / pitch fields.

- [ ] **Step 3: Implement source pitch parsing inside score-follow indexing**

Add focused helpers for MusicXML `step/alter/octave` and MIDI conversion. Keep them source-based and independent of renderer geometry.

When exact event pitch cannot be proven, preserve exact measure mapping but set event mapping unavailable per existing fail-closed architecture.

- [ ] **Step 4: Run focused and related tests**

```bash
node --test test/scoreFollowIndex.test.js test/scoreFollowCoordinator.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add src/practice/scoreFollowIndex.js test/scoreFollowIndex.test.js
git commit -m "STUDENT: expose exact active score events"
```

### Task 4: Add ViolinFollowCoordinator on the existing playback position stream

**Files:**
- Create: `src/practice/violinFollowCoordinator.js`
- Create: `test/violinFollowCoordinator.test.js`

**Interfaces:**
- Consumes:
  - `playbackPort.getScoreFollowPlaybackContextForPackage(pkg)`
  - `playbackPort.subscribePositionForPackage(pkg, listener)`
  - `createScoreFollowIndex(...)`
  - vendored `resolveViolinFollowSnapshot(...)`
  - presentation port:
    - `show(snapshot) -> boolean|Promise<boolean>`
    - `clear() -> boolean|Promise<boolean>`
- Produces:
  - `createViolinFollowCoordinator({ playbackPort, presentationPort, createIndex?, resolveSnapshot? })`
  - methods `bind({ pkg, sourceId, musicXml, targetPartId, stringLengthMm? }) -> boolean`, `clear()`, `dispose()`.

- [ ] **Step 1: Write failing coordinator tests**

Tests:
- binds only exact current package/source;
- consumes the same playback position snapshots; creates no timers;
- F# beat -> presentation gets D/high-2 snapshot;
- pause snapshot keeps current fingering with `playing:false`;
- empty/rest beat clears presentation;
- seek/new generation invalidates old update;
- ambiguous target-part chord clears/fail-closes;
- accompaniment-only active events clear;
- presentation exception never propagates into playback;
- unsubscribe occurs on clear/dispose/package switch.

- [ ] **Step 2: Run RED**

```bash
node --test test/violinFollowCoordinator.test.js
```

Expected: FAIL because coordinator does not exist.

- [ ] **Step 3: Implement coordinator without adding any clock**

The coordinator may react only to `subscribePositionForPackage` callbacks. It must not call `setInterval`, `setTimeout`, `requestAnimationFrame`, or audio APIs.

Use a monotonically changing local binding generation to reject stale async presentation completions, mirroring the bounded lifecycle style of `ScoreFollowCoordinator`.

- [ ] **Step 4: Run focused tests**

```bash
node --test test/violinFollowCoordinator.test.js test/scoreFollowCoordinator.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add src/practice/violinFollowCoordinator.js test/violinFollowCoordinator.test.js
git commit -m "STUDENT: add violin follow coordinator"
```

### Task 5: Define the bounded Student violin configuration and honest capability

**Files:**
- Modify: `src/practice/practiceCapabilities.js`
- Modify: `test/practiceCapabilities.test.js`
- Modify: `src/practice/practiceWorkspace.js`
- Modify: `test/practiceWorkspace.test.js`

**Interfaces:**
- Consumes optional existing `pkg.content.violin` object.
- Produces a supported V1 interpretation only for:

```js
{
  schemaVersion: 1,
  targetPartId: string,
  position: 1,
  stringLengthMm?: number
}
```

Rules:
- reject extra/unknown semantic fields for V1;
- `targetPartId` is required and bounded;
- `position` must equal 1;
- optional `stringLengthMm` must be finite and physically bounded for supported student instruments; use 250..400 mm;
- unknown legacy `content.violin` objects remain UNAVAILABLE;
- Student App does not guess a violin part.

- [ ] **Step 1: Write failing capability/projection tests**

Prove:
- valid exact descriptor becomes violin-capable only when playback/exact source prerequisites are present;
- unknown object stays UNAVAILABLE;
- missing target part stays UNAVAILABLE;
- position other than 1 stays UNAVAILABLE;
- invalid string length stays UNAVAILABLE;
- safe projected workspace exposes only required violin config, not raw package internals.

- [ ] **Step 2: Run RED**

```bash
node --test test/practiceCapabilities.test.js test/practiceWorkspace.test.js
```

- [ ] **Step 3: Implement the minimal validator/projection**

Do not change the Practice Package JSON Schema in this task; the schema already permits `content.violin` as object/null. This task defines the bounded Student consumer interpretation without granting new teacher mutation authority.

- [ ] **Step 4: Run focused tests**

```bash
node --test test/practiceCapabilities.test.js test/practiceWorkspace.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

```bash
git add src/practice/practiceCapabilities.js src/practice/practiceWorkspace.js test/practiceCapabilities.test.js test/practiceWorkspace.test.js
git commit -m "STUDENT: define first-position violin capability"
```

### Task 6: Render the physically scaled accessible fingerboard presentation

**Files:**
- Create: `src/ui/violinFingerboard.js`
- Create: `test/violinFingerboard.test.js`
- Modify: `src/ui/renderPracticeWorkspace.js`
- Modify: `test/renderPracticeWorkspace.test.js`
- Modify: `src/ui/styles.css` or the repository's existing Student stylesheet owning Practice Workspace styles.

**Interfaces:**
- Produces presentation port:
  - `createViolinFingerboardPresentation({ root })`
  - `show(snapshot)`
  - `clear()`
- Visual contract consumes `normalizedPosition` from the engine; it never recomputes equal-tempered pitch spacing.

- [ ] **Step 1: Write failing rendering tests**

Tests prove:
- valid AVAILABLE snapshot renders G/D/A/E strings and one active point on the correct D string;
- marker axis uses `normalizedPosition` directly;
- F#4 marker is not rendered at an equal 1/4 finger-grid position;
- open string renders at nut/open state without a fake stopped-finger dot;
- unavailable/ambiguous state clears active marker;
- semantic text contains note name/string/finger/placement data supplied by snapshot adapter;
- visual state is not color-only;
- no `aria-live` auto-announcement is added in V1, preventing rapid playback announcement spam;
- fingerboard section is absent when violin capability is UNAVAILABLE.

- [ ] **Step 2: Run RED**

```bash
node --test test/violinFingerboard.test.js test/renderPracticeWorkspace.test.js
```

- [ ] **Step 3: Implement minimal UI**

Use a small responsive SVG or equivalent static geometry:
- four labeled strings;
- nut/fingerboard axis;
- active marker;
- CSS positioning from clamped `normalizedPosition`.

Keep note/fingering text focus-readable and visible. Do not add a second playback control set.

- [ ] **Step 4: Run focused tests**

```bash
node --test test/violinFingerboard.test.js test/renderPracticeWorkspace.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit Task 6**

```bash
git add src/ui/violinFingerboard.js test/violinFingerboard.test.js src/ui/renderPracticeWorkspace.js test/renderPracticeWorkspace.test.js src/ui/styles.css
git commit -m "STUDENT: render first-position violin fingerboard"
```

### Task 7: Wire lifecycle, Piece Workspace, and offline shell

**Files:**
- Modify: `src/ui/main.js`
- Modify: `src/ui/mountStudentApp.js`
- Modify: `test/studentPieceWorkspaceMount.test.js`
- Modify: `test/practiceNotationLifecycle.test.js`
- Modify: `service-worker.js`
- Modify: `test/playbackOfflineAssets.test.js`
- Modify: `test/serviceWorkerRegistration.test.js`
- Modify: `test/staticShell.test.js`

**Interfaces:**
- Consumes Task 4 coordinator and Task 6 presentation port.
- Produces one lifecycle binding tied to the same current SCORE package/source as score follow.

- [ ] **Step 1: Write failing lifecycle/offline tests**

Prove:
- SCORE Practice/ Piece Workspace binds score follow and violin follow to the same source;
- switching to CHORDS/TAB or leaving practice clears violin presentation and unsubscribes;
- package change clears old fingering before new bind;
- notation failure does not stop playback and violin failure does not alter notation/playback;
- service worker shell includes violin coordinator/presentation and vendored runtime files;
- cache name increments from `st-student-shell-v17` to `st-student-shell-v18`;
- private Practice Package data is still not included in Cache Storage asset lists.

- [ ] **Step 2: Run RED**

```bash
node --test test/studentPieceWorkspaceMount.test.js test/practiceNotationLifecycle.test.js test/playbackOfflineAssets.test.js test/serviceWorkerRegistration.test.js test/staticShell.test.js
```

- [ ] **Step 3: Wire main + mount**

In `main.js`:
- import the vendored VIOLIN-02 resolver;
- create violin fingerboard presentation from the current app root;
- create ViolinFollowCoordinator with existing `playbackPort`.

In `mountStudentApp.js`:
- add independent `activeViolinFollowKey`;
- bind only when current practice violin capability is AVAILABLE and SCORE source is exact/current;
- clear before notation disposal, package/view switch, or destroy;
- never make violin bind success a prerequisite for score rendering or playback.

- [ ] **Step 4: Update static shell**

Add only static modules/runtime assets. Do not add package/MusicXML data to shell caches.

- [ ] **Step 5: Run focused lifecycle/offline tests**

Run the Step 2 command again. Expected: PASS.

- [ ] **Step 6: Commit Task 7**

```bash
git add src/ui/main.js src/ui/mountStudentApp.js service-worker.js test/studentPieceWorkspaceMount.test.js test/practiceNotationLifecycle.test.js test/playbackOfflineAssets.test.js test/serviceWorkerRegistration.test.js test/staticShell.test.js
git commit -m "STUDENT: wire violin follow lifecycle"
```

### Task 8: Browser behavior and regression gates

**Files:**
- Create: `browser-tests/violin-first-position-follow.spec.mjs`
- Modify: `browser-tests/support/student-app-e2e-bootstrap.mjs`
- Modify: `README.md`
- Modify: `docs/architecture.md`

**Interfaces:**
- Exercises the complete Student public behavior using the same browser bootstrap as existing score-follow tests.

- [ ] **Step 1: Add browser tests**

Required browser scenarios:
- simple D-E-F#-G etude: score highlight and fingerboard move from open/1/high-2/3 according to source timing;
- pause freezes visual fingering;
- restart returns to opening event;
- tempo change preserves event/fingering identity;
- measure tap replay uses same position stream;
- target-part rest clears marker;
- target-part chord fails closed without choosing a note;
- offline reload loads violin runtime/fingerboard modules from shell cache;
- no network request is needed for fingering computation after package is locally available.

- [ ] **Step 2: Run browser RED/GREEN through the task implementation cycle**

Focused:

```bash
node --test browser-tests/violin-first-position-follow.spec.mjs
```

Then full browser suite:

```bash
npm run test:browser
```

Expected: PASS.

- [ ] **Step 3: Run full repository verification**

```bash
npm test
npm run test:browser
```

Expected: zero failures.

- [ ] **Step 4: Boundary scan**

Confirm:
- no `st-score-audio-engine` write;
- no `audition()` transport loop;
- no new timer in violin follow code;
- no DOM/SVG pitch inference;
- no new Render URL/service;
- no private Practice Package/MusicXML entry in Cache Storage;
- vendored violin runtime matches exact PR A source SHA.

- [ ] **Step 5: Update docs**

Document:
- supported first-position scope;
- `content.violin` V1 consumer descriptor;
- exact pinned violin-learning engine SHA;
- offline assets;
- failure isolation;
- VIOLIN-03 remains future audio-scheduling work.

- [ ] **Step 6: Commit Task 8**

```bash
git add browser-tests/violin-first-position-follow.spec.mjs browser-tests/support/student-app-e2e-bootstrap.mjs README.md docs/architecture.md
git commit -m "STUDENT: verify violin first-position follow"
```

### Task 9: Exact-head review and physical-device gate handoff

**Files:**
- Create: `docs/superpowers/progress/2026-09-27-violin-02-student-playback-sync-progress.md`

**Interfaces:**
- Produces release evidence only; no new feature behavior.

- [ ] **Step 1: Run fresh exact-head CI**

Require GitHub Actions on the exact PR B head:
- Node tests PASS;
- browser Chromium PASS;
- browser WebKit PASS if existing workflow provides it.

Do not reuse earlier branch/main evidence.

- [ ] **Step 2: Request independent whole-branch review**

Review both axes:
- spec compliance;
- engineering quality.

Critical/Important findings are fixed with TDD before proceeding.

- [ ] **Step 3: Re-run full verification after review fixes**

```bash
npm test
npm run test:browser
```

Then require fresh exact-head CI again.

- [ ] **Step 4: Prepare physical iPhone/Safari/VoiceOver acceptance checklist**

Device checklist:
- load teacher-approved simple violin etude;
- playback note and fingerboard marker stay synchronized;
- F# shows D string / 2 / high-2 at physically scaled location;
- pause/restart/tempo/measure replay remain synchronized;
- VoiceOver can inspect semantic fingering text;
- no uncontrolled spoken update flood;
- offline reopen retains static violin follow runtime;
- existing notation/playback navigation still works.

Physical device acceptance is evidence supplied by the human/device test and must not be claimed from automated WebKit alone.

- [ ] **Step 5: Write progress report and stop before merge/deploy**

Report:

```text
COMPLETED: VIOLIN-02 Student Playback + Fingering Synchronization
RESULT: <PASS/PARTIAL/FAIL>
VERIFICATION: <unit/browser/CI/device evidence>
NOTION: <updated page>
LINEAR: SES-45 <status>
RENDER: UNCHANGED
BLOCKERS: <none/exact blocker>
NEXT: VIOLIN-03 scheduled violin audio design
NEXT START CONDITION: explicit human approval after VIOLIN-02 merge/device gate
```

Do not merge PR B or deploy without the explicit human gate required by the Student project workflow.

---

## Plan Self-Review Result

- Spec coverage: all 18 design sections map to Tasks 1–9 or Global Constraints.
- Type consistency: PR A output is the exact vendored API consumed by PR B.
- Timing authority: no task introduces a new clock.
- Audio boundary: VIOLIN-03 remains excluded.
- Target-part selection: explicit `content.violin.targetPartId`; no guessing.
- Polyphony: explicit fail-closed tests included.
- Stale evidence: engine contract and Student lifecycle both test it.
- Physical spacing: exact F#4 physical value and normalized-position UI tests included.
- Offline/privacy: static runtime only; private package cache invariant tested.
- Accessibility: focus-readable semantic state, no color-only meaning, no V1 live-announcement spam.
- Cross-repository risk: PR A must merge first; PR B pins exact SHA; no simultaneous cross-repo write surface.
- Merge/deploy: both remain explicit human gates.
