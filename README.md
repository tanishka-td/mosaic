# Mosaic

Mosaic is a Maharashtra-focused location intelligence prototype. It compares OpenStreetMap business activity with modeled population in a movable map with selectable H3 hexagons, radius controls, place search, and relative category scores.

## Run locally

On Windows PowerShell, install dependencies with `npm.cmd install`, then start the app with `npm.cmd run dev`. In other shells, use `npm install` and `npm run dev`.

## Current build

- Maharashtra-only market grid with 213 resolution 4 source hexagons and a Maharashtra boundary overlay.
- A 25 km default radius; changing the radius also changes the displayed H3 resolution. Fine cells allocate source data proportionally and should be treated as estimates.
- More than 60 business and service categories, including retail, food, health, professional services, transport, education, lodging, and leisure.
- Place-name search is restricted to Maharashtra and works without an API key through Photon. The curated city list remains as a fallback.
- OpenFreeMap/OpenStreetMap streets and place labels appear as you zoom; their completeness depends on OpenStreetMap coverage and an internet connection.
- Soft map transitions, animated entry and hover feedback, and reduced-motion support.

## Data coverage and limits

The population layer uses WorldPop modeled estimates for 2025, aggregated from the India raster to Maharashtra H3 cells. Business counts represent 37,592 mapped OpenStreetMap features in Maharashtra; they are not a complete or official business registry. Scores compare population density and mapped competitor density within this source snapshot; they are relative signals, not sales forecasts. Fine H3 resolutions allocate counts from the resolution 4 cells proportionally.

The browser uses only Maharashtra-specific grid and boundary files from `public/data`. Downloaded source rasters, source boundaries, intermediate grids, and archived Pune prototype files are kept under ignored `data/raw` and `data/archive` folders. See [`data/SOURCES.md`](data/SOURCES.md) for sources, licences, and methods.

## Refresh data

The `data:maharashtra-*` scripts rebuild Maharashtra assets from local source data or retrieve fresh OSM/WorldPop/boundary inputs. `data:maharashtra-population` performs the full refresh and may take time because it downloads the WorldPop raster and queries the public Overpass service. `data:maharashtra-businesses` refreshes the mapped business snapshot.

## Git and local files

`.gitignore` excludes dependencies, build output, local environment files, large source downloads, and archived prototype inputs. Keep `.env.example`; do not commit `.env.local` or API credentials.
