# Arrivo

Book a parking bay before you leave, the way you pick a seat for a film. Pick the bay, pick
the hours, pay, and drive straight to it — no circling the lot. The first lot mapped is the
KIET main lot in Ghaziabad (96 bays, drawn from a satellite capture), shown as a live,
bay-by-bay plan you can sweep with a magnifier.

Built for INNOTECH'26.

## What's in here

```
start.command        double-click to run it on a Mac
start.bat            double-click to run it on Windows
frontend/            the website — plain HTML/CSS/JS with small React islands (Vite)
backend/             the API — one Python file, SQLite, live updates (SSE)
presentation/        the pitch deck — Arrivo-INNOTECH26.pdf and .pptx (+ web version)
brag-output/         the launch video (brag.mp4) and how it was made
```

## Run it (the easy way)

You only need **Python 3.8+** — no npm, no installs. The site comes already built.

- **Mac:** double-click `start.command`.
- **Windows:** double-click `start.bat`.

A window opens, the server starts, and your browser opens **http://localhost:8787**.
Close that window (or press Ctrl+C in it) to stop.

On a Mac, the first time you may see *"cannot be opened because it is from an unidentified
developer"*. Right-click `start.command` → **Open** → **Open**, once. If it says you don't
have permission, run this once in Terminal from the project folder:
`chmod +x start.command`.

No Python? Get it from https://www.python.org/downloads/ (on Windows, tick
*"Add python.exe to PATH"* in the installer).

If port 8787 is busy, pick another: `PORT=9000 ./start.command` (Mac) or
`set PORT=9000 && start.bat` (Windows).

## Run it (for development)

Two terminals. First the API:

```bash
cd backend
python server.py
```

Then the website:

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (http://localhost:5173). The API runs on port 8787 and the site
talks to it through a proxy.

To serve everything from one address instead, run `npm run build` in `frontend/` once —
the backend then serves the built site on **http://localhost:8787** by itself.

## The pitch

`presentation/Arrivo-INNOTECH26.pdf` is the deck to present from; the `.pptx` is the
editable version. `brag-output/brag.mp4` is a short launch video of the site.

More detail on each part is in `frontend/README.md` and `backend/README.md`.
