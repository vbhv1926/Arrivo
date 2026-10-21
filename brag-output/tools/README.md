# Re-capturing the app screenshots

`capture.mjs` drives the real site in headless Chrome and saves every UI state the video uses into `../composition/assets/shots/`, plus `coords.json` (cursor targets).

- Needs the site running: `python server.py` in `backend/` (serves `frontend/dist` on :8787).
- The clock is frozen at 16:40 and the lot data is the app's own seeded day (served to the page, nothing is written to the database), so runs are repeatable.

```bash
npm install puppeteer-core
node capture.mjs ../composition/assets/shots http://localhost:8787
```

Then from `../composition`: `npx hyperframes check` and `npx hyperframes render --quality delivery --output ../brag.mp4`.
