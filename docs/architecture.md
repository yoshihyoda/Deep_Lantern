# Architecture

The product is one TypeScript/React application with Next-compatible routes, Vinext/Vite, and the Sites Cloudflare runtime. Three.js directly manages a WebGL scene inside one React component, with no separate Python server or GIS backend. React owns central layer, truth, candidate, brief, chat and selection state. The supplied ABYSS design tokens inform the navy/cyan/amber theme; controls reuse the starter's accessible primitives.

## Data path

`public/data/snapshot` preserves the supplied scientific pack. `scripts/prepare-data.ts` verifies SHA256, reads aligned GeoTIFFs without resampling TID, computes metrics through `lib/abyss/science.ts`, and produces `public/data/terrain.json` and `lib/abyss/generated`. The registry is derived from original source metadata. No scientific endpoint is called at runtime.

The browser loads the full terrain and modest overview layers. NOAA vertices remain ordered. OBIS polygons use one logarithmic material per overview cell; the 323,640 records are never individual DOM elements. Detailed geohash8 counts enter the offline deterministic grid. Missing NOAA or OBIS display assets show an unavailable-layer status while the verified precomputed metrics and terrain remain usable.

The scene uses a local equirectangular projection with mean Earth radius 6371.0088 km, longitude origin −170°, latitude origin −14.5°, x east, z south. Elevation y is meters / 1000 × 6. Mesh category assignment is nearest source raster cell; TID never undergoes bilinear interpolation. Camera focus resolves only known candidate IDs to coordinates.

## Two AI transports, one tool implementation

`lib/abyss/tools.ts` owns the nine Zod-validated deterministic handlers and UI events. Scores and briefs are calculated there, never delegated to model arithmetic. UI applies `layers`, `truth`, `candidates`, `focus` and `brief` events.

Local development: `server/codex-app-server.ts` is a Vite middleware at `/api/astra`. It launches the signed-in CLI via stdio, initializes the experimental dynamic-tool capability, creates an ephemeral thread with a read-only sandbox, and starts a real GPT-6 Astra turn. `item/tool/call` is answered with deterministic tool results; agent deltas and UI events stream to the browser via SSE. Each request includes bounded recent conversation state. The app-server child lives only for the development server lifetime. The server binds to loopback, validates Host, and checks any supplied Origin against the allowed local app. No account credentials or API tokens are returned to the browser. Built-in shell/apps/plugins/browser/computer/image tools are disabled. Code mode host remains available because the tested CLI 0.153.4 integration routes Astra tools through Code Mode; disabling it also hides dynamic tools.

Hosted runtime: the Worker route optionally calls the OpenAI Responses API using a server secret. The stateless loop retains every output item, returns matching function-call outputs, and emits the same events. No secret means a truthful 503, without breaking scientific exploration. Downstream cancellation aborts the upstream request. Both transports have body limits and candidate-ID validation. The hosted Responses transport has not been exercised against a live API credential in this delivery.

Local Codex is intentionally not tunneled into the deployed site. Remote AI therefore needs a hosted credential; the hosted fallback remains operational without one.

## Community voting

D1 stores one 60-minute ballot per browser-generated UUID per depth-specific snapshot session. Re-voting replaces the prior choice, rather than adding minutes. IDs must match currently eligible candidates. The UI polls every 5 seconds and handles ties and no votes. This is an anonymous hackathon poll, not identity-verified governance; clearing browser storage can create a new participant. No real vehicle time is allocated.

The source schema lives in `db/schema.ts`; generated migrations are under `drizzle/`. `wrangler.local.jsonc` uses the scaffold's local placeholder ID only. Production bindings are owned by Sites.

## Operational boundaries

The data explorer survives model errors. Free-form chat requires a connected transport. No live scientific refresh, accounts, protected-area inference, operational dive planning, or FathomNet occurrence scoring is implemented. Do not make navigational decisions from this application.

The development server binds to 127.0.0.1:3000 and refuses an occupied port. The local bridge loads outside the Vite configuration dependency graph so UI changes do not restart the entire Cloudflare runtime. Restart development after changing bridge code or scientific tool implementations. The bridge limits active and starting requests together to two, and interrupts/unsubscribes failed or cancelled turns.
