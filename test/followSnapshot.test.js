import test from "node:test";
import assert from "node:assert/strict";

import * as violin from "../src/index.js";

function resolve(input) {
  assert.equal(
    typeof violin.resolveViolinFollowSnapshot,
    "function",
    "resolveViolinFollowSnapshot export must exist",
  );
  return violin.resolveViolinFollowSnapshot(input);
}

const binding = Object.freeze({
  packageId: "pkg-123",
  sourceId: "pkg-123",
  generation: 7,
  targetPartId: "P1",
});

function snapshot(activeEvents, overrides = {}) {
  return Object.freeze({
    packageId: "pkg-123",
    sourceId: "pkg-123",
    generation: 7,
    playing: true,
    activeEvents,
    ...overrides,
  });
}

function event(overrides = {}) {
  return Object.freeze({
    eventId: "P1:3:1:2",
    partId: "P1",
    measureIndex: 3,
    midi: 66,
    pitch: Object.freeze({ step: "F", alter: 1, octave: 4 }),
    ...overrides,
  });
}

test("resolves exact F#4 event to D string high second finger", () => {
  const result = resolve({
    binding,
    snapshot: snapshot([event()]),
  });

  assert.equal(result.state, "AVAILABLE");
  assert.equal(result.eventId, "P1:3:1:2");
  assert.equal(result.playing, true);
  assert.equal(result.position, 1);
  assert.equal(result.primary.stringId, "D");
  assert.equal(result.primary.finger, 2);
  assert.equal(result.primary.placement, "HIGH");
  assert.ok(Math.abs(result.primary.distanceFromNutMm - 67.666) < 0.01);
});

test("rejects stale package source or generation", () => {
  for (const stale of [
    snapshot([event()], { packageId: "pkg-old" }),
    snapshot([event()], { sourceId: "source-old" }),
    snapshot([event()], { generation: 6 }),
  ]) {
    const result = resolve({ binding, snapshot: stale });
    assert.equal(result.state, "STALE_EVIDENCE");
    assert.equal(result.primary, null);
  }
});

test("returns no active note for rest/empty target-part events", () => {
  const result = resolve({
    binding,
    snapshot: snapshot([]),
  });

  assert.equal(result.state, "NO_ACTIVE_NOTE");
  assert.equal(result.primary, null);
});

test("fails closed for simultaneous target-part pitches", () => {
  const result = resolve({
    binding,
    snapshot: snapshot([
      event(),
      event({
        eventId: "P1:3:1:3",
        midi: 67,
        pitch: Object.freeze({ step: "G", octave: 4 }),
      }),
    ]),
  });

  assert.equal(result.state, "AMBIGUOUS_EVENT");
  assert.equal(result.primary, null);
});

test("ignores accompaniment events outside targetPartId", () => {
  const result = resolve({
    binding,
    snapshot: snapshot([
      event({ partId: "P2", eventId: "P2:3:1:2" }),
      event(),
    ]),
  });

  assert.equal(result.state, "AVAILABLE");
  assert.equal(result.eventId, "P1:3:1:2");
});

test("rejects midi and MusicXML pitch disagreement", () => {
  const result = resolve({
    binding,
    snapshot: snapshot([
      event({
        midi: 65,
        pitch: Object.freeze({ step: "F", alter: 1, octave: 4 }),
      }),
    ]),
  });

  assert.equal(result.state, "UNSUPPORTED_SCORE_MAPPING");
  assert.equal(result.primary, null);
});

test("returns outside first position without throwing", () => {
  const result = resolve({
    binding,
    snapshot: snapshot([
      event({
        eventId: "P1:3:1:9",
        midi: 96,
        pitch: Object.freeze({ step: "C", octave: 7 }),
      }),
    ]),
  });

  assert.equal(result.state, "OUTSIDE_FIRST_POSITION");
  assert.equal(result.primary, null);
});

test("preserves playing false on paused snapshot", () => {
  const result = resolve({
    binding,
    snapshot: snapshot([event()], { playing: false }),
  });

  assert.equal(result.state, "AVAILABLE");
  assert.equal(result.playing, false);
  assert.equal(result.primary.stringId, "D");
});

test("rejects invalid top-level binding shape", () => {
  assert.throws(
    () =>
      resolve({
        binding: { ...binding, targetPartId: "" },
        snapshot: snapshot([event()]),
      }),
    TypeError,
  );
});
