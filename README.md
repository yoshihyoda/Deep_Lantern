# ABYSS COMMONS — Map the Unknown

A working American Samoa exploration workspace built from verified GEBCO 2026, NOAA EX1702, and OBIS snapshots. The map distinguishes source provenance from public observation coverage; an exploration heuristic proposes three spatially separated candidates.

## Run locally with Codex

Requirements: Node 22.13 or newer, npm, and a signed-in `codex` CLI (integration verified against 0.153.4). No OpenAI API key is needed for the local Codex connection.

```sh
npm ci
npm run data:prepare
npx wrangler d1 migrations apply DB --local --config wrangler.local.jsonc
npm run dev -- --host 127.0.0.1 --port 3000 --strictPort
```

Open `http://localhost:3000`. The Astra panel reports **CODEX CONNECTED** when the local app server is signed in. The Vite development plugin starts an app-server child over stdio; it is not exposed as a public WebSocket or separate public service. Each question uses an ephemeral conversation, real GPT-6 Astra, and nine validated scientific tools. No authentication tokens are copied into the app or browser.

If the CLI is elsewhere, set `CODEX_BINARY` to its executable path. Sign in with the normal Codex login flow before starting the app. Do not place account credentials in source files. The local child disables shell execution, apps, plugins, browser/computer use, and external scientific search. Code mode remains enabled because the tested CLI 0.153.4 integration requires it to reach the supplied Astra tools.

## Explore

1. Orbit, pan, and zoom the real 480×240 GEBCO terrain. Vertical exaggeration is ×6.
2. Move **WHAT DO WE ACTUALLY KNOW?** toward REALITY. Direct types remain solid; derived types fade; unknown types use a faint wireframe.
3. Ask Astra to show recorded ROV activity, then find a deep public-data gap. Tool calls change layers, run the deterministic candidate engine, and move the camera.
4. Change minimum **mean** depth to recompute candidates. No constraint is silently relaxed.
5. Select a candidate and inspect/download its Community Dive Brief.
6. Allocate 60 hypothetical ROV minutes. Voting is at `/vote?depth=2000`; totals poll every 5 seconds. A separate phone needs access to the hosted site. The local Codex app is bound to this computer's loopback interface.

The four quick prompts also provide explicitly labeled deterministic snapshot demos when no AI connection is available.

## Hosted runtime

The Cloudflare/Sites deployment contains the complete scientific explorer and persistent D1 voting. A hosted Worker cannot access your computer's Codex process. Hosted AI can optionally use the server-side `OPENAI_API_KEY` secret through the Responses API. Without it, the hosted panel clearly shows AI not connected and retains snapshot tools. Never use `NEXT_PUBLIC_` or `VITE_` for credentials. The default development path uses Codex app server regardless of this optional hosted setting.

## Scientific scope

- GEBCO: 115,200 aligned raster cells; all source TIFF/NetCDF values validated. TID is a categorical source type, not confidence. Land is masked using elevation, not TID alone.
- NOAA: four real paths, 21,074 ordered vertices. DIVE01 did not reach bottom and is excluded from scoring. The other three provide 38.4812 km of recorded vehicle paths, not verified bottom-only coverage.
- OBIS: 323,640 public occurrence records, 151 overview cells, 4,099 detailed cells, 65 contributing datasets. The cache has no per-cell taxon/depth/time detail. Zero cache records does not mean no life.
- All inputs are **SNAPSHOT**, retrieved 2026-09-08. There is no automatic scientific API refresh.
- OBIS includes CC-BY-NC and mixed original source terms. All 65 source citations/licenses remain inspectable. No blanket commercial-use license is asserted.

## Checks

```sh
npm test
npm run typecheck
npm run lint
npm run build
# Optional: consumes the signed-in Codex account's usage, makes a real model call.
node --import tsx scripts/smoke-codex.ts
```

`data:prepare` verifies all 69 SHA256 entries before deriving browser terrain and the 256-cell grid. It fails on missing or altered source data. Unit tests cover scientific invariants, DIVE01 exclusion, candidate separation/depth, source IDs, score bounds, voting ties, streaming and byte limits. Vendored starter UI files are excluded from authored-code lint; browser storage synchronization is explicitly annotated.

See [architecture](docs/architecture.md), [sources](docs/data-sources.md), [scientific integrity](docs/scientific-integrity.md), [development record](docs/built-with-astra.md), and [validation](docs/validation.md).

Optional FathomNet, protected areas, and true mid-turn steering are not included. Changing depth stops the current request and recomputes candidates. Sending another message starts a new constrained request; it is not advertised as API mid-turn steering.
