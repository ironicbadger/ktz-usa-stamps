const PARKS_URL = "data/parks.json";
const VISITS_URL = "data/visits.json";

const elements = {
  region: document.getElementById("park-region"),
  name: document.getElementById("park-name"),
  type: document.getElementById("park-type"),
  states: document.getElementById("park-states"),
  status: document.getElementById("park-status"),
  rating: document.getElementById("park-rating"),
  visitDate: document.getElementById("park-visit-date"),
  visitNote: document.getElementById("park-visit-note"),
  review: document.getElementById("park-review"),
  highlights: document.getElementById("park-highlights"),
  notes: document.getElementById("park-notes"),
  photos: document.getElementById("park-photos"),
  stamps: document.getElementById("park-stamps"),
  facts: document.getElementById("park-facts"),
  map: document.getElementById("park-map"),
  officialLink: document.getElementById("park-site-link"),
  banner: document.getElementById("park-banner"),
  bannerImage: document.getElementById("park-banner-image"),
  bannerCaption: document.getElementById("park-banner-caption"),
};

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeKey = (value) => String(value || "").trim().toLowerCase();

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

const formatDate = (value) => {
  const parsed = parseDate(value);
  if (!parsed) return "Unknown";
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const renderList = (container, items, emptyMessage) => {
  container.innerHTML = "";
  if (!items || items.length === 0) {
    const item = document.createElement("li");
    item.textContent = emptyMessage;
    container.appendChild(item);
    return;
  }
  items.forEach((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    container.appendChild(item);
  });
};

const renderPhotoGrid = (container, items, emptyMessage) => {
  container.innerHTML = "";
  if (!items || items.length === 0) {
    const fallback = document.createElement("p");
    fallback.textContent = emptyMessage;
    container.appendChild(fallback);
    return;
  }
  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "photo-card";
    const img = document.createElement("img");
    img.src = item.image || "assets/placeholder.svg";
    img.alt = item.caption || "Park photo";
    const caption = document.createElement("p");
    caption.textContent = item.caption || "";
    card.appendChild(img);
    card.appendChild(caption);
    container.appendChild(card);
  });
};

const renderFacts = (container, items) => {
  container.innerHTML = "";
  if (!items || items.length === 0) {
    const dt = document.createElement("dt");
    dt.textContent = "Factoids";
    const dd = document.createElement("dd");
    dd.textContent = "No factoids yet.";
    container.appendChild(dt);
    container.appendChild(dd);
    return;
  }

  items.forEach((fact) => {
    const dt = document.createElement("dt");
    dt.textContent = fact.label;
    const dd = document.createElement("dd");
    dd.textContent = fact.value;
    container.appendChild(dt);
    container.appendChild(dd);
  });
};

const renderMap = (park) => {
  if (!park.lat || !park.lng) {
    elements.map.textContent = "Add coordinates to show the map.";
    return;
  }
  const map = L.map("park-map", { scrollWheelZoom: false }).setView(
    [park.lat, park.lng],
    7
  );
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "Map data © OpenStreetMap contributors",
  }).addTo(map);
  L.marker([park.lat, park.lng]).addTo(map).bindPopup(park.name).openPopup();
};

const getOfficialUrl = (park) => {
  if (park.nps_url) return park.nps_url;
  if (!park.unit_code) return "";
  return `https://www.nps.gov/${park.unit_code.toLowerCase()}/index.htm`;
};

const getHeroImage = (park) => {
  if (park.hero_image && park.hero_image.url) return park.hero_image;
  if (park.hero_image_url) return { url: park.hero_image_url };
  return null;
};

const init = async () => {
  const params = new URLSearchParams(window.location.search);
  const parkId = params.get("id");

  if (!parkId) {
    elements.name.textContent = "Missing park id";
    return;
  }

  try {
    const [parksResponse, visitsResponse] = await Promise.all([
      fetch(PARKS_URL),
      fetch(VISITS_URL).catch(() => null),
    ]);
    const parksData = await parksResponse.json();
    const visitsData = visitsResponse ? await visitsResponse.json() : { visits: [] };
    const merged = mergeParksWithVisits(parksData.parks || [], visitsData.visits || []);
    const park = merged.find((entry) => entry.id === parkId);

    if (!park) {
      elements.name.textContent = "Park not found";
      return;
    }

    document.title = `${park.name} - Park Passport Log`;
    elements.region.textContent = park.region || "";
    elements.name.textContent = park.name || "";
    elements.type.textContent = park.type || "";
    elements.states.textContent = (park.states || []).join(", ");
    elements.status.textContent = park.visited ? "Visited" : "Not yet";
    elements.rating.textContent = park.rating ? `Rating ${park.rating} / 5` : "";
    elements.visitDate.textContent = park.visit_date ? formatDate(park.visit_date) : "Not yet";
    elements.visitNote.textContent = park.visit_note || "";
    elements.review.textContent = park.review || "No review yet.";
    elements.notes.textContent = park.notes || "No notes yet.";

    const hero = getHeroImage(park);
    if (hero && elements.banner && elements.bannerImage) {
      elements.bannerImage.src = hero.url;
      elements.bannerImage.alt = hero.alt || hero.caption || park.name || "Park banner";
      if (elements.bannerCaption) {
        const parts = [];
        if (hero.caption) parts.push(hero.caption);
        if (hero.credit) parts.push(`Photo credit: ${hero.credit}`);
        elements.bannerCaption.textContent = parts.join(" • ");
      }
      elements.banner.hidden = false;
    }

    const officialUrl = getOfficialUrl(park);
    if (officialUrl && elements.officialLink) {
      elements.officialLink.href = officialUrl;
      elements.officialLink.hidden = false;
    }

    renderList(elements.highlights, park.highlights, "No highlights yet.");
    renderPhotoGrid(elements.photos, park.photos, "No photos yet.");
    renderPhotoGrid(elements.stamps, park.stamps, "No stamp photos yet.");
    renderFacts(elements.facts, park.facts);
    renderMap(park);
  } catch (error) {
    elements.name.textContent = "Unable to load park";
    console.error(error);
  }
};

init();
