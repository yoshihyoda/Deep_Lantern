import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createSwimControls, type SwimState } from '../lib/abyss/swim-controls';
import type { Terrain } from '../lib/abyss/types';

void test('FPS input lifecycle handles holds, taps, focus loss, map mode and pointer-lock outcomes', async (t) => {
  class Doc extends EventTarget {
    activeElement: unknown = null;
    pointerLockElement: unknown = null;
    hidden = false;
    exitPointerLock() {
      this.pointerLockElement = null;
      this.dispatchEvent(new Event('pointerlockchange'));
    }
  }
  const doc = new Doc(),
    win = new EventTarget();
  class Canvas extends EventTarget {
    captures = new Set<number>();
    requestPointerLock: () => void | Promise<void> = () => {
      doc.pointerLockElement = this;
      doc.dispatchEvent(new Event('pointerlockchange'));
    };
    focus() {
      doc.activeElement = this;
      this.dispatchEvent(new Event('focus'));
    }
    blur() {
      doc.activeElement = null;
      this.dispatchEvent(new Event('blur'));
    }
    hasPointerCapture(id: number) {
      return this.captures.has(id);
    }
    setPointerCapture(id: number) {
      this.captures.add(id);
    }
    releasePointerCapture(id: number) {
      this.captures.delete(id);
    }
  }
  const originalDocument = Object.getOwnPropertyDescriptor(
      globalThis,
      'document',
    ),
    originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: doc,
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: win,
  });
  const canvas = new Canvas(),
    camera = new THREE.PerspectiveCamera();
  camera.position.set(0, -10, 0);
  const terrain = {
    bbox: [-171, -15, -169, -14],
    width: 2,
    height: 2,
    elevation: [-4000, -4000, -4000, -4000],
    tid: [11, 11, 11, 11],
  } as Terrain;
  let state: SwimState = 'idle',
    fallback = false,
    inspections = 0;
  const control = createSwimControls({
    canvas: canvas as unknown as HTMLCanvasElement,
    camera,
    terrain,
    onManual() {},
    onInspect() {
      inspections++;
    },
    onState(s, f) {
      state = s;
      fallback = f;
    },
  });
  const key = (type: string, code: string, key: string) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, {
      code,
      key,
      repeat: false,
      isComposing: false,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
    });
    (type === 'keyup' ? win : canvas).dispatchEvent(event);
  };
  try {
    control.setEnabled(true);
    canvas.focus();
    await t.test('held W advances along view and releasing stops', () => {
      key('keydown', 'KeyW', 'w');
      for (let i = 0; i < 60; i++) control.update(1 / 60);
      key('keyup', 'KeyW', 'w');
      assert.ok(Math.abs(camera.position.z + 4.5) < 1e-8);
      const z = camera.position.z;
      control.update(0.05);
      assert.equal(camera.position.z, z);
    });
    await t.test(
      'an accessibility-keyboard tap survives until the next frame',
      () => {
        const x = camera.position.x;
        key('keydown', '', 'd');
        key('keyup', '', 'd');
        control.update(1 / 60);
        assert.ok(camera.position.x > x);
        const stopped = camera.position.clone();
        control.update(1 / 60);
        assert.deepEqual(camera.position, stopped);
      },
    );
    await t.test(
      'Astra focus, window blur and map mode clear held keys',
      () => {
        key('keydown', 'KeyW', 'w');
        canvas.blur();
        const p = camera.position.clone();
        control.update(0.05);
        assert.deepEqual(camera.position, p);
        key('keydown', 'KeyD', 'd');
        control.update(0.05);
        assert.deepEqual(camera.position, p);
        canvas.focus();
        key('keydown', 'KeyW', 'w');
        win.dispatchEvent(new Event('blur'));
        control.update(0.05);
        assert.deepEqual(camera.position, p);
        control.setEnabled(false);
        canvas.focus();
        key('keydown', 'KeyW', 'w');
        control.update(0.05);
        assert.deepEqual(camera.position, p);
        control.setEnabled(true);
      },
    );
    await t.test(
      'legacy pointer lock, F inspection and Escape release work',
      () => {
        control.start();
        assert.equal(state, 'locked');
        key('keydown', 'KeyF', 'f');
        assert.equal(inspections, 1);
        key('keydown', 'Escape', 'Escape');
        assert.equal(state, 'idle');
        assert.equal(doc.pointerLockElement, null);
      },
    );
    await t.test(
      'rejected capture falls back without leaving a stale ready message',
      async () => {
        canvas.requestPointerLock = () =>
          Promise.reject(new Error('Unavailable'));
        control.start();
        await Promise.resolve();
        await Promise.resolve();
        assert.equal(state, 'ready');
        assert.equal(fallback, true);
        control.release();
        assert.equal(state, 'idle');
        assert.equal(fallback, false);
      },
    );
    await t.test(
      'late mouse capture after a mode change is immediately released',
      async () => {
        let resolve: () => void = () => {};
        canvas.requestPointerLock = () =>
          new Promise<void>((r) => {
            resolve = r;
          });
        control.start();
        control.setEnabled(false);
        doc.pointerLockElement = canvas;
        doc.dispatchEvent(new Event('pointerlockchange'));
        resolve();
        await Promise.resolve();
        assert.equal(doc.pointerLockElement, null);
        assert.equal(state, 'idle');
      },
    );
  } finally {
    control.dispose();
    if (originalDocument)
      Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
    if (originalWindow)
      Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
