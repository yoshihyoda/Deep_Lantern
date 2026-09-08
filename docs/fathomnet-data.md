# FathomNet reference image snapshot

`public/data/fathomnet/images.json` contains a sanitized selection from the user-provided `fathomnet-american-samoa.zip`, retrieved on 2026-09-08 at 20:06:01 UTC. The 24 original PNGs are stored unchanged in `public/data/fathomnet/images/`; each retained SHA-256 matches the archive manifest and FathomNet metadata. Their combined size is 103,603,543 bytes. This snapshot does not refresh automatically.

The same sanitized metadata is copied into `lib/abyss/generated/fathomnet.json` for bundling. Vite serves files in `public` as assets and does not permit importing their JSON directly in development. Keep the two metadata files identical when replacing this snapshot.

The selection contains 24 images within the current GEBCO bounds, sharing three registered positions: Ta’u (18), Vailulu’u (5), and CAPSTONE (1). Position uncertainty is not supplied, and repeated coordinates must not be treated as distinct sampling sites or precise per-frame navigation. These reference images are separate from OBIS occurrence totals and exploration scores.

The original 44 annotations are all `UNVERIFIED`. Labels identify a mixture of broad organism groups and a genus, rather than confirmed species. The display list excludes `none` and `other`, preserves `marine organism`, and removes repeated labels within each image. One image has a reported depth of 299.694 m; the other 23 have no depth. The 23 supplied capture timestamps fall between 2017-02-17 and 2017-02-25 UTC; the remaining capture timestamp is unknown. Missing values are retained as `null`.

All images are credited to NOAA Ocean Exploration via FathomNet. Collection names, any supplied bibliographic citation, original image URL, and checksum remain available per image. Original images are licensed [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/); annotations are licensed [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). Preserve attribution, license links, and the original images. Contributor emails and other personal metadata are omitted.

The [FathomNet Data Use Policy](https://www.fathomnet.org/datause) describes database imagery as intended for machine-learning development, not as an occurrence dataset. The [Terms of Use](https://www.fathomnet.org/terms) also describe these intended uses. Display these records as reference imagery and registered locations, not confirmed presence, species distributions, or independent organism counts. The archive alone does not establish permission for every public gallery use.
