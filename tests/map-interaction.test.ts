import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  pathPosition,
  preparePath,
  sampleTerrain,
  renderedSurfaceHeight,
  unproject,
} from '../lib/abyss/map-interaction';
import { project } from '../lib/abyss/science';
import type { Terrain, Track } from '../lib/abyss/types';

const terrain: Terrain = JSON.parse(
  readFileSync(new URL('../public/data/terrain.json', import.meta.url), 'utf8'),
);
const tracks: Track[] = JSON.parse(
  readFileSync(
    new URL(
      '../public/data/snapshot/noaa/tracks_bbox.geojson',
      import.meta.url,
    ),
    'utf8',
  ),
).features;

void test('map picking recovers geographic coordinates without using exaggerated height', () => {
  for (const [lon, lat] of [
    [-171, -14],
    [-169, -15],
    [-170.43, -14.26],
  ]) {
    const actual = unproject(...project(lon, lat));
    assert.ok(Math.abs(actual[0] - lon) < 1e-10);
    assert.ok(Math.abs(actual[1] - lat) < 1e-10);
  }
});

void test('inspection reads the original GEBCO north-to-south grid and categorical source', () => {
  for (const [lon, lat, elevation, tid] of [
    [-171, -14, -4013, 11],
    [-169, -15, -5049, 40],
    [-170, -14.5, -1069, 11],
  ]) {
    const s = sampleTerrain(terrain, lon, lat);
    assert.equal(s?.elevation, elevation);
    assert.equal(s?.tid, tid);
  }
  assert.equal(sampleTerrain(terrain, -172, -14.5), null);
  assert.equal(sampleTerrain(terrain, NaN, -14.5), null);
  const land = { ...terrain, width: 1, height: 1, elevation: [30], tid: [11] };
  assert.equal(sampleTerrain(land, -170, -14.5)?.provenance, 'land');
});

void test('replay preserves full NOAA path lengths and exact start/end positions', () => {
  const lengths = [
    0.909446013803, 10.506525147133, 20.013072445712, 7.96161218519,
  ];
  tracks.forEach((track, i) => {
    const path = preparePath(track.geometry.coordinates);
    assert.ok(Math.abs(path.totalKm - lengths[i]) < 1e-8);
    assert.deepEqual(pathPosition(path, 0), track.geometry.coordinates[0]);
    assert.deepEqual(pathPosition(path, 1), track.geometry.coordinates.at(-1));
    assert.ok(
      path.cumulative.every((km, i) => i === 0 || km >= path.cumulative[i - 1]),
    );
  });
});

void test('replay advances by distance, handles duplicate points and empty tracks', () => {
  const path = preparePath([
    [0, 0],
    [1, 0],
    [1, 0],
    [4, 0],
  ]);
  const middle = pathPosition(path, 0.5)!;
  assert.ok(Math.abs(middle[0] - 2) < 1e-8);
  assert.equal(middle[1], 0);
  assert.deepEqual(pathPosition(path, -1), [0, 0]);
  assert.deepEqual(pathPosition(path, 2), [4, 0]);
  assert.equal(pathPosition(preparePath([]), 0.5), null);
  assert.deepEqual(
    pathPosition(
      preparePath([
        [1, 2],
        [1, 2],
      ]),
      0.5,
    ),
    [1, 2],
  );
});

void test('camera clearance follows the rendered triangle diagonal, not bilinear or nearest depth', () => {
  const mesh: Terrain = {
    ...terrain,
    bbox: [-171, -15, -169, -14],
    width: 2,
    height: 2,
    elevation: [-1000, -2000, -4000, -8000],
    tid: [11, 11, 11, 11],
  };
  // Vertex centers span longitude [-170.5,-169.5], latitude [-14.25,-14.75].
  const at = (u: number, v: number) =>
    renderedSurfaceHeight(mesh, -170.5 + u, -14.25 - v * 0.5)!;
  assert.equal(at(0, 0), -6);
  assert.equal(at(1, 1), -48);
  assert.equal(at(0.25, 0.25), -12);
  assert.equal(at(0.75, 0.75), -33);
  assert.equal(at(0.5, 0.5), -18);
  assert.ok(Math.abs(at(0.5, 0.5 - 1e-7) - at(0.5, 0.5 + 1e-7)) < 1e-5);
  assert.equal(renderedSurfaceHeight(mesh, -171, -14), -6);
  assert.equal(renderedSurfaceHeight(mesh, -169, -15), -48);
  assert.equal(renderedSurfaceHeight(mesh, -172, -14.5), null);
  assert.equal(renderedSurfaceHeight(mesh, NaN, -14.5), null);
  assert.equal(sampleTerrain(mesh, -170.25, -14.375)?.elevation, -1000);
});
