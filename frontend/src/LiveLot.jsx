import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useDragControls } from 'motion/react'
import {
  DAY, HOUR, MIN, ROWS, ROW_BY_ID, SLOTS, SLOT_BY_ID, STATUS, TYPES,
  ceilTo, dayStart, fmtClock, fmtCountdown, fmtDur, fmtShort, fmtTime, hash, maskPlate, overlaps, rupees,
  useLot, useNow,
} from './lot'
import LotMap from './LotMap'
import { DayStrip, EASE, Hand, PillButton, StatusDot, TypeGlyph, useMedia } from './ui'

/* ==================== hero: rows A and C as a seat map ==================== */

const ROW_A = SLOTS.filter((s) => s.row === 'A').slice(0, 16)
const ROW_C = SLOTS.filter((s) => s.row === 'C').slice(0, 16)

function Seat({ s, st, i, onPick, flip }) {
  return (
    <motion.button
      className={`seat is-${st.status}${flip ? ' is-flip' : ''}`}
      onClick={() => onPick(s.id)}
      aria-label={`${s.id}, ${STATUS[st.status].label}`}
      initial={{ opacity: 0, y: flip ? -14 : 14, scale: 0.7 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, ease: EASE, delay: 0.9 + i * 0.022 }}
    >
      <span className="seat-car" />
      <span className="seat-id">{String(s.n).padStart(2, '0')}</span>
    </motion.button>
  )
}

export function HeroSeats() {
  const { states, select, counts } = useLot()
  const pick = (id) => select(id, { scroll: true })
  return (
    <div className="seatmap">
      <div className="sm-head">
        <span className="live-dot" />
        <span className="mono">KIET main lot · rows A and C · live</span>
        <span className="mono sm-count">
          {counts.free}/{counts.total} free
        </span>
      </div>
      <div className="sm-rows">
        <span className="sm-l">A</span>
        <div className="sm-bays">
          {ROW_A.map((s, i) => (
            <Seat key={s.id} s={s} st={states[s.id]} i={i} onPick={pick} flip />
          ))}
        </div>
        <span className="sm-l" />
        <div className="sm-road">
          <motion.span
            className="sm-road-line"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1.4, ease: EASE, delay: 0.8 }}
          />
          <span className="mono-s caps">Service road · all bumpers this way</span>
        </div>
        <span className="sm-l">C</span>
        <div className="sm-bays">
          {ROW_C.map((s, i) => (
            <Seat key={s.id} s={s} st={states[s.id]} i={i + 16} onPick={pick} />
          ))}
        </div>
      </div>
      <Hand
        className="sm-note"
        delay={1.8}
        w={70}
        h={50}
        textFirst={false}
        path={['M66 44C54 40 30 30 10 6', 'M9 17 9.5 6l10.5 2']}
      >
        pale ones are free.
        <br />
        tap one.
      </Hand>
    </div>
  )
}

/* ==================== the bay panel ==================== */

const FEE = 5
const DURS = [1, 2, 3, 4, 6, 8]
const GATE = { x: 562, y: 1112 }
const BY_GATE = [...SLOTS].sort(
  (a, b) => Math.hypot(a.cx - GATE.x, a.cy - GATE.y) - Math.hypot(b.cx - GATE.x, b.cy - GATE.y),
)

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
}
const item = {
  hidden: { opacity: 0, y: 14, filter: 'blur(6px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.7, ease: EASE } },
}

function Barcode({ code }) {
  let h = hash(code)
  const bars = []
  let x = 0
  for (let i = 0; i < 46; i++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
    const w = 1 + (h % 3)
    if (i % 2 === 0) bars.push(<rect key={i} x={x} y="0" width={w} height="34" fill="var(--ink)" />)
    x += w + 0.6
  }
  return (
    <svg viewBox={`0 0 ${x} 34`} preserveAspectRatio="none" className="barcode" aria-hidden="true">
      {bars}
    </svg>
  )
}

function Ticket({ b, s }) {
  const row = ROW_BY_ID[s.row]
  const hours = (b.end - b.start) / HOUR
  const paid = Math.round(hours * TYPES[s.type].rate) + FEE
  return (
    <motion.div
      className="ticket"
      initial={{ opacity: 0, rotateX: -70, y: 30 }}
      animate={{ opacity: 1, rotateX: 0, y: 0 }}
      transition={{ duration: 1, ease: EASE }}
    >
      <div className="tk-top">
        <div className="tk-head">
          <span className="mono-s caps">Arrivo · bay pass</span>
          <span className="mono-s caps">KIET main lot</span>
        </div>
        <div className="tk-bay">{s.id}</div>
        <div className="tk-grid">
          <div>
            <span className="mono-s">Arrive</span>
            <b>{fmtTime(b.start)}</b>
          </div>
          <div>
            <span className="mono-s">Leave</span>
            <b>{fmtTime(b.end)}</b>
          </div>
          <div>
            <span className="mono-s">Vehicle</span>
            <b>{b.plate}</b>
          </div>
          <div>
            <span className="mono-s">Row</span>
            <b>
              {row.id} · {row.name}
            </b>
          </div>
          <div>
            <span className="mono-s">Date</span>
            <b>{new Date(b.start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</b>
          </div>
          <div>
            <span className="mono-s">Paid</span>
            <b>{rupees(paid)}</b>
          </div>
        </div>
      </div>
      <div className="tk-perf" />
      <div className="tk-bot">
        <Barcode code={b.code || b.id} />
        <span className="mono-s">{b.code}</span>
      </div>
    </motion.div>
  )
}

function StatusBlock({ st, now }) {
  const end = dayStart(now) + DAY
  if (st.status === 'free') {
    const allDay = st.freeUntil >= end
    return (
      <motion.div variants={item} className="sb">
        <div className="sb-big">Free now</div>
        <p className="body">
          {allDay ? 'Nothing booked here for the rest of the day.' : `Stays free till ${fmtTime(st.freeUntil)}, that is ${fmtDur(st.freeUntil - now)} from now.`}
        </p>
      </motion.div>
    )
  }
  if (st.status === 'held') {
    return (
      <motion.div variants={item} className="sb">
        <div className="sb-big">Reserved for {fmtTime(st.next.start)}</div>
        <p className="body">
          {maskPlate(st.next.plate)} is on the way. The bay is held until {fmtTime(st.next.start + 15 * MIN)}, then it opens up
          again if nobody shows.
        </p>
      </motion.div>
    )
  }
  const b = st.current || st.next
  const total = b.end - b.start
  const elapsed = Math.min(Math.max(now - b.start, 0), total)
  return (
    <motion.div variants={item} className="sb">
      <div className="sb-row">
        <div className="sb-big">
          {st.status === 'mine' ? 'Yours' : 'Booked'} till {fmtTime(b.end)}
        </div>
        {st.current && <div className="sb-count mono">{fmtCountdown(b.end - now)} left</div>}
      </div>
      {st.current && (
        <div className="meter">
          <span className="meter-fill" style={{ width: `${(elapsed / total) * 100}%` }} />
          {Array.from({ length: 9 }, (_, i) => (
            <i key={i} style={{ left: `${(i + 1) * 10}%` }} />
          ))}
        </div>
      )}
      <p className="body">
        {st.status === 'mine'
          ? `${b.plate} · code ${b.code}`
          : `${maskPlate(b.plate)} · via ${b.via} · since ${fmtTime(b.start)}`}
        {st.status === 'ending' && ' · frees up soon, book the slot right after'}
      </p>
    </motion.div>
  )
}

function SlotDetail({ id, onClose }) {
  const { bookings, states, book, tick } = useLot()
  const now = useNow()
  const s = SLOT_BY_ID[id]
  const row = ROW_BY_ID[s.row]
  const type = TYPES[s.type]
  const st = states[id]
  const list = bookings[id] || []

  const base = st.current ? ceilTo(st.current.end, 5 * MIN) : ceilTo(tick, 5 * MIN)
  const starts = useMemo(() => [0, 30, 60, 120].map((m) => base + m * MIN), [base])
  const startOk = starts.map((t) => !overlaps(list, t, t + HOUR))

  const [si, setSi] = useState(() => Math.max(0, startOk.indexOf(true)))
  const start = starts[si]
  const durOk = DURS.map((h) => !overlaps(list, start, start + h * HOUR))
  const [dh, setDh] = useState(() => (durOk[1] ? 2 : 1))
  const end = start + dh * HOUR
  const clash = overlaps(list, start, end)
  const [plate, setPlate] = useState('')
  const [err, setErr] = useState('')
  const [phase, setPhase] = useState('form')
  const [made, setMade] = useState(null)

  const mineNow = list.find((b) => b.mine && b.end > now)
  const cost = dh * type.rate

  const submit = (e) => {
    e.preventDefault()
    const p = plate.trim().toUpperCase()
    if (p.replace(/\s/g, '').length < 6) return setErr('Add your vehicle number, e.g. UP14 AB 1234.')
    if (clash) return setErr(`That window clashes with a booking at ${fmtTime(clash.start)}.`)
    setErr('')
    setPhase('holding')
    setTimeout(async () => {
      const r = await book(id, start, end, p)
      if (r.error) {
        setErr(r.error)
        setPhase('form')
      } else {
        setMade(r.booking)
        setPhase('done')
      }
    }, 1100)
  }

  const label = (t, i) => (i === 0 && !st.current ? 'Now' : fmtTime(t))

  return (
    <motion.div className="detail" variants={stagger} initial="hidden" animate="show">
      <motion.div variants={item} className="dt-head">
        <div>
          <span className="mono">
            Row {row.id} · {row.name}
          </span>
          <div className="dt-id">{s.id}</div>
        </div>
        <div className="dt-head-r">
          <span className={`pill-status is-${st.status}`}>
            <StatusDot status={st.status} />
            {STATUS[st.status].label}
          </span>
          <button className="x-btn" onClick={onClose} aria-label="Close bay details">
            <svg viewBox="0 0 16 16" width="14" height="14">
              <path d="M3 3l10 10M13 3 3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </motion.div>

      <motion.div variants={item} className="specs">
        <div>
          <span className="mono-s">Size</span>
          <b>
            {s.widthM} × {s.depthM} m
          </b>
        </div>
        <div>
          <span className="mono-s">Type</span>
          <b className="with-ico">
            <TypeGlyph type={s.type} size={13} />
            {type.label}
          </b>
        </div>
        <div>
          <span className="mono-s">Rate</span>
          <b>₹{type.rate} / hr</b>
        </div>
      </motion.div>

      {phase === 'done' && made ? (
        <motion.div variants={item} className="done">
          <div className="done-head">
            <span className="h3">Held for you.</span>
            <span className="hand">show this at the gate</span>
          </div>
          <Ticket b={made} s={s} />
          <PillButton variant="line" size="sm" dir="e" onClick={onClose}>
            Done
          </PillButton>
        </motion.div>
      ) : (
        <>
          <StatusBlock st={st} now={now} />

          <motion.div variants={item} className="today">
            <div className="today-head">
              <span className="mono">Today</span>
              <span className="mono-s dim">yellow is the window you are picking</span>
            </div>
            <DayStrip list={list} now={now} preview={phase === 'form' && !mineNow ? { start, end, clash: !!clash } : null} />
          </motion.div>

          {mineNow && st.status === 'mine' ? (
            <motion.div variants={item} className="done">
              <Ticket b={mineNow} s={s} />
            </motion.div>
          ) : (
            <motion.form variants={item} className="bk" onSubmit={submit}>
              <fieldset>
                <legend>
                  <span className="num">01</span> Arrive
                </legend>
                <div className="chips">
                  {starts.map((t, i) => (
                    <button
                      type="button"
                      key={t}
                      className={`chip chip-s${si === i ? ' is-on' : ''}${!startOk[i] ? ' is-off' : ''}`}
                      onClick={() => {
                        setSi(i)
                        const ok = DURS.map((h) => !overlaps(list, t, t + h * HOUR))
                        if (!ok[DURS.indexOf(dh)]) setDh(DURS[Math.max(0, ok.lastIndexOf(true, DURS.indexOf(dh)))])
                      }}
                    >
                      {label(t, i)}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>
                  <span className="num">02</span> Stay
                </legend>
                <div className="chips">
                  {DURS.map((h, i) => (
                    <button
                      type="button"
                      key={h}
                      className={`chip chip-s${dh === h ? ' is-on' : ''}${!durOk[i] ? ' is-off' : ''}`}
                      onClick={() => setDh(h)}
                    >
                      {h} h
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>
                  <span className="num">03</span> Vehicle
                </legend>
                <input
                  className="field"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  placeholder="UP14 AB 1234"
                  autoComplete="off"
                  spellCheck="false"
                  maxLength={14}
                />
              </fieldset>

              <div className="sum">
                <div>
                  <span className="mono">
                    {fmtTime(start)} → {fmtTime(end)} · {dh} h × ₹{type.rate}
                  </span>
                  <span className="mono">{rupees(cost)}</span>
                </div>
                <div>
                  <span className="mono">Booking fee</span>
                  <span className="mono">{rupees(FEE)}</span>
                </div>
                <div className="sum-total">
                  <span>Total</span>
                  <span>{rupees(cost + FEE)}</span>
                </div>
              </div>

              <AnimatePresence>
                {(err || clash) && (
                  <motion.p
                    className="err mono-s"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    {err || `Clashes with a booking at ${fmtTime(clash.start)}. Try a shorter stay.`}
                  </motion.p>
                )}
              </AnimatePresence>

              <div className="bk-go">
                <PillButton type="submit" disabled={!!clash || phase === 'holding'}>
                  {phase === 'holding' ? `Holding ${s.id}…` : `Hold ${s.id} · ${rupees(cost + FEE)}`}
                </PillButton>
                {phase === 'holding' && <span className="holding-bar" />}
              </div>
            </motion.form>
          )}
        </>
      )}
    </motion.div>
  )
}

function LiveFeed() {
  const { events, select } = useLot()
  return (
    <div className="feed">
      <div className="feed-head">
        <span className="live-dot" />
        <span className="mono">Live feed</span>
      </div>
      <ul>
        <AnimatePresence initial={false}>
          {events.slice(0, 6).map((e) => (
            <motion.li
              key={e.id}
              layout
              initial={{ opacity: 0, y: -12, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              <span className="mono-s dim">{fmtClock(e.t)}</span>
              <button className="feed-id" onClick={() => select(e.slotId)}>
                {e.slotId}
              </button>
              <span className={`feed-txt${e.kind === 'mine' ? ' is-mine' : ''}`}>{e.text}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  )
}

function PanelIdle() {
  const { states, select } = useLot()
  const free = BY_GATE.filter((s) => states[s.id].status === 'free').slice(0, 6)
  return (
    <motion.div className="idle" variants={stagger} initial="hidden" animate="show">
      <motion.span variants={item} className="mono">
        No bay picked yet
      </motion.span>
      <motion.h3 variants={item} className="h3">
        Tap a bay on the plan, or pick up the lens and look around.
      </motion.h3>
      <motion.p variants={item} className="body">
        Pale bays are free. Grey ones have a car in them. A yellow ring means that car is due out within 20 minutes;
        hatched bays are reserved for someone on the way.
      </motion.p>
      <motion.div variants={item} className="quick">
        <span className="mono-s caps">Free now, closest to the campus road</span>
        <div className="chips">
          {free.map((s) => (
            <button key={s.id} className="chip chip-s" onClick={() => select(s.id)}>
              <TypeGlyph type={s.type} size={12} /> {s.id}
            </button>
          ))}
        </div>
      </motion.div>
      <motion.div variants={item}>
        <LiveFeed />
      </motion.div>
    </motion.div>
  )
}

function SlotPanel() {
  const { selectedId, select } = useLot()
  const sheet = useMedia('(max-width: 980px)')
  const controls = useDragControls()
  const close = () => select(null)

  useEffect(() => {
    if (!selectedId) return
    const onKey = (e) => e.key === 'Escape' && select(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, select])

  if (sheet) {
    return (
      <>
        <aside className="panel">
          <PanelIdle />
        </aside>
        <AnimatePresence>
          {selectedId && (
            <>
              <motion.div
                key="scrim"
                className="scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={close}
              />
              <motion.div
                key="sheet"
                className="sheet"
                data-lenis-prevent
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ duration: 0.7, ease: EASE }}
                drag="y"
                dragListener={false}
                dragControls={controls}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.6 }}
                onDragEnd={(_, i) => i.offset.y > 120 && close()}
              >
                <span className="sheet-grip" onPointerDown={(e) => controls.start(e)} />
                <SlotDetail key={selectedId} id={selectedId} onClose={close} />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </>
    )
  }

  return (
    <aside className="panel" data-lenis-prevent>
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedId || 'idle'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: -8, filter: 'blur(4px)', transition: { duration: 0.25 } }}
        >
          {selectedId ? <SlotDetail id={selectedId} onClose={close} /> : <PanelIdle />}
        </motion.div>
      </AnimatePresence>
    </aside>
  )
}

/* ==================== every bay in one list ==================== */

const FILTERS = [
  ['all', 'All'],
  ['free', 'Free'],
  ['booked', 'Booked'],
  ['ending', 'Ending soon'],
  ['held', 'Reserved'],
  ['mine', 'Yours'],
]

const SORTS = [
  ['bay', 'By bay'],
  ['longest', 'Free longest'],
  ['soonest', 'Frees soonest'],
]

const match = (f, status) =>
  f === 'all' || (f === 'booked' ? status === 'taken' || status === 'ending' : status === f)

function bookingCell(st, tick) {
  const end = dayStart(tick) + DAY
  if (st.status === 'free') {
    const allDay = st.freeUntil >= end
    return {
      main: allDay ? 'Free all day' : `Free till ${fmtTime(st.freeUntil)}`,
      sub: allDay ? 'nothing booked later' : `${fmtShort(st.freeUntil - tick)} open`,
      frac: null,
    }
  }
  if (st.status === 'held')
    return { main: `Due ${fmtTime(st.next.start)}`, sub: `${maskPlate(st.next.plate)} on the way`, frac: null }
  const b = st.current || st.next
  const frac = st.current ? Math.min(1, Math.max(0, (tick - b.start) / (b.end - b.start))) : 0
  return {
    main: `${st.status === 'mine' ? 'Yours' : 'Booked'} till ${fmtTime(b.end)}`,
    sub: st.current ? `${fmtShort(b.end - tick)} left · since ${fmtTime(b.start)}` : `starts ${fmtTime(b.start)}`,
    frac,
  }
}

const Row = memo(function Row({ s, st, list, tick, selected, onPick, i }) {
  const type = TYPES[s.type]
  const cell = bookingCell(st, tick)
  const prev = useRef(st.status)
  const [flash, setFlash] = useState(false)
  useEffect(() => {
    if (prev.current !== st.status) {
      prev.current = st.status
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 1400)
      return () => clearTimeout(t)
    }
  }, [st.status])
  const canBook = st.status !== 'mine'
  return (
    <div
      role="button"
      tabIndex={0}
      className={`lr is-${st.status}${selected ? ' is-sel' : ''}${flash ? ' is-flash' : ''}`}
      style={{ '--i': Math.min(i, 24) }}
      onClick={() => onPick(s.id)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onPick(s.id))}
    >
      <span className="lr-bay">{s.id}</span>
      <span className="lr-type">
        <TypeGlyph type={s.type} size={13} />
        {type.label}
      </span>
      <span className="lr-status">
        <StatusDot status={st.status} />
        {STATUS[st.status].label}
      </span>
      <span className="lr-book">
        <span className="lr-main">{cell.main}</span>
        {cell.frac !== null ? (
          <span className="lr-bar">
            <i style={{ width: `${cell.frac * 100}%` }} />
          </span>
        ) : null}
        <span className="lr-sub mono-s">{cell.sub}</span>
      </span>
      <span className="lr-day">
        <DayStrip list={list} now={tick} compact />
      </span>
      <span className="lr-rate mono">₹{type.rate}/h</span>
      <span className="lr-go">
        <span className={`lr-btn${canBook ? '' : ' is-ghost'}`}>{canBook ? (st.status === 'free' ? 'Book' : 'Book later') : 'View'}</span>
      </span>
    </div>
  )
})

function SlotList() {
  const { states, bookings, select, counts, selectedId, tick } = useLot()
  const [filter, setFilter] = useState('all')
  const [rowF, setRowF] = useState('all')
  const [sort, setSort] = useState('bay')
  const [q, setQ] = useState('')

  const shown = useMemo(() => {
    const term = q.trim().toUpperCase().replace(/\s/g, '')
    let out = SLOTS.filter(
      (s) =>
        match(filter, states[s.id].status) &&
        (rowF === 'all' || s.row === rowF) &&
        (!term || s.id.replace('-', '').includes(term.replace('-', ''))),
    )
    if (sort === 'longest')
      out = [...out].sort((a, b) => (states[b.id].freeUntil ?? 0) - (states[a.id].freeUntil ?? 0))
    if (sort === 'soonest') {
      const key = (s) => {
        const st = states[s.id]
        if (st.status === 'free') return -1
        return st.current ? st.current.end : st.next ? st.next.end : Infinity
      }
      out = [...out].sort((a, b) => key(a) - key(b))
    }
    return out
  }, [states, filter, rowF, sort, q])

  const groups = useMemo(() => {
    if (sort !== 'bay') return [{ row: null, items: shown }]
    return ROWS.map((r) => ({ row: r, items: shown.filter((s) => s.row === r.id) })).filter((g) => g.items.length)
  }, [shown, sort])

  const rowStats = useMemo(() => {
    const o = {}
    for (const r of ROWS) {
      const items = SLOTS.filter((s) => s.row === r.id)
      o[r.id] = { total: items.length, free: items.filter((s) => states[s.id].status === 'free').length }
    }
    return o
  }, [states])

  const countFor = (f) =>
    f === 'all' ? counts.total : f === 'booked' ? counts.booked : counts[f]

  const pick = (id) => select(id, { scroll: true })

  let i = 0
  return (
    <div className="list" id="all-bays">
      <div className="list-head">
        <div>
          <span className="mono">Every bay, one list</span>
          <h3 className="list-title">All {counts.total} bays</h3>
        </div>
        <label className="search">
          <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
            <circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="m10.5 10.5 3.2 3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a bay, e.g. C-12" aria-label="Find a bay" />
        </label>
      </div>

      <div className="list-ctrl">
        <div className="chips">
          {FILTERS.filter(([f]) => f !== 'mine' || counts.mine > 0).map(([f, l]) => (
            <button key={f} className={`chip chip-s${filter === f ? ' is-on' : ''}`} onClick={() => setFilter(f)}>
              {f !== 'all' && <StatusDot status={f === 'booked' ? 'taken' : f} />}
              {l} <span className="count">{String(countFor(f)).padStart(2, '0')}</span>
            </button>
          ))}
        </div>
        <div className="chips">
          <button className={`chip chip-s${rowF === 'all' ? ' is-on' : ''}`} onClick={() => setRowF('all')}>
            All rows
          </button>
          {ROWS.map((r) => (
            <button key={r.id} className={`chip chip-s${rowF === r.id ? ' is-on' : ''}`} onClick={() => setRowF(r.id)}>
              {r.id} <span className="count">{rowStats[r.id].free} free</span>
            </button>
          ))}
          <span className="ctrl-sep" />
          {SORTS.map(([k, l]) => (
            <button key={k} className={`chip chip-s${sort === k ? ' is-on' : ''}`} onClick={() => setSort(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="list-table">
        <div className="lt-head mono-s" aria-hidden="true">
          <span>Bay</span>
          <span>Type</span>
          <span>Status</span>
          <span>Booking</span>
          <span>Today 06–22</span>
          <span>Rate</span>
          <span />
        </div>
        <div className="lt-body" data-lenis-prevent key={`${filter}-${rowF}-${sort}`}>
          {groups.map((g) => (
            <div key={g.row ? g.row.id : 'all'} className="lt-group">
              {g.row && (
                <div className="lt-ghead">
                  <span className="lt-letter">{g.row.id}</span>
                  <b>{g.row.name}</b>
                  <span className="mono-s">
                    {rowStats[g.row.id].total} bays · {rowStats[g.row.id].free} free
                  </span>
                  <span className="mono-s dim lt-blurb">{g.row.blurb}</span>
                </div>
              )}
              {g.items.map((s) => (
                <Row
                  key={s.id}
                  s={s}
                  st={states[s.id]}
                  list={bookings[s.id]}
                  tick={tick}
                  selected={s.id === selectedId}
                  onPick={pick}
                  i={i++}
                />
              ))}
            </div>
          ))}
          {!shown.length && (
            <div className="lt-empty">
              <span className="hand">nothing here right now.</span>
              <span className="body">Try another filter, or wait a minute. Cars come and go.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ==================== the live lot section ==================== */

function Clock() {
  const now = useNow()
  return <span className="mono">Live · {fmtClock(now)}</span>
}

const LEGEND = [
  ['free', 'Free'],
  ['taken', 'Booked'],
  ['ending', 'Ending ≤ 20 min'],
  ['held', 'Reserved, driver on the way'],
  ['mine', 'Yours / selected'],
]

export default function LiveLot() {
  const [mode, setMode] = useState('plan')
  const [focus, setFocus] = useState(null)

  return (
    <>
      <div className="live-grid">
        <motion.div
          className="map-card"
          id="lot-map"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '0px 0px -10% 0px' }}
          transition={{ duration: 1.1, ease: EASE }}
        >
          <div className="map-bar">
            <div className="seg" role="tablist" aria-label="View">
              {[
                ['plan', 'Plan'],
                ['tilt', '3D'],
              ].map(([k, l]) => (
                <button key={k} role="tab" aria-selected={mode === k} className={mode === k ? 'is-on' : ''} onClick={() => setMode(k)}>
                  {mode === k && <motion.span layoutId="seg-pill" className="seg-pill" transition={{ duration: 0.5, ease: EASE }} />}
                  <span>{l}</span>
                </button>
              ))}
            </div>
            <div className="seg seg-rows" role="tablist" aria-label="Zoom to row">
              {[[null, 'All'], ...ROWS.map((r) => [r.id, r.id])].map(([k, l]) => (
                <button key={l} role="tab" aria-selected={focus === k} className={focus === k ? 'is-on' : ''} onClick={() => setFocus(k)}>
                  {focus === k && <motion.span layoutId="row-pill" className="seg-pill" transition={{ duration: 0.5, ease: EASE }} />}
                  <span>{l}</span>
                </button>
              ))}
            </div>
            <div className="map-live">
              <span className="live-dot" />
              <Clock />
            </div>
          </div>

          <LotMap mode={mode} focusRow={focus} />

          <div className="legend">
            {LEGEND.map(([k, l]) => (
              <span key={k}>
                <i className={`lg lg-${k}`} />
                {l}
              </span>
            ))}
            <span>
              <i className="lg lg-ev">
                <svg viewBox="0 0 14 14" width="10" height="10">
                  <path d="M8 1.5 3.5 8h3L6 12.5 10.5 6h-3L8 1.5Z" fill="currentColor" />
                </svg>
              </i>
              EV · step-free marked
            </span>
          </div>
        </motion.div>

        <SlotPanel />
      </div>
      <SlotList />
    </>
  )
}
