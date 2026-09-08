import { env } from 'cloudflare:workers';
import { readJsonLimited } from '@/lib/abyss/request';
import {
  SYSTEM_RULES,
  toolDefinitions,
  executeTool,
  type ToolName,
} from '@/lib/abyss/tools';
import { readSSE } from '@/lib/abyss/sse';
import { chatRequestSchema as requestSchema } from '@/lib/abyss/chat-input';
const runtime = () => env as unknown as Record<string, string | undefined>;
export async function GET() {
  return Response.json(
    { connected: Boolean(runtime().OPENAI_API_KEY), model: 'gpt-6-astra' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
export async function POST(req: Request) {
  if (
    req.headers.get('origin') &&
    req.headers.get('origin') !== new URL(req.url).origin
  )
    return Response.json({ error: 'Origin mismatch' }, { status: 403 });
  const key = runtime().OPENAI_API_KEY;
  if (!key)
    return Response.json(
      {
        error:
          'Astra is not connected. Use the snapshot demo controls; live chat requires a server-side OpenAI API key.',
        code: 'not_configured',
      },
      { status: 503 },
    );
  let body;
  try {
    if (Number(req.headers.get('content-length')) > 32000) throw Error();
    body = requestSchema.parse(await readJsonLimited(req));
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
  const upstream = new AbortController();
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      closed = true;
      upstream.abort();
    },
    async start(controller) {
      const enc = new TextEncoder();
      const send = (v: unknown) => {
        if (!closed)
          controller.enqueue(enc.encode('data: ' + JSON.stringify(v) + '\n\n'));
      };
      const ctx = { minDepth: body.minDepth, selectedId: body.selectedId };
      const input: unknown[] = [
        ...body.history,
        { role: 'user', content: body.message },
      ];
      try {
        send({ type: 'status', value: 'Astra is consulting the evidence…' });
        for (let round = 0; round < 8; round++) {
          const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${key}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-6-astra',
              instructions:
                SYSTEM_RULES +
                ` Current minimum mean depth: ${ctx.minDepth} m. Selected candidate: ${ctx.selectedId ?? 'none'}.`,
              input,
              tools: toolDefinitions,
              stream: true,
              store: false,
              reasoning: { effort: 'low' },
              max_output_tokens: 2400,
            }),
            signal: AbortSignal.any([
              req.signal,
              upstream.signal,
              AbortSignal.timeout(90000),
            ]),
          });
          if (!response.ok || !response.body) {
            throw Error(
              response.status === 429
                ? 'Astra is rate limited or has no available API balance. Snapshot controls remain available.'
                : response.status === 401
                  ? 'Astra authentication failed. Check the server-side API key.'
                  : 'Astra is temporarily unavailable. Snapshot controls remain available.',
            );
          }
          let complete: Record<string, unknown> | null = null;
          for await (const event of readSSE(response.body)) {
            if (event.type === 'response.output_text.delta')
              send({ type: 'delta', value: String(event.delta) });
            else if (event.type === 'response.completed')
              complete = event.response;
            else if (
              event.type === 'response.failed' ||
              event.type === 'response.incomplete' ||
              event.type === 'error'
            )
              throw Error(
                'Astra could not complete this response. Try again or use snapshot controls.',
              );
          }
          if (!complete)
            throw Error('Astra connection interrupted before completion.');
          const output = complete.output as {
            type: string;
            name?: string;
            arguments?: string;
            call_id?: string;
          }[];
          input.push(...output);
          const calls = output.filter((o) => o.type === 'function_call');
          if (!calls.length) {
            send({ type: 'done' });
            return;
          }
          for (const call of calls) {
            let result: unknown;
            try {
              const done = executeTool(
                call.name as ToolName,
                JSON.parse(call.arguments ?? '{}'),
                ctx,
              );
              result = done.result;
              send({ type: 'tool', value: call.name });
              for (const event of done.events)
                send({ type: 'ui', value: event });
            } catch {
              result = {
                error:
                  'Invalid tool arguments or unavailable candidate. Recompute using current constraints.',
              };
            }
            input.push({
              type: 'function_call_output',
              call_id: call.call_id,
              output: JSON.stringify(result),
            });
          }
        }
        throw Error('Tool limit reached. Please narrow the request.');
      } catch (error) {
        if (!req.signal.aborted)
          send({
            type: 'error',
            value:
              error instanceof Error && !/fetch|abort/i.test(error.message)
                ? error.message
                : 'Astra connection ended. The scientific explorer is still available.',
          });
      } finally {
        if (!closed) {
          closed = true;
          controller.close();
        }
        upstream.abort();
      }
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
