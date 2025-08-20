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

## Installation

```sh
npm install --save @jessefriend/windgl
```

or load via CDN (after building):

```html
<script src="https://cdn.example.com/windgl/windgl.umd.js"></script>
```

---

## Usage

```javascript
import maplibregl from 'maplibre-gl';
import { sampleFill, particles, source, arrows } from '@jessefriend/windgl';

// 1. Create a source from your tile.json
const windSource = source('https://example.com/path/to/tile.json');

const map = new maplibregl.Map({...});

map.addLayer(sampleFill({
  id: 'windbackground',
  source: windSource,
  'sample-fill-opacity': 0.8
}));

map.addLayer(particles({
  id: 'particles',
  source: windSource,
  'particle-speed': ['interpolate', ['zoom'], 0, 0.5, 10, 0.8]
}));

map.addLayer(arrows({
  id: 'arrows',
  source: windSource
}), 'waterway-label');
```

---

## Layers

### Sample Fill
Raster-style colorized wind speed map.  
Customizable with:
- `sample-fill-color`
- `sample-opacity`

### Particles
Animated particles advected by the wind field.  
Customizable with:
- `particle-color`
- `particle-speed`

### Arrows
Vector field arrows at grid points.  
Customizable with:
- `arrow-min-size`
- `arrow-color`
- `arrow-halo-color`

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

---

## Acknowledgments

- Original work: [mapbox/webgl-wind](https://github.com/mapbox/webgl-wind)  
- Extended by: [astrosat/windgl](https://github.com/astrosat/windgl)  
- Fork updated for MapLibre by Jesse Friend
