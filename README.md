# Mosaic

Mosaic is a location intelligence demo for exploring business opportunity across Maharashtra, India. Choose a business category, search for a place, and compare mapped business activity with modeled population on an interactive H3 hexagon map.

## Live Application

https://main.d1i6q84kj6cns5.amplifyapp.com/

## Data Storage

Processed datasets are stored in Amazon S3 and delivered
through Amazon CloudFront.

## Features

- Pan and zoom across Maharashtra, with city, locality, and street labels from OpenStreetMap based map tiles. If the tile service is unavailable, the Maharashtra market grid remains usable on a plain map.
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

Street and place labels are loaded from OpenFreeMap vector tiles and need an internet connection. Only features with an English map name are labeled, so some streets and places may be unlabeled. Location search uses Photon when available, with a curated Maharashtra city list as a fallback. Both public services are subject to availability and data coverage. Attribution and data-source details are in [`data/SOURCES.md`](data/SOURCES.md).

Radius totals estimate partial hexagon overlap by sampling one finer H3 level. This avoids counting a whole hexagon just because its center falls inside the radius, but remains an estimate rather than exact circle-polygon clipping.

## Refreshing the data

The standard app runs from the committed files in `public/data/`; refreshing data is optional. The interactive map code loads only when the map approaches the screen. Refresh scripts use the source files in the ignored `data/raw/` directory and may require Python with NumPy and Pillow for raster extraction.

```sh
npm run data:maharashtra                 # Rebuild browser files from local source data
npm run data:maharashtra-boundaries      # Download state boundaries, then rebuild
npm run data:maharashtra-businesses      # Refresh Maharashtra business counts from Overpass
npm run data:maharashtra-population      # Full population and business data refresh
```

The full refresh downloads the WorldPop raster and queries public data services. These operations can take time and may be limited by service availability. The business refresh keeps the last complete snapshot if a refresh fails.

## AWS Architecture

Mosaic uses the following AWS services:

- **AWS Amplify:** Hosts the React frontend and automates
  deployment through GitHub integration.
- **Amazon S3:** Stores processed geospatial datasets,
  including Maharashtra's boundary and H3 hexagonal grid.
- **Amazon CloudFront:** Delivers the datasets to the
  frontend through a private S3 origin.
- **Origin Access Control (OAC):** Restricts direct
  access to the S3 bucket.

### Data Flow

1. Geospatial datasets are processed and stored in Amazon S3.
2. CloudFront retrieves the datasets from the private S3 origin.
3. The Mosaic frontend fetches the datasets through CloudFront.
4. The application visualizes the data using MapLibre GL
   and H3 geospatial indexing.

## Repository notes

`data/raw/`, `node_modules/`, and `dist/` are excluded by `.gitignore`. The two Maharashtra files under `public/data/` are the app’s runtime datasets and should remain committed. Keep credentials and local environment files out of the repository.
