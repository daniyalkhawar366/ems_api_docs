# EMS APIs Tecnext

Password-protected static docs for the Wallan EMS Appointment & Test Drive API.

Repo: https://github.com/daniyalkhawar366/ems_api_docs

## Local

```bash
node build.mjs
npx --yes serve -l 5177
```

## Update the docs

1. Edit `postman/EMS_API_postman_collection_v2.json` (params, descriptions, examples).
2. Optional: `node fetch-samples.mjs` then `node build.mjs`.
3. Or just `node build.mjs` to regenerate `data.js`.
4. Commit and push to `main` — Netlify redeploys automatically.

## Netlify

- Base directory: `/` (repo root)
- Build command: `node build.mjs`
- Publish directory: `.`
