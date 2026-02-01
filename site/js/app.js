const PARKS_URL = "data/parks.json";
const VISITS_URL = "data/visits.json";

const elements = {
  visitedCount: document.getElementById("visited-count"),
  totalCount: document.getElementById("total-count"),
  stampCount: document.getElementById("stamp-count"),
  progressValue: document.getElementById("progress-value"),
  progressBar: document.getElementById("progress-bar"),
  latestVisit: document.getElementById("latest-visit"),
  latestVisitNote: document.getElementById("latest-visit-note"),
  favoriteRating: document.getElementById("favorite-rating"),
  search: document.getElementById("search"),
  region: document.getElementById("filter-region"),
  state: document.getElementById("filter-state"),
  stateOptions: document.getElementById("state-options"),
  type: document.getElementById("filter-type"),
  status: document.getElementById("filter-status"),
  sort: document.getElementById("sort"),
  grid: document.getElementById("parks-grid"),
  results: document.getElementById("results-count"),
  empty: document.getElementById("empty-state"),
  carouselImage: document.getElementById("carousel-image"),
  carouselCaption: document.getElementById("carousel-caption"),
  carouselMeta: document.getElementById("carousel-meta"),
};

let allParks = [];
let map;
let markersLayer;

const toNumber = (value) => (Number.isFinite(value) ? value : Number.parseFloat(value));

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value) => {
  const parsed = parseDate(value);
  if (!parsed) return "Unknown";
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const normalize = (value) => String(value || "").toLowerCase();
const normalizeState = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const normalizeKey = (value) => String(value || "").trim().toLowerCase();

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
    if (!visit) return park;
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
  const pieces = [
    park.name,
    park.type,
    park.region,
    park.unit_code,
    (park.states || []).join(" "),
    stateNames.join(" "),
    park.review,
    park.notes,
  ];
  return normalize(pieces.join(" "));
};

const computeStats = (parks) => {
  const visited = parks.filter((park) => park.visited);
  const visitedCount = visited.length;
  const totalCount = parks.length;
  const progress = totalCount ? Math.round((visitedCount / totalCount) * 100) : 0;
  const stamps = parks.reduce((sum, park) => sum + (park.stamps?.length || 0), 0);

  const recentVisit = visited
    .map((park) => ({ park, date: parseDate(park.visit_date) }))
    .filter((entry) => entry.date)
    .sort((a, b) => b.date - a.date)[0];

  const averageRating = visited.reduce((sum, park) => sum + (toNumber(park.rating) || 0), 0);
  const avgRatingValue = visitedCount ? (averageRating / visitedCount).toFixed(1) : "-";

  elements.visitedCount.textContent = visitedCount;
  elements.totalCount.textContent = totalCount;
  elements.stampCount.textContent = stamps;
  elements.progressValue.textContent = `${progress}%`;
  elements.progressBar.style.width = `${progress}%`;
  elements.latestVisit.textContent = recentVisit
    ? `${recentVisit.park.name}`
    : "No visits yet";
  elements.latestVisitNote.textContent = recentVisit
    ? formatDate(recentVisit.park.visit_date)
    : "";
  elements.favoriteRating.textContent = avgRatingValue === "-" ? "-" : `${avgRatingValue} / 5`;
};

const shuffle = (items) => {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const buildCarouselItems = (parks) => {
  const items = [];
  parks.forEach((park) => {
    (park.photos || []).forEach((photo) => {
      if (!photo || !photo.image) return;
      items.push({
        image: photo.image,
        caption: photo.caption || "",
        parkName: park.name,
        type: park.type,
        region: park.region,
        date: park.visit_date,
        note: park.visit_note || park.notes || "",
        rating: park.rating,
      });
    });
  });
  return shuffle(items);
};

const startCarousel = (items) => {
  if (!elements.carouselImage) return;

  if (!items.length) {
    elements.carouselImage.src = "assets/placeholder.svg";
    elements.carouselImage.alt = "Add photos to the carousel";
    elements.carouselCaption.textContent = "Add photos in the editor to start the carousel.";
    elements.carouselMeta.textContent = "";
    return;
  }

  let index = 0;

  const renderSlide = () => {
    const item = items[index % items.length];
    elements.carouselImage.classList.add("is-fading");
    window.setTimeout(() => {
      elements.carouselImage.src = item.image;
      elements.carouselImage.alt = item.caption || item.parkName;
      const dateText = formatDate(item.date);
      elements.carouselCaption.textContent = `${item.parkName} • ${dateText} • ${item.type}`;

      const metaParts = [item.region];
      if (item.rating) metaParts.push(`Rating ${item.rating}/5`);
      if (item.note) metaParts.push(item.note);
      elements.carouselMeta.textContent = metaParts.filter(Boolean).join(" • ");

      elements.carouselImage.classList.remove("is-fading");
    }, 300);

    index += 1;
  };

  renderSlide();
  window.setInterval(renderSlide, 6000);
};

const renderCard = (park, index) => {
  const card = document.createElement("article");
  card.className = "park-card";
  card.style.animationDelay = `${index * 40}ms`;

  const states = (park.states || []).join(", ");
  const statusLabel = park.visited ? "Visited" : "Not yet";
  const statusClass = park.visited ? "visited" : "unvisited";
  const visitDate = park.visited ? formatDate(park.visit_date) : "";
  const notes = park.review || park.notes || "No notes yet.";

  card.innerHTML = `
    <div>
      <h3>
        <a class="park-title-link" href="park.html?id=${encodeURIComponent(park.id)}">${park.name}</a>
      </h3>
      <div class="park-meta">
        <span>${park.type || ""}</span>
        <span>${states}</span>
        <span>${park.region || ""}</span>
      </div>
    </div>
    <div class="park-tags">
      <span class="tag ${statusClass}">${statusLabel}</span>
      ${visitDate ? `<span class="tag">${visitDate}</span>` : ""}
      ${park.rating ? `<span class="tag">Rating ${park.rating} / 5</span>` : ""}
    </div>
    <p>${notes}</p>
    <div class="park-actions">
      <span>${park.stamps?.length || 0} stamp(s)</span>
    </div>
  `;

  return card;
};

const renderList = (parks) => {
  elements.grid.innerHTML = "";
  elements.results.textContent = `${parks.length} park(s)`;
  elements.empty.hidden = parks.length > 0;

  parks.forEach((park, index) => {
    elements.grid.appendChild(renderCard(park, index));
  });
};

const renderMap = (parks, { fitBounds = true } = {}) => {
  if (!map) {
    map = L.map("map", {
      scrollWheelZoom: false,
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
      fillOpacity: 0.8,
    }).bindPopup(`
      <strong>${park.name}</strong><br/>
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
  const sort = elements.sort.value;

  let filtered = allParks.filter((park) => {
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

  filtered = filtered.sort((a, b) => {
    if (sort === "visit_date") {
      const dateA = parseDate(a.visit_date) || new Date(0);
      const dateB = parseDate(b.visit_date) || new Date(0);
      return dateB - dateA;
    }
    if (sort === "rating") {
      return (toNumber(b.rating) || 0) - (toNumber(a.rating) || 0);
    }
    if (sort === "state") {
      const codeA = (a.states && a.states[0]) || "";
      const codeB = (b.states && b.states[0]) || "";
      const stateA = STATE_NAMES[codeA] || codeA;
      const stateB = STATE_NAMES[codeB] || codeB;
      const stateCompare = stateA.localeCompare(stateB);
      return stateCompare || a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name);
  });

  renderList(filtered);
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
  [
    elements.search,
    elements.region,
    elements.state,
    elements.type,
    elements.status,
    elements.sort,
  ].forEach((element) => {
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

    computeStats(allParks);
    populateRegions(allParks);
    populateStates(allParks);
    populateTypes(allParks);
    attachEvents();
    applyFilters();
    startCarousel(buildCarouselItems(allParks));
  } catch (error) {
    elements.results.textContent = "Unable to load data.";
    console.error(error);
  }
};

init();
