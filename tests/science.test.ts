import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  classifyTid,
  project,
  fractions,
  relief,
  visualGap,
  biologicalGap,
  boundaryScore,
  dataGapScore,
  candidates,
  distance,
  trackDistances,
  winners,
  makeBrief,
  buildGrid,
} from '../lib/abyss/science';
import { grid, executeTool, runDemo } from '../lib/abyss/tools';
import { sources, validSourceIds } from '../lib/abyss/registry';
import { readSSE } from '../lib/abyss/sse';
import { readJsonLimited } from '../lib/abyss/request';
import type { Terrain, Track, Coverage } from '../lib/abyss/types';
void test('TID follows supplied categorical mapping including code 44 and unrecognized codes', () => {
  assert.equal(classifyTid(11), 'direct');
  assert.equal(classifyTid(44), 'indirect');
  assert.equal(classifyTid(70), 'unknown');
  assert.equal(classifyTid(0), 'land');
  assert.equal(classifyTid(999), 'unknown');
});
void test('local projection center and cardinal directions', () => {
  assert.deepEqual(project(-170, -14.5), [0, -0]);
  assert.ok(project(-169, -14.5)[0] > 107);
  assert.ok(project(-170, -14)[1] < 0);
});
void test('provenance excludes all positive elevations, regardless of TID', () => {
  assert.deepEqual(fractions([11, 40, 70, 15], [100, -5, -5, -5]), {
    directFraction: 1 / 3,
    indirectFraction: 1 / 3,
    mixedUnknownFraction: 1 / 3,
  });
  assert.deepEqual(fractions([0], [10]), {
    directFraction: 0,
    indirectFraction: 0,
    mixedUnknownFraction: 0,
  });
});
void test('robust relief resists isolated extrema and handles empty cells', () => {
  assert.equal(relief([]), 0);
  assert.equal(relief([42, 42]), 0);
  assert.equal(relief([99999, ...Array<number>(100).fill(10)]), 0);
});
void test('gap normalizations remain bounded', () => {
  for (const n of [-10, 0, 1, 10000, 1e9]) {
    assert.ok(visualGap(n) >= 0 && visualGap(n) <= 1);
    assert.ok(biologicalGap(n) >= 0 && biologicalGap(n) <= 1);
  }
  assert.equal(visualGap(0), 1);
  assert.equal(visualGap(5), 0);
  assert.equal(biologicalGap(0), 1);
  assert.equal(biologicalGap(10000), 0);
});
void test('boundary endpoints and center are deterministic', () => {
  assert.equal(boundaryScore(0), 0);
  assert.equal(boundaryScore(0.5), 1);
  assert.equal(boundaryScore(1), 0);
});
void test('all 256 computed cells stay in bbox and meet metric invariants', () => {
  assert.equal(grid.length, 256);
  for (const g of grid) {
    assert.ok(g.centerLon > -171 && g.centerLon < -169);
    assert.ok(g.centerLat > -15 && g.centerLat < -14);
    assert.ok(
      Math.abs(
        g.directFraction + g.indirectFraction + g.mixedUnknownFraction - 1,
      ) < 1e-10,
    );
    assert.ok(dataGapScore(g) >= 0 && dataGapScore(g) <= 1);
    assert.ok(g.meanDepth > 0);
    assert.ok(validSourceIds(g.sourceIds));
  }
});
void test('candidate archetypes are unique and separated by at least 25 km', () => {
  const c = candidates(grid);
  assert.equal(c.length, 3);
  assert.deepEqual(
    c.map((c) => c.archetype),
    ['A', 'B', 'C'],
  );
  for (let i = 0; i < c.length; i++)
    for (let j = i + 1; j < c.length; j++)
      assert.ok(
        distance(
          [c[i].centerLon, c[i].centerLat],
          [c[j].centerLon, c[j].centerLat],
        ) >= 25,
      );
});
void test('depth constraints never relax and no frontier is invented', () => {
  for (const d of [4000, 4810, 5100, 11000]) {
    const c = candidates(grid, d);
    assert.ok(c.every((c) => c.meanDepth >= d));
    assert.ok(
      c
        .filter((c) => c.archetype === 'C')
        .every((c) => boundaryScore(c.directFraction) > 0),
    );
  }
  assert.deepEqual(candidates(grid, 11000), []);
});
void test('NOAA DIVE01 contributes no recorded path distance', async () => {
  const data = JSON.parse(
    await readFile('public/data/snapshot/noaa/tracks_bbox.geojson', 'utf8'),
  ) as { features: Track[] };
  const excluded = data.features.filter(
    (t) => t.properties.reached_bottom === false,
  );
  assert.equal(excluded.length, 1);
  assert.equal(
    trackDistances(excluded).reduce((a, b) => a + b, 0),
    0,
  );
  assert.ok(
    Math.abs(
      trackDistances(data.features).reduce((a, b) => a + b, 0) - 38.481209778,
    ) < 1e-6,
  );
});
void test('segment allocation preserves total length across grid boundaries', () => {
  const t = {
    properties: { reached_bottom: true },
    geometry: {
      coordinates: [
        [-170.99, -14.99],
        [-169.01, -14.01],
      ],
    },
  } as Track;
  assert.ok(
    Math.abs(
      trackDistances([t]).reduce((a, b) => a + b, 0) -
        distance(t.geometry.coordinates[0], t.geometry.coordinates[1]),
    ) < 1e-9,
  );
});
void test('fine OBIS aggregation preserves all records and is reproducible', async () => {
  const terrain = JSON.parse(
      await readFile('public/data/terrain.json', 'utf8'),
    ) as Terrain,
    coverage = JSON.parse(
      await readFile(
        'public/data/snapshot/obis/coverage_geohash8_bbox.geojson',
        'utf8',
      ),
    ) as { features: Coverage[] };
  const computed = buildGrid(terrain, [], coverage.features);
  assert.equal(
    computed.reduce((a, b) => a + b.obisRecords, 0),
    323640,
  );
  assert.deepEqual(
    computed.map((c) => c.obisRecords),
    grid.map((c) => c.obisRecords),
  );
});
void test('missing optional datasets do not invent replacement observations', async () => {
  const terrain = JSON.parse(
    await readFile('public/data/terrain.json', 'utf8'),
  ) as Terrain;
  const c = buildGrid(terrain, [], []);
  assert.equal(c.length, 256);
  assert.ok(c.every((c) => c.rovTrackKm === 0 && c.obisRecords === 0));
});
void test('source registry preserves IDs, snapshot status and mixed licenses', () => {
  assert.deepEqual(
    sources.map((s) => s.id),
    ['gebco', 'noaa', 'obis'],
  );
  assert.ok(
    sources.every(
      (s) =>
        s.status === 'snapshot' &&
        s.sourceUrl.startsWith('https://') &&
        s.attribution,
    ),
  );
  assert.ok(sources.find((s) => s.id === 'obis')?.license.includes('CC-BY-NC'));
  assert.equal(validSourceIds(['invented']), false);
});
void test('brief evidence citations all resolve and caveats persist', () => {
  const b = makeBrief(candidates(grid)[0]);
  assert.ok(validSourceIds(b.evidenceSources));
  assert.ok(
    [...b.known, ...b.dataGaps, ...b.whyExplore].every((s) =>
      validSourceIds(s.sourceIds),
    ),
  );
  assert.ok(b.caveats.some((s) => s.includes('DIVE01')));
});
void test('winner handles no votes and ties without inventing a winner', () => {
  assert.deepEqual(winners({ a: 0, b: 0 }), []);
  assert.deepEqual(winners({ a: 60, b: 60 }), ['a', 'b']);
  assert.deepEqual(winners({ a: 60, b: 120 }), ['b']);
});
void test('Astra tools validate arguments and never accept invented candidate coordinates', () => {
  const ctx = { minDepth: 2000, selectedId: null };
  assert.throws(() => executeTool('set_truth_level', { level: 101 }, ctx));
  assert.throws(() =>
    executeTool('focus_camera', { candidateId: 'cell-99-99' }, ctx),
  );
  assert.throws(() => executeTool('made_up' as never, {}, ctx));
  assert.equal(
    executeTool('set_layers', { rov: true }, ctx).events[0].type,
    'layers',
  );
});
void test('all four offline demo flows manipulate state through tools', () => {
  for (const intent of ['direct', 'rov', 'discover', 'brief'] as const) {
    const r = runDemo(intent, { minDepth: 2000, selectedId: null });
    assert.ok(r.calls.length > 0);
    assert.ok(r.events.length > 0);
  }
  assert.ok(
    runDemo('discover', { minDepth: 11000, selectedId: null }).text.startsWith(
      'No eligible candidates',
    ),
  );
});
void test('SSE handles arbitrary UTF8 chunk boundaries and multiline data', async () => {
  const bytes = new TextEncoder().encode(
    'event: delta\r\ndata: {"text":"海底"}\r\n\r\ndata: [DONE]\r\n\r\n',
  );
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      for (const b of bytes) c.enqueue(new Uint8Array([b]));
      c.close();
    },
  });
  const events = [];
  for await (const e of readSSE(stream)) events.push(e);
  assert.deepEqual(events, [{ text: '海底' }]);
});
void test('SSE early stop cancels upstream reader', async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode('data: {"x":1}\n\n'));
    },
    cancel() {
      cancelled = true;
    },
  });
  for await (const _e of readSSE(stream)) break;
  assert.ok(cancelled);
});
void test('request byte limit works without Content-Length', async () => {
  const req = new Request('https://example.test', {
    method: 'POST',
    body: JSON.stringify({ x: 'a'.repeat(100) }),
  });
  await assert.rejects(readJsonLimited(req, 10));
  assert.deepEqual(
    await readJsonLimited(
      new Request('https://example.test', { method: 'POST', body: '{"x":1}' }),
    ),
    { x: 1 },
  );
});
