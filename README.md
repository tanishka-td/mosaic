# Mosaic

Mosaic is a location intelligence demo for exploring business opportunity across Maharashtra, India. Choose a business category, search for a place, and compare mapped business activity with modeled population on an interactive H3 hexagon map.

## Features

- Pan and zoom across Maharashtra, with city, locality, and street labels from OpenStreetMap based map tiles.
- Select market hexagons and compare relative opportunity for 60+ business and service categories.
- Search Maharashtra locations or pin a point on the map.
- Adjust the analysis radius from 3 km to 150 km; the displayed H3 resolution changes with the radius.
- Inspect estimated population and mapped businesses around a selected area.

## Run locally

Requires Node.js 20 or later.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. On Windows PowerShell, use `npm.cmd` in place of `npm` if script execution is restricted.

Create a production build with `npm run build`; preview it with `npm run preview`.

## Data and limitations

The committed app data is in `public/data/` and covers Maharashtra only. Population is a modeled WorldPop 2025 estimate. Business counts are mapped OpenStreetMap features retrieved through Overpass; they are not an official or complete business registry. Opportunity scores are relative comparisons within the available data, not sales forecasts. Smaller H3 cells allocate totals from the source grid proportionally and should be treated as estimates.

Street and place labels are loaded from OpenFreeMap vector tiles. Location search uses Photon. Both services require an internet connection and are subject to their availability and data coverage. Attribution and data-source details are in [`data/SOURCES.md`](data/SOURCES.md).

## Refreshing the data

The standard app runs from the committed files in `public/data/`; refreshing data is optional. Refresh scripts use the source files in the ignored `data/raw/` directory and may require Python with NumPy and Pillow for raster extraction.

```sh
npm run data:maharashtra                 # Rebuild browser files from local source data
npm run data:maharashtra-boundaries      # Download state boundaries, then rebuild
npm run data:maharashtra-businesses      # Refresh Maharashtra business counts from Overpass
npm run data:maharashtra-population      # Full population and business data refresh
```

The full refresh downloads the WorldPop raster and queries public data services. These operations can take time and may be limited by service availability. The business refresh keeps the last complete snapshot if a refresh fails.

## Repository notes

`data/raw/`, `node_modules/`, and `dist/` are excluded by `.gitignore`. The two Maharashtra files under `public/data/` are the app’s runtime datasets and should remain committed. Keep credentials and local environment files out of the repository.
