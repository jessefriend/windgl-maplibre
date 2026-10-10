// MapLibre 6 is ESM-only and has no default export, so it must be imported as a namespace.
import * as maplibregl from "maplibre-gl";
import * as windGL from "./src";

// no access token needed

var mapContainer1 = document.getElementById("map1");
var mapContainer2 = document.getElementById("map2");

var map1, map2;

// use a MapLibre-compatible style everywhere
var STYLE = "https://demotiles.maplibre.org/style.json";
var WIND_SOURCE = "wind/gfs/2026100700/tile.json";
var TERRAIN_SOURCE = "https://tiles.mapterhorn.com/tilejson.json";
var TERRAIN_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }
  },
  layers: [{ id: "basemap", type: "raster", source: "osm" }]
};

var configs = [
  {
    id: "world",
    name: "World wind: fill and particles",
    style: STYLE,
    layers: [
      { type: "sampleFill", after: null },
      { type: "particles", after: null }
    ],
    flyTo: { zoom: 2 }
  },
  {
    id: "arrows",
    name: "World wind: arrows",
    style: STYLE,
    layers: [
      {
        type: "arrow",
        after: null,
        properties: {
          "arrow-min-size": 80,
          "arrow-color": [
            "interpolate", ["linear"], ["get", "speed"],
            0.0, "#3288bd",
            10,  "#66c2a5",
            20,  "#abdda4",
            30,  "#e6f598",
            40,  "#fee08b",
            50,  "#fdae61",
            60,  "#f46d43",
            100.0, "#d53e4f"
          ]
        }
      }
    ],
    flyTo: { pitch: 30, zoom: 2.5, center: [0, 45] }
  },
  {
    id: "particles",
    name: "World wind: particles",
    style: STYLE,
    layers: [
      {
        type: "particles",
        after: null,
        properties: {
          // Speed changes with zoom
          "particle-speed": [
            "interpolate", ["linear"], ["zoom"],
            0, 0.9,
            8, 1.5
          ],

          // Color ramp driven by "speed" property
          "particle-color": [
            "interpolate", ["linear"], ["get", "speed"],
            0,   "#3288bd",
            10,  "#66c2a5",
            20,  "#abdda4",
            30,  "#e6f598",
            40,  "#fee08b",
            50,  "#fdae61",
            60,  "#f46d43",
            100, "#d53e4f"
          ]
        }
      }
    ],
    flyTo: { zoom: 2, center: [50, -10] }
  },
  {
    id: "fill",
    name: "World wind: fill and arrows",
    style: STYLE,
    layers: [
      {
        type: "sampleFill",
        after: null,
        properties: {
          "sample-fill-color": [
            "interpolate", ["linear"], ["get", "speed"],
            0,  "#ffffcc",
            10, "#ffeda0",
            20, "#fed976",
            30, "#feb24c",
            40, "#fd8d3c",
            50, "#fc4e2a",
            60, "#e31a1c",
            70, "#bd0026",
            80, "#800026"
          ]
        }
      },
      {
        type: "arrow",
        after: null,
        properties: {
          "arrow-min-size": 30,
          "arrow-color": [
            "interpolate", ["linear"], ["get", "speed"],
            0,  "rgba(30,30,30,0)",
            10, "rgba(30,30,30,0)",
            20, "rgba(30,30,30,0.6)",
            30, "rgba(30,30,30,0.8)",
            40, "rgba(30,30,30,0.8)",
            50, "rgba(30,30,30,0.8)",
            60, "rgba(30,30,30,0.9)",
            70, "rgba(30,30,30,1)",
            80, "rgba(30,30,30,1)"
          ],
          "arrow-halo-color": "rgba(240,240,240,1)"
        }
      }
    ],
    flyTo: { zoom: 2 }
  },
  {
    id: "terrain",
    name: "3D terrain: Alps and global wind",
    style: TERRAIN_STYLE,
    terrain: true,
    layers: [{
      type: "particles",
      after: null,
      properties: {
        "number-particles": 2048,
        "particle-size": 1.5,
        "particle-terrain": true,
        "particle-altitude": 30,
        "particle-color": "#ffdf70"
      }
    }],
    flyTo: { center: [11.39085, 47.27574], zoom: 11, pitch: 65, bearing: -25 }
  }
];

function firstSymbolLayerId(map) {
  var layers = map.getStyle().layers;
  for (var i = 0; i < layers.length; i++) {
    if (layers[i].type === "symbol") return layers[i].id;
  }
  return undefined; // top of stack
}

function initializeConfig(container, cfg) {
  var map = new maplibregl.Map(Object.assign({
    container: container, style: cfg.style, maxPitch: 85
  }, cfg.flyTo));
  map.addControl(new maplibregl.NavigationControl());
  map.on("load", function () {
    map.setProjection({ type: "mercator" });
    var beforeId = firstSymbolLayerId(map);
    if (cfg.terrain) {
      map.addSource("terrain", {
        type: "raster-dem", url: TERRAIN_SOURCE, encoding: "terrarium", tileSize: 512
      });
      map.addLayer({
        id: "hillshade", type: "hillshade", source: "terrain",
        paint: { "hillshade-exaggeration": 0.4 }
      }, beforeId);
      map.setTerrain({ source: "terrain", exaggeration: 1.5 });
      map.addControl(new maplibregl.TerrainControl({ source: "terrain", exaggeration: 1.5 }));
    }
    var source = windGL.source(cfg.windSource || WIND_SOURCE);
    cfg.layers.forEach(function (entry) {
      var type = entry.type;
      var after = entry.after;
      var properties = entry.properties || {};
      var layer = windGL[type](Object.assign({ id: type, source: source }, properties));
      var before = (after !== undefined && after !== null) ? after : beforeId;
      map.addLayer(layer, before);
      // after: map.addLayer(layer, before);
      if (type === "particles") {
        map._windParticles = layer;
        if (map === window._map) window._particles = layer;
      }
    });
  });
  return map;
}

function nextConfig() {
  document.getElementById("preset-name").textContent = configs[index].name;
  window._map = map2;
  window._particles = map2._windParticles || null;
  mapContainer1.style.left = "-100%";
  mapContainer1.style.transition = "left 1s";
  mapContainer2.style.left = "0";
  mapContainer2.style.transition = "left 1s";
  setTimeout(function () {
    if (configs[index].flyTo) map2.flyTo(configs[index].flyTo);
    index = (index + 1) % configs.length;
    if (map1) map1.remove();
    map1 = map2;
    mapContainer1.style.transition = "none";
    mapContainer1.style.left = "100%";
    var temp = mapContainer1; mapContainer1 = mapContainer2; mapContainer2 = temp;
    map2 = initializeConfig(mapContainer2, configs[index]);
  }, 1000);
}

var index = 0;
var requestedStyle = new URLSearchParams(window.location.search).get("style");
configs.forEach(function (cfg, i) {
  if (cfg.id === requestedStyle) index = i;
});
map2 = initializeConfig(mapContainer2, configs[index]);
nextConfig();
document.getElementById("next").addEventListener("click", nextConfig);
