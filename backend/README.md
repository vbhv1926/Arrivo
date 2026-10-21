# ParkSeat — backend

The API behind the lot: bays, bookings and a live stream of what changes.

The whole backend is one Python file, [`server.py`](server.py). It needs Python 3.8+ and nothing else (no `pip install`):

```bash
python server.py
```

That's it. The API runs on http://localhost:8787. Then run `npm run dev` in `../frontend`; Vite proxies `/api` to this server. If you have run `npm run build` in `../frontend`, this server also serves the finished site, so http://localhost:8787 is the whole thing.

| Command | What it does |
| --- | --- |
| `python server.py` | Starts the API. Demo cars on. |
| `python server.py --no-demo` | Same, with a quiet lot. |
| `python server.py --port 8788` | Another port. |
| `python server.py --reset` | Deletes the database. The next start rebuilds the lot and seeds today. Stop the server first. |

| Setting | Default | |
| --- | --- | --- |
| `--port` or `PORT` | `8787` | |
| `--db` or `PARKSEAT_DB` | `data/parkseat.db` | SQLite file. Created on first start. |
| `PARKSEAT_DEMO` | on | `off` stops the demo traffic. So does `--no-demo`. |
| `CORS_ORIGIN` | | Extra origins allowed to call the API directly, comma separated. `localhost` origins are always allowed. |
## Data

| Table | Holds |
| --- | --- |
| `lots` | One row: `kiet-main`. |
| `rows` | Rows A–E with their names and blurbs. |
| `bays` | The 96 bays, with type and hourly rate. Written on every start from the `ROWS` table in `server.py`, which copies `../frontend/src/lot/geometry.js`. If you change the rows in one, change the other. |
| `bookings` | Bay, `start_ms`/`end_ms` (epoch ms), plate, gate `code`, `status` (`confirmed`, `released` when a car left early, `cancelled`), and who made it. |
| `events` | The live feed: `book`, `cancel`, `release`, `arrive`, `leave`. |

A bay can't be double-booked. A booking is checked and inserted inside one write transaction. SQLite triggers on `bookings` also refuse any overlapping row, whoever writes it.

## Endpoints

| | |
| --- | --- |
| `GET /api/health` | Up, demo on or off, open streams. |
| `GET /api/lots` | Lots with their bay counts. |
| `GET /api/lots/:lotId/bays` | Every bay with its status now (`free`, `taken`, `ending`, `held`, `mine`), current and next booking, and counts. |
| `GET /api/lots/:lotId/snapshot?from=&to=` | All bookings in a window (default: today) plus the latest 30 feed events. The map loads this on open and after every reconnect. |
| `GET /api/lots/:lotId/stream` | Server-Sent Events, see below. |
| `GET /api/bays/:bayId/bookings?from=&to=` | One bay's status and its bookings for the day. |
| `POST /api/bookings` | `{ bayId, start, end, plate }` → `201 { booking }`. A clash returns `409 { error: "overlap", message, conflict: { start, end } }`; bad input returns `400` with a message fit to show. |
| `DELETE /api/bookings/:id` | Cancels a booking that hasn't started. If the car is already in, it ends the stay now. Only the device that made the booking can do this. |
| `GET` / `POST /api/demo` | Read or set `{ enabled }` for the demo traffic. |

There are no accounts. Each browser gets an anonymous `ps_device` cookie, which makes a booking "yours" in every tab and after a reload. The server stores only a hash of it. Other people's plates go out masked (`UP14 •• 1234`) and their gate codes not at all.

## Live stream

`GET /api/lots/kiet-main/stream` sends:

- `hello` on connect. The page reloads its snapshot here, so nothing is missed across a reconnect.
- `change` with `{ booking, event }` whenever something happens. `booking` is the booking as it now stands; a `cancelled` one should be dropped. Either field may be `null`.
- `ping` every 15 s, so the page can spot a dead connection.

Three things make changes:

- **People**, through `POST` and `DELETE`.
- **The clock.** Every 5 s it turns bookings that just started or ended into `arrive` and `leave` events. When the date changes it seeds that day's background traffic, the regular cars of a teaching day, generated the same way the frontend used to do it locally.
- **Demo traffic.** Made-up drivers pull in, reserve ahead or leave early every few seconds. It runs only while someone has the map open, and it never touches a booking a person made.
