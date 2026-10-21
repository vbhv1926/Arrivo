import { useEffect, useRef, useState } from 'react'
import { animate, motion, useInView } from 'motion/react'
import { HOUR, dayStart, pad3 } from './lot'

export const EASE = [0.22, 1, 0.36, 1]

export function Arrow({ dir = 'ne' }) {
  const rot = { ne: 0, e: 45, s: 135, se: 90, n: -45 }[dir] ?? 0
  return (
    <svg viewBox="0 0 16 16" fill="none" style={{ transform: `rotate(${rot}deg)` }} aria-hidden="true">
      <path d="M4 12 12 4M5.5 4H12v6.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function PillButton({ children, variant = 'dark', size, dir = 'ne', as = 'button', className = '', ...rest }) {
  const Tag = as
  return (
    <Tag className={`btn btn-${variant} ${size ? `btn-${size}` : ''} ${className}`} {...rest}>
      <span>{children}</span>
      <span className="btn-ico">
        <span className="a1" style={{ display: 'grid' }}>
          <Arrow dir={dir} />
        </span>
        <span className="a2" style={{ display: 'grid' }}>
          <Arrow dir={dir} />
        </span>
      </span>
    </Tag>
  )
}

/* A handwritten note with an arrow that draws itself in. */
export function Hand({ children, path, w = 120, h = 60, className = '', style, delay = 0.3, textFirst = true }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' })
  return (
    <div ref={ref} className={`hand-note ${className}`} style={style}>
      {textFirst && (
        <motion.span
          className="hand"
          initial={{ opacity: 0, y: 8, rotate: -4 }}
          animate={inView ? { opacity: 1, y: 0, rotate: -4 } : undefined}
          transition={{ duration: 0.7, ease: EASE, delay }}
        >
          {children}
        </motion.span>
      )}
      {path && (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" className="hand-arrow" aria-hidden="true">
          {[].concat(path).map((d, i) => (
            <motion.path
              key={i}
              d={d}
              stroke="var(--sun-ink)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={inView ? { pathLength: 1, opacity: 1 } : undefined}
              transition={{ duration: i === 0 ? 0.9 : 0.3, ease: EASE, delay: delay + 0.35 + i * 0.75 }}
            />
          ))}
        </svg>
      )}
      {!textFirst && (
        <motion.span
          className="hand"
          initial={{ opacity: 0, y: 8, rotate: -4 }}
          animate={inView ? { opacity: 1, y: 0, rotate: -4 } : undefined}
          transition={{ duration: 0.7, ease: EASE, delay }}
        >
          {children}
        </motion.span>
      )}
    </div>
  )
}

/* Zero-padded number that rolls to its new value. */
export function Ticker({ value, pad = true, className = '', duration = 0.9 }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const ctrl = animate(from.current, value, {
      duration,
      ease: EASE,
      onUpdate: (v) => setShown(v),
    })
    from.current = value
    return () => ctrl.stop()
  }, [value, duration])
  return <span className={className}>{pad ? pad3(shown) : Math.round(shown)}</span>
}

export function StatusDot({ status }) {
  return <span className={`dot dot-${status}`} aria-hidden="true" />
}

export function TypeGlyph({ type, size = 14 }) {
  if (type === 'ev')
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
        <path d="M8 1.5 3.5 8h3L6 12.5 10.5 6h-3L8 1.5Z" fill="currentColor" />
      </svg>
    )
  if (type === 'accessible')
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <circle cx="7" cy="2.6" r="1.4" fill="currentColor" />
        <path d="M6.2 5v3.2h3.3l1.4 3M6.2 6.6H9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M4.6 7.1a3 3 0 1 0 4 3.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    )
  if (type === 'compact')
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <rect x="3.5" y="2.5" width="7" height="9" rx="2" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    )
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="3" y="1.5" width="8" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

/* ---------- one day as a strip, 06:00 to 22:00 ---------- */

const FROM = 6
const TO = 22

export function DayStrip({ list = [], now, preview, compact = false }) {
  const ds = dayStart(now)
  const a = ds + FROM * HOUR
  const b = ds + TO * HOUR
  const pct = (t) => ((Math.min(Math.max(t, a), b) - a) / (b - a)) * 100
  const blocks = list.filter((x) => x.end > a && x.start < b)
  const nowPct = pct(now)
  return (
    <div className={`strip${compact ? ' strip-s' : ''}`}>
      <div className="strip-track">
        <span className="strip-past" style={{ width: `${nowPct}%` }} />
        {blocks.map((x) => (
          <span
            key={x.id}
            className={`strip-blk${x.mine ? ' is-mine' : ''}${x.start > now ? ' is-ahead' : ''}`}
            style={{ left: `${pct(x.start)}%`, width: `${Math.max(0.6, pct(x.end) - pct(x.start))}%` }}
          />
        ))}
        {preview && (
          <motion.span
            className={`strip-prev${preview.clash ? ' is-clash' : ''}`}
            initial={false}
            animate={{ left: `${pct(preview.start)}%`, width: `${Math.max(0.6, pct(preview.end) - pct(preview.start))}%` }}
            transition={{ duration: 0.55, ease: EASE }}
          />
        )}
        <span className="strip-now" style={{ left: `${nowPct}%` }} />
      </div>
      {!compact && (
        <div className="strip-ticks" aria-hidden="true">
          {Array.from({ length: TO - FROM + 1 }, (_, i) => {
            const h = FROM + i
            return (
              <span key={h} className={`tk${h % 2 === 0 ? ' tk-l' : ''}`} style={{ left: `${(i / (TO - FROM)) * 100}%` }}>
                {h % 2 === 0 && <em>{String(h).padStart(2, '0')}</em>}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ---------- media query hook ---------- */

export function useMedia(query) {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const m = window.matchMedia(query)
    const on = () => setMatch(m.matches)
    on()
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [query])
  return match
}
