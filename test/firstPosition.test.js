import test from "node:test";
import assert from "node:assert/strict";

import {
  midiFromMusicXmlPitch,
  resolveFirstPositionMidi,
  resolveFirstPositionNote,
  stopDistanceFromNutMm,
} from "../src/index.js";

test("converts MusicXML-compatible F#4 pitch to MIDI 66", () => {
  assert.equal(
    midiFromMusicXmlPitch({ step: "F", alter: 1, octave: 4 }),
    66,
  );
});

test("maps F#4 to D string high second finger in first position", () => {
  const result = resolveFirstPositionNote({
    noteId: "m3-n2",
    pitch: { step: "F", alter: 1, octave: 4 },
  });

  assert.equal(result.supported, true);
  assert.equal(result.primary.stringId, "D");
  assert.equal(result.primary.finger, 2);
  assert.equal(result.primary.placement, "HIGH");
  assert.equal(result.primary.semitoneOffset, 4);
  assert.ok(Math.abs(result.primary.distanceFromNutMm - 67.666) < 0.01);
});

test("uses physical equal-tempered spacing instead of equal visual finger spacing", () => {
  const e4 = stopDistanceFromNutMm(2);
  const fs4 = stopDistanceFromNutMm(4);

  assert.ok(Math.abs(e4 - 35.785) < 0.01);
  assert.ok(Math.abs(fs4 - 67.666) < 0.01);
  assert.ok(Math.abs((fs4 - e4) - 31.881) < 0.01);
});

test("prefers an open string while preserving fourth-finger alternative", () => {
  const result = resolveFirstPositionMidi(62);

  assert.equal(result.primary.stringId, "D");
  assert.equal(result.primary.finger, 0);
  assert.equal(result.alternatives.length, 1);
  assert.equal(result.alternatives[0].stringId, "G");
  assert.equal(result.alternatives[0].finger, 4);
});

test("allows a teacher/host to prefer a valid alternative string", () => {
  const result = resolveFirstPositionMidi(62, { preferredStringId: "G" });

  assert.equal(result.primary.stringId, "G");
  assert.equal(result.primary.finger, 4);
  assert.equal(result.alternatives[0].stringId, "D");
});

test("maps chromatic beginner placements deterministically", () => {
  assert.deepEqual(
    [63, 64, 65, 66, 67, 68, 69].map((midi) => {
      const r = resolveFirstPositionMidi(midi, { preferredStringId: "D" });
      return [r.primary.finger, r.primary.placement];
    }),
    [
      [1, "LOW"],
      [1, "NORMAL"],
      [2, "LOW"],
      [2, "HIGH"],
      [3, "NORMAL"],
      [3, "HIGH"],
      [4, "NORMAL"],
    ],
  );
});

test("returns an explicit unsupported result outside first-position coverage", () => {
  const result = resolveFirstPositionMidi(40);

  assert.equal(result.supported, false);
  assert.equal(result.primary, null);
  assert.equal(result.reason, "OUTSIDE_FIRST_POSITION");
});

test("supports configurable violin string length", () => {
  const shortScale = stopDistanceFromNutMm(4, 320);
  const standard = stopDistanceFromNutMm(4, 328);

  assert.ok(shortScale < standard);
});
