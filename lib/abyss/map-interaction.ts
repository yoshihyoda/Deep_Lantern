import { classifyTid, clamp, distance, EARTH_KM } from './science';
import type { Terrain } from './types';

export function unproject(x: number, z: number): [number, number] {
  const k = (EARTH_KM * Math.PI) / 180;
  return [x / (k * Math.cos((-14.5 * Math.PI) / 180)) - 170, -z / k - 14.5];
}

// Raster rows run north to south; positive elevation is land even when TID is not 0.
export function sampleTerrain(t: Terrain, lon: number, lat: number) {
  const [west, south, east, north] = t.bbox;
  if (
    !Number.isFinite(lon) ||
    !Number.isFinite(lat) ||
    lon < west ||
    lon > east ||
    lat < south ||
    lat > north
  )
    return null;
  const col = Math.min(
    t.width - 1,
    Math.floor(((lon - west) / (east - west)) * t.width),
  );
  const row = Math.min(
    t.height - 1,
    Math.floor(((north - lat) / (north - south)) * t.height),
  );
  const i = row * t.width + col;
  return {
    lon,
    lat,
    elevation: t.elevation[i],
    tid: t.tid[i],
    provenance: t.elevation[i] >= 0 ? ('land' as const) : classifyTid(t.tid[i]),
  };
}
export type TerrainSample = NonNullable<ReturnType<typeof sampleTerrain>>;

// Display-only collision surface, using the exact diagonal of the rendered mesh.
// Never use this interpolated, exaggerated value as an observed depth.
export function renderedSurfaceHeight(t: Terrain, lon: number, lat: number) {
  const [west, south, east, north] = t.bbox;
  if (
    !Number.isFinite(lon) ||
    !Number.isFinite(lat) ||
    lon < west ||
    lon > east ||
    lat < south ||
    lat > north
  )
    return null;
  const x = Math.max(
    0,
    Math.min(t.width - 1, ((lon - west) / (east - west)) * t.width - 0.5),
  );
  const z = Math.max(
    0,
    Math.min(t.height - 1, ((north - lat) / (north - south)) * t.height - 0.5),
  );
  const col = Math.min(t.width - 2, Math.floor(x)),
    row = Math.min(t.height - 2, Math.floor(z));
  if (col < 0 || row < 0) return t.elevation[0] * 0.006;
  const u = x - col,
    v = z - row,
    i = row * t.width + col;
  const a = t.elevation[i],
    b = t.elevation[i + 1],
    c = t.elevation[i + t.width],
    d = t.elevation[i + t.width + 1];
  return (
    (u + v <= 1
      ? a + (b - a) * u + (c - a) * v
      : d + (c - d) * (1 - u) + (b - d) * (1 - v)) * 0.006
  );
}

export function preparePath(coordinates: [number, number][]) {
  const cumulative = [0];
  for (let i = 1; i < coordinates.length; i++)
    cumulative.push(
      cumulative[i - 1] + distance(coordinates[i - 1], coordinates[i]),
    );
  return { coordinates, cumulative, totalKm: cumulative.at(-1) ?? 0 };
}

// Replay is distance along the supplied path, never elapsed survey time.
export function pathPosition(
  path: ReturnType<typeof preparePath>,
  fraction: number,
): [number, number] | null {
  if (!path.coordinates.length) return null;
  const km = path.totalKm * clamp(fraction);
  if (km === 0) return path.coordinates[0];
  let lo = 1,
    hi = path.cumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (path.cumulative[mid] < km) lo = mid + 1;
    else hi = mid;
  }
  const a = path.coordinates[lo - 1],
    b = path.coordinates[lo];
  const segment = path.cumulative[lo] - path.cumulative[lo - 1];
  const ratio = segment > 0 ? (km - path.cumulative[lo - 1]) / segment : 0;
  return [a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio];
}
