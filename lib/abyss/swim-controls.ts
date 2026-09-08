import * as THREE from 'three';
import { createSwimSurface, swimDisplacement } from './swim-motion';
import type { Terrain } from './types';
export type SwimState = 'idle' | 'ready' | 'locked';

export function createSwimControls(options: {
  canvas: HTMLCanvasElement;
  camera: THREE.PerspectiveCamera;
  terrain: Terrain;
  onManual: () => void;
  onInspect: () => void;
  onState: (state: SwimState, fallback: boolean) => void;
}) {
  const { canvas, camera, onManual, onInspect, onState } = options;
  const surface = createSwimSurface(options.terrain);
  const keys = new Set<string>();
  const taps = new Set<string>();
  const forward = new THREE.Vector3(),
    angles = new THREE.Euler(0, 0, 0, 'YXZ');
  const movement = new Set([
    'KeyW',
    'KeyA',
    'KeyS',
    'KeyD',
    'KeyQ',
    'KeyE',
    'KeyC',
    'Space',
    'ShiftLeft',
    'ShiftRight',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
  ]);
  let enabled = false,
    disposed = false,
    wasLocked = false,
    requested = false,
    fallback = false;
  let drag: { id: number; x: number; y: number; distance: number } | null =
      null,
    dragged = false;
  let lastState: SwimState | null = null;
  const ownsLock = () => document.pointerLockElement === canvas;
  const active = () => enabled && document.activeElement === canvas;
  const notify = () => {
    if (disposed) return;
    const state = enabled
      ? ownsLock()
        ? 'locked'
        : active()
          ? 'ready'
          : 'idle'
      : 'idle';
    if (state !== lastState || fallback) {
      lastState = state;
      onState(state, fallback);
    }
  };
  function clearDrag() {
    if (drag && canvas.hasPointerCapture(drag.id))
      canvas.releasePointerCapture(drag.id);
    drag = null;
  }
  function release() {
    keys.clear();
    taps.clear();
    fallback = false;
    clearDrag();
    requested = false;
    if (ownsLock()) document.exitPointerLock();
    if (document.activeElement === canvas) canvas.blur();
    notify();
  }
  function look(dx: number, dy: number) {
    onManual();
    angles.setFromQuaternion(camera.quaternion, 'YXZ');
    angles.y -= dx * 0.0022;
    angles.x = THREE.MathUtils.clamp(
      angles.x - dy * 0.0022,
      -Math.PI * 0.47,
      Math.PI * 0.47,
    );
    angles.z = 0;
    camera.quaternion.setFromEuler(angles);
  }
  function focus() {
    if (enabled) {
      canvas.focus({ preventScroll: true });
      onManual();
      notify();
    }
  }
  function lockFailure() {
    requested = false;
    if (!disposed && active()) {
      fallback = true;
      notify();
    }
  }
  function start() {
    if (!enabled || disposed) return;
    fallback = false;
    focus();
    requested = true;
    if (!canvas.requestPointerLock) {
      lockFailure();
      return;
    }
    // User-gesture call; accommodate both the legacy void and Promise implementations.
    try {
      Promise.resolve(canvas.requestPointerLock())
        .then(() => {
          if (disposed || !enabled || !requested) {
            if (ownsLock()) document.exitPointerLock();
          }
        })
        .catch(lockFailure);
    } catch {
      lockFailure();
    }
  }
  function lockChange() {
    if (ownsLock() && (!enabled || disposed || !requested)) {
      document.exitPointerLock();
      return;
    }
    if (ownsLock()) {
      wasLocked = true;
      keys.clear();
      canvas.focus({ preventScroll: true });
      onManual();
    } else if (wasLocked) {
      wasLocked = false;
      release();
    }
    notify();
  }
  function down(e: PointerEvent) {
    if (!enabled || !e.isPrimary || (e.button !== 0 && e.button !== 2)) return;
    focus();
    dragged = false;
    if (!ownsLock()) {
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, distance: 0 };
      canvas.setPointerCapture(e.pointerId);
    }
  }
  function pointerMove(e: PointerEvent) {
    if (!enabled || ownsLock() || !drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    drag.distance += Math.hypot(dx, dy);
    dragged = drag.distance > 4;
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (dragged) look(dx, dy);
  }
  function pointerUp(e: PointerEvent) {
    if (drag?.id === e.pointerId) clearDrag();
  }
  function mouseMove(e: MouseEvent) {
    if (enabled && ownsLock()) look(e.movementX, e.movementY);
  }
  const inputCode = (e: KeyboardEvent) => {
    if (e.code) return e.code;
    // Accessibility keyboards may supply a key without a physical key code.
    if (/^[a-z]$/i.test(e.key)) return `Key${e.key.toUpperCase()}`;
    return e.key === ' ' ? 'Space' : e.key === 'Shift' ? 'ShiftLeft' : e.key;
  };
  function keyDown(e: KeyboardEvent) {
    if (!active() || e.isComposing) return;
    if (e.key === 'Escape' || e.key === 'Tab') {
      release();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) {
      keys.clear();
      taps.clear();
      return;
    }
    const code = inputCode(e);
    if (movement.has(code)) {
      e.preventDefault();
      keys.add(code);
      if (!e.repeat) taps.add(code);
      onManual();
    }
    if ((code === 'KeyF' || code === 'Enter') && !e.repeat) {
      e.preventDefault();
      onInspect();
    }
  }
  function keyUp(e: KeyboardEvent) {
    keys.delete(inputCode(e));
  }
  function wheel(e: WheelEvent) {
    if (!enabled) return;
    e.preventDefault();
    onManual();
    camera.getWorldDirection(forward);
    camera.position.copy(
      surface.move(
        camera.position,
        forward.multiplyScalar(THREE.MathUtils.clamp(-e.deltaY * 0.008, -2, 2)),
      ),
    );
  }
  function blur() {
    if (!active()) release();
  }
  function hidden() {
    if (document.hidden) release();
  }
  function context(e: MouseEvent) {
    if (enabled) e.preventDefault();
  }
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerUp);
  canvas.addEventListener('lostpointercapture', pointerUp);
  canvas.addEventListener('focus', notify);
  canvas.addEventListener('blur', blur);
  canvas.addEventListener('keydown', keyDown);
  canvas.addEventListener('wheel', wheel, { passive: false });
  canvas.addEventListener('contextmenu', context);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', release);
  document.addEventListener('visibilitychange', hidden);
  document.addEventListener('mousemove', mouseMove);
  document.addEventListener('pointerlockchange', lockChange);
  document.addEventListener('pointerlockerror', lockFailure);
  return {
    start,
    release,
    setEnabled(value: boolean) {
      if (enabled === value) return;
      enabled = value;
      if (!enabled) release();
      notify();
    },
    isLocked: ownsLock,
    didDrag: () => dragged,
    constrain(position = camera.position) {
      position.copy(surface.constrain(position));
    },
    dolly(distance: number) {
      onManual();
      camera.getWorldDirection(forward);
      camera.position.copy(
        surface.move(camera.position, forward.multiplyScalar(distance)),
      );
    },
    update(dt: number) {
      if (!active()) {
        keys.clear();
        taps.clear();
        return;
      }
      const held = (...codes: string[]) =>
        codes.some((c) => keys.has(c) || taps.has(c)) ? 1 : 0;
      const yaw = held('ArrowRight') - held('ArrowLeft'),
        pitch = held('ArrowDown') - held('ArrowUp');
      if (yaw || pitch) look(yaw * dt * 500, pitch * dt * 500);
      camera.getWorldDirection(forward);
      const delta = swimDisplacement(
        forward,
        {
          forward: held('KeyW') - held('KeyS'),
          right: held('KeyD') - held('KeyA'),
          up: held('Space', 'KeyE') - held('KeyQ', 'KeyC'),
          boost: Boolean(held('ShiftLeft', 'ShiftRight')),
        },
        dt,
      );
      // Consume short taps once, even when keyup arrives between animation frames.
      taps.clear();
      if (delta.x || delta.y || delta.z) {
        onManual();
        camera.position.copy(surface.move(camera.position, delta));
      }
    },
    dispose() {
      disposed = true;
      enabled = false;
      release();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointercancel', pointerUp);
      canvas.removeEventListener('lostpointercapture', pointerUp);
      canvas.removeEventListener('focus', notify);
      canvas.removeEventListener('blur', blur);
      canvas.removeEventListener('keydown', keyDown);
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('contextmenu', context);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', hidden);
      document.removeEventListener('mousemove', mouseMove);
      document.removeEventListener('pointerlockchange', lockChange);
      document.removeEventListener('pointerlockerror', lockFailure);
    },
  };
}
