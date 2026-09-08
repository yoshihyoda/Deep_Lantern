import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  createSwimSurface,
  swimDisplacement,
  SWIM_CLEARANCE,
  SWIM_CEILING,
  SWIM_SPEED,
} from '../lib/abyss/swim-motion';
import { renderedSurfaceHeight, unproject } from '../lib/abyss/map-interaction';
import { project } from '../lib/abyss/science';
import type { Terrain } from '../lib/abyss/types';
const terrain: Terrain = JSON.parse(
  readFileSync(new URL('../public/data/terrain.json', import.meta.url), 'utf8'),
);
const input = { forward: 1, right: 0, up: 0, boost: false };
const length = (p: { x: number; y: number; z: number }) =>
  Math.hypot(p.x, p.y, p.z);
const near = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-8, `${a} ≈ ${b}`);
void test('swimming follows the view, strafes horizontally, normalizes diagonal speed and boosts', () => {
  const direction = { x: 0, y: -0.6, z: -0.8 };
  const forward = swimDisplacement(direction, input, 0.02);
  near(forward.y, -0.6 * SWIM_SPEED * 0.02);
  near(forward.z, -0.8 * SWIM_SPEED * 0.02);
  const strafe = swimDisplacement(
    direction,
    { ...input, forward: 0, right: 1 },
    0.02,
  );
  near(strafe.x, SWIM_SPEED * 0.02);
  assert.equal(strafe.y, 0);
  const diagonal = swimDisplacement(direction, { ...input, right: 1 }, 0.02);
  near(length(diagonal), length(forward));
  near(
    length(swimDisplacement(direction, { ...input, boost: true }, 0.02)),
    length(forward) * 3,
  );
  assert.deepEqual(
    swimDisplacement(direction, { ...input, forward: 0 }, 0.02),
    { x: 0, y: 0, z: 0 },
  );
});
void test('swimming has equal travel at 30 and 120 fps and caps resume-time jumps', () => {
  const north = { x: 0, y: 0, z: -1 };
  near(
    swimDisplacement(north, input, 1 / 30).z * 30,
    swimDisplacement(north, input, 1 / 120).z * 120,
  );
  near(length(swimDisplacement(north, input, 10)), SWIM_SPEED * 0.05);
  assert.equal(length(swimDisplacement(north, input, -1)), 0);
});
void test('swimmer stays above GEBCO triangles, below the water surface and inside raster centers', () => {
  const surface = createSwimSurface(terrain),
    [x, z] = project(-170.3, -14.55);
  const start = surface.constrain({ x, y: -200, z });
  near(
    start.y,
    renderedSurfaceHeight(terrain, ...unproject(x, z))! + SWIM_CLEARANCE,
  );
  const up = surface.move(start, { x: 0, y: 100, z: 0 });
  near(up.y, SWIM_CEILING);
  const edge = surface.move(up, { x: 400, y: 0, z: 0 });
  const [lon, lat] = unproject(edge.x, edge.z);
  assert.ok(lon >= -171 && lon <= -169 && lat >= -15 && lat <= -14);
  assert.ok(
    edge.y >= renderedSurfaceHeight(terrain, lon, lat)! + SWIM_CLEARANCE - 1e-8,
  );
  assert.ok(edge.y <= SWIM_CEILING);
});
void test('land blocks swimming and a scripted camera above land recovers to real water', () => {
  // A full north/south land barrier separates two bodies of water.
  const barrier: Terrain = {
    ...terrain,
    bbox: [-170.02, -14.51, -169.98, -14.49],
    width: 5,
    height: 2,
    elevation: [
      -1000, -1000, 100, -1000, -1000, -1000, -1000, 100, -1000, -1000,
    ],
    tid: Array(10).fill(11),
  };
  const surface = createSwimSurface(barrier),
    [x, z] = project(-170.014, -14.5);
  const across = surface.move({ x, y: -3, z }, { x: 3, y: 0, z: 0 });
  assert.ok(across.x < 0, 'cannot pass through the land barrier');
  assert.ok(across.y <= SWIM_CEILING);
  const recovered = surface.constrain({ x: 0, y: 100, z: 0 });
  const h = renderedSurfaceHeight(
    barrier,
    ...unproject(recovered.x, recovered.z),
  )!;
  assert.ok(h + SWIM_CLEARANCE <= SWIM_CEILING);
  assert.ok(recovered.y <= SWIM_CEILING);
});
