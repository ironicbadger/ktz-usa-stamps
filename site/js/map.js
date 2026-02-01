const PARKS_URL = "data/parks.json";
const VISITS_URL = "data/visits.json";

const elements = {
  search: document.getElementById("map-search"),
  region: document.getElementById("map-region"),
  state: document.getElementById("map-state"),
  stateOptions: document.getElementById("map-state-options"),
  type: document.getElementById("map-type"),
  status: document.getElementById("map-status"),
  results: document.getElementById("map-results"),
};

let allParks = [];
let map;
let markersLayer;

const normalize = (value) => String(value || "").toLowerCase();
const normalizeState = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const normalizeKey = (value) => String(value || "").trim().toLowerCase();

const hasLegacyVisit = (visit) => {
  if (!visit) return false;
  if (visit.visited) return true;
  if (visit.visit_date || visit.visit_note || visit.review || visit.notes) return true;
  if (visit.rating) return true;
  if (visit.highlights && visit.highlights.length) return true;
  if (visit.facts && visit.facts.length) return true;
  if (visit.stamps && visit.stamps.length) return true;
  if (visit.photos && visit.photos.length) return true;
  return false;
};

const toLegacyVisit = (visit) => ({
  visit_date: visit.visit_date || "",
  visit_note: visit.visit_note || "",
  rating: visit.rating ?? null,
  review: visit.review || "",
  entry: visit.entry || visit.notes || "",
  highlights: visit.highlights || [],
  facts: visit.facts || [],
  stamps: visit.stamps || [],
  photos: visit.photos || [],
});

const getVisitEntries = (visit) => {
  const entries = Array.isArray(visit?.visits) ? visit.visits.filter(Boolean) : [];
  if (entries.length) return entries;
  if (hasLegacyVisit(visit)) return [toLegacyVisit(visit)];
  return [];
};

const getLatestVisit = (visits) => {
  if (!visits.length) return null;
  const withDates = visits
    .map((entry) => ({ entry, date: new Date(entry.visit_date) }))
    .filter((item) => !Number.isNaN(item.date.getTime()))
    .sort((a, b) => b.date - a.date);
  if (withDates.length) return withDates[0].entry;
  return visits[0];
};

const STATE_NAMES = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
  PR: "Puerto Rico",
  VI: "U.S. Virgin Islands",
  GU: "Guam",
  AS: "American Samoa",
  MP: "Northern Mariana Islands",
};

const mergeParksWithVisits = (parks, visits) => {
  const visitMap = new Map(
    (visits || []).map((visit) => [
      normalizeKey(visit.unit_code || visit.id || visit.park_id),
      visit,
    ])
  );

  return (parks || []).map((park) => {
    const key = normalizeKey(park.unit_code || park.id);
    const visit = visitMap.get(key);
    if (!visit) return { ...park, visits: [] };
    const entries = getVisitEntries(visit);
    const latest = getLatestVisit(entries);
    const allStamps = entries.flatMap((entry) =>
      Array.isArray(entry.stamps) ? entry.stamps : []
    );
    const allPhotos = entries.flatMap((entry) =>
      Array.isArray(entry.photos) ? entry.photos : []
    );
    return {
      ...park,
      ...visit,
      id: park.id,
      unit_code: park.unit_code,
      name: park.name,
      type: park.type,
      region: park.region,
      states: park.states,
      lat: park.lat,
      lng: park.lng,
      visits: entries,
      visited: entries.length > 0,
      visit_date: latest?.visit_date || "",
      visit_note: latest?.visit_note || "",
      rating: latest?.rating ?? null,
      review: latest?.review || "",
      notes: latest?.entry || latest?.notes || "",
      highlights: latest?.highlights || [],
      facts: latest?.facts || [],
      stamps: allStamps,
      photos: allPhotos,
    };
  });
};

const parseStateInput = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return { code: "", nameQuery: "" };

  const dashParts = raw.split(/[-—]/);
  if (dashParts.length > 1) {
    const code = dashParts[0].trim().toUpperCase();
    if (STATE_NAMES[code]) return { code, nameQuery: "" };
  }

  const codeCandidate = raw.replace(/[^a-z]/gi, "").toUpperCase();
  if (codeCandidate.length === 2 && STATE_NAMES[codeCandidate]) {
    return { code: codeCandidate, nameQuery: "" };
  }

  const nameQuery = normalizeState(raw);
  if (nameQuery.length <= 2) {
    return { code: nameQuery.toUpperCase(), nameQuery: "" };
  }

  return { code: "", nameQuery };
};

const getSearchText = (park) => {
  const stateNames = (park.states || []).map((code) => STATE_NAMES[code] || "");
  const visitTexts = (park.visits || []).flatMap((visit) => [
    visit.review,
    visit.entry,
    visit.notes,
    visit.visit_note,
    (visit.facts || []).map((fact) => fact.value || "").join(" "),
  ]);
  const pieces = [
    park.name,
    park.type,
    park.region,
    park.unit_code,
    (park.states || []).join(" "),
    stateNames.join(" "),
    park.review,
    park.notes,
    visitTexts.join(" "),
  ];
  return normalize(pieces.join(" "));
};

const renderMap = (parks, { fitBounds = true } = {}) => {
  if (!map) {
    map = L.map("full-map", {
      scrollWheelZoom: true,
      zoomSnap: 0.5,
      zoomDelta: 0.5,
    }).setView([39.2, -98.35], 3.0);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "Map data © OpenStreetMap contributors",
    }).addTo(map);
    markersLayer = L.layerGroup().addTo(map);
  }

  markersLayer.clearLayers();

  const bounds = [];
  parks.forEach((park) => {
    if (!park.lat || !park.lng) return;
    const color = park.visited ? "#2f5f4a" : "#c7724e";
    const marker = L.circleMarker([park.lat, park.lng], {
      radius: park.visited ? 8 : 6,
      color,
      fillColor: color,
      fillOpacity: 0.85,
    }).bindPopup(`
      <strong>${park.name}</strong><br/>
      ${park.type || ""}<br/>
      ${park.visited ? "Visited" : "Not yet"}
    `);
    marker.addTo(markersLayer);
    bounds.push([park.lat, park.lng]);
  });

  if (fitBounds && bounds.length) {
    map.fitBounds(bounds, { padding: [40, 40] });
  }
};

const applyFilters = () => {
  const query = normalize(elements.search.value);
  const region = elements.region.value;
  const state = elements.state.value;
  const type = elements.type.value;
  const status = elements.status.value;

  const filtered = allParks.filter((park) => {
    const matchesSearch = !query || getSearchText(park).includes(query);
    const matchesRegion = region === "all" || normalize(park.region) === normalize(region);
    const matchesState = (() => {
      const parsed = parseStateInput(state);
      if (!parsed.code && !parsed.nameQuery) return true;
      return (park.states || []).some((code) => {
        if (parsed.code) return code.toUpperCase() === parsed.code.toUpperCase();
        const nameNorm = normalizeState(STATE_NAMES[code] || "");
        return nameNorm.includes(parsed.nameQuery);
      });
    })();
    const matchesType = type === "all" || normalize(park.type) === normalize(type);
    const matchesStatus =
      status === "all" ||
      (status === "visited" && park.visited) ||
      (status === "unvisited" && !park.visited);

    return matchesSearch && matchesRegion && matchesState && matchesType && matchesStatus;
  });

  elements.results.textContent = filtered.length;
  const hasActiveFilters =
    query ||
    (region && region !== "all") ||
    (type && type !== "all") ||
    (status && status !== "all") ||
    (() => {
      const parsed = parseStateInput(state);
      return parsed.code || parsed.nameQuery;
    })();

  renderMap(filtered, { fitBounds: hasActiveFilters });
};

const populateRegions = (parks) => {
  const regions = Array.from(
    new Set(parks.map((park) => park.region).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  regions.forEach((region) => {
    const option = document.createElement("option");
    option.value = region;
    option.textContent = region;
    elements.region.appendChild(option);
  });
};

const populateStates = (parks) => {
  const states = Array.from(
    new Set(parks.flatMap((park) => park.states || []))
  ).sort((a, b) => {
    const nameA = STATE_NAMES[a] || a;
    const nameB = STATE_NAMES[b] || b;
    return nameA.localeCompare(nameB);
  });

  states.forEach((state) => {
    const option = document.createElement("option");
    const name = STATE_NAMES[state] || state;
    option.value = `${state} — ${name}`;
    option.label = name;
    elements.stateOptions.appendChild(option);
  });
};

const populateTypes = (parks) => {
  const types = Array.from(
    new Set(parks.map((park) => park.type).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  types.forEach((type) => {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type;
    elements.type.appendChild(option);
  });
};

const attachEvents = () => {
  [elements.search, elements.region, elements.state, elements.type, elements.status].forEach(
    (element) => {
    element.addEventListener("input", applyFilters);
  });
};

const init = async () => {
  try {
    const [parksResponse, visitsResponse] = await Promise.all([
      fetch(PARKS_URL),
      fetch(VISITS_URL).catch(() => null),
    ]);
    const parksData = await parksResponse.json();
    const visitsData = visitsResponse ? await visitsResponse.json() : { visits: [] };
    allParks = mergeParksWithVisits(parksData.parks || [], visitsData.visits || []);

    populateRegions(allParks);
    populateStates(allParks);
    populateTypes(allParks);
    attachEvents();
    applyFilters();
  } catch (error) {
    elements.results.textContent = "0";
    console.error(error);
  }
};

init();
