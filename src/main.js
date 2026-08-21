import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";
import { createScore } from "./audio.js";
import {
  DURATION,
  bearing as geoBearing,
  clamp,
  lerp,
  mixAngle,
  pointAt,
  range,
  sliceRoute,
  smoother,
} from "./geo.js";

const params = new URLSearchParams(location.search);
const EXPORT = params.has("export");

const mapStyle = {
  version: 8,
  sources: {
    satellite: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Esri",
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#070a12" } },
    {
      id: "sat",
      type: "raster",
      source: "satellite",
      paint: {
        "raster-saturation": -0.06,
        "raster-contrast": 0.1,
        "raster-brightness-min": 0.14,
        "raster-brightness-max": 0.96,
        "raster-fade-duration": 0,
      },
    },
  ],
};

const hud = {
  title: document.getElementById("title-block"),
  end: document.getElementById("end-card"),
  place: document.getElementById("place-card"),
  placeName: document.querySelector(".place-name"),
  road: document.getElementById("road-chip"),
  atmosphere: document.getElementById("atmosphere"),
  loader: document.getElementById("loader"),
};

function show(el, on) {
  el.classList.toggle("visible", Boolean(on));
}

function setPlace(name, peak = false) {
  if (!name) {
    show(hud.place, false);
    hud.place.classList.remove("peak");
    return;
  }
  hud.placeName.textContent = name;
  hud.place.classList.toggle("peak", peak);
  show(hud.place, true);
}

function setRoad(name) {
  if (!name) {
    show(hud.road, false);
    return;
  }
  hud.road.textContent = name;
  show(hud.road, true);
}

function emptyLine() {
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } };
}

function lineFeat(coords) {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: coords.length > 1 ? coords : [coords[0], coords[0]] },
  };
}

function thinLine(coords, step = 5) {
  if (coords.length <= 120) return coords;
  const out = [];
  for (let i = 0; i < coords.length - 1; i += step) out.push(coords[i]);
  out.push(coords[coords.length - 1]);
  return out;
}

function pointFeat(coord) {
  return { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: coord } };
}

function waitIdle(map, timeout = 4000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    map.once("idle", finish);
    setTimeout(finish, timeout);
  });
}

async function warmup(map, route) {
  const samples = 24;
  for (let i = 0; i <= samples; i++) {
    const s = story(route, (i / samples) * DURATION);
    map.jumpTo({
      center: s.center,
      zoom: s.zoom,
      pitch: Math.min(s.pitch, 52),
      bearing: s.bearing,
    });
    await waitIdle(map, 650);
  }
}

function story(route, t) {
  const p = route.places;
  const total = route.cumdist.at(-1);
  const km = (id) => p[id].km * 1000;

  const legs = [
    [18.6, 32.4, 0, km("islamabad")],
    [32.4, 36.0, km("islamabad"), km("islamabad")],
    [36.0, 43.2, km("islamabad"), km("balakot")],
    [43.2, 45.6, km("balakot"), km("balakot")],
    [45.6, 48.4, km("balakot"), km("kiwai")],
    [48.4, 50.0, km("kiwai"), km("kiwai")],
    [50.0, 52.6, km("kiwai"), km("kaghan")],
    [52.6, 54.2, km("kaghan"), km("kaghan")],
    [54.2, 57.4, km("kaghan"), km("naran")],
    [57.4, 59.2, km("naran"), km("naran")],
    [59.2, 64.2, km("naran"), km("babusar")],
    [64.2, 73.0, km("babusar"), km("babusar")],
    [73.0, 79.2, km("babusar"), km("chilas")],
  ];

  let meters = 0;
  let traveling = false;
  if (t < 18.6) {
    meters = 0;
  } else {
    const leg = legs.find((seg) => t <= seg[1]) || legs.at(-1);
    const [t0, t1, a, b] = leg;
    const u = t < t0 ? 0 : smoother((t - t0) / Math.max(0.001, t1 - t0));
    meters = t > 79.2 ? total : lerp(a, b, u);
    traveling = a !== b && t >= 18.6 && t < 79.4;
  }

  const mountain = clamp((p.balakot ? (meters - km("balakot")) / (total - km("balakot")) : 0), 0, 1);
  const north = clamp((p.islamabad ? (meters - km("islamabad")) / Math.max(1, total - km("islamabad")) : 0), 0, 1);

  let center;
  let zoom;
  let pitch;
  let camBearing;
  let vehicle = false;
  let routeOn = t >= 18.2;
  let finale = t >= 80.2;
  let title = t >= 11.2 && t < 19.0;
  let endCard = t >= 81.6;
  let place = null;
  let peakPlace = false;
  let road = null;
  let pinStart = t >= 10.8 && t < 20.5;
  let pinEnd = t >= 78.2;
  let orbit = 0;

  if (t < 6.8) {
    const u = range(t, 0, 6.8);
    center = [lerp(67.8, 71.8, u), lerp(27.8, 30.4, u)];
    zoom = lerp(4.05, 5.15, u);
    pitch = lerp(14, 24, u);
    camBearing = lerp(-18, -8, u);
  } else if (t < 12.2) {
    const u = range(t, 6.8, 12.2);
    center = [lerp(71.8, 74.12, u), lerp(30.4, 31.4, u)];
    zoom = lerp(5.15, 7.55, u);
    pitch = lerp(24, 36, u);
    camBearing = lerp(-8, 14, u);
  } else if (t < 18.6) {
    const u = range(t, 12.2, 16.4);
    center = [lerp(74.12, 74.3436, Math.min(1, u)), lerp(31.4, 31.5497, Math.min(1, u))];
    zoom = lerp(7.55, 9.45, Math.min(1, u));
    pitch = lerp(36, 42, Math.min(1, u));
    camBearing = lerp(14, 26, Math.min(1, u));
  } else if (t < 80.4) {
    vehicle = true;
    const look = lerp(1800, 700, clamp(mountain, 0, 1));
    const pos = pointAt(route, meters);
    const ahead = pointAt(route, Math.min(total, meters + look));
    const travelBearing = geoBearing(pos, ahead);
    center = pos;
    camBearing = travelBearing;
    zoom = lerp(9.05, 9.8, 1 - traveling * 0.25);
    pitch = lerp(44, 50, north);

    if (t >= 18.6 && t < 32.4) {
      road = "M-2 Motorway";
      zoom = lerp(9.35, 9.05, range(t, 18.6, 27));
      pitch = 44;
    }
    if (t >= 32.4 && t < 36.0) {
      place = "Islamabad";
      zoom = lerp(9.1, 9.85, range(t, 32.4, 34));
      pitch = 43;
    }
    if (t >= 36.0 && t < 43.2) {
      road = t < 41.2 ? "M-1 Motorway" : null;
      zoom = 9.15;
      pitch = lerp(45, 48, range(t, 36.0, 43));
    }
    if (t >= 43.2 && t < 45.6) {
      place = "Balakot";
      zoom = 10.15;
      pitch = 50;
    }
    if (t >= 48.4 && t < 50.0) {
      place = "Kiwai";
      zoom = 10.25;
      pitch = 51;
    }
    if (t >= 52.6 && t < 54.2) {
      place = "Kaghan";
      zoom = 10.35;
      pitch = 52;
    }
    if (t >= 57.4 && t < 59.2) {
      place = "Naran";
      zoom = 10.4;
      pitch = 52;
    }
    if (t >= 64.2 && t < 73.0) {
      place = "Babusar Top";
      peakPlace = true;
      vehicle = true;
      const u = range(t, 64.2, 73.0);
      orbit = lerp(0, 78, u);
      center = p.babusar.coord;
      zoom = lerp(10.35, 10.7, Math.sin(u * Math.PI));
      pitch = lerp(52, 58, Math.sin(u * Math.PI));
      camBearing = (travelBearing + orbit) % 360;
    }
    if (t >= 73.0 && t < 79.2) {
      zoom = lerp(10.5, 9.6, range(t, 73.0, 79.2));
      pitch = lerp(56, 48, range(t, 73.0, 79.2));
    }
    if (t >= 78.2 && t < 81.2) {
      place = "Chilas";
      vehicle = t < 79.4;
      zoom = lerp(9.7, 9.2, range(t, 78.2, 81));
    }
  } else {
    const u = range(t, 80.4, 90);
    const a = p.babusar.coord;
    center = [lerp(a[0], 73.85, u), lerp(a[1], 34.9, u)];
    zoom = lerp(9.2, 6.35, u);
    pitch = lerp(48, 36, u);
    camBearing = lerp(18, -14, u);
    meters = total;
    routeOn = true;
    pinEnd = true;
    if (t >= 80.6 && t < 82.4) place = "Chilas";
  }

  camBearing = (camBearing + Math.sin(t * 0.28) * 2.4 + 360) % 360;

  return {
    center,
    zoom,
    pitch,
    bearing: camBearing,
    meters,
    vehicle,
    routeOn,
    title,
    endCard,
    place,
    peakPlace,
    road,
    pinStart,
    pinEnd,
    mountain: clamp(mountain, 0, 1),
    travel: traveling ? 1 : t >= 18.6 && t < 80 ? 0.35 : 0,
    peak: t >= 64 && t < 73.6 ? range(t, 64, 66.4) * (1 - range(t, 72, 73.8)) : 0,
    finale: endCard ? 1 : 0,
    exag: lerp(1.05, 1.32, clamp((t - 42) / 22, 0, 1)),
    fadeOut: range(t, 87.2, 90),
  };
}

async function main() {
  const route = await fetch("/route.json").then((r) => r.json());
  await Promise.race([
    document.fonts.ready,
    new Promise((resolve) => setTimeout(resolve, 1800)),
  ]);

  const map = new maplibregl.Map({
    container: "map",
    style: mapStyle,
    center: [69.4, 30.2],
    zoom: 4.2,
    pitch: 18,
    bearing: -18,
    attributionControl: false,
    fadeDuration: 0,
    preserveDrawingBuffer: true,
    pixelRatio: 1,
    maxPitch: 72,
    canvasContextAttributes: { antialias: true, preserveDrawingBuffer: true },
  });

  map.on("error", (e) => console.warn("Map warning:", e.error?.message || e));

  await Promise.race([
    new Promise((resolve) => map.once("load", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);

  try {
    if (!EXPORT) map.setProjection({ type: "globe" });
  } catch (err) {
    console.warn("Globe unavailable", err);
  }

  try {
    map.addSource("terrain", {
      type: "raster-dem",
      tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
      encoding: "terrarium",
      tileSize: 256,
      maxzoom: 15,
    });
    map.setTerrain({ source: "terrain", exaggeration: 1.15 });
    map.addLayer({
      id: "hills",
      type: "hillshade",
      source: "terrain",
      paint: {
        "hillshade-exaggeration": 0.62,
        "hillshade-shadow-color": "#05060c",
        "hillshade-highlight-color": "#f0d2a0",
        "hillshade-illumination-direction": 286,
      },
    });
    map.setSky({
      "sky-color": "#081018",
      "sky-horizon-blend": 0.5,
      "horizon-color": "#2a1a12",
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.85, 5, 0.2, 9, 0],
    });
  } catch (err) {
    console.warn("Terrain/sky unavailable", err);
  }

  map.addSource("route-glow", { type: "geojson", data: emptyLine() });
  map.addSource("route-core", { type: "geojson", data: emptyLine() });
  map.addSource("traveler", { type: "geojson", data: pointFeat(route.places.lahore.coord) });
  map.addSource("pin-start", { type: "geojson", data: pointFeat(route.places.lahore.coord) });
  map.addSource("pin-end", { type: "geojson", data: pointFeat(route.places.chilas.coord) });

  map.addLayer({
    id: "route-glow",
    type: "line",
    source: "route-glow",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#ffb04a",
      "line-width": 16,
      "line-blur": 14,
      "line-opacity": 0.55,
    },
  });
  map.addLayer({
    id: "route-core",
    type: "line",
    source: "route-core",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#ffe7b3",
      "line-width": 3.4,
      "line-opacity": 0.96,
    },
  });
  map.addLayer({
    id: "traveler-glow",
    type: "circle",
    source: "traveler",
    paint: {
      "circle-radius": 18,
      "circle-color": "#ffcf7a",
      "circle-blur": 0.85,
      "circle-opacity": 0.45,
      "circle-pitch-alignment": "map",
    },
  });
  map.addLayer({
    id: "traveler-core",
    type: "circle",
    source: "traveler",
    paint: {
      "circle-radius": 6.5,
      "circle-color": "#fff6df",
      "circle-stroke-width": 2,
      "circle-stroke-color": "#e8c47a",
      "circle-pitch-alignment": "map",
    },
  });
  map.addLayer({
    id: "pin-start",
    type: "circle",
    source: "pin-start",
    paint: {
      "circle-radius": 11,
      "circle-color": "#e8c47a",
      "circle-stroke-width": 3,
      "circle-stroke-color": "#fff6df",
      "circle-opacity": 0,
      "circle-stroke-opacity": 0,
    },
  });
  map.addLayer({
    id: "pin-end",
    type: "circle",
    source: "pin-end",
    paint: {
      "circle-radius": 16,
      "circle-color": "#ff9d42",
      "circle-stroke-width": 4,
      "circle-stroke-color": "#fff1d2",
      "circle-opacity": 0,
      "circle-stroke-opacity": 0,
    },
  });

  if (EXPORT) {
    document.body.classList.add("export");
    await warmup(map, route);
  } else {
    await waitIdle(map, 2200);
  }

  hud.loader.classList.add("hide");
  setTimeout(() => hud.loader.remove(), 400);

  const silentScore = { start() {}, impact() {}, whoosh() {}, setStage() {} };
  let score = silentScore;
  if (!EXPORT) {
    try {
      const audioCtx = new AudioContext();
      score = createScore(audioCtx);
      const startAudio = async () => {
        if (audioCtx.state === "suspended") await audioCtx.resume();
        score.start();
      };
      window.addEventListener("pointerdown", startAudio, { once: true });
    } catch (err) {
      console.warn("Audio unavailable", err);
    }
  }

  let cam = {
    center: [69.4, 30.2],
    zoom: 4.2,
    pitch: 18,
    bearing: -18,
  };
  let lastPlace = "";
  let lastRoad = "";
  let lastExag = 1.15;
  let lastVehicle = null;
  let lastPinStart = null;
  let lastPinEnd = null;
  let finished = false;
  window.__JOURNEY_DONE = false;

  function renderAt(t, snap = false) {
    const s = story(route, t);
    if (snap) {
      cam = {
        center: s.center,
        zoom: s.zoom,
        pitch: s.pitch,
        bearing: s.bearing,
      };
    } else {
      const k = 0.18;
      cam.center = [
        lerp(cam.center[0], s.center[0], k),
        lerp(cam.center[1], s.center[1], k),
      ];
      cam.zoom = lerp(cam.zoom, s.zoom, k);
      cam.pitch = lerp(cam.pitch, s.pitch, k);
      cam.bearing = mixAngle(cam.bearing, s.bearing, k);
    }

    map.jumpTo({
      center: cam.center,
      zoom: cam.zoom,
      pitch: cam.pitch,
      bearing: cam.bearing,
    });

    if (map.getSource("terrain") && Math.abs(s.exag - lastExag) > 0.08) {
      lastExag = s.exag;
      try {
        map.setTerrain({ source: "terrain", exaggeration: s.exag });
      } catch {
        /* ignore */
      }
    }

    const coords = s.routeOn ? thinLine(sliceRoute(route, s.meters)) : [];
    if (coords.length) {
      const line = lineFeat(coords);
      map.getSource("route-glow").setData(line);
      map.getSource("route-core").setData(line);
    }
    const traveler = s.vehicle ? pointAt(route, s.meters) : route.places.lahore.coord;
    map.getSource("traveler").setData(pointFeat(traveler));
    if (lastVehicle !== s.vehicle) {
      lastVehicle = s.vehicle;
      const vis = s.vehicle ? "visible" : "none";
      map.setLayoutProperty("traveler-glow", "visibility", vis);
      map.setLayoutProperty("traveler-core", "visibility", vis);
    }
    if (lastPinStart !== s.pinStart) {
      lastPinStart = s.pinStart;
      map.setPaintProperty("pin-start", "circle-opacity", s.pinStart ? 0.95 : 0);
      map.setPaintProperty("pin-start", "circle-stroke-opacity", s.pinStart ? 1 : 0);
    }
    if (lastPinEnd !== s.pinEnd) {
      lastPinEnd = s.pinEnd;
      map.setPaintProperty("pin-end", "circle-opacity", s.pinEnd ? 0.95 : 0);
      map.setPaintProperty("pin-end", "circle-stroke-opacity", s.pinEnd ? 1 : 0);
    }

    show(hud.title, s.title);
    show(hud.end, s.endCard);
    setPlace(s.endCard ? null : s.place, s.peakPlace);
    setRoad(s.road);
    hud.atmosphere.classList.toggle("mountain", s.mountain > 0.15);
    hud.atmosphere.classList.toggle("peak", s.peak > 0.2);
    document.getElementById("vignette").style.opacity = String(0.85 + s.fadeOut * 0.15);
    document.getElementById("hud").style.opacity = String(1 - s.fadeOut);

    if (s.place && s.place !== lastPlace) {
      try { score.impact(); } catch { /* ignore */ }
      lastPlace = s.place;
    }
    if (s.road && s.road !== lastRoad) {
      try { score.whoosh(); } catch { /* ignore */ }
      lastRoad = s.road;
    }
    try {
      score.setStage(s);
    } catch {
      /* ignore audio glitches */
    }
  }

  window.__seek = (t) => {
    renderAt(t, true);
    map.triggerRepaint();
  };
  window.__waitIdle = async () => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    if (typeof map.areTilesLoaded === "function" && map.areTilesLoaded()) return;
    await waitIdle(map, 80);
  };

  if (EXPORT) {
    renderAt(0, true);
    window.__READY = true;
    return;
  }

  let start = performance.now();
  function frame(now) {
    const t = clamp((now - start) / 1000, 0, DURATION);
    renderAt(t, false);
    if (t >= DURATION && !finished) {
      finished = true;
      window.__JOURNEY_DONE = true;
      return;
    }
    if (!finished) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

main().catch((err) => {
  console.error(err);
  hud.loader.querySelector("h2").textContent = "Could not load the journey";
});
