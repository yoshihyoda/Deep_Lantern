import { project } from './science';
import { renderedSurfaceHeight, unproject } from './map-interaction';
import type { Terrain } from './types';

export type SwimVector = { x: number; y: number; z: number };
export const SWIM_CLEARANCE = 0.6;
export const SWIM_CEILING = -0.2;
// Display-world speed, not observed vehicle speed or real dive time.
export const SWIM_SPEED = 4.5;
export function swimDisplacement(
  forward: SwimVector,
  input: { forward: number; right: number; up: number; boost: boolean },
  seconds: number,
): SwimVector {
  const horizontal = Math.hypot(forward.x, forward.z) || 1;
  const x = forward.x * input.forward - (forward.z / horizontal) * input.right;
  const y = forward.y * input.forward + input.up;
  const z = forward.z * input.forward + (forward.x / horizontal) * input.right;
  const length = Math.hypot(x, y, z);
  const speed =
    SWIM_SPEED * (input.boost ? 3 : 1) * Math.max(0, Math.min(seconds, 0.05));
  const scale = length > 0 ? speed / Math.max(1, length) : 0;
  return { x: x * scale, y: y * scale, z: z * scale };
}

export function createSwimSurface(terrain: Terrain) {
  const [west, south, east, north] = terrain.bbox;
  const halfX = (east - west) / terrain.width / 2,
    halfZ = (north - south) / terrain.height / 2;
  const [minX, minZ] = project(west + halfX, north - halfZ);
  const [maxX, maxZ] = project(east - halfX, south + halfZ);
  const clamp = (n: number, a: number, b: number) =>
    Math.max(a, Math.min(b, n));
  const floor = (p: SwimVector) =>
    renderedSurfaceHeight(terrain, ...unproject(p.x, p.z));
  const water = (p: SwimVector) => {
    const h = floor(p);
    return h !== null && h + SWIM_CLEARANCE <= SWIM_CEILING;
  };
  function constrain(position: SwimVector): SwimVector {
    const p = {
      x: clamp(position.x, minX, maxX),
      y: position.y,
      z: clamp(position.z, minZ, maxZ),
    };
    // A scripted camera can arrive from above land. Recover to the nearest real water pixel.
    if (!water(p)) {
      let nearest = Infinity;
      for (let i = 0; i < terrain.elevation.length; i++) {
        if (terrain.elevation[i] * 0.006 + SWIM_CLEARANCE > SWIM_CEILING)
          continue;
        const [x, z] = project(
          west + (((i % terrain.width) + 0.5) * (east - west)) / terrain.width,
          north -
            ((Math.floor(i / terrain.width) + 0.5) * (north - south)) /
              terrain.height,
        );
        const d = (x - position.x) ** 2 + (z - position.z) ** 2;
        if (d < nearest) {
          nearest = d;
          p.x = x;
          p.z = z;
        }
      }
    }
    const h = floor(p);
    if (h !== null) p.y = clamp(p.y, h + SWIM_CLEARANCE, SWIM_CEILING);
    return p;
  }
  function move(position: SwimVector, displacement: SwimVector): SwimVector {
    let p = { ...position };
    // Less than half a source raster pixel per step, including boosted movement.
    const stepSize = Math.min(
      0.15,
      (maxX - minX) / Math.max(1, terrain.width - 1) / 2,
      (maxZ - minZ) / Math.max(1, terrain.height - 1) / 2,
    );
    const steps = Math.max(
      1,
      Math.ceil(
        Math.hypot(displacement.x, displacement.y, displacement.z) /
          Math.max(0.01, stepSize),
      ),
    );
    const delta = {
      x: displacement.x / steps,
      y: displacement.y / steps,
      z: displacement.z / steps,
    };
    for (let i = 0; i < steps; i++) {
      const next = {
        x: clamp(p.x + delta.x, minX, maxX),
        y: p.y + delta.y,
        z: clamp(p.z + delta.z, minZ, maxZ),
      };
      if (!water(next)) {
        // Slide along a coast rather than climbing onto dry land.
        const alongX = { ...next, z: p.z },
          alongZ = { ...next, x: p.x };
        if (water(alongX)) {
          next.z = p.z;
        } else if (water(alongZ)) {
          next.x = p.x;
        } else {
          next.x = p.x;
          next.z = p.z;
        }
      }
      const h = floor(next);
      if (h !== null) next.y = clamp(next.y, h + SWIM_CLEARANCE, SWIM_CEILING);
      p = next;
    }
    return p;
  }
  return { constrain, move };
}
