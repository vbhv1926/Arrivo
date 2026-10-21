import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

/* ---------- the lot: geometry ---------- */

// The KIET main lot, drawn bay by bay.
// Every coordinate below is a pixel of public/kiet-lot.jpg (784 × 1601, a Google Earth
// capture). The capture's scale bar puts 50 m at 385 px, so one metre is 7.7 px.
// Rows follow the yellow lines marked on that capture.

export const IMG = { w: 784, h: 1601, rotate: -1, cx: 400, cy: 700 }
export const PX_PER_M = 7.7
export const VIEW = { x: 30, y: 226, w: 680, h: 930 }

export const ROWS = [
  {
    id: 'A',
    name: 'Ground Edge',
    blurb: 'Nose-in bays along the football ground, off the service road.',
    axis: 'v',
    line: 547,
    from: 270,
    to: 910,
    count: 33,
    depth: 38,
    dir: -1,
  },
  {
    id: 'B',
    name: 'North Wing',
    blurb: 'A short shaded strip under the trees. Compact cars only.',
    axis: 'v',
    line: 574,
    from: 300,
    to: 490,
    count: 10,
    depth: 32,
    dir: 1,
  },
  {
    id: 'C',
    name: 'Main Block',
    blurb: 'Facing the main building. EV chargers at the north end.',
    axis: 'v',
    line: 578,
    from: 548,
    to: 1010,
    count: 24,
    depth: 38,
    dir: 1,
  },
  {
    id: 'D',
    name: 'Corner',
    blurb: 'Six bays by the south-east entrance. Two of them step-free.',
    axis: 'v',
    line: 631,
    from: 962,
    to: 1088,
    count: 6,
    depth: 36,
    dir: 1,
  },
  {
    id: 'E',
    name: 'South Lot',
    blurb: 'The open lot beside the two-wheeler stand.',
    axis: 'h',
    line: 1085,
    from: 80,
    to: 532,
    count: 23,
    depth: 38,
    dir: -1,
  },
]

export const TYPES = {
  standard: { label: 'Standard', rate: 20 },
  compact: { label: 'Compact', rate: 15 },
  ev: { label: 'EV charging', rate: 35 },
  accessible: { label: 'Step-free', rate: 20 },
}

function typeFor(row, n) {
  if ((row.id === 'D' && n <= 2) || (row.id === 'A' && n === 33)) return 'accessible'
  if (row.id === 'C' && n <= 4) return 'ev'
  if (row.id === 'B') return 'compact'
  return 'standard'
}

const GAP = 2.6

export const SLOTS = ROWS.flatMap((row) => {
  const pitch = (row.to - row.from) / row.count
  return Array.from({ length: row.count }, (_, i) => {
    const n = i + 1
    let x, y, w, h
    if (row.axis === 'v') {
      y = row.from + i * pitch + GAP / 2
      h = pitch - GAP
      w = row.depth
      x = row.dir < 0 ? row.line - row.depth : row.line
    } else {
      x = row.from + i * pitch + GAP / 2
      w = pitch - GAP
      h = row.depth
      y = row.dir < 0 ? row.line - row.depth : row.line
    }
    return {
      id: `${row.id}-${String(n).padStart(2, '0')}`,
      row: row.id,
      n,
      x,
      y,
      w,
      h,
      cx: x + w / 2,
      cy: y + h / 2,
      axis: row.axis,
      dir: row.dir,
      type: typeFor(row, n),
      widthM: (pitch / PX_PER_M).toFixed(1),
      depthM: (row.depth / PX_PER_M).toFixed(1),
    }
  })
})

export const SLOT_BY_ID = Object.fromEntries(SLOTS.map((s) => [s.id, s]))
export const ROW_BY_ID = Object.fromEntries(ROWS.map((r) => [r.id, r]))

export function rowBox(rowId, pad = 0) {
  const list = SLOTS.filter((s) => s.row === rowId)
  const x0 = Math.min(...list.map((s) => s.x)) - pad
  const y0 = Math.min(...list.map((s) => s.y)) - pad
  const x1 = Math.max(...list.map((s) => s.x + s.w)) + pad
  const y1 = Math.max(...list.map((s) => s.y + s.h)) + pad
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

// Footprints of the things around the bays, also in capture pixels.
export const BUILDINGS = [
  { id: 'wing', name: 'North wing', points: '640,318 700,262 710,262 710,548 690,548 640,498', z: 46 },
  { id: 'main', name: 'Main block', x: 642, y: 598, w: 68, h: 356, z: 58 },
  { id: 'se', name: 'South-east block', x: 674, y: 962, w: 36, h: 126, z: 34 },
  { id: 'south', name: 'South block', x: 190, y: 1144, w: 452, h: 60, z: 40 },
]

export const TREES = [
  [620, 246, 9],
  [624, 276, 8],
  [619, 304, 10],
  [622, 338, 8],
  [618, 370, 9],
  [623, 404, 8],
  [620, 436, 10],
  [622, 470, 8],
  [96, 236, 9],
  [190, 238, 8],
  [312, 236, 10],
  [372, 238, 8],
  [432, 234, 9],
  [500, 238, 10],
  [92, 934, 9],
  [212, 930, 10],
  [306, 926, 9],
]

// Two ways to lay the plan on screen. Portrait is the capture as-is; landscape turns it
// a quarter to the left (north points left) so the whole lot fits a desktop screen.
// T maps a capture point into the chosen orientation.
export const ORIENT = {
  p: {
    id: 'p',
    view: VIEW,
    gt: undefined,
    pt: (x, y) => [x, y],
    north: 0,
  },
  l: {
    id: 'l',
    view: { x: VIEW.y, y: -(VIEW.x + VIEW.w), w: VIEW.h, h: VIEW.w },
    gt: 'rotate(-90)',
    pt: (x, y) => [y, -x],
    north: -90,
  },
}

export function orientRect(o, r) {
  if (o.id === 'p') return r
  return { x: r.y, y: -(r.x + r.w), w: r.h, h: r.w }
}

// Slot geometry as it appears on screen in each orientation.
export const SCREEN = Object.fromEntries(
  Object.values(ORIENT).map((o) => [
    o.id,
    Object.fromEntries(
      SLOTS.map((s) => {
        const r = orientRect(o, s)
        const axis = o.id === 'p' ? s.axis : s.axis === 'v' ? 'h' : 'v'
        return [s.id, { ...r, cx: r.x + r.w / 2, cy: r.y + r.h / 2, axis }]
      }),
    ),
  ]),
)

/* ---------- bay status rules ---------- */

// Time helpers and bay status rules (free / booked / ending soon / reserved / yours).
// Bookings come from the API; the server applies the same rules in backend/server.py.

export const MIN = 60_000
export const HOUR = 60 * MIN
export const DAY = 24 * HOUR
export const ENDING_SOON = 20 * MIN
export const HOLD_AHEAD = 30 * MIN

export function dayStart(t) {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export const ceilTo = (t, step) => Math.ceil(t / step) * step

export function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export const maskPlate = (p) => {
  const parts = p.split(' ')
  return parts.length >= 3 ? `${parts[0]} •• ${parts[parts.length - 1]}` : p
}

// A bay's state right now. `mine` is your booking here, if any: the one you're parked on,
// otherwise your next one. Any upcoming booking of yours makes the bay "Yours" straight away,
// so a booking shows up on the plan and in the list the moment it's made, not 30 minutes before.
export function slotState(list = [], now) {
  let current = null
  let next = null
  let mine = null
  for (const b of list) {
    if (b.end <= now) continue
    if (b.start <= now) current = b
    else if (!next || b.start < next.start) next = b
    if (b.mine && (!mine || b.start < mine.start)) mine = b
  }
  let status
  if (current) status = current.mine ? 'mine' : current.end - now <= ENDING_SOON ? 'ending' : 'taken'
  else if (mine) status = 'mine'
  else if (next && next.start - now <= HOLD_AHEAD) status = 'held'
  else status = 'free'
  const freeUntil = current ? null : next ? next.start : dayStart(now) + DAY
  return { status, current, next, mine, freeUntil }
}

// "14:30" today, "midnight" for 00:00 tomorrow, "tmrw 01:00" after that.
export function fmtWhen(t, now) {
  if (dayStart(t) === dayStart(now)) return fmtTime(t)
  if (t === dayStart(t)) return 'midnight'
  return `tmrw ${fmtTime(t)}`
}

export const STATUS = {
  free: { label: 'Free', short: 'Free' },
  taken: { label: 'Booked', short: 'Booked' },
  ending: { label: 'Ending soon', short: 'Ending' },
  held: { label: 'Reserved', short: 'Reserved' },
  mine: { label: 'Yours', short: 'Yours' },
}

export const overlaps = (list, start, end, ignoreId) =>
  list.find((b) => b.id !== ignoreId && b.start < end && start < b.end) || null

/* ---------- time + money formats ---------- */

const two = (n) => String(n).padStart(2, '0')

export function fmtTime(t) {
  const d = new Date(t)
  return `${two(d.getHours())}:${two(d.getMinutes())}`
}

export function fmtClock(t) {
  const d = new Date(t)
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`
}

export function fmtDur(ms) {
  const m = Math.max(0, Math.round(ms / 60000))
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h === 0) return `${r} min`
  if (r === 0) return `${h} h`
  return `${h} h ${r} m`
}

export function fmtShort(ms) {
  const m = Math.max(0, Math.round(ms / 60000))
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h === 0) return `${r}m`
  return r ? `${h}h ${r}m` : `${h}h`
}

export function fmtCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${two(Math.floor(s / 3600))}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`
}

export const rupees = (n) => `₹${n.toLocaleString('en-IN')}`

export const pad3 = (n) => String(Math.max(0, Math.round(n))).padStart(3, '0')

/* ---------- API + live stream ---------- */

// The Arrivo API. In dev, Vite proxies /api to the backend (see vite.config.js); set
// VITE_API_URL to talk to it somewhere else.
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export const LOT_ID = 'kiet-main'

async function call(path, init = {}) {
  let res
  try {
    res = await fetch(BASE + path, {
      credentials: 'include',
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
    })
  } catch {
    throw new Error('Could not reach Arrivo. Check your connection and try again.')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(body.message || `Request failed (${res.status}).`), { status: res.status, body })
  return body
}

// The API speaks of bays; the app calls them slots.
export const fromApi = ({ bayId, ...b }) => ({ ...b, slotId: bayId })

export const api = {
  snapshot: (from, to) => call(`/api/lots/${LOT_ID}/snapshot?from=${from}&to=${to}`),
  book: (slotId, start, end, plate) =>
    call('/api/bookings', { method: 'POST', body: JSON.stringify({ bayId: slotId, start, end, plate }) }),
  cancel: (id) => call(`/api/bookings/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}

// Live changes for the lot. The browser reconnects on its own after a dropped connection,
// but gives up if the server answers with an error (say, the API isn't up yet), so we
// retry those ourselves. onOpen fires on every (re)connect, which is the cue to resync.
export function openStream({ onOpen, onChange }) {
  let es
  let timer
  let wait = 1000
  let closed = false
  let heard = Date.now()
  const connect = () => {
    heard = Date.now()
    es = new EventSource(`${BASE}/api/lots/${LOT_ID}/stream`, { withCredentials: true })
    es.addEventListener('hello', () => {
      heard = Date.now()
      wait = 1000
      onOpen()
    })
    es.addEventListener('ping', () => {
      heard = Date.now()
    })
    es.addEventListener('change', (e) => {
      heard = Date.now()
      onChange(JSON.parse(e.data))
    })
    es.onerror = () => {
      if (closed || es.readyState !== EventSource.CLOSED) return
      timer = setTimeout(connect, wait)
      wait = Math.min(wait * 2, 15000)
    }
  }
  // The server pings every 15 s. A stream that goes quiet for longer is dead even if the
  // browser still calls it open (a proxy can hang on after the server behind it is gone).
  const watchdog = setInterval(() => {
    if (closed || es.readyState === EventSource.CLOSED || Date.now() - heard < 40_000) return
    es.close()
    connect()
  }, 5000)
  connect()
  return () => {
    closed = true
    clearTimeout(timer)
    clearInterval(watchdog)
    es.close()
  }
}

/* ---------- scrolling ---------- */

// Smooth scroll is owned by the plain page (script.js sets window.goTo). Fall back to the
// browser's own smooth scroll if it isn't there.
export function scrollTo(target, opts = {}) {
  const offset = opts.offset ?? -88
  if (window.goTo) return window.goTo(target, offset)
  const el = typeof target === 'string' ? document.querySelector(target) : target
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + offset, behavior: 'smooth' })
}

/* ---------- live state ---------- */

const LotCtx = createContext(null)
const ClockCtx = createContext(0)

const FEED = 30

const emptyLot = () => Object.fromEntries(SLOTS.map((s) => [s.id, []]))

function group(list) {
  const out = emptyLot()
  for (const b of list) out[b.slotId]?.push(b)
  for (const id in out) out[id].sort((p, q) => p.start - q.start)
  return out
}

// Puts one booking, as it now stands, into the day's lists. Cancelled ones drop out.
function upsert(cur, b, win) {
  const prev = cur[b.slotId]
  if (!prev) return cur
  const rest = prev.filter((x) => x.id !== b.id)
  const keep = b.status !== 'cancelled' && b.end > win.from && b.start < win.to
  if (!keep && rest.length === prev.length) return cur
  return { ...cur, [b.slotId]: keep ? [...rest, b].sort((p, q) => p.start - q.start) : rest }
}

// Server events say what happened; the words are written here, in the viewer's own time.
function feedItem(e) {
  const span = `${fmtTime(e.start)}–${fmtTime(e.end)}`
  let text
  switch (e.kind) {
    case 'book':
      if (e.mine) text = `booked by you · ${span}`
      else if (e.start - e.t <= MIN) text = `booked · ${fmtShort(e.end - e.start)}`
      else text = `reserved · arriving ${fmtTime(e.start)}`
      break
    case 'arrive':
      text = e.mine ? `you're in · till ${fmtTime(e.end)}` : `arrived · till ${fmtTime(e.end)}`
      break
    case 'leave':
      text = e.mine ? 'your stay ended' : 'freed'
      break
    case 'release':
      text = e.mine ? 'you left · freed' : 'freed early'
      break
    case 'cancel':
      text = e.mine ? `you cancelled ${span}` : `cancelled · ${span}`
      break
    default:
      text = e.kind
  }
  return { id: e.id, t: e.t, slotId: e.slotId, kind: e.mine ? 'mine' : e.kind, text }
}

export function LotProvider({ children }) {
  const [now, setNow] = useState(() => Date.now())
  const [tick, setTick] = useState(() => Date.now())
  const [bookings, setBookings] = useState(emptyLot)
  const [events, setEvents] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  // The day the lists cover, and how to reload it.
  const windowRef = useRef(null)
  const syncRef = useRef(() => {})

  useEffect(() => {
    const a = setInterval(() => setNow(Date.now()), 1000)
    const b = setInterval(() => {
      const t = Date.now()
      setTick(t)
      if (windowRef.current && dayStart(t) !== windowRef.current.from) syncRef.current()
    }, 5000)
    return () => {
      clearInterval(a)
      clearInterval(b)
    }
  }, [])

  // The lot lives on the server: load the day once, then follow live changes. Changes that
  // arrive while a load is in flight wait for it and are replayed on top.
  useEffect(() => {
    let alive = true
    let run = 0
    let pending = null
    let retry

    const apply = ({ booking, event }) => {
      const win = windowRef.current
      if (booking && win) setBookings((cur) => upsert(cur, fromApi(booking), win))
      if (event) {
        const item = feedItem(fromApi(event))
        setEvents((list) => (list.some((e) => e.id === item.id) ? list : [item, ...list].slice(0, FEED)))
      }
      setTick(Date.now())
    }

    const sync = async () => {
      const me = ++run
      clearTimeout(retry)
      pending = []
      // Today and tomorrow: a slot booked for after midnight (say, right after a car that
      // leaves at 00:00) must still show up on the plan and in the list.
      const from = dayStart(Date.now())
      try {
        const snap = await api.snapshot(from, from + 2 * DAY)
        if (!alive || me !== run) return
        windowRef.current = { from: snap.from, to: snap.to }
        setBookings(group(snap.bookings.map(fromApi)))
        setEvents(snap.events.map((e) => feedItem(fromApi(e))))
        const queued = pending
        pending = null
        queued.forEach(apply)
        setTick(Date.now())
      } catch (err) {
        if (!alive || me !== run) return
        pending = null
        console.warn('Arrivo: could not load the lot, retrying.', err)
        retry = setTimeout(sync, 3000)
      }
    }

    syncRef.current = sync
    // Load the lot straight away, not only once the live stream connects: behind some
    // proxies and tunnels the stream never opens, and the lot would otherwise look empty.
    sync()
    const close = openStream({
      onOpen: sync,
      onChange: (msg) => (pending ? pending.push(msg) : apply(msg)),
    })
    return () => {
      alive = false
      clearTimeout(retry)
      close()
    }
  }, [])

  const states = useMemo(() => {
    const out = {}
    for (const s of SLOTS) out[s.id] = slotState(bookings[s.id], tick)
    return out
  }, [bookings, tick])

  const counts = useMemo(() => {
    const c = { free: 0, taken: 0, ending: 0, held: 0, mine: 0, total: SLOTS.length }
    for (const s of SLOTS) c[states[s.id].status] += 1
    c.booked = c.taken + c.ending + c.mine // your own bays are booked too
    return c
  }, [states])

  const select = useCallback((id, opts = {}) => {
    setSelectedId(id)
    if (opts.scroll) scrollTo('#lot-map', { offset: -96 })
  }, [])

  // Shows the server's answer right away instead of waiting for it to come round on the stream.
  const settle = useCallback((raw) => {
    const b = fromApi(raw)
    if (windowRef.current) setBookings((cur) => upsert(cur, b, windowRef.current))
    setTick(Date.now())
    return b
  }, [])

  // Resolves to { booking } or { error }. The server has the last word on clashes: if
  // someone else got the window first, it says so and nothing is booked.
  const book = useCallback(
    async (slotId, start, end, plate) => {
      try {
        const { booking } = await api.book(slotId, start, end, plate)
        return { booking: settle(booking) }
      } catch (err) {
        const c = err.body?.conflict
        if (c) return { error: `${slotId} was just booked ${fmtTime(c.start)}–${fmtTime(c.end)}. Pick another window.` }
        return { error: err.message }
      }
    },
    [settle],
  )

  // Not wired to the UI yet. Before the start it cancels; once parked it ends the stay now.
  const cancel = useCallback(
    async (id) => {
      try {
        const { booking } = await api.cancel(id)
        return { booking: settle(booking) }
      } catch (err) {
        return { error: err.message }
      }
    },
    [settle],
  )

  const value = useMemo(
    () => ({ bookings, states, counts, events, selectedId, select, book, cancel, tick }),
    [bookings, states, counts, events, selectedId, select, book, cancel, tick],
  )

  return (
    <LotCtx.Provider value={value}>
      <ClockCtx.Provider value={now}>{children}</ClockCtx.Provider>
    </LotCtx.Provider>
  )
}

export const useLot = () => useContext(LotCtx)
export const useNow = () => useContext(ClockCtx)
