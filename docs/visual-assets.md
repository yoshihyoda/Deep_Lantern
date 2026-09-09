# Expedition imagery and map interactions

The interface is English. Four original concept images were generated with the built-in image generation tool (`gpt-image-2`) on 8 September 2026 after the user approved that model. Originals were 1536 × 1024 PNG files; project assets are same-size JPEG exports at quality 85. No content edits, generated maps, or synthetic observations were used.

The ROV, coral garden, and volcanic ridge illustrate the three exploration entry points. Atmospheric water imagery supports the Astra panel, and the ROV illustration appears in dive details. Visible captions distinguish these from field observations. GEBCO terrain, NOAA paths, and OBIS record counts continue to come from the original verified snapshot. No imagery is used to infer the organisms, geology, or appearance of a candidate cell.

## Saved images and final prompts

### abyss-rov

Asset: `public/imagery/abyss-rov.jpg`

Create a premium expedition editorial concept image of a generic unmanned deep-sea remotely operated vehicle suspended above a quiet, shadowed seafloor. Place the compact utilitarian ROV mostly in the right half, viewed from a cinematic three-quarter angle, with a restrained subtle amber frame and warm-white headlamps cutting through suspended marine snow. Suggest scale with a small illuminated patch of textured seabed, while surrounding water dissolves into deep navy and muted teal. Sophisticated photographic realism, physically plausible light falloff, fine particulate detail, gentle film grain, restrained contrast, no oversaturated glow. Landscape 3:2 composition; keep the left 45 percent dark, sparse, and softly graded for later English HTML labels. Fictional location and fictional vehicle design: this is AI concept imagery, not a field observation, a NOAA photograph, or a scientifically accurate Samoa reconstruction. No people, text, logos, watermark, UI, map labels, or specific coordinates.

### abyss-corals

Asset: `public/imagery/abyss-corals.jpg`

Create a premium expedition editorial concept image of a delicate deep-water coral garden rising from a shadowed rocky seafloor. Arrange the finest branching and fan-like coral forms mostly in the right half, in soft coral pink, warm ivory, and muted lavender; depict an imagined mixed garden without asserting any specific species. A gentle warm-white survey light reveals translucent edges and subtle surface texture, surrounded by deep navy and muted teal water with sparse suspended marine snow and a faint amber highlight. Sophisticated photographic realism, quiet wonder, physically plausible light falloff, gentle film grain, restrained contrast, no oversaturated glow. Landscape 3:2 composition; keep the left 45 percent dark, sparse, and softly graded for later English HTML labels. Fictional location: this is AI concept imagery, not a field observation, a NOAA photograph, or a scientifically accurate Samoa reconstruction. No fish as primary subjects, people, text, logos, watermark, UI, map labels, or specific coordinates.

### abyss-ridge

Asset: `public/imagery/abyss-ridge.jpg`

Create a premium expedition editorial concept image of a dramatic submarine volcanic ridge disappearing into midnight water. Build a rugged basalt crest with layered rock faces mostly across the right half, receding diagonally into the far upper right and immense dark water. A narrow oblique survey light brushes the nearest rock with muted teal and a trace of warm amber, revealing fine mineral texture while the distant ridge vanishes into deep navy. Sparse marine snow suggests depth and scale. Sophisticated photographic realism, atmospheric perspective, physically plausible artificial light falloff, gentle film grain, restrained contrast, no glowing lava or exaggerated fantasy geology. Landscape 3:2 composition; keep the left 45 percent dark, sparse, and softly graded for later English HTML labels. An imagined geological scene without any claim of a real surveyed landform: AI concept imagery, not a field observation, a NOAA photograph, or a scientifically accurate Samoa reconstruction. No text, logos, watermark, UI, map labels, or specific coordinates.

### abyss-atmosphere

Asset: `public/imagery/abyss-atmosphere.jpg`

Create a premium expedition editorial concept image of an abstract atmospheric descent into the abyss, intended as a quiet dashboard sidebar backdrop. Show immense deep navy and muted teal water, exceptionally sparse drifting marine snow, and a soft restrained cyan shaft entering from the upper right and fading into near-black depth. Concentrate the subtle light structure and particulate detail in the right half; leave the left 45 percent exceptionally dark, uncluttered, low contrast, and softly graded for later English HTML labels. Suggest motion and depth through layered particles and extremely gentle haze, with one barely perceptible warm amber glint that matches the expedition image series. Sophisticated photographic atmosphere, fine film grain, no hard focal object, no bright bloom, no stars or outer-space appearance. Landscape 3:2 composition with crop-friendly edges. Fictional AI concept imagery, not a field observation or a NOAA photograph. No visible seafloor, people, vehicle, text, logos, watermark, UI, map labels, or specific coordinates.

## Map behavior

- Click terrain for geographic coordinates, the original GEBCO pixel elevation, and categorical source type. Positive elevation is identified as land. Displayed terrain height is exaggerated ×6.
- Click an OBIS polygon to inspect its whole-cell record count and the GEBCO depth at its center. A record navigator provides keyboard access to cells in descending record-count order. Clipped display cells retain original-cell counts and show a caveat. Counts do not establish abundance, species, observation depth, or habitat causes.
- Select a NOAA dive to frame its path. Play, pause, restart, or scrub through the full ordered coordinates using cumulative great-circle segment distances. Playback duration is a presentation choice, not observed time. The marker is draped on GEBCO; it is not measured vehicle depth. DIVE01 remains excluded from scientific coverage scoring and clearly marked as not reaching the seafloor.
- Switch between immersive Dive view, 3D map and Top down; zoom, reset, or focus candidate pins. Keyboard map controls: arrows to pan, +/- to zoom, Enter to inspect the center, R to reset, Escape to close details.
- Image assets and interactive changes are local. The Codex app-server chat connection remains unchanged.

## Verification

Unit checks validate inverse projection, real GEBCO point values and edge ordering, land masking, all four original NOAA path lengths, exact replay endpoints, and non-uniform / repeated vertices. The full existing scientific and Codex tests remain part of the suite. Browser checks cover real terrain picking, OBIS polygon picking, path controls, perspective switching and responsive layouts.

Final validation before the underwater revamp: all 28 tests, TypeScript and lint pass. Browser checks at 1440px and 390px confirmed no horizontal overflow; all four 1536 × 1024 image assets loaded. The path slider is accessible by name and its End key reaches 100%. Direct clicks on terrain and on an OBIS polygon returned the matching original raster values and 60,506 records respectively. Local Codex app-server connection remained active.

## Immersive underwater revamp

The full viewport now holds a continuous WebGL ocean. Layers and Astra open as translucent drawers; the three generated image cards form a collapsible expedition dock. Focus view hides the map chrome, and choosing a candidate below the map brings the ocean back into view. All interface labels remain English.

Dive view uses distance fog, camera-relative artificial survey spotlights, world-space GPU particles, subtle color grading, a vignette, and procedural surface color variation. These are illustrative appearance treatments, never water measurements, observed bottom texture, or additional terrain geometry. The original GEBCO triangles and source-derived depth readouts remain separate from these effects. The seabed's ×6 vertical exaggeration is stated on the map. Survey view retains the overview grid; survey lights and atmospheric controls apply to Dive view only.

The camera stays within the dataset and above the exact terrain triangles, with interpolation matching the renderer's diagonal and raster pixel centers. A dedicated regression test distinguishes this interpolation from bilinear interpolation and nearest-neighbor depth reads. World-space particle wrapping preserves parallax while moving. Reduced-motion preference freezes ambient particles and disables eased camera transitions; explicit path replay remains user-controlled. Rendering pauses offscreen and in hidden tabs, pixel ratio is capped, and sustained low frame rates reduce resolution. GPU geometry, lights, postprocessing passes, controls and observers are disposed on unmount.

Validation: 29 tests, TypeScript, lint and production build passed. The build retains the existing large-chunk and Vinext route-classification notices. Browser checks at 1440px and 390px found no horizontal overflow or WebGL console errors. Checks covered Dive/Top-down switching, bounded keyboard panning, original GEBCO inspection, NOAA replay to 100%, the 60,506-record OBIS cell (3,522 m at its display center), reduced-motion behavior, and an English Astra response through the local Codex app server. The browser reported 60 fps on the tested machine; performance varies with hardware. No deployment was made.

## First-person swimming

Dive view now supports WASD movement relative to the viewing direction, Q/C to descend, E/Space to ascend, and Shift to swim faster. Mouse movement looks around after an explicit Start swimming gesture captures the pointer. When capture is unavailable, focused-canvas keyboard controls and drag-to-look remain usable. Arrow keys provide keyboard look, F/Enter inspects the center of view, R resets, and Escape/Tab releases control. Opening Astra or a photo dialog, leaving the page, changing camera mode, or losing focus clears movement. A key press in a text field cannot move the camera.

Movement is normalized, time-based, and capped after interrupted frames. Terrain collision uses the rendered GEBCO triangles, with bounded substeps to prevent swimming through narrow land strips. Dive movement stays inside the raster, above the seafloor and below the sea surface. This is movement through the exaggerated display, not a simulated vehicle speed or reported dive depth. Inspection returns the original source-pixel depth rather than camera altitude. First-person rotation is independent of OrbitControls; map modes retain orbit behavior.

## Real image references

A separate Real dive photos entry, the life expedition card, and the Reference photos layer open 24 unchanged NOAA source images from the supplied FathomNet sample. Camera pins represent the three shared registered positions, not 24 independent observation sites. Gallery labels are explicitly unverified; missing capture times and depths remain unknown. The gallery keeps source links, attribution and separate image/annotation license links. Full originals are contained in the image viewport, and paginated thumbnails limit initial image loading. No generated imagery is substituted for a field image, and FathomNet labels or locations do not enter OBIS occurrence totals or exploration scores. See `docs/fathomnet-data.md` for provenance and limitations.

### Validation of swimming and reference images

All 40 tests, TypeScript, lint, and the production build pass. Build output retains the large-chunk and Vinext route-classification notices. Original PNG bytes and hashes were compared directly with the supplied ZIP: all 24 match; sanitized metadata contains no email addresses. The bundled and downloadable metadata copies are identical.

Browser verification at 1280px and 390px covered real image rendering, unverified-label filtering (including octopus), six-image pagination, location filtering, map focus from a photo, and reopening the 18-image Ta’u group from its camera pin. No horizontal overflow or browser warning/error was present after the server restart. Swim checks verified W movement, drag-to-look, photo-dialog release, and no camera movement while entering WASD in Astra. The in-app browser used the drag fallback; successful, rejected, legacy-void and late pointer-lock outcomes are covered by controller tests. Held-key motion and frame-rate consistency are unit tested. Astra reports CODEX CONNECTED after restart. The local development server remains running; no deployment was made.
