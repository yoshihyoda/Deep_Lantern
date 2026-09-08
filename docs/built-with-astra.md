# Built with Astra

Development record for this implementation on 2026-09-08. Human decisions below are actual supplied instructions; no later review or endorsement is inferred.

| Task                                   | Astra contribution                                                                                                                    | Human decision / instruction                                               | Commit    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------- |
| Validate real data before UI           | Verified 69 hashes, independently compared all TIFF/NetCDF cells, preserved NOAA order and OBIS totals                                | Supplied scientific pack must be primary; no fabricated fallback data      | `89ad8bd` |
| Separate evidence from certainty       | Built TID categories, underwater masks, projection and provenance rendering; discovered land cannot be masked by TID 0 alone          | TID must remain source provenance; vertical exaggeration disclosed         | `89ad8bd` |
| Deterministic candidate exploration    | Implemented 256-cell aggregation, robust relief, conserved path/record allocation, separated A/B/C ranking, and scientific tests      | DIVE01 excluded; OBIS counts are records; scoring separated from the model | `45e7434` |
| Community evidence and voting          | Built structured briefs with source IDs, source/license inspection and persisted virtual ballots                                      | Hypothetical 60-minute voting with no real NOAA allocation                 | `45e7434` |
| Replace the unavailable API credential | Integrated CLI 0.153.4 app-server, diagnosed Astra's code-mode-only tool routing, and verified real get_rov_activity/set_layers calls | User explicitly asked: “Codexのapp serverで現状は代替して”                 | `0932fb0` |

## Observed live demonstration

The app-server integration was tested using actual GPT-6 Astra, not a canned response. A ROV request emitted `get_rov_activity` and `set_layers`, then streamed an evidence-based answer. In browser testing, the discovery prompt emitted deterministic candidate computation, camera focus and brief creation. A follow-up requesting mean depths greater than 4,000 m changed the UI constraint to 4,000 and produced candidates with mean depths approximately 4,099 / 5,040 / 4,459 m. These are real snapshot computations. Recorded tool names and UI events were verified independently of the model's prose.

The failed intermediate attempt with Code Mode disabled did not manipulate the map. That cause was fixed before calling the local integration operational. Optional API-based mid-turn steering and FathomNet were not implemented or claimed.
