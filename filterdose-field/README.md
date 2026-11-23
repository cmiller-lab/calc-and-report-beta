# FilterDose — Chem-Clean Express Field Edition (v2)

Generic, offline-capable progressive web app for technician field estimates. No preloaded site, equipment asset, or brand-specific tank capacity.

## Technician workflow

1. Select **Horizontal** or **Vertical**.
2. Enter filter inside diameter; for horizontal vessels, enter **straight cylindrical shell length**, excluding dished end heads.
3. Select one of three water-volume methods:
   - **Media depth:** enter actual sand and gravel layer depths, and intended water cover over the sand.
   - **Sand weight:** enter known media weight and approximate gravel depth; app infers bed height from tank geometry and assumed sand bulk density.
   - **Measured gal:** enter **total solution in filter at soak level**, the preferred method if known.
4. Set number of identical tanks, pail size, and any underdrain/headspace liquid allowance.
5. Read the chemical pounds required per filter and across all filters, plus full pails to bring. Copy field summary as needed.

Defaults are an **illustrative 60-inch diameter x 8-foot straight cylinder**, with 24 inches of sand, 6 inches of gravel, 2 inches of solution above sand, 40% void space in each media layer, and sand bulk density 100 lb/ft³. They are NOT a manufacturer's suggested filter configuration.

## Dosing math

Manufacturer instructions for sand filters: **11 oz cleaner per 5 gal water**, or **0.1375 lb cleaner per gallon of total soaking solution**.

Water volume estimated from media pore water plus free water above bed, plus user-entered additional water. Vertical tank uses cross-sectional cylinder area; horizontal tank uses exact circular segment areas to account for the changing width with water depth. End heads, wetted underdrain spaces, and piping **are excluded unless entered**. Actual soak solution may differ from estimate.

Chem-Clean amount = `total liquid gallons × 0.1375` (lb). Each result is rounded for display only; pail counts are rounded up from unrounded values.

## Install

The standalone HTML is supplied separately as `FilterDose_Field_Offline.html`. Open it in a browser. This file works without installation or internet; depending on the browser, local saving and copying can be restricted.

For true **installable/offline PWA**, upload the entire contents of this folder to an HTTPS static host (such as internal company web hosting or GitHub Pages). Open the HTTPS URL in Safari and use Share > Add to Home Screen on iPhone. The service worker caches app files after an online visit, enabling later offline operation.

## Field limitations / safety

- This is an **independent estimator**, not a manufacturer-authorized dosing chart, NSF-certified app, or evidence of an individual chemical's NSF certification.
- Manufacturer instructions specify enough prepared cleaner solution to cover the sand; they explicitly say to call for sand-filter tank capacities. Confirm actual tank volume/soak level with the filter manufacturer where necessary.
- **Keep the manway open during soaking** for pressure relief, per manufacturer directions. Follow current SDS/label and facility isolation/LOTO procedures, and verify disposal arrangements.
- Estimate assumes cylindrical vessel and horizontally level media bed; if the actual bed, pressure vessel head geometry, or underdrain cavity is nonstandard, use measured volume instead.
- Solids displace liquid. Do not use total geometric vessel volume as solution volume; nor use only the water added after draining if the bed retains water.

## Manufacturer reference

Neptune-Benson Chem-Clean Express instructions (sand-filter section):
https://waterlinetechnologies.com/content/Evoqua/Defender%20Filter/Chem-Clean%20Express%20-%20CUT%20SHEET%20-%20Instructions.pdf

The calculator has no network data submission and stores its working values in the browser's local storage.