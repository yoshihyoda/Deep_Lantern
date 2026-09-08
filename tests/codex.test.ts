import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { CodexAppServer } from '../server/codex-app-server';

// Replace only the stdio transport: exercise the real lifecycle without model use.
type MockableClient = {
  rpc: (method: string, params: Record<string, unknown>) => Promise<unknown>;
  receive: (message: unknown) => void;
  jobs: Map<string, unknown>;
  startingJobs: number;
};
const request = {
  message: 'Show ROV activity',
  history: [],
  minDepth: 2000,
  selectedId: null,
};
const noop = () => {};

void test('Codex reserves pending thread starts within the two-request limit', async () => {
  const client = new CodexAppServer();
  client.start = async () => true;
  const mock = client as unknown as MockableClient;
  let starts = 0;
  mock.rpc = async (method) => {
    if (method === 'thread/start') {
      const id = String(++starts);
      await setImmediate();
      return { thread: { id } };
    }
    return { turn: { id: 'turn' } };
  };
  const results = await Promise.allSettled(
    [1, 2, 3].map(() => client.ask(request, noop, noop)),
  );
  assert.equal(starts, 2);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 2);
  assert.equal(mock.jobs.size, 2);
  assert.equal(mock.startingJobs, 0);
  for (const result of results)
    if (result.status === 'fulfilled') result.value();
  await setImmediate();
  assert.equal(mock.jobs.size, 0);
});

void test('Codex interrupts and unsubscribes when start times out after a started notification', async () => {
  const client = new CodexAppServer();
  client.start = async () => true;
  const mock = client as unknown as MockableClient;
  const calls: { method: string; params: Record<string, unknown> }[] = [];
  mock.rpc = async (method, params) => {
    calls.push({ method, params });
    if (method === 'thread/start') return { thread: { id: 'thread' } };
    if (method === 'turn/start') {
      mock.receive({
        method: 'turn/started',
        params: { threadId: 'thread', turn: { id: 'running' } },
      });
      throw Error('simulated timeout');
    }
    return {};
  };
  await assert.rejects(client.ask(request, noop, noop), /simulated timeout/);
  await setImmediate();
  assert.deepEqual(calls.slice(2), [
    {
      method: 'turn/interrupt',
      params: { threadId: 'thread', turnId: 'running' },
    },
    { method: 'thread/unsubscribe', params: { threadId: 'thread' } },
  ]);
  assert.equal(mock.jobs.size, 0);
});

void test('Codex frees reservations on start failure and cleans non-retry errors once', async () => {
  const client = new CodexAppServer();
  client.start = async () => true;
  const mock = client as unknown as MockableClient;
  mock.rpc = async () => {
    throw Error('start failed');
  };
  await assert.rejects(client.ask(request, noop, noop), /start failed/);
  assert.equal(mock.startingJobs, 0);
  const calls: string[] = [];
  mock.rpc = async (method) => {
    calls.push(method);
    if (method === 'thread/start') return { thread: { id: 'thread' } };
    return { turn: { id: 'turn' } };
  };
  let errors = 0;
  const cancel = await client.ask(request, noop, () => {
    errors++;
  });
  mock.receive({
    method: 'error',
    params: { threadId: 'thread', willRetry: false },
  });
  cancel();
  await setImmediate();
  assert.equal(errors, 1);
  assert.deepEqual(calls.slice(2), ['turn/interrupt', 'thread/unsubscribe']);
  assert.equal(mock.jobs.size, 0);
});
