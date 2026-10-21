#!/usr/bin/env python3
"""
ParkSeat backend: the whole server in one Python file.

    python server.py               start on http://localhost:8787
    python server.py --no-demo     same, without the made-up demo cars
    python server.py --reset       delete the database and stop (next start is fresh)
    python server.py --reset-demo  undo today's demo cars (real bookings stay) and stop
    python server.py --help        every option

Needs Python 3.8 or newer and nothing else. No pip install.
Then run `npm run dev` in ../frontend. If you have run `npm run build` there, this
server also serves the finished site, so http://localhost:8787 is the whole thing.

The file reads top to bottom:
  1. Settings
  2. The lot: rows A-E and their 96 bays
  3. Database: tables, and a rule that makes double-booking impossible
  4. Time and bay status
  5. Seeding: each day's regular campus traffic
  6. Bookings: make one, cancel one, and the feed events they cause
  7. Live updates: push every change to open pages (Server-Sent Events)
  8. Background loops: the clock and the demo cars
  9. The web server: every URL the site calls
"""

import argparse
import errno
import hashlib
import json
import os
import queue
import random
import re
import secrets
import socket
import sqlite3
import threading
import time
import traceback
from contextlib import contextmanager, suppress
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit


# ---------------------------------------------------------------------------
# 1. Settings
# ---------------------------------------------------------------------------

HERE = Path(__file__).resolve().parent
SITE = HERE.parent / "frontend" / "dist"  # the built frontend, if there is one

options = argparse.ArgumentParser(description="ParkSeat backend")
options.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8787)))
options.add_argument("--db", default=os.environ.get("PARKSEAT_DB", str(HERE / "data" / "parkseat.db")))
options.add_argument("--no-demo", action="store_true", help="no made-up demo cars")
options.add_argument("--reset", action="store_true", help="delete the database and stop")
options.add_argument("--reset-demo", action="store_true", help="undo today's demo cars and stop")
ARGS = options.parse_args()

PORT = ARGS.port
DB_FILE = Path(ARGS.db)
DEMO_ON = not ARGS.no_demo and os.environ.get("PARKSEAT_DEMO", "").lower() not in ("0", "off", "false", "no")
# Other websites allowed to call this API directly. localhost is always allowed.
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGIN", "").split(",") if o.strip()]


# ---------------------------------------------------------------------------
# 2. The lot
# Same rows as frontend/src/lot.jsx. If you change one, change both.
# ---------------------------------------------------------------------------

LOT = {"id": "kiet-main", "name": "KIET main lot", "place": "KIET Group of Institutions, Delhi-NCR"}

PX_PER_M = 7.7  # the map is drawn in pixels of the satellite photo; 7.7 px is one metre
ROWS = [
    # id,  name,          what it is,                                                        from, to, bays, depth (px)
    ("A", "Ground Edge", "Nose-in bays along the football ground, off the service road.", 270, 910, 33, 38),
    ("B", "North Wing", "A short shaded strip under the trees. Compact cars only.", 300, 490, 10, 32),
    ("C", "Main Block", "Facing the main building. EV chargers at the north end.", 548, 1010, 24, 38),
    ("D", "Corner", "Six bays by the south-east entrance. Two of them step-free.", 962, 1088, 6, 36),
    ("E", "South Lot", "The open lot beside the two-wheeler stand.", 80, 532, 23, 38),
]
RATES = {"standard": 20, "compact": 15, "ev": 35, "accessible": 20}  # rupees per hour


def bay_type(row, n):
    if (row == "D" and n <= 2) or (row == "A" and n == 33):
        return "accessible"
    if row == "C" and n <= 4:
        return "ev"
    if row == "B":
        return "compact"
    return "standard"


def make_bays():
    bays = []
    for row_id, _name, _blurb, start_px, end_px, count, depth in ROWS:
        pitch = (end_px - start_px) / count
        for n in range(1, count + 1):
            kind = bay_type(row_id, n)
            bays.append({
                "id": f"{row_id}-{n:02d}", "row": row_id, "n": n, "type": kind, "rate": RATES[kind],
                "width_m": round(pitch / PX_PER_M, 1), "depth_m": round(depth / PX_PER_M, 1),
            })
    return bays


BAYS = make_bays()  # A-01 ... E-23, 96 in all


# ---------------------------------------------------------------------------
# 3. Database (SQLite, one file)
# Times are milliseconds since 1970, like JavaScript's Date.now(). A booking holds its
# bay from start_ms up to (not including) end_ms.
# ---------------------------------------------------------------------------

SCHEMA = """
CREATE TABLE IF NOT EXISTS lots (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  place TEXT
);

CREATE TABLE IF NOT EXISTS rows (
  lot_id   TEXT NOT NULL REFERENCES lots(id),
  id       TEXT NOT NULL,
  name     TEXT NOT NULL,
  blurb    TEXT,
  position INTEGER NOT NULL,
  PRIMARY KEY (lot_id, id)
);

CREATE TABLE IF NOT EXISTS bays (
  id      TEXT PRIMARY KEY,
  lot_id  TEXT NOT NULL REFERENCES lots(id),
  row_id  TEXT NOT NULL,
  n       INTEGER NOT NULL,
  type    TEXT NOT NULL,
  rate    INTEGER NOT NULL,
  width_m REAL,
  depth_m REAL,
  FOREIGN KEY (lot_id, row_id) REFERENCES rows(lot_id, id)
);

CREATE TABLE IF NOT EXISTS bookings (
  id         INTEGER PRIMARY KEY,
  bay_id     TEXT NOT NULL REFERENCES bays(id),
  start_ms   INTEGER NOT NULL,
  end_ms     INTEGER NOT NULL CHECK (end_ms > start_ms),
  plate      TEXT NOT NULL,
  -- confirmed: holds the bay | released: driver left early, end_ms moved up | cancelled: never used
  status     TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'released', 'cancelled')),
  code       TEXT UNIQUE,
  via        TEXT NOT NULL DEFAULT 'app',
  tone       INTEGER NOT NULL DEFAULT 0,
  owner      TEXT, -- hash of the booking browser's cookie; NULL for seeded and demo cars
  source     TEXT NOT NULL CHECK (source IN ('api', 'seed', 'demo')),
  created_ms INTEGER NOT NULL,
  updated_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS bookings_bay_start ON bookings (bay_id, start_ms);
CREATE INDEX IF NOT EXISTS bookings_start ON bookings (start_ms);
CREATE INDEX IF NOT EXISTS bookings_end ON bookings (end_ms);

-- The no-double-booking rule, enforced by the database itself: two live bookings on one
-- bay may never overlap, no matter who writes them.
CREATE TRIGGER IF NOT EXISTS bookings_no_overlap_insert
BEFORE INSERT ON bookings WHEN NEW.status != 'cancelled'
BEGIN
  SELECT RAISE(ABORT, 'overlap') WHERE EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.bay_id = NEW.bay_id AND b.status != 'cancelled'
      AND b.start_ms < NEW.end_ms AND NEW.start_ms < b.end_ms
  );
END;

CREATE TRIGGER IF NOT EXISTS bookings_no_overlap_update
BEFORE UPDATE OF bay_id, start_ms, end_ms, status ON bookings WHEN NEW.status != 'cancelled'
BEGIN
  SELECT RAISE(ABORT, 'overlap') WHERE EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.id != NEW.id AND b.bay_id = NEW.bay_id AND b.status != 'cancelled'
      AND b.start_ms < NEW.end_ms AND NEW.start_ms < b.end_ms
  );
END;

-- What the live feed shows: one row per thing that happened on a bay.
CREATE TABLE IF NOT EXISTS events (
  id         INTEGER PRIMARY KEY,
  lot_id     TEXT NOT NULL REFERENCES lots(id),
  t          INTEGER NOT NULL,
  bay_id     TEXT NOT NULL REFERENCES bays(id),
  kind       TEXT NOT NULL CHECK (kind IN ('book', 'cancel', 'release', 'arrive', 'leave')),
  booking_id INTEGER REFERENCES bookings(id)
);
CREATE INDEX IF NOT EXISTS events_lot_t ON events (lot_id, t);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
"""

db = None  # opened in main()
LOCK = threading.RLock()  # one thing touches the database at a time


def open_db():
    global db
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_FILE, check_same_thread=False, isolation_level=None)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode = WAL")
    db.execute("PRAGMA foreign_keys = ON")
    db.executescript(SCHEMA)


def q_all(sql, *params):
    with LOCK:
        return [dict(r) for r in db.execute(sql, params)]


def q_one(sql, *params):
    with LOCK:
        r = db.execute(sql, params).fetchone()
        return dict(r) if r else None


def run(sql, params=()):
    with LOCK:
        return db.execute(sql, params)


@contextmanager
def transaction():
    """Everything inside happens completely, or not at all."""
    with LOCK:
        db.execute("BEGIN IMMEDIATE")
        try:
            yield
        except BaseException:
            db.execute("ROLLBACK")
            raise
        db.execute("COMMIT")


def meta_get(key):
    r = q_one("SELECT value FROM meta WHERE key = ?", key)
    return r["value"] if r else None


def meta_set(key, value):
    run("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
        (key, str(value)))


def sync_catalog():
    """Writes the lot, rows and bays into the database (safe to run on every start)."""
    with transaction():
        run("""INSERT INTO lots (id, name, place) VALUES (:id, :name, :place)
               ON CONFLICT (id) DO UPDATE SET name = excluded.name, place = excluded.place""", LOT)
        for position, (row_id, name, blurb, *_rest) in enumerate(ROWS):
            run("""INSERT INTO rows (lot_id, id, name, blurb, position) VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT (lot_id, id) DO UPDATE SET name = excluded.name, blurb = excluded.blurb,
                   position = excluded.position""", (LOT["id"], row_id, name, blurb, position))
        for b in BAYS:
            run("""INSERT INTO bays (id, lot_id, row_id, n, type, rate, width_m, depth_m)
                   VALUES (:id, :lot_id, :row, :n, :type, :rate, :width_m, :depth_m)
                   ON CONFLICT (id) DO UPDATE SET lot_id = excluded.lot_id, row_id = excluded.row_id,
                   n = excluded.n, type = excluded.type, rate = excluded.rate,
                   width_m = excluded.width_m, depth_m = excluded.depth_m""", {**b, "lot_id": LOT["id"]})
    return len(BAYS)


def get_lot(lot_id):
    return q_one("SELECT * FROM lots WHERE id = ?", lot_id)


def get_bay(bay_id):
    return q_one("SELECT * FROM bays WHERE id = ?", bay_id)


def list_bays(lot_id):
    return q_all("""SELECT b.* FROM bays b JOIN rows r ON r.lot_id = b.lot_id AND r.id = b.row_id
                    WHERE b.lot_id = ? ORDER BY r.position, b.n""", lot_id)


def list_rows(lot_id):
    return q_all("SELECT id, name, blurb FROM rows WHERE lot_id = ? ORDER BY position", lot_id)


def bookings_in_lot(lot_id, start, end):
    """Every live booking in a lot that touches the window start..end."""
    return q_all("""SELECT k.* FROM bookings k JOIN bays b ON b.id = k.bay_id
                    WHERE b.lot_id = ? AND k.status != 'cancelled' AND k.end_ms > ? AND k.start_ms < ?
                    ORDER BY k.start_ms""", lot_id, start, end)


def bookings_in_bay(bay_id, start, end):
    return q_all("""SELECT * FROM bookings
                    WHERE bay_id = ? AND status != 'cancelled' AND end_ms > ? AND start_ms < ?
                    ORDER BY start_ms""", bay_id, start, end)


def recent_events(lot_id, limit=30):
    return q_all("""SELECT e.*, k.start_ms, k.end_ms, k.owner FROM events e
                    LEFT JOIN bookings k ON k.id = e.booking_id
                    WHERE e.lot_id = ? ORDER BY e.t DESC, e.id DESC LIMIT ?""", lot_id, limit)


# ---------------------------------------------------------------------------
# 4. Time and bay status
# ---------------------------------------------------------------------------

MIN = 60_000
HOUR = 60 * MIN
DAY = 24 * HOUR
ENDING_SOON = 20 * MIN  # "ending soon" when a car is due out within 20 minutes
HOLD_AHEAD = 30 * MIN   # "reserved" when someone is due in within 30 minutes


def now_ms():
    return int(time.time() * 1000)


def local(t):
    return datetime.fromtimestamp(t / 1000)


def day_start(t):
    """Midnight (local time) of the day that contains t."""
    return int(local(t).replace(hour=0, minute=0, second=0, microsecond=0).timestamp() * 1000)


def hhmm(t):
    return local(t).strftime("%H:%M")


def ceil_to(t, step):
    return -(-t // step) * step


def slot_state(bookings, now):
    """What a bay is doing at `now`: free, taken, ending, held or mine.
    Same rule as frontend/src/lot.jsx, so the API and the map always agree."""
    current = nxt = None
    for b in bookings:
        if b["start"] <= now < b["end"]:
            current = b
        elif b["start"] > now and (nxt is None or b["start"] < nxt["start"]):
            nxt = b
    if current:
        status = "mine" if current["mine"] else "ending" if current["end"] - now <= ENDING_SOON else "taken"
    elif nxt and nxt["start"] - now <= HOLD_AHEAD:
        status = "mine" if nxt["mine"] else "held"
    else:
        status = "free"
    free_until = None if current else nxt["start"] if nxt else day_start(now) + DAY
    return {"status": status, "current": current, "next": nxt, "freeUntil": free_until}


def mask_plate(plate):
    """UP14 AB 1234 -> UP14 •• 1234, so strangers can't read your number."""
    parts = plate.split(" ")
    return f"{parts[0]} •• {parts[-1]}" if len(parts) >= 3 else plate


# ---------------------------------------------------------------------------
# 5. Seeding: the regular cars of a teaching day, added once per date.
# Uses the same random formula the frontend used, so each day looks the same as before.
# ---------------------------------------------------------------------------

# How likely a bay is to be in use at each hour (0-23). Hostel and staff cars keep some
# of the lot busy overnight.
DEMAND = [0.42, 0.4, 0.38, 0.38, 0.38, 0.4, 0.46, 0.56, 0.78, 0.88, 0.9, 0.9,
          0.86, 0.88, 0.9, 0.86, 0.76, 0.64, 0.56, 0.5, 0.48, 0.46, 0.44, 0.43]
PREFIX = ["UP14", "UP14", "UP14", "UP16", "UP80", "DL3C", "DL8C", "HR26", "UP15"]
LETTERS = "ABCDEFGHJKLMNPRSTUVWXZ"
VIA = ["app", "app", "app", "app", "pass", "gate"]
U32 = 0xFFFFFFFF


def text_hash(s):
    """A number from a piece of text (FNV-1a), same as the frontend's hash()."""
    h = 2166136261
    for ch in s:
        h = ((h ^ ord(ch)) * 16777619) & U32
    return h


def seeded_random(seed):
    """A repeatable random number generator (mulberry32): same seed, same numbers."""
    a = seed & U32

    def r():
        nonlocal a
        a = (a + 0x6D2B79F5) & U32
        t = ((a ^ (a >> 15)) * (1 | a)) & U32
        t = ((t + (((t ^ (t >> 7)) * (61 | t)) & U32)) & U32) ^ t
        return ((t ^ (t >> 14)) & U32) / 4294967296

    return r


def random_car(r):
    """A made-up driver: number plate, how they booked, and a colour for the map."""
    plate = (f"{PREFIX[int(r() * len(PREFIX))]} "
             f"{LETTERS[int(r() * len(LETTERS))]}{LETTERS[int(r() * len(LETTERS))]} "
             f"{1000 + int(r() * 9000)}")
    return {"plate": plate, "via": VIA[int(r() * len(VIA))], "tone": int(r() * 100)}


def seed_plan(start):
    """The regular cars for the day that begins at `start`: (bay id, arrives, leaves, car)
    for each. A date always gets the same cars."""
    seed_base = local(start).strftime("%a %b %d %Y")  # e.g. "Mon Oct 19 2026"
    plan = []
    for b in BAYS:
        r = seeded_random(text_hash(seed_base + b["id"]))
        t = start + int(r() * 18) * 5 * MIN
        while t < start + DAY:
            hour = local(t).hour
            if r() < DEMAND[hour]:
                peak = 8 <= hour <= 15
                stay = (3 + int(r() * (22 if peak else 9))) * 15 * MIN
                end = min(t + stay, start + DAY)
                plan.append((b["id"], t, end, random_car(r)))
                t = end + (1 + int(r() * 7)) * 5 * MIN
            else:
                t += (2 + int(r() * 7)) * 15 * MIN
    return plan


def usual_fullness(t):
    """How full the regular cars make the lot at time t, from 0 to 1."""
    return sum(1 for _bay, arrives, leaves, _car in seed_plan(day_start(t)) if arrives <= t < leaves) / len(BAYS)


def ensure_day(t):
    """Adds the background traffic for the day containing t, once per date."""
    start = day_start(t)
    key = f"seeded:{local(start).strftime('%Y-%m-%d')}"
    if meta_get(key):
        return 0
    added = 0
    with transaction():
        for bay_id, arrives, leaves, car in seed_plan(start):
            # Skip anything a real booking (say, one running past midnight) already holds.
            if not q_one(CLASH_SQL, bay_id, leaves, arrives):
                run("""INSERT INTO bookings (bay_id, start_ms, end_ms, plate, via, tone, source,
                       created_ms, updated_ms) VALUES (?, ?, ?, ?, ?, ?, 'seed', ?, ?)""",
                    (bay_id, arrives, leaves, car["plate"], car["via"], car["tone"], start - 1, start - 1))
                added += 1
        meta_set(key, now_ms())
    return added


# ---------------------------------------------------------------------------
# 6. Bookings
# ---------------------------------------------------------------------------

class ApiError(Exception):
    """A problem to send back to the page, with a message fit to show the user."""

    def __init__(self, status, code, message, **extra):
        super().__init__(message)
        self.status, self.code, self.message, self.extra = status, code, message, extra


CLASH_SQL = """SELECT * FROM bookings
               WHERE bay_id = ? AND status != 'cancelled' AND start_ms < ? AND end_ms > ?
               ORDER BY start_ms LIMIT 1"""
CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O or 1/I, easy to read out at the gate
PLATE = re.compile(r"^[A-Z0-9 ]{6,14}$")


def overlap_error(bay_id, clash):
    return ApiError(409, "overlap",
                    f"{bay_id} is already booked {hhmm(clash['start_ms'])}–{hhmm(clash['end_ms'])}. "
                    "Pick another window.",
                    conflict={"start": clash["start_ms"], "end": clash["end_ms"]})


def insert_booking(row, with_code):
    """Checks for a clash and saves the booking in one locked step."""
    try:
        with transaction():
            clash = q_one(CLASH_SQL, row["bay_id"], row["end_ms"], row["start_ms"])
            if clash:
                raise overlap_error(row["bay_id"], clash)
            for tries in range(6):
                code = "PS-" + "".join(secrets.choice(CODE_CHARS) for _ in range(5)) if with_code else None
                try:
                    cur = run("""INSERT INTO bookings (bay_id, start_ms, end_ms, plate, code, via, tone, owner,
                                 source, created_ms, updated_ms) VALUES (:bay_id, :start_ms, :end_ms, :plate,
                                 :code, :via, :tone, :owner, :source, :now, :now)""", {**row, "code": code})
                    break
                except sqlite3.IntegrityError as e:  # two codes the same, try another
                    if "UNIQUE" not in str(e) or tries == 5:
                        raise
            return q_one("SELECT * FROM bookings WHERE id = ?", cur.lastrowid)
    except sqlite3.IntegrityError as e:
        if str(e) == "overlap":  # the database rule caught a clash
            raise overlap_error(row["bay_id"], q_one(CLASH_SQL, row["bay_id"], row["end_ms"], row["start_ms"]) or row)
        raise


def record_event(kind, booking, t):
    """Saves a feed event. Returns (lot id, event) for publish()."""
    lot_id = get_bay(booking["bay_id"])["lot_id"]
    cur = run("INSERT INTO events (lot_id, t, bay_id, kind, booking_id) VALUES (?, ?, ?, ?, ?)",
              (lot_id, t, booking["bay_id"], kind, booking["id"]))
    event = {"id": cur.lastrowid, "lot_id": lot_id, "t": t, "bay_id": booking["bay_id"], "kind": kind,
             "booking_id": booking["id"], "start_ms": booking["start_ms"], "end_ms": booking["end_ms"],
             "owner": booking["owner"]}
    return lot_id, event


def announce(kind, booking, t):
    with LOCK:
        lot_id, event = record_event(kind, booking, t)
        publish(lot_id, booking=booking, event=event)


def as_int(v):
    """A whole number from JSON or a URL, or None."""
    if isinstance(v, bool):
        return None
    if isinstance(v, int):
        return v
    if isinstance(v, float) and v.is_integer():
        return int(v)
    if isinstance(v, str):
        with suppress(ValueError):
            return int(v)
    return None


def create_booking(body, owner, now=None):
    now = now or now_ms()
    if not isinstance(body, dict):
        raise ApiError(400, "bad_body", "Send bayId, start, end and plate as JSON.")
    bay = get_bay(str(body.get("bayId", "")))
    if not bay:
        raise ApiError(404, "no_bay", f'There is no bay called "{body.get("bayId", "")}".')

    start, end = as_int(body.get("start")), as_int(body.get("end"))
    if start is None or end is None:
        raise ApiError(400, "bad_time", "Pick when you arrive and when you leave.")
    if end <= start:
        raise ApiError(400, "bad_time", "A booking has to end after it starts.")
    if not 15 * MIN <= end - start <= 12 * HOUR:
        raise ApiError(400, "bad_time", "Bookings run from 15 minutes to 12 hours.")
    if start < now - 2 * MIN:
        raise ApiError(400, "bad_time", "That start time has already passed. Pick a later one.")
    if start > now + 2 * DAY:
        raise ApiError(400, "bad_time", "You can book up to two days ahead.")

    plate = re.sub(r"\s+", " ", "" if body.get("plate") is None else str(body["plate"])).upper().strip()
    if len(plate.replace(" ", "")) < 6 or not PLATE.match(plate):
        raise ApiError(400, "bad_plate", "Add your vehicle number, e.g. UP14 AB 1234.")

    with LOCK:
        booking = insert_booking({"bay_id": bay["id"], "start_ms": start, "end_ms": end, "plate": plate,
                                  "via": "app", "tone": secrets.randbelow(100), "owner": owner,
                                  "source": "api", "now": now}, with_code=True)
        announce("book", booking, now)
    return booking


def cancel_booking(booking_id, owner, now=None):
    """Before it starts, a booking is cancelled outright. Once the car is in, cancelling
    ends the stay now and frees the bay."""
    now = now or now_ms()
    with LOCK:
        booking = q_one("SELECT * FROM bookings WHERE id = ?", as_int(booking_id))
        if not booking:
            raise ApiError(404, "no_booking", "That booking does not exist.")
        if not owner or booking["owner"] != owner:
            raise ApiError(403, "not_yours", "Only the device that made this booking can cancel it.")
        if booking["status"] != "confirmed" or booking["end_ms"] <= now:
            raise ApiError(409, "closed", "This booking has already ended.")
        live = booking["start_ms"] <= now
        run("UPDATE bookings SET status = ?, end_ms = ?, updated_ms = ? WHERE id = ?",
            ("released" if live else "cancelled", now if live else booking["end_ms"], now, booking["id"]))
        updated = q_one("SELECT * FROM bookings WHERE id = ?", booking["id"])
        announce("release" if live else "cancel", updated, now)
    return updated


def create_demo_booking(bay_id, start, end, car, now):
    with LOCK:
        booking = insert_booking({"bay_id": bay_id, "start_ms": start, "end_ms": end, **car, "owner": None,
                                  "source": "demo", "now": now}, with_code=False)
        announce("book", booking, now)
    return booking


def release_booking(booking, now):
    """A demo car leaves before its time is up."""
    with LOCK:
        run("UPDATE bookings SET status = 'released', end_ms = ?, updated_ms = ? WHERE id = ?",
            (now, now, booking["id"]))
        updated = q_one("SELECT * FROM bookings WHERE id = ?", booking["id"])
        announce("release", updated, now)
    return updated


# How things leave the server. Other people's plates go out masked and their gate codes
# not at all; only the browser that made a booking sees it in full.

def booking_out(b, owner):
    mine = bool(owner) and b["owner"] == owner
    out = {"id": str(b["id"]), "bayId": b["bay_id"], "start": b["start_ms"], "end": b["end_ms"],
           "status": b["status"], "plate": b["plate"] if mine else mask_plate(b["plate"]),
           "via": b["via"], "tone": b["tone"], "mine": mine}
    if mine:
        out["code"] = b["code"]
        out["madeAt"] = b["created_ms"]
    return out


def event_out(e, owner):
    return {"id": f"ev{e['id']}", "t": e["t"], "bayId": e["bay_id"], "kind": e["kind"],
            "start": e["start_ms"], "end": e["end_ms"], "mine": bool(owner) and e["owner"] == owner}


def bay_out(b):
    return {"id": b["id"], "row": b["row_id"], "n": b["n"], "type": b["type"], "rate": b["rate"],
            "widthM": b["width_m"], "depthM": b["depth_m"]}


# ---------------------------------------------------------------------------
# 7. Live updates (Server-Sent Events)
# Every open map keeps one connection. Each change is sent as a `change` message with
# the booking as it now stands and the feed event it caused.
# ---------------------------------------------------------------------------

LISTENERS = {}  # inbox (a queue) -> (lot id, owner) for every open page


def frame(kind, data):
    return f"event: {kind}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def publish(lot_id, booking=None, event=None):
    with LOCK:
        for inbox, (lot, owner) in LISTENERS.items():
            if lot == lot_id:
                inbox.put(("change", {"booking": booking and booking_out(booking, owner),
                                      "event": event and event_out(event, owner)}))


def listener_count(lot_id=None):
    with LOCK:
        return sum(1 for lot, _ in LISTENERS.values() if lot_id is None or lot == lot_id)


# ---------------------------------------------------------------------------
# 8. Background loops
# ---------------------------------------------------------------------------

BACKFILL = 45 * MIN  # on a fresh start, look this far back so the feed opens with something in it


def clock_tick():
    """Every 5 s: cars whose booking just started 'arrive', ones whose booking just
    ended 'leave'. Also seeds a new day when the date changes."""
    now = now_ms()
    ensure_day(now)
    with LOCK:
        since = max(int(meta_get("clock") or 0), now - BACKFILL)
        with transaction():
            happened = [record_event("arrive", b, b["start_ms"]) for b in q_all(
                """SELECT * FROM bookings WHERE status != 'cancelled' AND start_ms > ? AND start_ms <= ?
                   AND created_ms < start_ms ORDER BY start_ms""", since, now)]
            happened += [record_event("leave", b, b["end_ms"]) for b in q_all(
                """SELECT * FROM bookings WHERE status = 'confirmed' AND end_ms > ? AND end_ms <= ?
                   ORDER BY end_ms""", since, now)]
            meta_set("clock", now)
            run("DELETE FROM events WHERE id <= (SELECT id FROM events ORDER BY id DESC LIMIT 1 OFFSET 5000)")
        for lot_id, event in sorted(happened, key=lambda h: h[1]["t"]):
            publish(lot_id, event=event)


DEMO_MAX_WAITING = round(0.06 * len(BAYS))  # demo reservations not yet started: about 6% of bays
DEMO_MIN_STAY = 20 * MIN  # a car is parked at least this long before it may leave early


def demo_step():
    """One move by the demo cars: someone pulls in, reserves for later, or leaves early.
    Never touches a booking a real person made."""
    t = now_ms()
    by_bay = {}
    for row in bookings_in_lot(LOT["id"], t, day_start(t) + DAY):
        by_bay.setdefault(row["bay_id"], []).append(
            {"start": row["start_ms"], "end": row["end_ms"], "mine": False, "row": row})
    states = [(bay, slot_state(by_bay.get(bay["id"], []), t)) for bay in BAYS]
    free = [(bay, s) for bay, s in states if s["status"] == "free" and s["freeUntil"] - t >= 50 * MIN]
    parked = sum(1 for _bay, s in states if s["status"] in ("taken", "ending"))
    # Cars that may leave early: not a real person's, not due out soon anyway, in for a while,
    # and with nobody due in the bay for a while after (or it would just turn "reserved").
    leavers = [s["current"]["row"] for _bay, s in states if s["status"] == "taken"
               and s["current"]["row"]["source"] != "api" and t - s["current"]["start"] >= DEMO_MIN_STAY
               and (s["next"] is None or s["next"]["start"] - t >= 50 * MIN)]
    waiting = q_one("""SELECT COUNT(*) AS n FROM bookings
                       WHERE source = 'demo' AND status = 'confirmed' AND start_ms > ?""", t)["n"]

    # Lean towards how full the regular cars usually make the lot at this time of day.
    # Only parked cars count: a reserved bay has no car in it, so it doesn't make the lot full.
    off = parked / len(BAYS) - usual_fullness(t)
    r = random.random()
    if off > 0.05:
        move = "early" if r < 0.75 else "reserve" if r < 0.9 else "arrive"
    elif off < -0.05:
        move = "arrive" if r < 0.75 else "reserve" if r < 0.9 else "early"
    else:
        move = "arrive" if r < 0.4 else "early" if r < 0.8 else "reserve"

    if move == "early" and leavers:
        # The longer a car has been parked, the likelier it is the one to go.
        release_booking(random.choices(leavers, [t - b["start_ms"] for b in leavers])[0], t)
    elif move == "reserve" and free and waiting < DEMO_MAX_WAITING:
        choices = [(bay, s) for bay, s in free if s["freeUntil"] - t >= 90 * MIN]
        if choices:
            bay, s = random.choice(choices)
            start = ceil_to(t + random.randint(8, 25) * MIN, MIN)
            end = min(start + random.randint(4, 11) * 15 * MIN, s["freeUntil"] - 5 * MIN)
            create_demo_booking(bay["id"], start, end, random_car(random.random), t)
    elif move == "arrive" and free:
        bay, s = random.choice(free)
        end = min(t + random.randint(4, 15) * 15 * MIN, s["freeUntil"] - 5 * MIN)
        if end - t >= 30 * MIN:
            create_demo_booking(bay["id"], t, end, random_car(random.random), t)


def reset_demo():
    """Undoes today's demo cars: removes their bookings and feed lines, and gives the regular
    cars they sent off early their full stay back. Real bookings are left as they are."""
    now = now_ms()
    start = day_start(now)
    planned = {(bay_id, arrives): leaves for bay_id, arrives, leaves, _car in seed_plan(start)}
    demo = "SELECT id FROM bookings WHERE source = 'demo' AND end_ms > ?"
    restored = 0
    with transaction():
        run(f"DELETE FROM events WHERE booking_id IN ({demo})", (start,))
        removed = run(f"DELETE FROM bookings WHERE id IN ({demo})", (start,)).rowcount
        for b in q_all("""SELECT * FROM bookings WHERE source = 'seed' AND status = 'released'
                          AND start_ms >= ? AND start_ms < ?""", start, start + DAY):
            leaves = planned.get((b["bay_id"], b["start_ms"]))
            if not leaves:
                continue
            try:
                run("UPDATE bookings SET status = 'confirmed', end_ms = ?, updated_ms = ? WHERE id = ?",
                    (leaves, now, b["id"]))
            except sqlite3.IntegrityError:
                continue  # a real booking has the bay now; this car stays gone
            run("DELETE FROM events WHERE booking_id = ? AND kind = 'release'", (b["id"],))
            restored += 1
    print(f"Removed {removed} demo bookings from today and gave {restored} regular cars their bay back.\n"
          "Now start the server again: python server.py (restart it if it is running).")


def keep_running(job, wait):
    """Runs job() forever, sleeping wait() seconds between runs, in the background."""
    def loop():
        while True:
            time.sleep(wait())
            try:
                job()
            except ApiError:
                pass  # e.g. a real booking took the bay a demo car wanted; try again next time
            except Exception:
                traceback.print_exc()

    threading.Thread(target=loop, daemon=True).start()


def demo_if_watched():
    if DEMO_ON and listener_count(LOT["id"]) > 0:  # only while someone has the map open
        demo_step()


# ---------------------------------------------------------------------------
# 9. The web server
# ---------------------------------------------------------------------------

def lot_or_404(lot_id):
    lot = get_lot(lot_id)
    if not lot:
        raise ApiError(404, "no_lot", f'There is no lot called "{lot_id}".')
    return lot


def window_of(req, now):
    """?from=&to= in milliseconds; today by default."""
    start = as_int(req.query["from"]) if "from" in req.query else day_start(now)
    end = as_int(req.query["to"]) if "to" in req.query else (start + DAY if start is not None else None)
    if start is None or end is None or end <= start or end - start > 3 * DAY:
        raise ApiError(400, "bad_window", "from and to must be epoch milliseconds, at most three days apart.")
    return start, end


# --- What each URL does. Each gets the request and returns the JSON to send back. ---

def health(req):
    return {"ok": True, "now": now_ms(), "demo": DEMO_ON, "listeners": listener_count()}


def lots(req):
    return {"lots": q_all("""SELECT l.id, l.name, l.place, COUNT(b.id) AS bays
                             FROM lots l LEFT JOIN bays b ON b.lot_id = l.id GROUP BY l.id ORDER BY l.id""")}


def lot_bays(req, lot_id):
    """Every bay in the lot and what it is doing right now."""
    lot, now = lot_or_404(lot_id), now_ms()
    by_bay = {}
    for b in bookings_in_lot(lot["id"], now, day_start(now) + DAY):
        by_bay.setdefault(b["bay_id"], []).append(booking_out(b, req.owner))
    counts = {"free": 0, "taken": 0, "ending": 0, "held": 0, "mine": 0, "total": 0}
    bays = []
    for bay in list_bays(lot["id"]):
        state = slot_state(by_bay.get(bay["id"], []), now)
        counts[state["status"]] += 1
        counts["total"] += 1
        bays.append({**bay_out(bay), **state})
    counts["booked"] = counts["taken"] + counts["ending"]
    return {"lot": lot, "rows": list_rows(lot["id"]), "now": now, "counts": counts, "bays": bays}


def snapshot(req, lot_id):
    """What the map loads when it opens: the day's bookings and the latest feed."""
    lot, now = lot_or_404(lot_id), now_ms()
    start, end = window_of(req, now)
    return {"lotId": lot["id"], "now": now, "from": start, "to": end,
            "bookings": [booking_out(b, req.owner) for b in bookings_in_lot(lot["id"], start, end)],
            "events": [event_out(e, req.owner) for e in recent_events(lot["id"])]}


def stream(req, lot_id):
    req.stream(lot_or_404(lot_id)["id"])


def bay_bookings(req, bay_id):
    """One bay: its status now and its bookings for the day."""
    bay = get_bay(bay_id)
    if not bay:
        raise ApiError(404, "no_bay", f'There is no bay called "{bay_id}".')
    now = now_ms()
    start, end = window_of(req, now)
    bookings = [booking_out(b, req.owner) for b in bookings_in_bay(bay["id"], start, end)]
    return {"bay": {**bay_out(bay), **slot_state(bookings, now)}, "now": now, "from": start, "to": end,
            "bookings": bookings}


def post_booking(req):
    return 201, {"booking": booking_out(create_booking(req.body(), req.owner), req.owner)}


def delete_booking(req, booking_id):
    return {"booking": booking_out(cancel_booking(booking_id, req.owner), req.owner)}


def get_demo(req):
    return {"enabled": DEMO_ON}


def set_demo(req):
    global DEMO_ON
    body = req.body()
    if not isinstance(body, dict) or not isinstance(body.get("enabled"), bool):
        raise ApiError(400, "bad_body", 'Send { "enabled": true } or { "enabled": false }.')
    DEMO_ON = body["enabled"]
    return {"enabled": DEMO_ON}


ROUTES = [
    ("GET", r"/api/health", health),
    ("GET", r"/api/lots", lots),
    ("GET", r"/api/lots/([^/]+)/bays", lot_bays),
    ("GET", r"/api/lots/([^/]+)/snapshot", snapshot),
    ("GET", r"/api/lots/([^/]+)/stream", stream),
    ("GET", r"/api/bays/([^/]+)/bookings", bay_bookings),
    ("POST", r"/api/bookings", post_booking),
    ("DELETE", r"/api/bookings/([^/]+)", delete_booking),
    ("GET", r"/api/demo", get_demo),
    ("POST", r"/api/demo", set_demo),
]

LOCAL_ORIGIN = re.compile(r"https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?")
FILE_TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
              ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".jpg": "image/jpeg",
              ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".ico": "image/x-icon",
              ".woff": "font/woff", ".woff2": "font/woff2", ".json": "application/json",
              ".txt": "text/plain; charset=utf-8"}


class Handler(BaseHTTPRequestHandler):
    server_version = "ParkSeat"
    sys_version = ""

    def do_GET(self):
        self.handle_request("GET")

    def do_POST(self):
        self.handle_request("POST")

    def do_DELETE(self):
        self.handle_request("DELETE")

    def do_OPTIONS(self):
        self.handle_request("OPTIONS")

    def handle_request(self, method):
        url = urlsplit(self.path)
        self.query = {k: v[-1] for k, v in parse_qs(url.query).items()}
        self.extra = []  # headers every reply gets: the cookie and CORS
        self.identify()
        self.allow_cors()
        if method == "OPTIONS":
            self.extra += [("Access-Control-Allow-Methods", "GET, POST, DELETE"),
                           ("Access-Control-Allow-Headers", "Content-Type")]
            return self.send_body(204, b"", None)
        if not url.path.startswith("/api"):
            return self.serve_site(url.path) if method == "GET" else self.send_json(404, {"error": "not_found"})
        for route_method, pattern, action in ROUTES:
            match = re.fullmatch(pattern, url.path)
            if match and route_method == method:
                try:
                    out = action(self, *[unquote(g) for g in match.groups()])
                except ApiError as e:
                    return self.send_json(e.status, {"error": e.code, "message": e.message, **e.extra})
                except Exception:
                    traceback.print_exc()
                    return self.send_json(500, {"error": "server", "message": "Something went wrong on our side. Try again."})
                if out is not None:  # None means the reply was already sent (the live stream)
                    status, data = out if isinstance(out, tuple) else (200, out)
                    self.send_json(status, data)
                return
        self.send_json(404, {"error": "not_found", "message": f"No route for {method} {url.path}."})

    # --- Who is asking, and from where ---

    def identify(self):
        """No accounts: each browser gets an anonymous id in a cookie. That id is what makes a
        booking 'yours' in every tab and after a reload. Only a hash of it is stored."""
        found = re.search(r"(?:^|;\s*)ps_device=([\w-]{20,64})", self.headers.get("Cookie", ""))
        device = found.group(1) if found else None
        if not device:
            device = secrets.token_urlsafe(24)
            self.extra.append(("Set-Cookie", f"ps_device={device}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax"))
        self.owner = hashlib.sha256(device.encode()).hexdigest()

    def allow_cors(self):
        origin = self.headers.get("Origin")
        if origin and (LOCAL_ORIGIN.fullmatch(origin) or origin in CORS_ORIGINS):
            self.extra += [("Access-Control-Allow-Origin", origin),
                           ("Access-Control-Allow-Credentials", "true"), ("Vary", "Origin")]

    def body(self):
        size = int(self.headers.get("Content-Length") or 0)
        if size > 10_000:
            raise ApiError(413, "too_big", "That request is too large.")
        raw = self.rfile.read(size) if size else b""
        if not raw or "json" not in self.headers.get("Content-Type", ""):
            return None
        try:
            return json.loads(raw)
        except ValueError:
            raise ApiError(400, "bad_json", "The request body is not valid JSON.")

    # --- Sending things back ---

    def end_headers(self):
        for name, value in getattr(self, "extra", []):
            self.send_header(name, value)
        super().end_headers()

    def send_body(self, status, raw, content_type, cache=None):
        self.send_response(status)
        if content_type:
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(raw)))
        if cache:
            self.send_header("Cache-Control", cache)
        self.end_headers()
        if raw:
            self.wfile.write(raw)

    def send_json(self, status, data):
        raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode()
        self.send_body(status, raw, "application/json; charset=utf-8")

    def stream(self, lot_id):
        """Keeps the connection open and writes each change as it happens."""
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-transform")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()
        inbox = queue.Queue()
        with LOCK:
            LISTENERS[inbox] = (lot_id, self.owner)
        try:
            self.wfile.write(("retry: 2000\n\n" + frame("hello", {"now": now_ms(), "lotId": lot_id})).encode())
            while True:
                try:
                    kind, data = inbox.get(timeout=15)
                except queue.Empty:  # quiet for 15 s: send a ping so the page knows we're alive
                    kind, data = "ping", {"now": now_ms()}
                self.wfile.write(frame(kind, data).encode())
        except OSError:  # the page was closed
            pass
        finally:
            with LOCK:
                LISTENERS.pop(inbox, None)

    def serve_site(self, path):
        """The built frontend (frontend/dist). Any page that isn't a file gets index.html."""
        root = SITE.resolve()
        if not (root / "index.html").is_file():
            text = b"ParkSeat API is running. For the site, run `npm run dev` in frontend (or `npm run build` to serve it from here)."
            return self.send_body(404, text, "text/plain; charset=utf-8")
        file = (root / unquote(path).lstrip("/")).resolve()
        if not file.is_file() or root not in file.parents:
            if path.startswith("/assets/"):
                return self.send_body(404, b"Not found", "text/plain; charset=utf-8")
            file = root / "index.html"
        cache = "public, max-age=31536000, immutable" if path.startswith("/assets/") else "no-cache"
        self.send_body(200, file.read_bytes(), FILE_TYPES.get(file.suffix.lower(), "application/octet-stream"), cache)

    # --- Console output: only bookings and cancellations, not every page load ---

    def log_request(self, code="-", size="-"):
        if self.command in ("POST", "DELETE"):
            print(f"{time.strftime('%H:%M:%S')}  {self.command} {self.path}  ->  {code}", flush=True)

    def log_message(self, *args):
        pass


class Server(ThreadingHTTPServer):
    daemon_threads = True
    # Never share a port with another server (on Windows reuse_address would allow it).
    allow_reuse_address = os.name != "nt"
    allow_reuse_port = False
    address_family = socket.AF_INET6

    def server_bind(self):
        with suppress(OSError, AttributeError):  # accept IPv4 as well as IPv6
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        super().server_bind()


def port_busy(e):
    return e.errno in (errno.EADDRINUSE, 10048) or getattr(e, "winerror", None) == 10048


def make_server():
    try:
        return Server(("::", PORT), Handler)
    except OSError as e:
        if port_busy(e):
            raise
        Server.address_family = socket.AF_INET  # no IPv6 on this machine
        return Server(("0.0.0.0", PORT), Handler)


def reset():
    for f in (DB_FILE, Path(f"{DB_FILE}-wal"), Path(f"{DB_FILE}-shm")):
        try:
            f.unlink()
        except FileNotFoundError:
            pass
        except PermissionError:
            print("The database is in use. Stop the server first, then run this again.")
            return
    print(f"Removed {DB_FILE}. The next start sets up a fresh lot.")


def main():
    if ARGS.reset:
        return reset()
    open_db()
    bay_count = sync_catalog()
    if ARGS.reset_demo:
        return reset_demo()
    clock_tick()
    try:
        server = make_server()
    except OSError as e:
        if port_busy(e):
            print(f"Port {PORT} is already in use. Is the old Node backend (npm run dev) still running?\n"
                  f"Stop it, or start this one on another port: python server.py --port {PORT + 1}")
            return
        raise
    keep_running(clock_tick, lambda: 5)
    # One demo move every 15-30 s. Any faster and every car has to leave again within minutes.
    keep_running(demo_if_watched, lambda: random.uniform(15, 30))

    print(f"ParkSeat API on http://localhost:{PORT}  |  {bay_count} bays  |  demo cars {'on' if DEMO_ON else 'off'}")
    print(f"Database: {DB_FILE}")
    if (SITE / "index.html").is_file():
        print(f"Site:     http://localhost:{PORT}  (the built frontend)")
    print("Press Ctrl+C to stop.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.server_close()
        db.close()


if __name__ == "__main__":
    main()
