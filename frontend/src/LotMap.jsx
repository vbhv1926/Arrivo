import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  BUILDINGS, DAY, IMG, ORIENT, ROWS, SCREEN, SLOTS, SLOT_BY_ID, STATUS, TREES, TYPES, VIEW,
  dayStart, fmtShort, fmtTime, orientRect, rowBox, useLot,
} from './lot'
import { EASE, Ticker, useMedia } from './ui'
/* ------------------------------------------------------------------ */
/*  Plan drawing                                                       */
/*  Shapes are drawn in capture pixels inside one group that the       */
/*  orientation rotates; text sits outside it so it always reads       */
/*  upright.                                                           */
/* ------------------------------------------------------------------ */

const GATE = { x: 562, y: 1112 }
const DELAY = Object.fromEntries(
  SLOTS.map((s) => [s.id, +((Math.hypot(s.cx - GATE.x, s.cy - GATE.y) / 820) * 1.1).toFixed(3)]),
)

const TONES = [
  ['#1c1c1f', '#55585f', false],
  ['#f9f9f6', '#2a2c31', true],
  ['#bebdb7', '#34363c', false],
  ['#3b3e45', '#6a6e77', false],
  ['#e9e7e0', '#2a2c31', true],
  ['#7b3030', '#3a2a2a', false],
]
const toneFor = (n) => TONES[n < 30 ? 0 : n < 58 ? 1 : n < 74 ? 2 : n < 86 ? 3 : n < 96 ? 4 : 5]

function Car({ s, tone }) {
  const [body, glass, light] = toneFor(tone)
  const horiz = s.axis === 'v'
  const L = (horiz ? s.w : s.h) - 7.5
  const W = (horiz ? s.h : s.w) - 5.2
  const rot = s.axis === 'h' ? -90 : s.dir < 0 ? 180 : 0
  const off = s.axis === 'h' ? { x: 0, y: 36 } : { x: s.dir < 0 ? 36 : -36, y: 0 }
  return (
    <motion.g
      className="car"
      initial={{ ...off, opacity: 0 }}
      animate={{ x: 0, y: 0, opacity: 1 }}
      exit={{ ...off, opacity: 0 }}
      transition={{ duration: 1, ease: EASE }}
    >
      <g transform={`translate(${s.cx} ${s.cy}) rotate(${rot})`}>
        <rect
          x={-L / 2}
          y={-W / 2}
          width={L}
          height={W}
          rx={W * 0.36}
          fill={body}
          stroke={light ? 'rgba(var(--ink-rgb),.38)' : 'none'}
          strokeWidth=".5"
        />
        <rect x={L / 2 - L * 0.37} y={-W / 2 + 1.2} width={L * 0.15} height={W - 2.4} rx="1.4" fill={glass} />
        <rect x={-L / 2 + L * 0.1} y={-W / 2 + 1.5} width={L * 0.1} height={W - 3} rx="1" fill={glass} opacity=".8" />
      </g>
    </motion.g>
  )
}

function TypeMark({ s, upright }) {
  const size = 7.5
  const t = `translate(${s.cx} ${s.cy}) rotate(${upright}) translate(${-size / 2} ${-size / 2}) scale(${size / 14})`
  if (s.type === 'ev') return <path className="type-mark" transform={t} d="M8 1.5 3.5 8h3L6 12.5 10.5 6h-3L8 1.5Z" />
  if (s.type === 'accessible')
    return (
      <g className="type-mark-line" transform={t}>
        <circle cx="7" cy="2.6" r="1.4" />
        <path d="M6.2 5v3.2h3.3l1.4 3M6.2 6.6H9M4.6 7.1a3 3 0 1 0 4 3.6" />
      </g>
    )
  return null
}

function Bay({ s, st, selected, xray, uid, upright }) {
  const status = st.status
  const carBooking = status === 'taken' || status === 'ending' || (status === 'mine' && st.current) ? st.current : null
  return (
    <g className={`bay is-${status}${selected ? ' is-sel' : ''}`} data-id={s.id} data-status={status} style={{ '--d': `${DELAY[s.id]}s` }}>
      <rect className="bay-box" x={s.x} y={s.y} width={s.w} height={s.h} rx="2.4" />
      {status === 'held' && <rect x={s.x} y={s.y} width={s.w} height={s.h} rx="2.4" fill={`url(#${uid}-hatch)`} className="bay-hatch" />}
      {!xray && (
        <AnimatePresence initial={false}>
          {carBooking && <Car key={carBooking.id} s={s} tone={carBooking.tone} />}
        </AnimatePresence>
      )}
      {status === 'ending' && !xray && (
        <rect className="bay-ring" x={s.x - 1.3} y={s.y - 1.3} width={s.w + 2.6} height={s.h + 2.6} rx="3.4" />
      )}
      {!xray && !carBooking && <TypeMark s={s} upright={upright} />}
    </g>
  )
}

function xrayText(st, now, narrow) {
  const end = dayStart(now) + DAY
  switch (st.status) {
    case 'free':
      return ['FREE', st.freeUntil >= end ? 'all day' : narrow ? fmtTime(st.freeUntil) : `till ${fmtTime(st.freeUntil)}`]
    case 'taken':
      return ['BOOKED', narrow ? fmtTime(st.current.end) : `till ${fmtTime(st.current.end)}`]
    case 'ending':
      return ['ENDING', `in ${fmtShort(st.current.end - now)}`]
    case 'held':
      return ['RSVD', narrow ? fmtTime(st.next.start) : `at ${fmtTime(st.next.start)}`]
    default:
      return ['YOURS', st.current ? (narrow ? fmtTime(st.current.end) : `till ${fmtTime(st.current.end)}`) : fmtTime(st.next.start)]
  }
}

function XrayLabel({ g, st, now, id }) {
  const narrow = g.axis === 'h'
  const [word, detail] = xrayText(st, now, narrow)
  if (narrow) {
    const top = g.cy - 10
    return (
      <g className={`xl is-${st.status}`}>
        <text x={g.cx} y={top} textAnchor="middle" className="xl-id" fontSize="4.6">
          {id}
        </text>
        <text x={g.cx} y={top + 9} textAnchor="middle" className="xl-word" fontSize="3.9">
          {word}
        </text>
        <text x={g.cx} y={top + 16} textAnchor="middle" className="xl-detail" fontSize="3.6">
          {detail}
        </text>
      </g>
    )
  }
  return (
    <g className={`xl is-${st.status}`}>
      <text x={g.x + 2.6} y={g.cy - 1} className="xl-id" fontSize="5.2">
        {id}
      </text>
      <text x={g.x + g.w - 2.4} y={g.cy - 1} textAnchor="end" className="xl-word" fontSize="4.1">
        {word}
      </text>
      <text x={g.x + 2.6} y={g.cy + 5.4} className="xl-detail" fontSize="4">
        {detail}
      </text>
    </g>
  )
}

const ROAD = [
  [548, 226],
  [577, 226],
  [577, 1094],
  [710, 1094],
  [710, 1138],
  [30, 1138],
  [30, 1094],
  [548, 1094],
]

const ContextShapes = memo(function ContextShapes({ uid }) {
  return (
    <g className="ctx">
      <rect x="36" y="988" width="540" height="106" className="ctx-apron" />
      <polygon points={ROAD.map((p) => p.join(',')).join(' ')} className="ctx-road" />
      <line x1="562.5" y1="236" x2="562.5" y2="1084" className="ctx-dash" />
      <line x1="210" y1="1116" x2="706" y2="1116" className="ctx-dash" />

      <rect x="36" y="232" width="466" height="652" rx="10" className="ground" />
      <rect x="36" y="232" width="466" height="652" rx="10" fill={`url(#${uid}-mow)`} />
      <g className="pitch">
        <rect x="66" y="262" width="406" height="592" />
        <line x1="66" y1="558" x2="472" y2="558" />
        <circle cx="269" cy="558" r="48" />
        <rect x="169" y="262" width="200" height="78" />
        <rect x="219" y="262" width="100" height="28" />
        <rect x="169" y="776" width="200" height="78" />
        <rect x="219" y="826" width="100" height="28" />
        <path d="M237 340a36 36 0 0 0 64 0M237 776a36 36 0 0 1 64 0" />
      </g>
      <circle cx="269" cy="558" r="1.8" className="pitch-dot" />

      <rect x="36" y="898" width="500" height="84" rx="4" className="bikes" />
      <rect x="36" y="898" width="500" height="84" rx="4" fill={`url(#${uid}-hatch-b)`} />

      {BUILDINGS.map((b) =>
        b.points ? (
          <g key={b.id}>
            <polygon points={b.points} className="bld" />
            <polygon points={b.points} fill={`url(#${uid}-hatch-b)`} />
          </g>
        ) : (
          <g key={b.id}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} className="bld" />
            <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={`url(#${uid}-hatch-b)`} />
          </g>
        ),
      )}

      {TREES.map(([x, y, r], i) => (
        <g key={i} className="tree">
          <circle cx={x} cy={y} r={r} />
          <circle cx={x} cy={y} r={r * 0.35} />
        </g>
      ))}
    </g>
  )
})

// [text, portrait anchor, portrait rotation, landscape anchor (screen), landscape rotation, class, textAnchor]
const LABELS = [
  ['SERVICE ROAD', [565, 700], 90, [700, -560], 0, 'ctx-road-label', 'middle'],
  ['CAMPUS ROAD', [44, 1119], 0, [1118, -44], -90, 'ctx-road-label', 'start'],
  ['KIET FOOTBALL GROUND', [269, 636], 0, [558, -196], 0, 'ground-label', 'middle'],
  ['TWO-WHEELER STAND · NOT BOOKABLE', [286, 943], 0, [942, -286], -90, 'ctx-label', 'middle'],
  ['MAIN BLOCK', [679, 776], 90, [776, -674], 0, 'ctx-label', 'middle'],
]

function ContextLabels({ o }) {
  return (
    <g className="ctx ctx-labels">
      {LABELS.map(([t, pa, pr, la, lr, cls, anchor]) => {
        const [x, y] = o.id === 'p' ? pa : la
        const r = o.id === 'p' ? pr : lr
        return (
          <text key={t} transform={`translate(${x} ${y}) rotate(${r})`} className={cls} textAnchor={anchor}>
            {t}
          </text>
        )
      })}
    </g>
  )
}

function RowBadges({ o }) {
  return (
    <g className="row-badges">
      {ROWS.map((r) => {
        let px, py
        if (r.axis === 'v') {
          px = r.line + (r.dir * r.depth) / 2
          py = r.from - 13
        } else {
          px = r.from - 15
          py = r.line - r.depth / 2
        }
        const [x, y] = o.pt(px, py)
        const showName = o.id === 'p'
        const anchor = r.axis === 'v' ? (r.dir < 0 ? 'end' : 'start') : 'middle'
        const tx = r.axis === 'v' ? x + (r.dir < 0 ? -12 : 12) : x
        const ty = r.axis === 'v' ? y + 2.2 : y - 13
        return (
          <g key={r.id}>
            <circle cx={x} cy={y} r="8" className="rb-c" />
            <text x={x} y={y + 3} textAnchor="middle" className="rb-l">
              {r.id}
            </text>
            {showName && (
              <text x={tx} y={ty} textAnchor={anchor} className="rb-n">
                {r.name.toUpperCase()}
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}

function SelectionShapes({ s, k }) {
  const lines = [
    [s.x - 3, s.cy, VIEW.x, s.cy],
    [s.x + s.w + 3, s.cy, VIEW.x + VIEW.w, s.cy],
    [s.cx, s.y - 3, s.cx, VIEW.y],
    [s.cx, s.y + s.h + 3, s.cx, VIEW.y + VIEW.h],
  ]
  const hs = 3.8 / k
  const corners = [
    [s.x - 1.8, s.y - 1.8],
    [s.x + s.w + 1.8, s.y - 1.8],
    [s.x - 1.8, s.y + s.h + 1.8],
    [s.x + s.w + 1.8, s.y + s.h + 1.8],
  ]
  return (
    <g className="sel" pointerEvents="none">
      {lines.map((l, i) => (
        <motion.line
          key={i}
          x1={l[0]}
          y1={l[1]}
          x2={l[2]}
          y2={l[3]}
          stroke="var(--sun-line)"
          strokeWidth={0.8 / k}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.85 }}
          transition={{ duration: 1.2, ease: EASE }}
        />
      ))}
      <motion.rect
        x={s.x - 1.8}
        y={s.y - 1.8}
        width={s.w + 3.6}
        height={s.h + 3.6}
        rx="3"
        fill="none"
        stroke="var(--ink)"
        strokeWidth={0.9 / k}
        initial={{ opacity: 0, scale: 1.6 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        transition={{ duration: 0.6, ease: EASE }}
      />
      {corners.map(([x, y], i) => (
        <motion.rect
          key={i}
          x={x - hs / 2}
          y={y - hs / 2}
          width={hs}
          height={hs}
          fill="#fff"
          stroke="var(--sun-ink)"
          strokeWidth={0.8 / k}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 + i * 0.05 }}
        />
      ))}
    </g>
  )
}

function SelectionLabel({ s, g, o, k }) {
  const label = `${s.id} · ${s.widthM} × ${s.depthM} m`
  const fs = 6.6 / k
  const tw = label.length * fs * 0.62 + 12 / k
  const th = 12.5 / k
  const v = o.view
  const lx = Math.min(Math.max(g.cx - tw / 2, v.x + 6), v.x + v.w - tw - 6)
  const above = g.y - th - 7 / k
  const ly = above < v.y + 4 ? g.y + g.h + 7 / k : above
  return (
    <motion.g
      className="sel"
      pointerEvents="none"
      initial={{ opacity: 0, y: 5 / k }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.6, ease: EASE }}
    >
      <rect x={lx} y={ly} width={tw} height={th} rx={th / 2} fill="var(--ink)" />
      <text x={lx + tw / 2} y={ly + th / 2 + fs * 0.36} textAnchor="middle" fontSize={fs} className="sel-label">
        {label}
      </text>
    </motion.g>
  )
}

export const PlanSvg = memo(function PlanSvg({ o, states, selectedId, xray = false, now, uid, k = 1, inView = true }) {
  const sel = selectedId ? SLOT_BY_ID[selectedId] : null
  const v = o.view
  const upright = o.id === 'l' ? 90 : 0
  const screen = SCREEN[o.id]
  return (
    <svg
      className={`plan ${xray ? 'is-xray' : 'plan-base'} ${inView ? 'is-in' : ''}`}
      viewBox={`${v.x} ${v.y} ${v.w} ${v.h}`}
      aria-hidden={xray ? 'true' : undefined}
    >
      <defs>
        <pattern id={`${uid}-dots`} width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r=".75" fill="rgba(var(--ink-rgb),.15)" />
        </pattern>
        <pattern id={`${uid}-hatch`} width="3.6" height="3.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="1.1" height="3.6" fill="rgba(var(--ink-rgb),.28)" />
        </pattern>
        <pattern id={`${uid}-hatch-b`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width=".8" height="5" fill="rgba(var(--ink-rgb),.1)" />
        </pattern>
        <pattern id={`${uid}-mow`} width="60" height="74" patternUnits="userSpaceOnUse">
          <rect width="60" height="37" fill="rgba(var(--ink-rgb),.025)" />
        </pattern>
      </defs>
      <rect x={v.x} y={v.y} width={v.w} height={v.h} fill="var(--paper)" />
      <rect x={v.x} y={v.y} width={v.w} height={v.h} fill={`url(#${uid}-dots)`} />
      <g transform={o.gt}>
        {xray && (
          <image
            href="/kiet-lot.jpg"
            x="0"
            y="0"
            width={IMG.w}
            height={IMG.h}
            transform={`rotate(${IMG.rotate} ${IMG.cx} ${IMG.cy})`}
            className="xray-img"
            preserveAspectRatio="none"
          />
        )}
        <ContextShapes uid={uid} />
        <g className="bays">
          {SLOTS.map((s) => (
            <Bay key={s.id} s={s} st={states[s.id]} selected={s.id === selectedId} xray={xray} uid={uid} upright={upright} />
          ))}
        </g>
        {sel && !xray && <SelectionShapes key={sel.id} s={sel} k={k} />}
      </g>
      <ContextLabels o={o} />
      <RowBadges o={o} />
      {xray && (
        <g className="xls">
          {SLOTS.map((s) => (
            <XrayLabel key={s.id} id={s.id} g={screen[s.id]} st={states[s.id]} now={now} />
          ))}
        </g>
      )}
      {sel && !xray && <SelectionLabel key={sel.id} s={sel} g={screen[sel.id]} o={o} k={k} />}
    </svg>
  )
})

/* ------------------------------------------------------------------ */
/*  3D: buildings rise out of the plan                                 */
/* ------------------------------------------------------------------ */

const ptsOf = (b) =>
  b.points
    ? b.points.split(' ').map((p) => p.split(',').map(Number))
    : [
        [b.x, b.y],
        [b.x + b.w, b.y],
        [b.x + b.w, b.y + b.h],
        [b.x, b.y + b.h],
      ]

const Extrusions = memo(function Extrusions({ s, o }) {
  const v = o.view
  return (
    <div className="extrude" aria-hidden="true">
      {BUILDINGS.map((b) => {
        const pts = ptsOf(b).map(([x, y]) => o.pt(x, y))
        const xs = pts.map((p) => p[0])
        const ys = pts.map((p) => p[1])
        const bx = Math.min(...xs)
        const by = Math.min(...ys)
        const bw = Math.max(...xs) - bx
        const bh = Math.max(...ys) - by
        const clip = `polygon(${pts.map(([x, y]) => `${((x - bx) / bw) * 100}% ${((y - by) / bh) * 100}%`).join(',')})`
        return (
          <div key={b.id} className="box" style={{ '--zh': b.z * s }}>
            {pts.map((p, i) => {
              const q = pts[(i + 1) % pts.length]
              const dx = q[0] - p[0]
              const dy = q[1] - p[1]
              const ang = (Math.atan2(dy, dx) * 180) / Math.PI
              const light = 0.5 + 0.5 * Math.cos(((ang - 20) * Math.PI) / 180)
              const c = Math.round(196 + light * 40)
              return (
                <div
                  key={i}
                  className="wall"
                  style={{
                    left: (p[0] - v.x) * s,
                    top: (p[1] - v.y) * s,
                    width: Math.hypot(dx, dy) * s,
                    transform: `rotateZ(${ang}deg) rotateX(90deg)`,
                    background: `rgb(${c},${c - 1},${c - 6})`,
                  }}
                />
              )
            })}
            <div className="roof" style={{ left: (bx - v.x) * s, top: (by - v.y) * s, width: bw * s, height: bh * s, clipPath: clip }} />
          </div>
        )
      })}
    </div>
  )
})

/* ------------------------------------------------------------------ */
/*  The map                                                            */
/* ------------------------------------------------------------------ */

const LENS_Z = 2.2
const HUD_AT = { p: [70, 300], l: [252, -490] }
const DOCK_AT = { p: [118, 812], l: [318, -98] }

function describe(st, now) {
  if (!st) return ''
  const end = dayStart(now) + DAY
  switch (st.status) {
    case 'free':
      return st.freeUntil >= end ? 'free all day' : `free till ${fmtTime(st.freeUntil)}`
    case 'taken':
      return `booked till ${fmtTime(st.current.end)}`
    case 'ending':
      return `frees in ${fmtShort(st.current.end - now)}`
    case 'held':
      return `driver due ${fmtTime(st.next.start)}`
    default:
      return st.current ? `yours till ${fmtTime(st.current.end)}` : `yours from ${fmtTime(st.next.start)}`
  }
}

function MapLayers({ o, states, selectedId, xray, tick, uid, s, zoom, inView, counts, showHud }) {
  const v = o.view
  const [hx, hy] = HUD_AT[o.id]
  return (
    <div className="map-persp">
      <div className="map-tilt">
        <div className="map-zoom" style={{ transform: `translate3d(${zoom.tx}px, ${zoom.ty}px, 0) scale(${zoom.k})` }}>
          <PlanSvg o={o} states={states} selectedId={selectedId} xray={xray} now={tick} uid={uid} k={zoom.k} inView={inView} />
          {s > 0 && <Extrusions s={s} o={o} />}
          {showHud && (
            <div
              className="ground-hud"
              style={{
                left: `${((hx - v.x) / v.w) * 100}%`,
                top: `${((hy - v.y) / v.h) * 100}%`,
                fontSize: `${Math.max(9, 12 * (s / 0.9))}px`,
              }}
            >
              <span className="mono-s caps">Free right now</span>
              <span className="ground-num">
                <Ticker value={counts.free} />
              </span>
              <span className="mono-s">of {String(counts.total).padStart(3, '0')} bays · KIET main lot</span>
              <span className="hud-scale">
                <i style={{ width: 20 * 7.7 * s }} />
                <span className="mono-s">20 m</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const LensClone = memo(function LensClone(props) {
  return <MapLayers {...props} xray uid="lens" inView showHud={false} />
})

export default function LotMap({ mode = 'plan', focusRow = null }) {
  const { states, selectedId, select, tick, counts } = useLot()
  const wide = useMedia('(min-width: 981px)')
  const o = ORIENT[wide ? 'l' : 'p']
  const LENS_R = wide ? 80 : 64
  const stageRef = useRef(null)
  const lensRef = useRef(null)
  const innerRef = useRef(null)
  const scaleRef = useRef(null)
  const readRef = useRef(null)
  const [width, setWidth] = useState(0)
  const [inView, setInView] = useState(false)
  const [hover, setHover] = useState(null)
  const [held, setHeld] = useState(false)
  const [readout, setReadout] = useState(null)
  const readoutRef = useRef(null)
  const drag = useRef({ on: false, ox: 0, oy: 0, cx: 0, cy: 0, raf: 0, lastScan: 0, suppress: false })
  const pressTimer = useRef(0)
  const statesRef = useRef(states)
  const tickRef = useRef(tick)
  useEffect(() => {
    statesRef.current = states
    tickRef.current = tick
  }, [states, tick])

  useLayoutEffect(() => {
    const el = stageRef.current
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { threshold: 0.18 },
    )
    io.observe(el)
    return () => {
      ro.disconnect()
      io.disconnect()
    }
  }, [])

  const size = useMemo(() => ({ w: width, h: (width * o.view.h) / o.view.w }), [width, o])
  const s = size.w / o.view.w

  const zoom = useMemo(() => {
    if (!focusRow || !size.w) return { k: 1, tx: 0, ty: 0 }
    const b = orientRect(o, rowBox(focusRow, 34))
    const k = Math.min(o.view.w / b.w, o.view.h / b.h, 3.4)
    const pcx = (b.x + b.w / 2 - o.view.x) * s
    const pcy = (b.y + b.h / 2 - o.view.y) * s
    return { k, tx: size.w / 2 - k * pcx, ty: size.h / 2 - k * pcy }
  }, [focusRow, size.w, size.h, s, o])

  /* ---------- lens ---------- */

  const dock = useCallback(() => {
    const [x, y] = DOCK_AT[o.id]
    return { x: (x - o.view.x) * s, y: (y - o.view.y) * s }
  }, [o, s])

  const place = useCallback((x, y) => {
    drag.current.cx = x
    drag.current.cy = y
    if (!lensRef.current) return
    lensRef.current.style.transform = `translate3d(${x - LENS_R}px, ${y - LENS_R}px, 0)`
    innerRef.current.style.transform = `translate3d(${LENS_R - x}px, ${LENS_R - y}px, 0)`
    scaleRef.current.style.transformOrigin = `${x}px ${y}px`
    const rd = readRef.current
    if (rd) {
      const sw = stageRef.current ? stageRef.current.clientWidth : 0
      if (sw < 640) {
        // narrow screens: float the readout above the lens (or below it near the top)
        const w = rd.offsetWidth || 200
        const lx = Math.min(Math.max(x - w / 2, 4), sw - w - 4)
        const above = y - LENS_R - 16 - (rd.offsetHeight || 110)
        rd.style.transform = `translate3d(${lx}px, ${above > -60 ? above : y + LENS_R + 16}px, 0)`
      } else {
        rd.style.transform =
          x > 260
            ? `translate3d(${x - LENS_R - 14}px, ${y - 40}px, 0) translateX(-100%)`
            : `translate3d(${x + LENS_R + 14}px, ${y - 40}px, 0)`
      }
    }
  }, [LENS_R])

  // the readout's height changes with its content; re-seat it once it has rendered
  useLayoutEffect(() => {
    if (drag.current.on) place(drag.current.cx, drag.current.cy)
  }, [readout, place])

  useEffect(() => {
    if (!size.w || drag.current.on) return
    const d = dock()
    place(d.x, d.y)
  }, [size, dock, place, o])

  const scan = useCallback(() => {
    const d = drag.current
    const stage = stageRef.current
    if (!stage) return
    const r = stage.getBoundingClientRect()
    const cx = r.left + d.cx
    const cy = r.top + d.cy
    const hit = document.elementFromPoint(cx, cy)
    const bayEl = hit && hit.closest ? hit.closest('.plan-base [data-id]') : null
    const id = bayEl ? bayEl.getAttribute('data-id') : null
    const radius = LENS_R / LENS_Z
    const c = { free: 0, taken: 0, ending: 0, held: 0, mine: 0 }
    stage.querySelectorAll('.plan-base .bay').forEach((el) => {
      const b = el.getBoundingClientRect()
      if (Math.hypot(b.left + b.width / 2 - cx, b.top + b.height / 2 - cy) <= radius) c[el.getAttribute('data-status')] += 1
    })
    const st = id ? statesRef.current[id] : null
    const next = {
      id,
      status: st ? st.status : null,
      detail: st ? describe(st, tickRef.current) : null,
      type: id ? TYPES[SLOT_BY_ID[id].type] : null,
      counts: c,
    }
    readoutRef.current = next
    setReadout((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
  }, [LENS_R])

  const moveTo = useCallback(
    (clientX, clientY) => {
      const d = drag.current
      const r = stageRef.current.getBoundingClientRect()
      d.cx = clientX - r.left + d.ox
      d.cy = clientY - r.top + d.oy
      place(d.cx, d.cy)
      const t = performance.now()
      clearTimeout(d.trail)
      if (t - d.lastScan > 70) {
        d.lastScan = t
        cancelAnimationFrame(d.raf)
        d.raf = requestAnimationFrame(scan)
      } else {
        // throttled: still read the spot where the lens comes to rest
        d.trail = setTimeout(() => {
          d.lastScan = performance.now()
          scan()
        }, 80)
      }
    },
    [place, scan],
  )

  const endDrag = useCallback(() => {
    const d = drag.current
    if (!d.on) return
    d.on = false
    d.suppress = true
    setTimeout(() => (d.suppress = false), 60)
    window.removeEventListener('pointermove', d.onMove)
    window.removeEventListener('pointerup', d.onUp)
    window.removeEventListener('pointercancel', d.onUp)
    cancelAnimationFrame(d.raf)
    clearTimeout(d.trail)
    scan()
    const last = readoutRef.current
    if (last && last.id) select(last.id)
    readoutRef.current = null
    setReadout(null)
    setHeld(false)
    const p = dock()
    lensRef.current?.classList.add('is-return')
    place(p.x, p.y)
    setTimeout(() => lensRef.current?.classList.remove('is-return'), 750)
  }, [dock, place, scan, select])

  const startDrag = useCallback(
    (clientX, clientY, ox, oy) => {
      const d = drag.current
      d.on = true
      d.ox = ox
      d.oy = oy
      setHover(null)
      setHeld(true)
      lensRef.current?.classList.remove('is-return')
      d.onMove = (e) => {
        e.preventDefault?.()
        moveTo(e.clientX, e.clientY)
      }
      d.onUp = () => endDrag()
      window.addEventListener('pointermove', d.onMove, { passive: false })
      window.addEventListener('pointerup', d.onUp)
      window.addEventListener('pointercancel', d.onUp)
      moveTo(clientX, clientY)
    },
    [moveTo, endDrag],
  )

  const onLensDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    if (e.pointerType === 'mouse') {
      const r = stageRef.current.getBoundingClientRect()
      const d = drag.current
      startDrag(e.clientX, e.clientY, d.cx - (e.clientX - r.left), d.cy - (e.clientY - r.top))
    } else {
      startDrag(e.clientX, e.clientY, -LENS_R * 0.78, -LENS_R * 0.78)
    }
  }

  // Hold anywhere on the plan to pick the lens up right there.
  const onStageDown = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || drag.current.on) return
    const sx = e.clientX
    const sy = e.clientY
    clearTimeout(pressTimer.current)
    const cancel = (ev) => {
      if (!ev || Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) {
        clearTimeout(pressTimer.current)
        window.removeEventListener('pointermove', cancel)
      }
    }
    window.addEventListener('pointermove', cancel)
    window.addEventListener('pointerup', () => cancel(), { once: true })
    pressTimer.current = setTimeout(() => {
      window.removeEventListener('pointermove', cancel)
      lensRef.current?.classList.add('is-fly')
      startDrag(sx, sy, 0, 0)
      setTimeout(() => lensRef.current?.classList.remove('is-fly'), 380)
    }, 300)
  }

  useEffect(() => {
    const d = drag.current
    return () => {
      window.removeEventListener('pointermove', d.onMove)
      window.removeEventListener('pointerup', d.onUp)
      clearTimeout(pressTimer.current)
    }
  }, [])

  /* ---------- clicks + hover ---------- */

  const onClick = (e) => {
    if (drag.current.suppress) return
    const el = e.target.closest?.('.plan-base [data-id]')
    if (el) select(el.getAttribute('data-id'))
  }

  const onOver = (e) => {
    if (e.pointerType !== 'mouse' || drag.current.on) return
    const el = e.target.closest?.('.plan-base [data-id]')
    if (!el) return setHover(null)
    const r = el.getBoundingClientRect()
    const st = stageRef.current.getBoundingClientRect()
    setHover({ id: el.getAttribute('data-id'), x: r.left + r.width / 2 - st.left, y: r.top - st.top })
  }

  const hoverSt = hover ? states[hover.id] : null

  return (
    <div
      ref={stageRef}
      className={`map-stage is-${mode}${held ? ' is-lensing' : ''}`}
      onClick={onClick}
      onPointerOver={onOver}
      onPointerLeave={() => setHover(null)}
      onPointerDown={onStageDown}
      style={{ '--s': s, aspectRatio: `${o.view.w} / ${o.view.h}` }}
    >
      <div className="map-clip">
        <MapLayers
          o={o}
          states={states}
          selectedId={selectedId}
          xray={false}
          tick={tick}
          uid="base"
          s={s}
          zoom={zoom}
          inView={inView}
          counts={counts}
          showHud={!focusRow}
        />
      </div>

      <div className="map-hud-n" style={{ transform: `rotate(${o.north + (mode === 'tilt' ? -32 : 0)}deg)` }} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path d="M12 3 16 19 12 16 8 19Z" fill="var(--ink)" />
        </svg>
        <span className="mono-s">N</span>
      </div>

      <AnimatePresence>
        {hover && hoverSt && !held && (
          <motion.div
            key={hover.id}
            className="map-tip"
            style={{ left: hover.x, bottom: size.h - hover.y + 10 }}
            initial={{ opacity: 0, y: 6, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 4, x: '-50%', transition: { duration: 0.15 } }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <b>{hover.id}</b>
            <span className={`dot dot-${hoverSt.status}`} />
            <span>{STATUS[hoverSt.status].label}</span>
            <span className="dim">· {describe(hoverSt, tick)}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* magnifier */}
      <div ref={lensRef} className={`lens${held ? ' is-held' : ''}`} style={{ width: LENS_R * 2, height: LENS_R * 2 }} aria-hidden="true">
        <div className="lens-body" onPointerDown={onLensDown}>
          <div className="lens-glass">
            <div ref={innerRef} className="lens-inner" style={{ width: size.w, height: size.h }}>
              <div ref={scaleRef} className="lens-scale" style={{ transform: `scale(${LENS_Z})` }}>
                {size.w > 0 && (
                  <LensClone
                    o={o}
                    states={states}
                    selectedId={null}
                    tick={tick}
                    s={s}
                    zoom={zoom}
                    counts={counts}
                  />
                )}
              </div>
            </div>
            <span className="lens-glare" />
            <span className="lens-cross" />
          </div>
          <span className="lens-handle">
            <i />
          </span>
        </div>
      </div>

      <div ref={readRef} className={`lens-read${held && readout ? ' is-on' : ''}`} aria-live="polite">
        {readout && (
          <>
            <div className="lr-top">
              {readout.id ? (
                <>
                  <b>{readout.id}</b>
                  <span className={`dot dot-${readout.status}`} />
                  <span>{STATUS[readout.status].label}</span>
                </>
              ) : (
                <span className="dim">Over the road</span>
              )}
            </div>
            {readout.id && (
              <div className="lr-sub">
                {readout.detail} · {readout.type.label} · ₹{readout.type.rate}/h
              </div>
            )}
            <div className="lr-counts">
              <span className="mono-s caps">In the lens</span>
              <span>
                <i className="dot dot-free" /> {readout.counts.free}
              </span>
              <span>
                <i className="dot dot-taken" /> {readout.counts.taken}
              </span>
              <span>
                <i className="dot dot-ending" /> {readout.counts.ending}
              </span>
              <span>
                <i className="dot dot-held" /> {readout.counts.held}
              </span>
            </div>
            {readout.id && <div className="lr-hint mono-s">let go to open {readout.id}</div>}
          </>
        )}
      </div>

      {size.w > 0 && (
        <div
          className={`lens-hint${held ? ' is-gone' : ''}`}
          style={{ left: dock().x + 40, top: dock().y - 70 }}
          aria-hidden="true"
        >
          <svg width="46" height="40" viewBox="0 0 46 40" fill="none">
            <path d="M42 6C30 8 13 16 7 34" stroke="var(--sun-ink)" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M3 25l4 10 9-4" stroke="var(--sun-ink)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="hand">hold &amp; drag me</span>
        </div>
      )}
    </div>
  )
}
