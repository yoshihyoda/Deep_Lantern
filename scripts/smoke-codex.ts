import { CodexAppServer } from '../server/codex-app-server';
const client = new CodexAppServer();
try {
  console.log('connected', await client.start());
  await new Promise<void>((resolve, reject) => {
    let toolCount = 0;
    const timer = setTimeout(() => reject(Error('Timeout')), 120000);
    void client
      .ask(
        {
          message:
            'Show recorded ROV survey activity. Use get_rov_activity to turn the layer on.',
          history: [],
          minDepth: 2000,
          selectedId: 'cell-12-2',
        },
        (event) => {
          const e = event as { type: string; value: unknown };
          if (e.type === 'tool') {
            toolCount++;
            console.log('tool', e.value);
          }
          if (e.type === 'ui') console.log('ui', JSON.stringify(e.value));
          if (e.type === 'delta') process.stdout.write(String(e.value));
        },
        (error) => {
          clearTimeout(timer);
          console.log('\ntoolCount', toolCount);
          if (error) reject(Error(error));
          else if (!toolCount) reject(Error('No deterministic tool called'));
          else resolve();
        },
      )
      .catch(reject);
  });
} finally {
  client.stop();
}
