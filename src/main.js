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
import { STOPS, photoState, revealedStopIds } from "./photos.js";

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
  pins: document.getElementById("pin-layer"),
  photo: document.getElementById("photo-card"),
  photoImg: document.getElementById("photo-img"),
  photoTitle: document.querySelector(".photo-title"),
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

function setPhoto(shot) {
  if (!shot || shot.photo <= 0.02) {
    hud.photo.style.opacity = "0";
    hud.photo.style.transform = "translate(-50%, -46%) scale(0.84)";
    hud.photo.classList.remove("visible");
    return;
  }
  if (hud.photoImg.dataset.id !== shot.stop.id) {
    hud.photoImg.src = shot.stop.src;
    hud.photoImg.dataset.id = shot.stop.id;
    hud.photoTitle.textContent = shot.stop.name;
  }
  hud.photo.classList.add("visible");
  hud.photo.style.opacity = String(shot.photo);
  hud.photo.style.transform = `translate(-50%, -46%) scale(${0.86 + 0.14 * shot.photo})`;
}

function ensurePins() {
  if (hud.pins.dataset.ready) return;
  hud.pins.dataset.ready = "1";
  for (const stop of STOPS) {
    const el = document.createElement("div");
    el.className = "map-pin";
    el.id = `pin-${stop.id}`;
    el.innerHTML = '<span class="pin-glow"></span><span class="pin-body"><span class="pin-dot"></span></span>';
    hud.pins.appendChild(el);
  }
}

function updatePins(map, route, t, activeId, hide) {
  ensurePins();
  const shown = new Set(hide ? [] : revealedStopIds(t));
  for (const stop of STOPS) {
    const el = document.getElementById(`pin-${stop.id}`);
    const place = route.places[stop.id];
    if (!el || !place) continue;
    const on = shown.has(stop.id);
    el.classList.toggle("visible", on);
    el.classList.toggle("active", on && stop.id === activeId);
    if (!on) continue;
    const pt = map.project(place.coord);
    el.style.transform = `translate(${pt.x}px, ${pt.y}px) translate(-50%, -100%)`;
  }
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
    [21.2, 33.6, 0, km("islamabad")],
    [33.6, 40.0, km("islamabad"), km("islamabad")],
    [40.0, 47.2, km("islamabad"), km("balakot")],
    [47.2, 52.6, km("balakot"), km("balakot")],
    [52.6, 55.4, km("balakot"), km("kiwai")],
    [55.4, 60.2, km("kiwai"), km("kiwai")],
    [60.2, 62.4, km("kiwai"), km("kaghan")],
    [62.4, 67.2, km("kaghan"), km("kaghan")],
    [67.2, 70.0, km("kaghan"), km("naran")],
    [70.0, 75.2, km("naran"), km("naran")],
    [75.2, 79.6, km("naran"), km("babusar")],
    [79.6, 88.4, km("babusar"), km("babusar")],
    [88.4, 93.4, km("babusar"), km("chilas")],
    [93.4, 99.8, km("chilas"), km("chilas")],
  ];

  let meters = 0;
  let traveling = false;
  if (t < 21.2) {
    meters = 0;
  } else {
    const leg = legs.find((seg) => t <= seg[1]) || legs.at(-1);
    const [t0, t1, a, b] = leg;
    const u = t < t0 ? 0 : smoother((t - t0) / Math.max(0.001, t1 - t0));
    meters = t > 99.8 ? total : lerp(a, b, u);
    traveling = a !== b && t >= 21.2 && t < 93.5;
  }

  const mountain = clamp((p.balakot ? (meters - km("balakot")) / (total - km("balakot")) : 0), 0, 1);
  const north = clamp((p.islamabad ? (meters - km("islamabad")) / Math.max(1, total - km("islamabad")) : 0), 0, 1);

  let center;
  let zoom;
  let pitch;
  let camBearing;
  let vehicle = false;
  let routeOn = t >= 20.8;
  let title = t >= 11.0 && t < 15.4;
  let endCard = t >= 101.2;
  let place = null;
  let peakPlace = false;
  let road = null;
  let pinStart = false;
  let pinEnd = t >= 93.4;
  let orbit = 0;
  const shot = photoState(t);

  if (t < 6.8) {
    const u = range(t, 0, 6.8);
    center = [lerp(67.8, 71.8, u), lerp(27.8, 30.4, u)];
    zoom = lerp(4.05, 5.15, u);
    pitch = lerp(14, 24, u);
    camBearing = lerp(-18, -8, u);
  } else if (t < 12.4) {
    const u = range(t, 6.8, 12.4);
    center = [lerp(71.8, 74.12, u), lerp(30.4, 31.4, u)];
    zoom = lerp(5.15, 7.55, u);
    pitch = lerp(24, 36, u);
    camBearing = lerp(-8, 14, u);
  } else if (t < 21.2) {
    const u = range(t, 12.4, 15.1);
    center = p.lahore.coord;
    zoom = lerp(7.55, 9.35, Math.min(1, u));
    pitch = lerp(36, 42, Math.min(1, u));
    camBearing = lerp(14, 22, Math.min(1, u));
  } else if (t < 100.2) {
    vehicle = !shot || shot.photo < 0.35;
    const look = lerp(1800, 700, clamp(mountain, 0, 1));
    const pos = pointAt(route, meters);
    const ahead = pointAt(route, Math.min(total, meters + look));
    const travelBearing = geoBearing(pos, ahead);
    center = pos;
    camBearing = travelBearing;
    zoom = lerp(9.05, 9.8, 1 - traveling * 0.25);
    pitch = lerp(44, 50, north);

    if (t >= 21.2 && t < 33.6) {
      road = "M-2 Motorway";
      zoom = lerp(9.35, 9.05, range(t, 21.2, 30));
      pitch = 44;
    }
    if (t >= 40.0 && t < 47.2) {
      road = t < 45.4 ? "M-1 Motorway" : null;
      zoom = 9.15;
      pitch = lerp(45, 48, range(t, 40.0, 47));
    }
    if (t >= 79.6 && t < 88.4) {
      const u = range(t, 79.6, 88.4);
      orbit = lerp(0, 54, u);
      center = p.babusar.coord;
      camBearing = (travelBearing + orbit) % 360;
    }
    if (t >= 88.4 && t < 93.4) {
      zoom = lerp(10.3, 9.5, range(t, 88.4, 93.4));
      pitch = lerp(54, 48, range(t, 88.4, 93.4));
    }
  } else {
    const u = range(t, 100.2, 110);
    const a = p.chilas.coord;
    center = [lerp(a[0], 73.85, u), lerp(a[1], 34.9, u)];
    zoom = lerp(9.1, 6.35, u);
    pitch = lerp(48, 36, u);
    camBearing = lerp(18, -14, u);
    meters = total;
    routeOn = true;
    pinEnd = true;
  }

  if (shot) {
    const stopPlace = p[shot.stop.id];
    if (stopPlace) center = stopPlace.coord;
    vehicle = shot.photo < 0.25;
    place = shot.stop.name;
    peakPlace = Boolean(shot.stop.peak);
    road = null;
    zoom = (zoom || 9.2) + shot.punch * 1.55;
    pitch = Math.min(58, (pitch || 44) + shot.punch * 8);
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
    photo: shot,
    mountain: clamp(mountain, 0, 1),
    travel: traveling ? 1 : t >= 21.2 && t < 100 ? 0.35 : 0,
    peak: shot?.stop.id === "babusar" ? shot.photo : 0,
    finale: endCard ? 1 : 0,
    exag: lerp(1.05, 1.32, clamp((t - 42) / 22, 0, 1)),
    fadeOut: range(t, 107.2, 110),
  };
}


async function main() {
  const route = await fetch("/route.json").then((r) => r.json());
  STOPS.forEach((stop) => {
    const img = new Image();
    img.src = stop.src;
  });
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
    setPlace(s.endCard || (s.photo && s.photo.photo > 0.15) ? null : s.place, s.peakPlace);
    setRoad(s.road);
    setPhoto(s.endCard ? null : s.photo);
    updatePins(map, route, t, s.photo?.stop.id || null, s.endCard);
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
