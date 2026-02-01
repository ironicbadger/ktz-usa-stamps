# Run local site + Decap local backend + visits auto-rebuild
dev:
    python3 scripts/dev-local.py

# Capture a screenshot of a park page (requires just dev running)
shot park="BRCA" out="/tmp/park.png":
    npx playwright screenshot "http://localhost:8000/park.html?id={{park}}" "{{out}}"
