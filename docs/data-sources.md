# Data sources

The supplied `abyss-commons-american-samoa-data.zip` is primary. All 69 SHA256 entries matched, and an independent audit compared the TIFF and NetCDF arrays across all 115,200 cells. Original source metadata, source URLs, timestamps, attribution, terms PDFs, and all 65 OBIS dataset citations remain in `public/data/snapshot`.

| Source      | Snapshot                                                                           | Representation                                  | Interpretation                                            |
| ----------- | ---------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------- |
| GEBCO 2026  | 2026-09-08T20:21:00.959169Z                                                        | 480 columns × 240 rows, 15 arcseconds           | Elevation −5,083 to +860 m; TID source types              |
| NOAA EX1702 | First source retrieved 2026-09-08T20:19:04.683834Z; individual timestamps retained | DIVE01, DIVE02, DIVE09, DIVE13; 21,074 vertices | Recorded vehicle paths; no per-vertex depth or timestamps |
| OBIS        | First source retrieved 2026-09-08T20:19:05.982436Z; individual timestamps retained | 151 geohash5 and 4,099 geohash8 polygons        | Both sum to 323,640 public occurrence records             |

Source links are derived from provided metadata: [GEBCO 2026](https://www.gebco.net/data-products-gridded-bathymetry-data/gebco2026-grid), [NOAA EX1702](https://www.ncei.noaa.gov/waf/okeanos-rov-cruises/ex1702/), [OBIS policy](https://portal.obis.org/data/datapolicy/).

NOAA DIVE01 did not reach bottom. DIVE13 is listed as 2017-03-07, outside the overview cruise range; the original date and inconsistency are retained. NOAA navigation height 0 is not interpreted as water depth.

OBIS source licenses are mixed, including CC-BY-NC and ambiguous original wording. The app links to the complete original `dataset_licenses_and_citations.json`; it does not present a blanket commercial-use claim. Counts have no per-cell species/date/depth breakdown. Grid precision does not establish original observation-position accuracy.

The separate raw GEBCO ZIP is redundant with the validated pack and is not re-downloaded. The attached UI component bundle supplied design tokens and component references. No UI reference image was present in the supplied file list. Optional FathomNet is not loaded into scoring or the display.
