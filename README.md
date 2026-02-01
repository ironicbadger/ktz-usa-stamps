# Park Passport Log

A static site for tracking National Park passport stamps, photos, and visit notes.
Built to be editable by non-technical users through Decap CMS and deployed with
GitHub Pages.

## Quick start

Preview locally:

```bash
python3 -m http.server --directory site 8000
```

Then open `http://localhost:8000` in your browser.

## Map view

Open `http://localhost:8000/map.html` for the full-page map with filters.

## Editing content (Decap CMS)

The CMS lives at `/admin/`. It edits one small file per park in `site/visits/`
so the editor can list every park without loading a single huge JSON file.
During deploy, a build step compiles those files into `site/data/visits.json`
(only parks with visit data) and merges at runtime with `site/data/parks.json`
as the read-only baseline.

1. Update `site/admin/config.yml`:
   - Set `backend.repo` to your GitHub repo (`OWNER/REPO`).
   - If you are using an OAuth proxy, set `base_url` and `auth_endpoint`.
2. Commit and push.
3. Visit `/admin/` on your deployed site, log in, and edit parks.

### OAuth proxy notes

GitHub authentication for Decap CMS requires an OAuth provider when you are not
hosting on Netlify. A common option is the open-source `decap-cms-oauth-provider`
project, which you can deploy (for example) to a small server or serverless
platform. After it is deployed, set `base_url` and `auth_endpoint` in
`site/admin/config.yml`.

### Auth options (choose what fits your editor)

- **GitHub backend**: editors must have GitHub accounts with push access to the repo.
- **Git Gateway (Netlify Identity)**: allows editors without GitHub access. Change
  `backend.name` to `git-gateway` and enable Identity + Git Gateway on Netlify.

## Deploy to GitHub Pages

This repo includes `.github/workflows/deploy.yml`, which publishes the `site/`
folder to GitHub Pages.

1. In GitHub, go to **Settings > Pages**.
2. For **Source**, select **GitHub Actions**.
3. Push to `main` and the site will deploy automatically.

## Data format

Park entries live in `site/data/parks.json`:

```json
{
  "parks": [
    {
      "id": "yosemite",
      "name": "Yosemite National Park",
      "type": "National Park",
      "states": ["CA"],
      "region": "Pacific West",
      "lat": 37.8651,
      "lng": -119.5383,
      "visited": true,
      "visit_date": "2024-09-15",
      "rating": 5,
      "review": "...",
      "notes": "...",
      "stamps": [{ "caption": "Stamp", "image": "/uploads/stamps.jpg" }],
      "photos": [{ "caption": "Sunset", "image": "/uploads/sunset.jpg" }]
    }
  ]
}
```

Visited entries are edited per-park in `site/visits/*.json` and compiled into
`site/data/visits.json`. They override base data by `unit_code`:

```json
{
  "visits": [
    {
      "unit_code": "ACAD",
      "park_name": "Acadia National Park",
      "visited": true,
      "visit_date": "2023-06-20",
      "visit_note": "First sunrise on the coast.",
      "rating": 4,
      "review": "Coastal cliffs and sea air everywhere.",
      "notes": "Jordan Pond popovers were worth it.",
      "highlights": ["Cadillac Mountain", "Jordan Pond"],
      "facts": [{ "label": "Stamp", "value": "Hulls Cove Visitor Center" }],
      "photos": [{ "caption": "Cadillac Mountain view", "image": "/uploads/cadillac.jpg" }]
    }
  ]
}
```

## Updating the full park list

This project ships with a complete list of NPS sites (437 entries) sourced from
the NPS Land Resources Division boundary centroids service. If you need to
refresh the list, rerun the script below:

```bash
python3 scripts/build-parks.py
```

The script overwrites `site/data/parks.json` and preserves the schema used by
the UI and CMS.

## Visits workflow

Seed visit files for every park (one time):

```bash
python3 scripts/seed-visits.py
```

Rebuild the runtime visits index (needed after pulling edits locally):

```bash
python3 scripts/build-visits-index.py
```

## Optional: Add official park banner images

You can pull hero/banner images from the official NPS API (requires a free API
key). The script enriches `site/data/parks.json` with `hero_image` and `nps_url`
fields used on the park detail pages.

```bash
NPS_API_KEY=YOUR_KEY python3 scripts/enrich-park-images.py
```

## Customization ideas

- Add more filters (by state, by stamp type, by trip year).
- Split data into per-park files with a build step if the list grows very large.
- Add a printable summary page for physical Passport inserts.
