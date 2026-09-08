'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { classifyTid, project } from '@/lib/abyss/science';
import type {
  Terrain,
  Track,
  Coverage,
  Candidate,
  Layers,
} from '@/lib/abyss/types';
type Props = {
  truth: number;
  layers: Layers;
  candidates: Candidate[];
  selected: string | null;
  focusKey: number;
  onSelect: (id: string) => void;
  onTrack: (t: Track) => void;
  onStatus: (s: string) => void;
};
export default function Ocean(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    live = useRef(props),
    api = useRef<{
      focus: (id: string | null) => void;
      reset: () => void;
      zoom: (f: number) => void;
    } | null>(null);
  useEffect(() => {
    live.current = props;
  }, [props]);
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false,
      frame = 0;
    const el = host.current!;
    let renderer: THREE.WebGLRenderer | undefined;
    const disposers: (() => void)[] = [];
    async function setup() {
      try {
        const terrainResponse = await fetch('/data/terrain.json');
        if (!terrainResponse.ok)
          throw Error(
            'Verified GEBCO terrain is unavailable. Reload to try again.',
          );
        const terrain: Terrain = await terrainResponse.json();
        if (disposed) return;
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.setClearColor(0x071522, 0);
        el.appendChild(renderer.domElement);
        renderer.domElement.setAttribute(
          'aria-label',
          'Interactive 3D GEBCO seafloor: drag to orbit, right-drag to pan, scroll to zoom',
        );
        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x071522, 0.0015);
        const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 1800);
        camera.position.set(105, 142, 175);
        const controls = new OrbitControls(camera, renderer.domElement);
        // Register immediately: navigation can happen while optional layers load.
        disposers.push(() => {
          controls.dispose();
          scene.traverse((o) => {
            const m = o as THREE.Mesh;
            m.geometry?.dispose();
            if (m.material) {
              const list = Array.isArray(m.material)
                ? m.material
                : [m.material];
              list.forEach((mat) => mat.dispose());
            }
          });
        });
        controls.target.set(0, -15, 0);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.minDistance = 12;
        controls.maxDistance = 600;
        controls.maxPolarAngle = Math.PI * 0.48;
        controls.update();
        scene.add(new THREE.HemisphereLight(0xc6ecf6, 0x071a2c, 2.1));
        const sun = new THREE.DirectionalLight(0xd5fff1, 2.8);
        sun.position.set(-90, 130, -60);
        scene.add(sun);
        const fill = new THREE.DirectionalLight(0x4982a8, 1.3);
        fill.position.set(70, 30, 100);
        scene.add(fill);
        const w = terrain.width,
          h = terrain.height,
          positions = new Float32Array(w * h * 3),
          colors = new Float32Array(w * h * 3),
          indices: number[][] = [[], [], [], []];
        const classes = ['direct', 'indirect', 'unknown', 'land'];
        const color = new THREE.Color();
        for (let r = 0; r < h; r++)
          for (let c = 0; c < w; c++) {
            const i = r * w + c,
              e = terrain.elevation[i],
              [x, z] = project(-171 + ((c + 0.5) / w) * 2, -14 - (r + 0.5) / h);
            positions.set([x, (e / 1000) * 6, z], i * 3);
            if (e >= 0) color.set('#80a58b');
            else
              color
                .set('#13405a')
                .lerp(
                  new THREE.Color('#70d8c1'),
                  Math.pow(Math.max(0, 1 + e / 5300), 0.8),
                );
            colors.set([color.r, color.g, color.b], i * 3);
            if (c < w - 1 && r < h - 1) {
              const k =
                e >= 0
                  ? 3
                  : Math.max(0, classes.indexOf(classifyTid(terrain.tid[i])));
              indices[k].push(i, i + w, i + 1, i + 1, i + w, i + w + 1);
            }
          }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          'position',
          new THREE.BufferAttribute(positions, 3),
        );
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setIndex(indices.flat());
        let offset = 0;
        indices.forEach((a, i) => {
          geometry.addGroup(offset, a.length, i);
          offset += a.length;
        });
        geometry.computeVertexNormals();
        const materials = classes.map(
          (_, i) =>
            new THREE.MeshStandardMaterial({
              vertexColors: true,
              roughness: 0.86,
              metalness: 0.06,
              transparent: i === 1 || i === 2,
              side: THREE.DoubleSide,
              flatShading: false,
            }),
        );
        const mesh = new THREE.Mesh(geometry, materials);
        scene.add(mesh);
        const height = (lon: number, lat: number) => {
          const c = Math.max(
              0,
              Math.min(w - 1, Math.floor(((lon + 171) / 2) * w)),
            ),
            r = Math.max(0, Math.min(h - 1, Math.floor((-14 - lat) * h)));
          return (terrain.elevation[r * w + c] / 1000) * 6;
        };
        const point = (lon: number, lat: number, lift = 0.3) => {
          const [x, z] = project(lon, lat);
          return new THREE.Vector3(x, height(lon, lat) + lift, z);
        };
        const rov = new THREE.Group(),
          obis = new THREE.Group(),
          grid = new THREE.Group(),
          markers = new THREE.Group();
        scene.add(rov, obis, grid, markers);
        const line = (pts: THREE.Vector3[], color: string, opacity = 1) =>
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(pts),
            new THREE.LineBasicMaterial({
              color,
              transparent: opacity < 1,
              opacity,
            }),
          );
        for (let n = 0; n <= 16; n++) {
          const a: THREE.Vector3[] = [],
            b: THREE.Vector3[] = [];
          for (let k = 0; k <= 160; k++) {
            a.push(point(-171 + n / 8, -14 - k / 160, 0.12));
            b.push(point(-171 + k / 80, -14 - n / 16, 0.12));
          }
          grid.add(line(a, '#74b0b8', 0.17), line(b, '#74b0b8', 0.17));
        }
        const base = new THREE.GridHelper(260, 26, 0x234251, 0x142f40);
        base.position.y = -34;
        scene.add(base);
        const boundary = [
          point(-171, -14),
          point(-169, -14),
          point(-169, -15),
          point(-171, -15),
          point(-171, -14),
        ];
        scene.add(line(boundary, '#497789', 0.6));
        let layerMessage = '';
        const results = await Promise.allSettled([
          fetch('/data/snapshot/noaa/tracks_bbox.geojson').then((r) => {
            if (!r.ok) throw Error();
            return r.json();
          }),
          fetch('/data/snapshot/obis/coverage_geohash5_bbox.geojson').then(
            (r) => {
              if (!r.ok) throw Error();
              return r.json();
            },
          ),
        ]);
        if (disposed) return;
        if (results[0].status === 'fulfilled') {
          for (const track of (results[0].value as { features: Track[] })
            .features) {
            const l = line(
              track.geometry.coordinates.map(([lon, lat]) =>
                point(lon, lat, 0.55),
              ),
              track.properties.reached_bottom ? '#76f8df' : '#ffbd77',
            );
            l.userData.track = track;
            rov.add(l);
            const start = track.geometry.coordinates[0];
            const dot = new THREE.Mesh(
              new THREE.SphereGeometry(0.8, 12, 8),
              new THREE.MeshBasicMaterial({
                color: track.properties.reached_bottom ? '#76f8df' : '#ffbd77',
              }),
            );
            dot.position.copy(point(...start, 0.65));
            dot.userData.track = track;
            rov.add(dot);
          }
        } else layerMessage += 'NOAA layer unavailable. ';
        if (results[1].status === 'fulfilled') {
          for (const f of (results[1].value as { features: Coverage[] })
            .features) {
            const ring = f.geometry.coordinates[0];
            const p = ring
              .slice(0, 4)
              .map(([lon, lat]) => point(lon, lat, 0.4));
            const geom = new THREE.BufferGeometry().setFromPoints([
              p[0],
              p[1],
              p[2],
              p[0],
              p[2],
              p[3],
            ]);
            geom.computeVertexNormals();
            const opacity =
              0.12 +
              (0.55 * Math.log1p(f.properties.occurrence_count)) /
                Math.log1p(60506);
            obis.add(
              new THREE.Mesh(
                geom,
                new THREE.MeshBasicMaterial({
                  color: '#b69bea',
                  transparent: true,
                  opacity,
                  side: THREE.DoubleSide,
                  depthWrite: false,
                }),
              ),
            );
          }
        } else layerMessage += 'OBIS layer unavailable.';
        live.current.onStatus(layerMessage || 'GEBCO 2026 · 115,200 cells');
        let markerKey = '',
          selectedKey = '',
          target: THREE.Vector3 | null = null,
          desired: THREE.Vector3 | null = null;
        const focus = (id: string | null) => {
          const c = live.current.candidates.find((c) => c.id === id);
          if (c) {
            target = point(c.centerLon, c.centerLat);
            desired = target.clone().add(new THREE.Vector3(35, 53, 62));
          } else {
            target = new THREE.Vector3(0, -15, 0);
            desired = new THREE.Vector3(105, 142, 175);
          }
        };
        api.current = {
          focus,
          reset: () => focus(null),
          zoom: (factor) => {
            camera.position
              .sub(controls.target)
              .multiplyScalar(factor)
              .add(controls.target);
            controls.update();
          },
        };
        const ray = new THREE.Raycaster();
        ray.params.Line = { threshold: 1.2 };
        let down = [0, 0];
        const pointerDown = (e: PointerEvent) => {
          down = [e.clientX, e.clientY];
          target = null;
          desired = null;
        };
        const click = (e: MouseEvent) => {
          if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
          const rect = el.getBoundingClientRect();
          ray.setFromCamera(
            new THREE.Vector2(
              ((e.clientX - rect.left) / rect.width) * 2 - 1,
              (-(e.clientY - rect.top) / rect.height) * 2 + 1,
            ),
            camera,
          );
          const hit = ray.intersectObjects(
            [...markers.children, ...(rov.visible ? rov.children : [])],
            true,
          )[0];
          if (hit?.object.userData.candidateId)
            live.current.onSelect(hit.object.userData.candidateId);
          if (hit?.object.userData.track)
            live.current.onTrack(hit.object.userData.track);
        };
        renderer.domElement.addEventListener('pointerdown', pointerDown);
        renderer.domElement.addEventListener('click', click);
        const resize = () => {
          camera.aspect = el.clientWidth / el.clientHeight;
          camera.updateProjectionMatrix();
          renderer!.setSize(el.clientWidth, el.clientHeight);
        };
        const ro = new ResizeObserver(resize);
        disposers.push(() => {
          ro.disconnect();
          renderer?.domElement.removeEventListener('pointerdown', pointerDown);
          renderer?.domElement.removeEventListener('click', click);
        });
        ro.observe(el);
        resize();
        let count = 0,
          last = performance.now();
        const animate = () => {
          if (disposed) return;
          frame = requestAnimationFrame(animate);
          const p = live.current;
          mesh.visible = p.layers.terrain;
          rov.visible = p.layers.rov;
          obis.visible = p.layers.obis;
          grid.visible = p.layers.grid;
          materials[1].opacity = p.layers.provenance
            ? 0.06 + (0.76 * p.truth) / 100
            : 1;
          materials[2].opacity = p.layers.provenance
            ? 0.025 + (0.4 * p.truth) / 100
            : 1;
          materials[1].color.set(p.layers.provenance ? '#c8b299' : '#ffffff');
          materials[2].color.set(p.layers.provenance ? '#b6a7e3' : '#ffffff');
          materials[2].wireframe = p.layers.provenance;
          const key = p.candidates.map((c) => c.id).join(',');
          if (key !== markerKey) {
            markerKey = key;
            for (const child of markers.children.slice()) {
              markers.remove(child);
              const m = child as THREE.Mesh;
              m.geometry.dispose();
              (m.material as THREE.Material).dispose();
            }
            for (const c of p.candidates) {
              const mat = new THREE.MeshBasicMaterial({
                color: '#ffbd77',
                depthTest: false,
              });
              const ring = new THREE.Mesh(
                new THREE.TorusGeometry(3, 0.16, 8, 64),
                mat,
              );
              ring.rotation.x = Math.PI / 2;
              ring.position.copy(point(c.centerLon, c.centerLat, 1));
              ring.userData.candidateId = c.id;
              markers.add(ring);
              const stem = line(
                [
                  point(c.centerLon, c.centerLat, 0.5),
                  point(c.centerLon, c.centerLat, 8),
                ],
                '#ffbd77',
              );
              stem.userData.candidateId = c.id;
              markers.add(stem);
            }
          }
          if (selectedKey !== p.selected) {
            selectedKey = p.selected ?? '';
            markers.children.forEach((m) => {
              const selected = m.userData.candidateId === p.selected;
              (
                m as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
              ).material.color.set(selected ? '#ffc26b' : '#89bdc6');
            });
          }
          if (target && desired) {
            controls.target.lerp(target, 0.07);
            camera.position.lerp(desired, 0.07);
            if (camera.position.distanceTo(desired) < 0.04) {
              target = null;
              desired = null;
            }
          }
          controls.update();
          renderer!.render(scene, camera);
          count++;
          if (performance.now() - last > 2000) {
            el.dataset.fps = String(
              Math.round((count * 1000) / (performance.now() - last)),
            );
            last = performance.now();
            count = 0;
          }
        };
        animate();
      } catch (e) {
        if (!disposed) {
          setError(
            e instanceof Error ? e.message : '3D rendering unavailable.',
          );
          live.current.onStatus(
            '3D view unavailable; evidence and candidates remain usable.',
          );
        }
      }
    }
    void setup();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      disposers.forEach((dispose) => dispose());
      renderer?.dispose();
      renderer?.domElement.remove();
      api.current = null;
    };
  }, []);
  useEffect(() => {
    api.current?.focus(props.selected);
  }, [props.focusKey, props.selected]);
  return (
    <>
      <div ref={host} className="terrain-canvas" data-testid="ocean-canvas" />
      {error && (
        <div className="map-error" role="alert">
          {error}
          <p>
            You can still compare candidates and inspect their source evidence.
          </p>
        </div>
      )}
      <div className="map-tools">
        <button
          aria-label="Reset camera"
          title="Reset camera"
          onClick={() => api.current?.reset()}
        >
          ⌖
        </button>
        <button aria-label="Zoom in" onClick={() => api.current?.zoom(0.8)}>
          +
        </button>
        <button aria-label="Zoom out" onClick={() => api.current?.zoom(1.25)}>
          −
        </button>
      </div>
      <div className="map-compass">
        N<span>↑</span>
      </div>
    </>
  );
}
