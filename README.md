# WindGL (MapLibre Fork)

A WebGL-powered visualization of wind fields using custom **MapLibre GL JS** layers.  
Capable of rendering up to 1 million wind particles at 60fps.

This project is a continuation of [astrosat/windgl](https://github.com/astrosat/windgl), which itself was based on [mapbox/webgl-wind](https://github.com/mapbox/webgl-wind).  
It has been adapted and updated to work with **MapLibre GL JS** as a plugin.

---

## Project Status

The original authors (@gampleman at @astrosat) are no longer maintaining the project.  
This fork modernizes it for MapLibre and includes tooling to generate tiled wind data from GRIB2/GRIB sources.

**Notes:**
- This code should be considered experimental. Some bugs from the original remain.
- Pull requests and contributions are welcome.
- See the `scripts/` tools for workflows to generate your own wind tiles (HRRR, GFS, etc.).

---

## Compatibility

Works with **MapLibre GL JS 2 through 6**. The layers accept both the old
`render(gl, matrix)` custom-layer callback (MapLibre <= 4) and the options object
introduced in MapLibre 5. Browser tests verify rendering with **MapLibre 6.13.0**.

Requirements for MapLibre 6:

- It is **ESM-only** with no default export, so use `import * as maplibregl from 'maplibre-gl'`
  and `<script type="module">` rather than a UMD `<script src>`. This library's own
  UMD bundle is unaffected - it never imports `maplibre-gl`.
- MapLibre requires **WebGL2**. When you use a bundler, configure its worker URL
  as described in the [MapLibre installation guide](https://maplibre.org/maplibre-gl-js/docs/).
  For example, with Vite:

  ```javascript
  import { setWorkerUrl } from 'maplibre-gl';
  import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
  setWorkerUrl(workerUrl);
  ```

- Only the **mercator** projection is supported. The shaders project mercator
  coordinates themselves, so under `projection: {type: 'globe'}` the layers warn once
  and skip drawing rather than smearing a flat field over the sphere.
  If your map style uses globe projection, call `map.setProjection({ type: 'mercator' })`
  after the style loads.

## Installation

```sh
npm install --save @jessefriend/windgl-maplibre
```

or load via CDN (after building):

```html
<script src="https://cdn.example.com/windgl/windgl.umd.js"></script>
```

---

## Usage

```javascript
import * as maplibregl from 'maplibre-gl';
import { sampleFill, particles, source, arrow } from '@jessefriend/windgl-maplibre';

// 1. Create a source from your tile.json
const windSource = source('https://example.com/path/to/tile.json');

const map = new maplibregl.Map({...});

map.addLayer(sampleFill({
  id: 'windbackground',
  source: windSource,
  'sample-opacity': 0.8
}));

map.addLayer(particles({
  id: 'particles',
  source: windSource,
  'particle-speed': ['interpolate', ['zoom'], 0, 0.5, 10, 0.8]
}));

map.addLayer(arrow({
  id: 'arrows',
  source: windSource
}), 'waterway-label');
```

---

## Layers

### Sample Fill
Raster-style colorized wind speed map.  
Customizable with:
- `sample-fill-color` - color ramp, usually an `interpolate` on `["get", "speed"]`
- `sample-opacity` - 0..1

### Particles
Animated particles advected by the wind field.  
Customizable with:
- `particle-color` - color ramp, usually an `interpolate` on `["get", "speed"]`
- `particle-speed` - advection rate multiplier, default `0.75`
- `particle-size` - point size in pixels, default `2.0`
- `particle-terrain` - constructor option, default `false`. Enables terrain height
  sampling and shared 3D depth. Requires MapLibre 6.13+ and `EXT_color_buffer_float`.
- `particle-altitude` - clearance in meters for terrain-enabled particles, default
  `0`. Supports zoom expressions. With terrain disabled, this is altitude above sea level.
- `number-particles` - particle count, default `65536`. Rounded up to a square
  (the simulation state lives in a NxN texture), so `2000` becomes `2025`.
  Not zoom-dependent: changing it reallocates the state textures.

### Arrows
Vector field arrows at grid points.  
Customizable with:
- `arrow-min-size` - minimum arrow spacing in pixels, drives the grid density
- `arrow-color`
- `arrow-halo-color`

---

## Tuning

All of the properties above accept a literal or a
[style expression](https://maplibre.org/maplibre-style-spec/expressions/), and can be
set when the layer is created or changed later:

```javascript
const wind = particles({
  id: 'particles',
  source: windSource,
  'number-particles': 20000,
  'particle-size': 3,
  'particle-speed': ['interpolate', ['linear'], ['zoom'], 0, 0.9, 8, 1.5]
});
map.addLayer(wind);

// later
wind.setProperty('particle-speed', 0.3);
wind.setProperty('particle-color', '#ffcc00');
```

Note that unknown property names are **silently ignored**, so a typo just leaves the
default in place.

A few knobs are not style properties and are set directly on the layer instance
before it is added to the map:

| Field | Default | Effect |
| --- | --- | --- |
| `dropRate` | `0.003` | Chance per frame that a particle respawns at a random position. Higher values give shorter-lived particles. |
| `dropRateBump` | `0.01` | Extra drop rate proportional to particle speed, so fast particles recycle sooner. |
| `pixelToGridRatio` | `20` | How aggressively data tiles are downsampled when choosing a zoom level. |
| `tileSize` | `1024` | Simulation tile size. Each particle tile is sized to cover about `tileSize * 2` screen pixels, so a larger value spreads the same particle count over more of the map. |
| `maxParticleZoom` | `20` | Ceiling on the simulation grid zoom. Particle tiles overzoom past the data on purpose - see below. |

```javascript
const wind = particles({ id: 'particles', source: windSource });
wind.dropRate = 0.001;   // longer-lived particles
map.addLayer(wind);
```

**Particle trails are not implemented on this branch** - each frame draws the particle
heads only, so there is no tail length to set. The `wind-trails` branch carries an
accumulation-buffer implementation with `particle-trail` and `trail-substeps`
properties; it is not merged here.

### Terrain

The demo includes a pitched **3D terrain** preset over the Alps, with global wind
particles and a terrain toggle. Open `http://localhost:1337/?style=terrain` after
you start the demo server. The terrain uses [Mapterhorn elevation tiles](https://mapterhorn.com/).

The terrain preset places particles 30 meters above the displayed terrain.
Terrain exaggeration also changes particle height. Mountains hide particles behind
them through the shared depth buffer.

Enable terrain mode when you create the layer:

```js
const particles = windGL.particles({
  id: 'wind',
  source: windGL.source('wind/tile.json'),
  'particle-terrain': true,
  'particle-altitude': 30
});
map.addLayer(particles);
```

Terrain mode uses MapLibre's experimental
[`renderTerrainHeightMap` API](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CustomRenderMethodInput/#renderterrainheightmap).
Local height maps retain mountain detail at low camera angles. The layer refreshes
these maps after camera movement, source loading, or terrain changes.

The layer hides particles where terrain data has not loaded. If the required API
or GPU extension is unavailable, the layer hides terrain particles and warns once.
When you disable terrain, the particles return. Apple hardware still needs manual testing.

Fill and arrow layers remain flat overlays. Terrain mode changes particle height
for display only. It does not simulate vertical wind or airflow around mountains.

---

## Data Format

WindGL expects tiled data in PNG textures plus a `tile.json` metadata file.  
The JSON includes data ranges (`uMin`, `uMax`, `vMin`, `vMax`) so the renderer can decode values.

Example `tile.json`:

```json
{
  "date": "2025-01-12T06:00Z",
  "width": 720,
  "height": 361,
  "uMin": -21.32,
  "uMax": 26.8,
  "vMin": -21.57,
  "vMax": 21.42,
  "tiles": ["https://example.com/wind/{z}/{x}/{y}.png"]
}
```

Data can be generated using the Python scripts in `scripts/` (based on HRRR/GFS GRIB2 inputs).

The demo uses **global NOAA GFS** winds at 10 m from October 7, 2026, at 00:00 UTC.
This is a fixed sample, not a live forecast. Particles appear across the world as you pan.
The old US sample remains in `docs/wind/2025011206/`.
See [the global sample instructions](docs/wind/gfs/README.md) to generate a new snapshot.

---

## Development

Install dependencies and the test browser, then run the compatibility tests:

```sh
npm ci
npx playwright install chromium
npm test
```

The tests use local wind fixtures and WebGL2. They check fill, arrows, particles,
pan and zoom, MapLibre layers drawn after the wind layers, worldwide coverage,
and particles with 3D terrain.
To use an installed Chrome browser, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its path.

To view the demo:

```sh
npm run build
npm run serve -- -d docs -p 1337
```

Open `http://localhost:1337/` for global wind or `http://localhost:1337/?style=terrain`
for terrain. The demo loads its basemap and terrain from external tile services.

After you install the Python dependencies listed in `scripts/build_wind_tiles.py`,
run the global grid checks with `python3 -m unittest discover -s test -p 'test_*.py'`.

## Acknowledgments

- Original work: [mapbox/webgl-wind](https://github.com/mapbox/webgl-wind)  
- Extended by: [astrosat/windgl](https://github.com/astrosat/windgl)  
- Fork updated for MapLibre by Jesse Friend
