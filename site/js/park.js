const PARKS_URL = "data/parks.json";
const VISITS_URL = "data/visits.json";

let currentParkName = "";

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
  visits: document.getElementById("park-visits"),
  facts: document.getElementById("park-facts"),
  map: document.getElementById("park-map"),
  officialLink: document.getElementById("park-site-link"),
  editEntryLink: document.getElementById("edit-entry-link"),
  banner: document.getElementById("park-banner"),
  bannerImage: document.getElementById("park-banner-image"),
  bannerCaption: document.getElementById("park-banner-caption"),
  featuredStamp: document.getElementById("featured-stamp"),
  featuredStampImage: document.getElementById("featured-stamp-image"),
};

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeKey = (value) => String(value || "").trim().toLowerCase();

const isAllowedSnippetOrigin = (value) => {
  if (!value) return false;
  try {
    const url = new URL(value, window.location.href);
    const allowedOrigins = new Set([
      window.location.origin,
      "https://blog.ktz.me",
      "http://blog.ktz.me",
    ]);
    return allowedOrigins.has(url.origin);
  } catch (error) {
    return false;
  }
};

const truncateText = (value, maxLength = 220) => {
  if (!value) return "";
  const text = value.trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}…`;
};

const fetchBlogSnippet = async (url) => {
  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) return "";
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  const paragraph =
    doc.querySelector("main p") ||
    doc.querySelector("article p") ||
    doc.querySelector("p");
  if (!paragraph) return "";
  return truncateText(paragraph.textContent || "");
};

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
    .map((entry) => ({ entry, date: parseDate(entry.visit_date) }))
    .filter((item) => item.date)
    .sort((a, b) => b.date - a.date);
  if (withDates.length) return withDates[0].entry;
  return visits[0];
};

const sortVisitsByDateDesc = (visits) =>
  [...visits].sort((a, b) => {
    const dateA = parseDate(a.visit_date) || new Date(0);
    const dateB = parseDate(b.visit_date) || new Date(0);
    return dateB - dateA;
  });

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
      facts: latest?.facts || [],
      stamps: allStamps,
      photos: allPhotos,
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
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", "View photo");
    const img = document.createElement("img");
    img.src = item.image || "assets/placeholder.svg";
    img.alt = item.caption || "Park photo";
    const caption = document.createElement("p");
    caption.textContent = item.caption || "";
    card.appendChild(img);
    card.appendChild(caption);
    card.addEventListener("click", () => {
      if (!item.image) return;
      openLightbox({
        src: item.image,
        alt: img.alt,
        caption: item.caption || "",
        meta: item.meta || {},
      });
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        card.click();
      }
    });
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

const lightbox = {
  overlay: null,
  image: null,
  caption: null,
  meta: null,
};

const ensureLightbox = () => {
  if (lightbox.overlay) return;
  const overlay = document.createElement("div");
  overlay.className = "lightbox";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-hidden", "true");

  const backdrop = document.createElement("div");
  backdrop.className = "lightbox-backdrop";

  const content = document.createElement("div");
  content.className = "lightbox-content";

  const close = document.createElement("button");
  close.className = "lightbox-close";
  close.type = "button";
  close.setAttribute("aria-label", "Close");
  close.textContent = "×";

  const img = document.createElement("img");
  img.alt = "";

  const caption = document.createElement("p");
  caption.className = "lightbox-caption";

  const meta = document.createElement("div");
  meta.className = "lightbox-meta";

  content.appendChild(close);
  content.appendChild(meta);
  content.appendChild(img);
  content.appendChild(caption);
  overlay.appendChild(backdrop);
  overlay.appendChild(content);
  document.body.appendChild(overlay);

  const closeLightbox = () => {
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
  };

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target === backdrop) {
      closeLightbox();
    }
  });
  close.addEventListener("click", closeLightbox);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeLightbox();
  });

  lightbox.overlay = overlay;
  lightbox.image = img;
  lightbox.caption = caption;
  lightbox.meta = meta;
};

const openLightbox = ({ src, alt, caption, meta }) => {
  if (!src) return;
  ensureLightbox();
  lightbox.image.src = src;
  lightbox.image.alt = alt || "Park photo";
  if (caption) {
    lightbox.caption.textContent = caption;
    lightbox.caption.hidden = false;
  } else {
    lightbox.caption.textContent = "";
    lightbox.caption.hidden = true;
  }
  if (lightbox.meta) {
    const pieces = [];
    if (meta?.date) {
      const formatted = formatDate(meta.date);
      if (formatted && formatted !== "Unknown") pieces.push(formatted);
    }
    if (meta?.location) pieces.push(meta.location);
    const text = pieces.filter(Boolean).join(" • ");
    lightbox.meta.textContent = text;
    lightbox.meta.hidden = !text;
  }
  lightbox.overlay.classList.add("is-open");
  lightbox.overlay.setAttribute("aria-hidden", "false");
};

const renderVisits = (container, visits) => {
  container.innerHTML = "";
  if (!visits || visits.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No visits yet.";
    container.appendChild(empty);
    return;
  }

  const sorted = sortVisitsByDateDesc(visits);

  const appendTextBlock = (card, label, text) => {
    if (!text) return;
    const labelEl = document.createElement("p");
    labelEl.className = "visit-text-label";
    labelEl.textContent = label;
    const valueEl = document.createElement("p");
    valueEl.className = "visit-text";
    valueEl.textContent = text;
    card.appendChild(labelEl);
    card.appendChild(valueEl);
  };

  sorted.forEach((visit) => {
    const card = document.createElement("div");
    card.className = "visit-card";

    const header = document.createElement("div");
    header.className = "visit-header";
    const title = document.createElement("h3");
    title.textContent = visit.visit_date ? formatDate(visit.visit_date) : "Visit";
    header.appendChild(title);
    if (visit.rating) {
      const ratingTag = document.createElement("span");
      ratingTag.className = "tag";
      ratingTag.textContent = `Rating ${visit.rating} / 5`;
      header.appendChild(ratingTag);
    }
    card.appendChild(header);

    appendTextBlock(card, "Visit note", visit.visit_note);
    appendTextBlock(card, "Review", visit.review);
    appendTextBlock(card, "Entry", visit.notes || visit.entry);

    if (Array.isArray(visit.photos) && visit.photos.length) {
      const media = document.createElement("div");
      media.className = "visit-media";
      const label = document.createElement("p");
      label.className = "visit-media-label";
      label.textContent = "Photos";
      const grid = document.createElement("div");
      grid.className = "photo-grid visit-photo-grid";
      const photoItems = visit.photos.map((photo) => ({
        ...photo,
        meta: {
          date: visit.visit_date,
          location: currentParkName,
        },
      }));
      renderPhotoGrid(grid, photoItems, "");
      media.appendChild(label);
      media.appendChild(grid);
      card.appendChild(media);
    }

    if (Array.isArray(visit.stamps) && visit.stamps.length) {
      const media = document.createElement("div");
      media.className = "visit-media";
      const label = document.createElement("p");
      label.className = "visit-media-label";
      label.textContent = "Stamps";
      const grid = document.createElement("div");
      grid.className = "photo-grid";
      const stampItems = visit.stamps.map((stamp) => ({
        ...stamp,
        meta: {
          date: stamp.date || visit.visit_date,
          location: currentParkName,
        },
      }));
      renderPhotoGrid(grid, stampItems, "");
      media.appendChild(label);
      media.appendChild(grid);
      card.appendChild(media);
    }

    if (visit.blog_url) {
      const teaser = document.createElement("p");
      teaser.className = "visit-blog-snippet";
      if (visit.blog_snippet) {
        teaser.textContent = truncateText(visit.blog_snippet);
      } else if (isAllowedSnippetOrigin(visit.blog_url)) {
        teaser.textContent = "Loading teaser…";
        fetchBlogSnippet(visit.blog_url)
          .then((snippet) => {
            if (snippet) {
              teaser.textContent = snippet;
            } else {
              teaser.remove();
            }
          })
          .catch(() => {
            teaser.remove();
          });
      } else {
        teaser.textContent = "";
      }

      const link = document.createElement("a");
      link.className = "btn ghost visit-blog-link";
      link.href = visit.blog_url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "Read blog post";
      if (teaser.textContent) {
        card.appendChild(teaser);
      }
      card.appendChild(link);
    }

    container.appendChild(card);
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

const getHeaderImage = (park) => {
  const visits = Array.isArray(park.visits) ? park.visits : [];
  if (visits.length) {
    const sorted = sortVisitsByDateDesc(visits);
    const latest = sorted[0];
    const latestPhotos = Array.isArray(latest?.photos) ? latest.photos : [];

    if (latestPhotos.length > 1) {
      const header = latestPhotos.find((photo) => photo.header && photo.image);
      if (header) return { url: header.image, caption: header.caption };
    }
    if (latestPhotos.length === 1 && latestPhotos[0].image) {
      return { url: latestPhotos[0].image, caption: latestPhotos[0].caption };
    }

    const headerFromAny = sorted
      .flatMap((visit) => (Array.isArray(visit.photos) ? visit.photos : []))
      .find((photo) => photo.header && photo.image);
    if (headerFromAny) {
      return { url: headerFromAny.image, caption: headerFromAny.caption };
    }

    const allPhotos = sorted
      .flatMap((visit) => (Array.isArray(visit.photos) ? visit.photos : []))
      .filter((photo) => photo.image);
    if (allPhotos.length === 1) {
      return { url: allPhotos[0].image, caption: allPhotos[0].caption };
    }
  }

  const photos = park.photos || [];
  if (photos.length > 1) {
    const header = photos.find((photo) => photo.header);
    if (header && header.image) {
      return { url: header.image, caption: header.caption };
    }
  }
  if (photos.length === 1 && photos[0].image) {
    return { url: photos[0].image, caption: photos[0].caption };
  }
  return getHeroImage(park);
};

const buildTypeLine = (park) => {
  const parts = [];
  if (park.type) parts.push(park.type);
  if (park.elevation) parts.push(`Elevation ${park.elevation}`);
  if (park.established) parts.push(`Established ${park.established}`);
  return parts.join(" • ");
};

const getFeaturedStamp = (park) => {
  const stamps = park.stamps || [];
  if (!stamps.length) return null;
  const explicit = stamps.find((stamp) => stamp.featured);
  if (explicit) return explicit;

  const withDate = stamps
    .map((stamp) => ({ stamp, date: parseDate(stamp.date) }))
    .filter((entry) => entry.date)
    .sort((a, b) => a.date - b.date);

  if (withDate.length) return withDate[0].stamp;
  return stamps[0];
};

const init = async () => {
  const params = new URLSearchParams(window.location.search);
  const parkId = params.get("id");
  const parkKey = normalizeKey(parkId);

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
    const park = merged.find(
      (entry) =>
        normalizeKey(entry.id) === parkKey || normalizeKey(entry.unit_code) === parkKey
    );

    if (!park) {
      elements.name.textContent = "Park not found";
      return;
    }

    document.title = `${park.name} - Park Passport Log`;
    currentParkName = park.name || "";
    elements.region.textContent = park.region || "";
    elements.name.textContent = park.name || "";
    elements.type.textContent = buildTypeLine(park) || "";
    elements.states.textContent = (park.states || []).join(", ");
    const visits = park.visits || [];
    const latestVisit = getLatestVisit(visits);

    elements.status.textContent = visits.length ? "Visited" : "Not yet";
    elements.rating.textContent =
      latestVisit && latestVisit.rating ? `Rating ${latestVisit.rating} / 5` : "";
    elements.visitDate.textContent = latestVisit?.visit_date
      ? formatDate(latestVisit.visit_date)
      : "Not yet";
    elements.visitNote.textContent = latestVisit?.visit_note || "";
    elements.review.textContent = latestVisit?.review || "No review yet.";

    const featuredStamp = getFeaturedStamp(park);
    if (
      featuredStamp &&
      featuredStamp.image &&
      elements.featuredStamp &&
      elements.featuredStampImage
    ) {
      elements.featuredStampImage.src = featuredStamp.image;
      elements.featuredStampImage.alt =
        featuredStamp.caption || `${park.name} stamp`;
      elements.featuredStamp.hidden = false;
    }

    const hero = getHeaderImage(park);
    if (hero && elements.banner && elements.bannerImage) {
      elements.bannerImage.src = hero.url;
      elements.bannerImage.alt = hero.alt || hero.caption || park.name || "Park banner";
      if (elements.bannerCaption) {
        const parts = [];
        if (hero.caption) parts.push(hero.caption);
        if (hero.credit) parts.push(`Photo credit: ${hero.credit}`);
        const captionText = parts.join(" • ");
        elements.bannerCaption.textContent = captionText;
        elements.bannerCaption.hidden = !captionText;
      }
      elements.banner.hidden = false;
    }

    const officialUrl = getOfficialUrl(park);
    if (officialUrl && elements.officialLink) {
      elements.officialLink.href = officialUrl;
      elements.officialLink.hidden = false;
    }

    if (elements.editEntryLink && park.unit_code) {
      const slug = park.unit_code.toLowerCase();
      elements.editEntryLink.href = `admin/#/collections/visits/entries/${slug}`;
    }

    renderFacts(elements.facts, latestVisit?.facts);
    if (elements.visits) {
      renderVisits(elements.visits, visits);
    }
    renderMap(park);
  } catch (error) {
    elements.name.textContent = "Unable to load park";
    console.error(error);
  }
};

init();
