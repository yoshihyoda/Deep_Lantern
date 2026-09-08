# Scientific integrity and deterministic scoring

The application identifies gaps in these particular public snapshots. It never establishes that a place has never been seen or that organisms are absent. TID measures source type, not confidence, statistical accuracy or AI certainty. A direct-source grid cell is not an assertion that every point within it was directly sounded.

## Grid metrics

The bbox [−171, −15, −169, −14] is divided into 16×16 cells. Each GEBCO pixel center belongs to one cell. Mean depth, robust relief (P95−P05), and provenance fractions use underwater pixels (`elevation < 0`), excluding nodata. Land must not be inferred from TID 0 alone: 467 positive-elevation cells have other TIDs. Fractions normalize over underwater pixels. Ocean fraction must exceed 0.9 for a candidate.

The supplied TID mapping is authoritative: 10–17 direct, 40–48 indirect (including 44), 70–72 mixed/unknown, 0 land. Unrecognized TID is unknown. The scene assigns categories from nearest raster cells; categorical interpolation is never used. Underwater source fractions are approximately 98.4% direct, 1.6% indirect, and less than 0.1% unknown. The small inferred extent is real and is not enlarged to dramatize the slider.

NOAA segments from `reached_bottom === true` dives are split at grid boundaries. The haversine length of each source segment is allocated by its parametric fraction to exactly one cell per subsegment. This preserves the full 38.481209778 km recorded length. It is not bottom-phase-only length, swath area, unique visited area, or an independent survey count. DIVE01 contributes exactly zero. Rendered paths are draped onto GEBCO for legibility, not measured vehicle altitude.

Each clipped geohash8 polygon's record count is assigned once by its center. This is a disclosed spatial approximation, preserves all 323,640 records, and does not invent within-cell positions or multiply counts across intersecting cells.

## Product heuristic

All components are clamped to [0,1]. Constants and weights are named in `lib/abyss/science.ts`.

```
visualGap = 1 − clamp(recordedPathKm / 5)
biologicalGap = 1 − clamp(log1p(records) / log1p(10000))
boundary = clamp(1 − abs(directFraction − 0.5) × 2)
relief = clamp((P95 elevation − P05 elevation) / 2000 m)
score = .30 visualGap + .25 biologicalGap + .20 boundary
      + .15 relief + .10 directFraction
```

The references 5 km, 10,000 records and 2,000 m are demo normalization choices, not calibrated scientific thresholds. The score is not scientific importance, safety, biodiversity, discovery likelihood or a recommendation to deploy a real vehicle.

Candidate A emphasizes direct provenance, sparse recorded visual activity and relief. B emphasizes deeper water and the biological-record gap. C emphasizes mixed direct/indirect composition and must have a nonzero boundary component. Candidates must be at least 25 km apart. A strict depth constraint may return fewer than three candidates or none; the application never fabricates a frontier or relaxes the constraint.

Source citations in structured briefs are only registry IDs. Source URLs are taken from metadata; models cannot supply clickable source URLs. The UI also reports uncertainty and links full metadata/licenses.
