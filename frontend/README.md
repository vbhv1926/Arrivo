# Arrivo — frontend

Book a parking bay the way you book a seat. The page is plain HTML/CSS/JS; the parts that
run on live lot data are small React "islands" mounted into it. Built with Vite.

## Run

The lot data comes from the API in `../backend`, so start that first:

```bash
cd ../backend && python server.py
```

Then here:

```bash
npm install
npm run dev
```

Vite proxies `/api` to `http://localhost:8787`. `npm run build` writes `dist/`, which the
backend also serves on port 8787 — one address for the whole site.

## Files

```
index.html            the whole page: nav, menu, hero, sections, footer, mount points
public/               kiet-lot.jpg (the satellite capture) and the favicon
src/
  page.js             plain-JS shell: smooth scroll, theme switch, menu, scroll
                      animations, and it prints the live counts into nav / menu / footer
  main.jsx            React entry — puts each island into its <div> on the page
  lot.jsx             the data layer: lot geometry, booking rules, API calls, live state
  LotMap.jsx          the plan (SVG), the 3D view, row zoom and the magnifier lens
  LiveLot.jsx         the hero seat map, the bay panel + booking, the list of all bays
  HowItWorks.jsx      the scroll-driven "how a booking works" drawing
  ui.jsx              small shared bits (buttons, day strip, reveal animations, icons)
  styles/
    page.css          static-shell styles + the design tokens and light/dark themes
    islands.css       styles for the React parts
```

`index.html` has three empty divs — `#seatmap-root`, `#how-root` and `#live-root` — and
React draws into those; everything else is plain HTML/CSS/JS. React tells the page the live
numbers with a `lot:update` event (and `window.lot`); `page.js` puts them in the nav, menu
and footer.

Bay rows live in two places: `ROWS` in `backend/server.py` and in `src/lot.jsx`. Change
both together.

## Design

Paper `#f4f4f1`, ink `#121214`, one soft yellow `#ffd75a`; a near-black dark theme toggled
from the nav (remembered per browser, follows the system on first visit). Bricolage
Grotesque for display, Space Grotesk for body, IBM Plex Mono for labels, Caveat for the
handwritten notes.
