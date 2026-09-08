# Validation record

Validated on 2026-09-08, using the supplied American Samoa snapshot.

## Scientific checks

- All 69 SHA256 manifest entries matched. An independent TIFF/NetCDF comparison matched every one of 115,200 elevation and TID cells.
- The automated suite passes 24 tests: source categorization, projection, underwater masking, robust relief, bounded scores, 25 km candidate separation, strict depth constraints, DIVE01 exclusion, conserved NOAA path distances and OBIS counts, registry citations, structured briefs, voting ties, validated tools, snapshot demonstrations, streaming and request limits, and Codex concurrency/cleanup.
- The original NOAA and OBIS display files were temporarily withheld together. The browser displayed both unavailable-layer notices while retaining the terrain and all three computed candidates. Both original files were restored afterward.

## Application checks

- Type checking, authored-code lint and the production build pass. Vendored starter UI is excluded from authored-code lint.
- Real local Codex integration: recorded-path tools, deterministic candidate computation, camera focus, brief creation, and a follow-up minimum depth of 4,000 m worked. A final direct-measurement request changed the provenance slider to zero through the live model's tool call.
- Regression tests mock only the app-server RPC transport; they use no model quota. They prove that three simultaneous requests start at most two jobs, start reservations are released on failure, and failed/cancelled running turns are interrupted and unsubscribed.
- Desktop 1440×900 and small laptop 1100×750 layouts were inspected. The 390×844 mobile voting page has no horizontal overflow; ballot controls are approximately 342×79 CSS pixels. Terrain performance was about 60 FPS in the tested browser, not a guarantee for other devices.
- Minimum mean depth 11,000 m produces a truthful empty state and disables the brief action. Returning to 2,000 m restores the three candidates. Reload preserves the chosen depth.
- Two independent HTTP voters were tested: two ballots allocate 120 virtual minutes, a replacement ballot does not increase the total, invalid candidates are rejected, and cross-origin writes are rejected. Test ballots were removed. This validates independent clients, not an additional physical-phone browser.
- The built Worker was served locally without an API key. It reported AI not connected and returned 503 for AI requests; the snapshot ROV and discovery demonstrations still changed the map and opened a cited brief. D1 voting worked using the same explicitly selected local persistence directory as development. The initial production-preview vote failure was an empty, separate local database; the start command now shares `.wrangler/state`.
- Malformed Origin headers are rejected with 403. The local development server remains bound to loopback and refuses port drift.

## Remaining limits

The hosted Responses API transport has not been tested with a live API credential. A deployed Worker cannot use the local Codex child process. Public scientific endpoints are intentionally not refreshed at runtime. FathomNet, protected areas, and true mid-turn steering remain optional future work.

The build reports a large client chunk from the 3D application and an informational Vinext route-classification limitation. Neither prevents the validated application from running. React's server-component packages were patched to 19.2.8; transitive development/build-tool advisories remain in the starter toolchain and are not claimed to be fully resolved.

## Local development connection fix

Vite is pinned to 8.0.16 after a user reported `send was called before connect` at the console-forwarding handler. This matches [Vite issue 22407](https://github.com/vitejs/vite/issues/22407): when the development WebSocket disconnects, forwarding an unhandled error can itself reject and recursively trigger the same handler. The installed version includes [the upstream fix](https://github.com/vitejs/vite/commit/e8e9a34dcf2540139de558a10187630884d10217). HMR, error overlays and console forwarding remain enabled.

The installed Vite client code was exercised with a disconnected transport: console logging, error events and unhandled-rejection events caused no secondary unhandled rejections; normal console output remained intact, and forwarding resumed after reconnection. Direct HMR WebSocket handshakes succeeded for both `localhost:3000` and `127.0.0.1:3000`. The 24 application tests, type checking, lint and production build passed after the update.

A browser-level forced-offline probe was inconclusive because the testing session timed out reconnecting; it is not recorded as a passing browser reconnection test. The compiled-client lifecycle check and direct WebSocket checks above were used to validate the relevant behavior. The local application was reopened with the patched client for normal UI and Codex interaction checks.
