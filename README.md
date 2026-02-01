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

The CMS lives at `/admin/`. It edits `site/data/parks.json` and uploads photos to
`site/uploads/`.

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

## Updating the full park list

This project ships with a complete list of NPS sites (437 entries) sourced from
the NPS Land Resources Division boundary centroids service. If you need to
refresh the list, rerun the script below:

```bash
python3 scripts/build-parks.py
```

The script overwrites `site/data/parks.json` and preserves the schema used by
the UI and CMS.

## Customization ideas

- Add more filters (by state, by stamp type, by trip year).
- Split data into per-park files with a build step if the list grows very large.
- Add a printable summary page for physical Passport inserts.
