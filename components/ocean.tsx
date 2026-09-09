'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  LocateFixed,
  Plus,
  Minus,
  Play,
  Pause,
  X,
  Info,
  RotateCcw,
  MousePointer2,
  Compass,
  Lightbulb,
  Droplets,
  Aperture,
  Navigation,
  Camera,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import {
  unproject,
  sampleTerrain,
  preparePath,
  pathPosition,
  type TerrainSample,
} from '@/lib/abyss/map-interaction';
import * as THREE from 'three';
import { createSwimControls, type SwimState } from '@/lib/abyss/swim-controls';
import { referenceLocations } from '@/lib/abyss/fathomnet';
import {
  createUnderwater,
  addSeafloorAppearance,
} from '@/lib/abyss/underwater';
type ViewMode = 'dive' | 'map' | 'top';
const motionQuery = '(prefers-reduced-motion: reduce)';
const subscribeMotion = (notify: () => void) => {
  const media = window.matchMedia(motionQuery);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};
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
  overviewKey: number;
  photosVisible: boolean;
  photoFocus: { id: string; key: number } | null;
  photoGalleryOpen: boolean;
  onPhotoLocation: (id: string) => void;
  onSelect: (id: string) => void;
  onTrack: (t: Track) => void;
  onStatus: (s: string) => void;
  onLayers: (layers: Partial<Layers>) => void;
  onSwimStart: () => void;
  onInspect: () => void;
};
export default function Ocean(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    live = useRef(props),
    api = useRef<{
      focus: (id: string | null) => void;
      reset: () => void;
      zoom: (f: number) => void;
      view: (mode: ViewMode) => void;
      track: (id: string) => void;
      inspect: (lon: number, lat: number) => void;
      clear: () => void;
      record: (index: number) => void;
      swim: () => void;
      release: () => void;
      photo: (id: string) => void;
    } | null>(null);
  useEffect(() => {
    live.current = props;
  }, [props]);
  const [error, setError] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [trackId, setTrackId] = useState('');
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [recordIndex, setRecordIndex] = useState(0);
  const [recordCount, setRecordCount] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('dive');
  const [effects, setEffects] = useState(true);
  const [lights, setLights] = useState(true);
  const [motion, setMotion] = useState(true);
  const reducedMotion = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(motionQuery).matches,
    () => true,
  );
  const visual = useRef({
    mode: 'dive' as ViewMode,
    effects: true,
    lights: true,
    motion: false,
  });
  useEffect(() => {
    visual.current.effects = effects;
    visual.current.lights = lights;
    visual.current.motion = motion && !reducedMotion;
  }, [effects, lights, motion, reducedMotion]);
  const [hover, setHover] = useState<TerrainSample | null>(null);
  const [inspection, setInspection] = useState<{
    sample: TerrainSample;
    coverage?: Coverage;
  } | null>(null);
  const [ready, setReady] = useState(false);
  const [swimState, setSwimState] = useState<SwimState>('idle');
  const [swimFallback, setSwimFallback] = useState(false);
  const playback = useRef({ trackId, progress, playing });
  const pins = useRef<HTMLDivElement>(null);
  const photoPins = useRef<HTMLDivElement>(null);
  const compass = useRef<HTMLDivElement>(null);
  useEffect(() => {
    playback.current = { trackId, progress, playing };
  }, [trackId, progress, playing]);
  useEffect(() => {
    if (!playing || !props.layers.rov) return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now(),
        step = Math.min(now - last, 250) / 30000;
      last = now;
      setProgress((p) => Math.min(1, p + step));
      if (playback.current.progress >= 1) setPlaying(false);
    }, 60);
    return () => window.clearInterval(timer);
  }, [playing, props.layers.rov]);
  const activeTrack = tracks.find((t) => t.id === trackId);
  function chooseTrack(t: Track) {
    setTrackId(t.id);
    setProgress(0);
    setPlaying(false);
    api.current?.clear();
    props.onLayers({ rov: true });
    api.current?.track(t.id);
  }

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
          alpha: false,
          powerPreference: 'high-performance',
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.setClearColor(0x03151e, 1);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        el.appendChild(renderer.domElement);
        renderer.domElement.setAttribute('aria-label', 'Interactive seafloor');
        renderer.domElement.tabIndex = 0;
        renderer.domElement.setAttribute(
          'aria-describedby',
          'map-keyboard-help',
        );
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x03151e);
        const waterFog = new THREE.FogExp2(0x03151e, 0.013);
        scene.fog = waterFog;
        const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1800);
        camera.position.set(-32, -15, 30);
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
        controls.target.set(-32, -22, 6);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.minDistance = 3;
        controls.screenSpacePanning = false;
        controls.maxDistance = 110;
        controls.maxPolarAngle = Math.PI * 0.48;
        controls.update();
        const ambient = new THREE.HemisphereLight(0x9be0e2, 0x071a2c, 0.65);
        scene.add(ambient);
        const sun = new THREE.DirectionalLight(0xd5fff1, 2.2);
        sun.position.set(-90, 130, -60);
        scene.add(sun);
        const fill = new THREE.DirectionalLight(0x4982a8, 1.3);
        fill.position.set(70, 30, 100);
        scene.add(fill);
        const underwater = createUnderwater(renderer, scene, camera);
        // Dispose custom passes before the generic scene traversal.
        disposers.unshift(() => underwater.dispose());
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
                .set('#164a50')
                .lerp(
                  new THREE.Color('#87aaa0'),
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
        const surfaceAppearance = { value: 1 };
        materials.forEach((material) =>
          addSeafloorAppearance(material, surfaceAppearance),
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
        const boundaryLine = line(boundary, '#497789', 0.6);
        scene.add(boundaryLine);
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
        const paths = new Map<string, ReturnType<typeof preparePath>>();
        const trackFeatures: Track[] =
          results[0].status === 'fulfilled'
            ? (results[0].value as { features: Track[] }).features
            : [];
        setTracks(trackFeatures);
        const rover = new THREE.Mesh(
          new THREE.SphereGeometry(0.65, 16, 12),
          new THREE.MeshBasicMaterial({ color: '#fff5c9', depthTest: false }),
        );
        rover.renderOrder = 12;
        rover.visible = false;
        scene.add(rover);
        const probe = new THREE.Mesh(
          new THREE.RingGeometry(1.5, 1.85, 48),
          new THREE.MeshBasicMaterial({
            color: '#ffffff',
            side: THREE.DoubleSide,
            depthTest: false,
          }),
        );
        probe.rotation.x = -Math.PI / 2;
        probe.visible = false;
        scene.add(probe);
        if (results[0].status === 'fulfilled') {
          for (const track of (results[0].value as { features: Track[] })
            .features) {
            paths.set(track.id, preparePath(track.geometry.coordinates));
            const geom = new LineGeometry();
            geom.setPositions(
              track.geometry.coordinates.flatMap(([lon, lat]) =>
                point(lon, lat, 0.8).toArray(),
              ),
            );
            const l = new Line2(
              geom,
              new LineMaterial({
                color: track.properties.reached_bottom ? '#8affe6' : '#ffc277',
                linewidth: 3,
                depthTest: false,
                transparent: true,
                opacity: 0.9,
              }),
            );
            l.renderOrder = 8;
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
        const records: Coverage[] =
          results[1].status === 'fulfilled'
            ? (results[1].value as { features: Coverage[] }).features
                .slice()
                .sort(
                  (a, b) =>
                    b.properties.occurrence_count -
                    a.properties.occurrence_count,
                )
            : [];
        setRecordCount(records.length);
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
            const patch = new THREE.Mesh(
              geom,
              new THREE.MeshBasicMaterial({
                color: '#b69bea',
                transparent: true,
                opacity,
                side: THREE.DoubleSide,
                depthWrite: false,
              }),
            );
            patch.userData.coverage = f;
            obis.add(patch);
          }
        } else layerMessage += 'OBIS layer unavailable.';
        live.current.onStatus(
          layerMessage || 'GEBCO 2026 · 115,200 terrain cells',
        );
        setReady(true);
        let markerKey = '',
          selectedKey = '',
          target: THREE.Vector3 | null = null,
          desired: THREE.Vector3 | null = null;
        let inspectAhead = () => {};
        const swim = createSwimControls({
          canvas: renderer.domElement,
          camera,
          terrain,
          onManual: () => {
            target = null;
            desired = null;
          },
          onInspect: () => inspectAhead(),
          onState: (state, fallback) => {
            setSwimState(state);
            setSwimFallback(fallback);
          },
        });
        disposers.unshift(() => swim.dispose());
        const cameraForward = new THREE.Vector3();
        const setMode = (mode: ViewMode) => {
          swim.release();
          visual.current.mode = mode;
          setViewMode(mode);
          swim.setEnabled(mode === 'dive');
          controls.enabled = mode !== 'dive';
          camera.fov = mode === 'dive' ? 60 : 43;
          camera.updateProjectionMatrix();
          controls.minDistance = mode === 'dive' ? 3 : 12;
          controls.maxDistance = mode === 'dive' ? 110 : 900;
        };
        setMode(visual.current.mode);
        const placeCamera = (at: THREE.Vector3, extent = 65) => {
          const mode = visual.current.mode;
          target = at.clone();
          if (mode === 'dive') target.y = Math.min(-0.2, target.y + 3);
          desired = target
            .clone()
            .add(
              mode === 'dive'
                ? new THREE.Vector3(7, 4, 23)
                : mode === 'top'
                  ? new THREE.Vector3(0, extent * 1.8, 0.01)
                  : new THREE.Vector3(extent * 0.5, extent * 0.9, extent),
            );
          if (mode === 'dive') swim.constrain(desired);
        };
        const focus = (id: string | null) => {
          swim.release();
          const c = live.current.candidates.find((c) => c.id === id);
          probe.visible = false;
          setInspection(null);
          if (c) placeCamera(point(c.centerLon, c.centerLat));
          else if (visual.current.mode === 'dive')
            placeCamera(point(-170.3, -14.55));
          else
            placeCamera(
              new THREE.Vector3(0, -15, 0),
              170 * Math.max(1, el.clientHeight / Math.max(1, el.clientWidth)),
            );
        };
        const inspect = (lon: number, lat: number, coverage?: Coverage) => {
          const sample = sampleTerrain(terrain, lon, lat);
          if (!sample) return;
          setInspection({ sample, coverage });
          swim.release();
          live.current.onInspect();
          setPlaying(false);
          probe.position.copy(point(lon, lat, 0.9));
          probe.visible = true;
        };
        const focusTrack = (id: string) => {
          const path = paths.get(id);
          if (!path) return;
          const box = new THREE.Box3().setFromPoints(
            path.coordinates.map(([lon, lat]) => point(lon, lat)),
          );
          target = box.getCenter(new THREE.Vector3());
          const extent = Math.max(
            10,
            box.getSize(new THREE.Vector3()).length(),
          );
          setMode('map');
          placeCamera(target, extent * 1.2);
        };
        api.current = {
          swim: () => swim.start(),
          release: () => swim.release(),
          focus,
          track: focusTrack,
          photo: (id) => {
            const location = referenceLocations.find((l) => l.id === id);
            if (!location) return;
            setMode('map');
            setPlaying(false);
            setInspection(null);
            probe.visible = false;
            // Source-registered positions only; terrain draping is for display.
            placeCamera(point(location.longitude, location.latitude), 25);
          },
          clear: () => {
            probe.visible = false;
            setInspection(null);
          },
          record: (index) => {
            const f = records[index % records.length];
            if (!f) return;
            const ring = f.geometry.coordinates[0].slice(0, 4);
            const lon = ring.reduce((sum, p) => sum + p[0], 0) / 4,
              lat = ring.reduce((sum, p) => sum + p[1], 0) / 4;
            inspect(lon, lat, f);
            setMode('map');
            placeCamera(point(lon, lat), 25);
          },
          inspect: (lon, lat) => inspect(lon, lat),
          view: (mode) => {
            setMode(mode);
            const [lon, lat] = unproject(controls.target.x, controls.target.z);
            const at =
              mode === 'dive'
                ? point(
                    THREE.MathUtils.clamp(lon, -170.97, -169.03),
                    THREE.MathUtils.clamp(lat, -14.97, -14.03),
                  )
                : controls.target.clone();
            placeCamera(
              at,
              Math.max(35, camera.position.distanceTo(controls.target) / 1.45),
            );
          },
          reset: () => {
            focus(null);
            probe.visible = false;
            setInspection(null);
          },
          zoom: (factor) => {
            if (visual.current.mode === 'dive') {
              swim.dolly((1 - factor) * 10);
              return;
            }
            target = null;
            desired = null;
            camera.position
              .sub(controls.target)
              .multiplyScalar(factor)
              .add(controls.target);
            controls.update();
          },
        };
        const ray = new THREE.Raycaster();
        ray.params.Line = { threshold: 1.2 };
        let down = [0, 0],
          dragging = false,
          hoverAt = 0;
        const pointerDown = (e: PointerEvent) => {
          down = [e.clientX, e.clientY];
          dragging = true;
          target = null;
          desired = null;
        };
        const pointerUp = () => {
          dragging = false;
        };
        const aim = (e: MouseEvent) => {
          const rect = el.getBoundingClientRect();
          ray.setFromCamera(
            new THREE.Vector2(
              ((e.clientX - rect.left) / rect.width) * 2 - 1,
              -((e.clientY - rect.top) / rect.height) * 2 + 1,
            ),
            camera,
          );
        };
        const terrainHit = () =>
          live.current.layers.terrain ? ray.intersectObject(mesh)[0] : null;
        inspectAhead = () => {
          camera.updateMatrixWorld();
          ray.setFromCamera(new THREE.Vector2(0, 0), camera);
          const hit = terrainHit();
          if (hit) inspect(...unproject(hit.point.x, hit.point.z));
        };
        const click = (e: MouseEvent) => {
          if (visual.current.mode === 'dive' && swim.didDrag()) return;
          if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
          if (swim.isLocked())
            ray.setFromCamera(new THREE.Vector2(0, 0), camera);
          else aim(e);
          const hit = ray.intersectObjects(
            [...markers.children, ...(rov.visible ? rov.children : [])],
            true,
          )[0];
          if (hit?.object.userData.candidateId) {
            live.current.onSelect(hit.object.userData.candidateId);
            return;
          }
          if (hit?.object.userData.track) {
            const t = hit.object.userData.track as Track;
            setTrackId(t.id);
            setProgress(0);
            setPlaying(false);
            probe.visible = false;
            setInspection(null);
            focusTrack(t.id);
            return;
          }
          const record = obis.visible
            ? ray.intersectObjects(obis.children)[0]
            : null;
          const hitTerrain = terrainHit();
          // Ignore record patches hidden behind a nearer ridge.
          if (
            record &&
            (!hitTerrain || record.distance < hitTerrain.distance + 2)
          ) {
            const f = record.object.userData.coverage as Coverage;
            const ring = f.geometry.coordinates[0].slice(0, 4);
            inspect(
              ring.reduce((sum, p) => sum + p[0], 0) / 4,
              ring.reduce((sum, p) => sum + p[1], 0) / 4,
              f,
            );
          } else if (hitTerrain)
            inspect(...unproject(hitTerrain.point.x, hitTerrain.point.z));
        };
        const pointerMove = (e: PointerEvent) => {
          if (swim.isLocked()) return;
          if (dragging) {
            if (
              visual.current.mode === 'top' &&
              Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5
            )
              setMode('map');
            return;
          }
          if (performance.now() - hoverAt < 120) return;
          hoverAt = performance.now();
          aim(e);
          const hit = terrainHit();
          setHover(
            hit
              ? sampleTerrain(terrain, ...unproject(hit.point.x, hit.point.z))
              : null,
          );
        };
        const leave = () => {
          setHover(null);
          dragging = false;
        };
        const keydown = (e: KeyboardEvent) => {
          if (
            e.defaultPrevented ||
            e.isComposing ||
            e.metaKey ||
            e.ctrlKey ||
            e.altKey
          )
            return;
          if (e.key === 'Escape') {
            setInspection(null);
            probe.visible = false;
          }
          if (e.key === '+' || e.key === '=') api.current?.zoom(0.8);
          if (e.key === '-') api.current?.zoom(1.25);
          if (e.key.toLowerCase() === 'r') api.current?.reset();
          if (e.key === 'Enter')
            inspect(...unproject(controls.target.x, controls.target.z));
          const moves: Record<string, [number, number]> = {
            ArrowLeft: [-5, 0],
            ArrowRight: [5, 0],
            ArrowUp: [0, -5],
            ArrowDown: [0, 5],
          };
          if (moves[e.key]) {
            e.preventDefault();
            target = null;
            desired = null;
            const [x, z] = moves[e.key];
            controls.target.add(new THREE.Vector3(x, 0, z));
            camera.position.add(new THREE.Vector3(x, 0, z));
          }
        };
        const canvas = renderer.domElement;
        canvas.addEventListener('pointerdown', pointerDown);
        canvas.addEventListener('pointerup', pointerUp);
        canvas.addEventListener('pointermove', pointerMove);
        canvas.addEventListener('pointerleave', leave);
        canvas.addEventListener('click', click);
        canvas.addEventListener('keydown', keydown);
        disposers.push(() => {
          canvas.removeEventListener('pointerdown', pointerDown);
          canvas.removeEventListener('pointerup', pointerUp);
          canvas.removeEventListener('pointermove', pointerMove);
          canvas.removeEventListener('pointerleave', leave);
          canvas.removeEventListener('click', click);
          canvas.removeEventListener('keydown', keydown);
        });
        const resize = () => {
          camera.aspect = el.clientWidth / el.clientHeight;
          camera.updateProjectionMatrix();
          renderer!.setSize(el.clientWidth, el.clientHeight);
          underwater.resize(el.clientWidth, el.clientHeight);
        };
        const ro = new ResizeObserver(resize);
        disposers.push(() => {
          ro.disconnect();
          renderer?.domElement.removeEventListener('pointerdown', pointerDown);
          renderer?.domElement.removeEventListener('click', click);
        });
        let inView = true;
        const visibility = new IntersectionObserver((entries) => {
          inView = entries[0]?.isIntersecting ?? true;
          if (!inView) swim.release();
        });
        visibility.observe(el);
        disposers.push(() => visibility.disconnect());
        ro.observe(el);
        resize();
        focus(null);
        if (target && desired) {
          controls.target.copy(target);
          camera.position.copy(desired);
          target = null;
          desired = null;
          camera.lookAt(controls.target);
          if (visual.current.mode === 'dive') swim.constrain();
        }
        let elapsed = 0,
          previousFrame = performance.now(),
          lowFrameWindows = 0;
        let count = 0,
          last = performance.now(),
          selectedTrackKey = '',
          lastCameraReadout = 0;
        const projected = new THREE.Vector3();
        const animate = () => {
          if (disposed) return;
          frame = requestAnimationFrame(animate);
          const now = performance.now();
          const dt = Math.min(0.05, (now - previousFrame) / 1000);
          previousFrame = now;
          if (document.hidden || !inView) {
            last = now;
            count = 0;
            return;
          }
          const v = visual.current;
          const immersive = v.mode === 'dive';
          surfaceAppearance.value = immersive && v.effects ? 1 : 0;
          el.dataset.view = v.mode;
          if (v.motion) elapsed += dt;
          base.visible = boundaryLine.visible = !immersive;
          waterFog.density = immersive ? (v.effects ? 0.019 : 0.003) : 0.0008;
          ambient.intensity = immersive ? 0.75 : 1.5;
          sun.intensity = immersive ? 0.8 : 2.2;
          fill.intensity = immersive ? 0.4 : 1.3;
          controls.enableDamping = v.motion;
          const p = live.current;
          mesh.visible = p.layers.terrain;
          if (!p.layers.terrain && !p.layers.obis) probe.visible = false;
          rov.visible = p.layers.rov;
          obis.visible = p.layers.obis;
          grid.visible = p.layers.grid;
          if (!p.layers.rov && playback.current.playing) setPlaying(false);
          const play = playback.current,
            path = paths.get(play.trackId);
          rover.visible = p.layers.rov && Boolean(path);
          if (path) {
            const pos = pathPosition(path, play.progress);
            if (pos) rover.position.copy(point(...pos, 1.2));
          }
          const pixelWorld = (at: THREE.Vector3) =>
            (camera.position.distanceTo(at) *
              Math.tan((camera.fov * Math.PI) / 360) *
              2) /
            Math.max(1, el.clientHeight);
          rover.scale.setScalar((pixelWorld(rover.position) * 5) / 0.65);
          rov.children.forEach((o) => {
            if (o instanceof THREE.Mesh && !(o instanceof Line2))
              o.scale.setScalar((pixelWorld(o.position) * 3.5) / 0.8);
          });
          if (selectedTrackKey !== play.trackId) {
            selectedTrackKey = play.trackId;
            rov.children.forEach((o) => {
              if (o instanceof Line2) {
                const selected = o.userData.track.id === play.trackId;
                o.material.linewidth = selected ? 5 : 3;
                o.material.opacity = selected || !play.trackId ? 1 : 0.35;
              }
            });
          }

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
            selectedKey = '';
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
            controls.target.lerp(target, v.motion ? 1 - Math.exp(-4 * dt) : 1);
            camera.position.lerp(desired, v.motion ? 1 - Math.exp(-4 * dt) : 1);
            if (immersive) camera.lookAt(controls.target);
            if (camera.position.distanceTo(desired) < 0.04) {
              controls.target.copy(target);
              camera.position.copy(desired);
              if (immersive) camera.lookAt(target);
              target = null;
              desired = null;
            }
          }
          if (immersive) {
            swim.constrain();
            swim.update(dt);
            // Preserve free-look rotation; OrbitControls.update would overwrite it.
            if (!target) {
              camera.getWorldDirection(cameraForward);
              controls.target
                .copy(camera.position)
                .addScaledVector(cameraForward, 23);
            }
          } else controls.update();
          camera.updateMatrixWorld();
          camera.getWorldDirection(cameraForward);
          if (now - lastCameraReadout > 150) {
            lastCameraReadout = now;
            // Match the existing FPS diagnostics with the rendered camera pose.
            el.dataset.cameraPosition = camera.position
              .toArray()
              .map((n) => n.toFixed(5))
              .join(',');
            el.dataset.cameraDirection = cameraForward
              .toArray()
              .map((n) => n.toFixed(5))
              .join(',');
          }
          if (compass.current)
            compass.current.style.transform = `rotate(${Math.atan2(-cameraForward.x, -cameraForward.z)}rad)`;
          for (const node of pins.current?.querySelectorAll<HTMLButtonElement>(
            '[data-candidate]',
          ) ?? []) {
            const candidate = p.candidates.find(
              (c) => c.id === node.dataset.candidate,
            );
            if (!candidate) continue;
            projected
              .copy(point(candidate.centerLon, candidate.centerLat, 9))
              .project(camera);
            const visible =
              projected.z > -1 &&
              projected.z < 1 &&
              Math.abs(projected.x) < 0.94 &&
              Math.abs(projected.y) < 0.85;
            node.style.visibility = visible ? 'visible' : 'hidden';
            node.style.transform = `translate(${(projected.x * 0.5 + 0.5) * el.clientWidth}px,${(-projected.y * 0.5 + 0.5) * el.clientHeight}px) translate(-50%,-100%)`;
          }
          for (const node of photoPins.current?.querySelectorAll<HTMLButtonElement>(
            '[data-photo-location]',
          ) ?? []) {
            const location = referenceLocations.find(
              (l) => l.id === node.dataset.photoLocation,
            );
            if (!location) continue;
            projected
              .copy(point(location.longitude, location.latitude, 2))
              .project(camera);
            const visible =
              p.photosVisible &&
              projected.z > -1 &&
              projected.z < 1 &&
              Math.abs(projected.x) < 0.94 &&
              Math.abs(projected.y) < 0.85;
            node.style.visibility = visible ? 'visible' : 'hidden';
            node.style.transform = `translate(${(projected.x * 0.5 + 0.5) * el.clientWidth}px,${(-projected.y * 0.5 + 0.5) * el.clientHeight}px) translate(-50%,-100%)`;
          }
          underwater.update(elapsed, immersive, v.effects, v.lights);
          underwater.render(immersive, v.effects);
          count++;
          if (performance.now() - last > 2000) {
            el.dataset.fps = String(
              Math.round((count * 1000) / (performance.now() - last)),
            );
            const fps = Number(el.dataset.fps);
            lowFrameWindows = fps < 28 ? lowFrameWindows + 1 : 0;
            if (lowFrameWindows >= 2 && renderer!.getPixelRatio() > 1) {
              renderer!.setPixelRatio(1);
              underwater.setPixelRatio(1);
              resize();
              lowFrameWindows = 0;
            }
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
  useEffect(() => {
    if (props.overviewKey > 0) {
      api.current?.view('map');
      api.current?.reset();
    }
  }, [props.overviewKey]);
  useEffect(() => {
    if (ready && props.photoFocus) api.current?.photo(props.photoFocus.id);
  }, [props.photoFocus, ready]);
  useEffect(() => {
    if (props.photoGalleryOpen) api.current?.release();
  }, [props.photoGalleryOpen]);
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
      {!ready && !error && (
        <div className="map-loading">
          <span className="loading-orbit" />
          <strong>Bringing the seafloor into view</strong>
          <small>Rendering the GEBCO terrain grid</small>
        </div>
      )}
      <div className="map-view-switch" aria-label="Map perspective">
        {(['dive', 'map', 'top'] as const).map((mode) => (
          <button
            key={mode}
            aria-pressed={viewMode === mode}
            onClick={() => api.current?.view(mode)}
          >
            {mode === 'dive' && <Aperture size={13} />}
            {{ dive: 'Dive view', map: '3D map', top: 'Top down' }[mode]}
          </button>
        ))}
      </div>
      <div className="water-controls" aria-label="Underwater appearance">
        <button
          aria-label="Water effects"
          title="Water haze & floating particles"
          aria-pressed={effects}
          disabled={viewMode !== 'dive'}
          onClick={() => setEffects((v) => !v)}
        >
          <Droplets size={15} />
          <span>Water</span>
        </button>
        <button
          aria-label="Survey lights"
          title="Illustrative survey lights"
          aria-pressed={lights}
          disabled={viewMode !== 'dive'}
          onClick={() => setLights((v) => !v)}
        >
          <Lightbulb size={15} />
          <span>Lights</span>
        </button>
        <button
          aria-label="Ambient motion"
          title={
            reducedMotion
              ? 'Reduced motion preference is active'
              : 'Pause ambient motion & camera easing'
          }
          aria-pressed={motion && !reducedMotion}
          disabled={reducedMotion}
          onClick={() => setMotion((v) => !v)}
        >
          {motion && !reducedMotion ? <Pause size={15} /> : <Play size={15} />}
          <span>Motion</span>
        </button>
      </div>
      {viewMode === 'dive' && !inspection && (
        <div className="swim-panel" data-active={swimState !== 'idle'}>
          <button
            className="swim-start"
            disabled={!ready}
            onClick={() => {
              if (swimState === 'locked') api.current?.release();
              else {
                props.onSwimStart();
                api.current?.swim();
              }
            }}
          >
            <Navigation size={14} />
            {swimState === 'locked' ? 'Release mouse (Esc)' : 'Start swimming'}
          </button>
          <p>
            <kbd>WASD</kbd> Move <span>·</span> <kbd>Q</kbd> / <kbd>E</kbd> Down
            / up
          </p>
          <p>
            <kbd>Shift</kbd> Faster <span>·</span> <kbd>F</kbd> Inspect{' '}
            <span>·</span> <kbd>Esc</kbd> Release
          </p>
          <output className="swim-status">
            {swimState === 'locked'
              ? 'Move the mouse to look around'
              : swimFallback
                ? 'Drag to look · WASD is ready'
                : swimState === 'ready'
                  ? 'WASD is ready · drag to look'
                  : 'Click the ocean or start swimming'}
          </output>
        </div>
      )}
      {viewMode === 'dive' && swimState !== 'idle' && (
        <div className="swim-crosshair" aria-hidden="true">
          <i />
          <i />
        </div>
      )}
      <div className="map-scale">
        <span>
          {viewMode === 'dive'
            ? 'WASD swim · Drag to look · Q/E down/up'
            : 'Drag to orbit · Right-drag to pan'}
        </span>
        <span>
          {viewMode === 'dive'
            ? 'Scroll to swim closer · F to inspect ahead'
            : 'Scroll to zoom · Click to inspect'}
        </span>
      </div>
      <div className="immersion-note">
        <span className="live-dot" />
        {viewMode === 'dive' ? 'DIVE VIEW' : 'SURVEY VIEW'}
        <span>Illustrative lighting & particles · Terrain ×6</span>
      </div>
      <div className="map-tools">
        <button
          aria-label="Reset camera"
          title="Reset camera (R)"
          onClick={() => api.current?.reset()}
        >
          <LocateFixed size={18} />
        </button>
        <button
          aria-label={viewMode === 'dive' ? 'Swim forward' : 'Zoom in'}
          title={viewMode === 'dive' ? 'Swim forward' : 'Zoom in (+)'}
          onClick={() => api.current?.zoom(0.8)}
        >
          <Plus size={18} />
        </button>
        <button
          aria-label={viewMode === 'dive' ? 'Swim backward' : 'Zoom out'}
          title={viewMode === 'dive' ? 'Swim backward' : 'Zoom out (-)'}
          onClick={() => api.current?.zoom(1.25)}
        >
          <Minus size={18} />
        </button>
      </div>
      <div className="map-compass" ref={compass}>
        N<Compass size={28} />
      </div>
      <div ref={pins} className="map-pins">
        {props.candidates.map((c) => (
          <button
            key={c.id}
            data-candidate={c.id}
            aria-label={`Focus candidate ${c.archetype}`}
            aria-pressed={props.selected === c.id}
            onClick={() => {
              api.current?.clear();
              props.onSelect(c.id);
            }}
          >
            {c.archetype}
            <span>{Math.round(c.meanDepth).toLocaleString()} m</span>
          </button>
        ))}
      </div>
      <div
        ref={photoPins}
        className="photo-map-pins"
        aria-label="FathomNet registered photo locations"
        hidden={!props.photosVisible}
      >
        {referenceLocations.map((location) => (
          <button
            key={location.id}
            data-photo-location={location.id}
            aria-label={`View ${location.imageCount} reference photos: ${location.name}`}
            title={`${location.name} · ${location.imageCount} photos · registered position`}
            onClick={() => {
              api.current?.release();
              props.onPhotoLocation(location.id);
            }}
          >
            <Camera size={15} />
            <b>{location.imageCount}</b>
            <span>
              {location.name}
              <small>Registered position</small>
            </span>
          </button>
        ))}
      </div>
      {props.layers.obis && recordCount > 0 && (
        <div className="record-browse">
          <span>OBIS · {recordCount} cells</span>
          <button
            onClick={() => {
              api.current?.record(recordIndex);
              setRecordIndex((i) => (i + 1) % recordCount);
            }}
          >
            {recordIndex === 0
              ? 'Inspect most recorded cell'
              : 'Next record cell'}{' '}
            <span>↗</span>
          </button>
        </div>
      )}
      <div className="map-console">
        {props.layers.rov && (
          <section className="track-player" aria-label="Dive path player">
            <div className="console-title">
              <span className="eyebrow">
                <span className="live-dot" /> NOAA / FOLLOW THE DIVE
              </span>
              <button
                aria-label="Hide dive paths"
                onClick={() => {
                  setPlaying(false);
                  props.onLayers({ rov: false });
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="track-tabs">
              {tracks.map((t) => (
                <button
                  key={t.id}
                  aria-pressed={trackId === t.id}
                  onClick={() => chooseTrack(t)}
                >
                  {t.properties.dive_id.replace('EX1702_', '')}
                  <i
                    className={t.properties.reached_bottom ? '' : 'not-bottom'}
                  />
                </button>
              ))}
            </div>
            {activeTrack ? (
              <>
                <div className="playback-row">
                  <button
                    className="play-button"
                    aria-label={
                      playing ? 'Pause path replay' : 'Play path replay'
                    }
                    onClick={() => {
                      if (progress >= 1) setProgress(0);
                      setPlaying((p) => !p);
                    }}
                  >
                    {playing ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                  <span id="path-progress-label" className="sr-only">
                    Distance along recorded path
                  </span>
                  <Slider
                    value={[progress * 100]}
                    onValueChange={(v) => {
                      setPlaying(false);
                      setProgress((Array.isArray(v) ? v[0] : v) / 100);
                    }}
                    aria-labelledby="path-progress-label"
                  />
                  <output>{Math.round(progress * 100)}%</output>
                  <button
                    aria-label="Restart path replay"
                    onClick={() => {
                      setProgress(0);
                      setPlaying(false);
                    }}
                  >
                    <RotateCcw size={15} />
                  </button>
                </div>
                <div className="player-meta">
                  <span>
                    {activeTrack.properties.reached_bottom
                      ? 'Seafloor reached'
                      : 'No seafloor arrival · excluded from scoring'}
                  </span>
                  <button onClick={() => props.onTrack(activeTrack)}>
                    <Info size={13} />
                    Dive details
                  </button>
                </div>
              </>
            ) : (
              <p className="player-instruction">
                Choose a dive to zoom in and follow its recorded path.
              </p>
            )}
            <small>
              Replay follows path distance, not real time. Vehicle depth is
              unavailable.
            </small>
          </section>
        )}
        {inspection && (
          <section
            className={
              'map-inspector ' + (inspection.coverage ? 'record-inspector' : '')
            }
            aria-label="Selected location"
          >
            <div className="console-title">
              <span className="eyebrow">
                {inspection.coverage
                  ? 'OBIS / TRACES OF LIFE'
                  : 'GEBCO / BENEATH THE SURFACE'}
              </span>
              <button
                aria-label="Close location details"
                onClick={() => api.current?.clear()}
              >
                <X size={16} />
              </button>
            </div>
            {inspection.coverage && (
              <div className="inspect-count">
                {inspection.coverage.properties.occurrence_count.toLocaleString()}{' '}
                <span>occurrence records</span>
              </div>
            )}
            <div className="inspect-depth">
              {inspection.sample.elevation < 0
                ? 'Seafloor depth'
                : 'Land elevation'}
              <strong>
                {Math.abs(inspection.sample.elevation).toLocaleString()}
                <span> m</span>
              </strong>
            </div>
            <p className="coordinates">
              {Math.abs(inspection.sample.lat).toFixed(4)}° S ·{' '}
              {Math.abs(inspection.sample.lon).toFixed(4)}° W
            </p>
            <p>
              {
                {
                  direct: 'Directly measured terrain',
                  indirect: 'Indirectly derived terrain',
                  unknown: 'Mixed / unknown sources',
                  land: 'Land',
                }[inspection.sample.provenance]
              }
              <span className="tid-code">TID {inspection.sample.tid}</span>
            </p>
            {inspection.coverage ? (
              <small>
                Records in this whole purple cell, not individual animals. Depth
                is the seafloor at the cell center. These counts cannot tell us
                observation depths, species, or why life occurs here.
                {inspection.coverage.properties.clipped_to_query_bbox &&
                  ' This display cell is clipped at the region edge; its count belongs to the original OBIS cell.'}
              </small>
            ) : (
              <small>
                Nearest GEBCO raster cell. Terrain height is exaggerated ×6 for
                display.
              </small>
            )}
          </section>
        )}
      </div>
      <div className="map-readout">
        <MousePointer2 size={13} />
        {hover ? (
          <span>
            {Math.abs(hover.lat).toFixed(3)}° S /{' '}
            {Math.abs(hover.lon).toFixed(3)}° W{' '}
            <b>
              {hover.elevation < 0 ? 'Depth' : 'Elevation'}{' '}
              {Math.abs(hover.elevation).toLocaleString()} m
            </b>
          </span>
        ) : (
          <span>Click the seafloor to inspect its depth</span>
        )}
      </div>
      <p id="map-keyboard-help" className="sr-only">
        {viewMode === 'dive'
          ? 'Click or focus the ocean. W and S swim along your view; A and D strafe. E or Space rises; Q or C descends. Hold Shift to swim faster. Drag to look, or use arrow keys. Start swimming captures the mouse for free look. F or Enter inspects the seafloor ahead. Escape or Tab releases the controls. R resets your position.'
          : 'Focus the map. Arrow keys pan, Enter inspects the center, plus and minus zoom, R resets, and Escape closes details.'}
      </p>
    </>
  );
}
