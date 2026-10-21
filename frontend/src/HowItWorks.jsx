import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { pad3, scrollTo } from './lot'
import { EASE } from './ui'
const CHAPTERS = [
  ['A lot.', 'Every lot gets drawn once, properly: rows, bays and the road between them. Where things belong is measured, not guessed.'],
  ['A bay.', 'Each bay gets a name and a size. A-14 is 2.5 by 5 metres, on the edge of the football ground, facing the service road.'],
  ['A window.', 'Pick when you arrive and how long you stay. Hours that are already taken show up grey, like seats someone else bought.'],
  ['A hold.', 'Pay, and the bay is held in your name. If traffic disagrees with your plans, it waits 15 minutes past your arrival time.'],
  ['You arrive.', 'Drive in and go straight to A-14. It is still free, because nobody else could book it.'],
]
const N = CHAPTERS.length

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const seg = (f, a, b) => clamp((f - a) / (b - a))
const io = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const out = (t) => 1 - Math.pow(1 - t, 3)

const X0 = 92
const PITCH = 56
const TARGET = 6
const TOP_CARS = [0, 1, 3, 8, 9, 10]
const BOT_CARS = [0, 2, 3, 5, 7, 8]
const HX = (h) => X0 + ((h - 8) / 12) * (PITCH * 11)

function MiniCar({ x, y, rot = 0, fill = 'var(--car-ink)', glass = '#55585f', stroke, roof }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect x="-17" y="-35" width="34" height="70" rx="11" fill={fill} stroke={stroke} strokeWidth={stroke ? 1 : 0} />
      <rect x="-13" y="-22" width="26" height="12" rx="3" fill={glass} />
      <rect x="-12" y="16" width="24" height="8" rx="2.5" fill={glass} opacity=".8" />
      {roof && <rect x="-9" y="-6" width="18" height="18" rx="3" fill={roof} />}
    </g>
  )
}

function Drawing({ P }) {
  const f = (i) => clamp(P - i)
  const f0 = f(0)
  const f1 = f(1)
  const f2 = f(2)
  const f3 = f(3)
  const f4 = f(4)
  const tx = X0 + TARGET * PITCH

  // the car: along the road, then a turn into the bay
  const d1 = io(seg(f4, 0, 0.55))
  const d2 = io(seg(f4, 0.55, 1))
  const carX = -60 + (tx + PITCH / 2 + 60) * d1
  const carY = 228 - 90 * d2
  const carR = 90 - 90 * d2

  return (
    <svg viewBox="0 0 800 520" className="how-svg" aria-hidden="true">
      <defs>
        <pattern id="how-dots" width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r=".9" fill="rgba(var(--ink-rgb),.16)" />
        </pattern>
      </defs>
      <rect width="800" height="520" fill="url(#how-dots)" />

      {/* guides */}
      <g stroke="var(--sun-line)" strokeWidth=".8" opacity={0.7 * seg(f1, 0, 0.3) * (1 - seg(f3, 0.6, 1))}>
        <line x1="0" y1="86" x2="800" y2="86" />
        <line x1="0" y1="190" x2="800" y2="190" />
        <line x1={tx + 3} y1="0" x2={tx + 3} y2="520" />
        <line x1={tx + 53} y1="0" x2={tx + 53} y2="520" />
      </g>

      {/* lot outline + road */}
      <rect x="60" y="40" width="680" height="376" rx="14" fill="none" stroke="var(--ink)" strokeWidth="1.4" pathLength="1" strokeDasharray="1 1" strokeDashoffset={1 - out(seg(f0, 0, 0.55))} />
      {[200, 256].map((y, i) => (
        <line key={y} x1="60" y1={y} x2="740" y2={y} stroke="var(--ink)" strokeWidth="1" pathLength="1" strokeDasharray="1 1" strokeDashoffset={1 - out(seg(f0, 0.25 + i * 0.08, 0.7))} />
      ))}
      <line x1="72" y1="228" x2="728" y2="228" stroke="var(--ink-4)" strokeWidth="1.4" strokeDasharray="12 10" opacity={seg(f0, 0.6, 0.9)} />

      {/* bay separators */}
      {Array.from({ length: 12 }, (_, i) => {
        const x = X0 + i * PITCH
        const t = out(seg(f0, 0.4 + i * 0.03, 0.75 + i * 0.02))
        return (
          <g key={i} stroke="var(--ink)" strokeWidth="1.2" strokeLinecap="round" opacity={t > 0.02 ? 1 : 0}>
            <line x1={x} y1={196} x2={x} y2={196 - 108 * t} />
            <line x1={x} y1={260} x2={x} y2={260 + 108 * t} />
          </g>
        )
      })}

      {/* the bay */}
      <rect
        x={tx + 3}
        y="86"
        width="50"
        height="104"
        rx="4"
        fill={f3 > 0 ? 'var(--sun)' : 'var(--sun-wash)'}
        opacity={seg(f1, 0, 0.4)}
        stroke="var(--ink)"
        strokeWidth={f3 > 0.3 ? 1.4 : 0}
      />
      <motion.rect
        x={tx + 3}
        y="86"
        width="50"
        height="104"
        rx="4"
        fill="var(--sun)"
        initial={false}
        animate={{ opacity: f3 > 0.05 ? 1 : 0 }}
        transition={{ duration: 0.5 }}
      />
      <text x={tx + 28} y={f3 > 0.05 ? 132 : 142} textAnchor="middle" className="how-bay-id" opacity={seg(f1, 0.2, 0.6)}>
        A-14
      </text>
      <text x={tx + 28} y="150" textAnchor="middle" className="how-held" opacity={seg(f3, 0.2, 0.6) * (1 - seg(f4, 0.6, 0.9))}>
        HELD 14:00
      </text>

      {/* handles */}
      <g opacity={seg(f1, 0.3, 0.6) * (1 - seg(f3, 0.4, 0.8))}>
        {[
          [tx + 3, 86],
          [tx + 53, 86],
          [tx + 3, 190],
          [tx + 53, 190],
        ].map(([x, y], i) => (
          <rect key={i} x={x - 3.5} y={y - 3.5} width="7" height="7" fill="#fff" stroke="var(--sun-ink)" strokeWidth="1.2" />
        ))}
      </g>

      {/* dimensions */}
      <g className="how-dim" opacity={1 - seg(f3, 0.4, 0.8)}>
        <line x1={tx + 3} y1="66" x2={tx + 3 + 50 * out(seg(f1, 0.3, 0.7))} y2="66" />
        <line x1={tx + 3} y1="60" x2={tx + 3} y2="72" opacity={seg(f1, 0.3, 0.4)} />
        <line x1={tx + 53} y1="60" x2={tx + 53} y2="72" opacity={seg(f1, 0.6, 0.7)} />
        <text x={tx + 28} y="56" textAnchor="middle" opacity={seg(f1, 0.6, 0.9)}>
          2.5 m
        </text>
        <line x1={tx + 70} y1="86" x2={tx + 70} y2={86 + 104 * out(seg(f1, 0.4, 0.8))} />
        <line x1={tx + 64} y1="86" x2={tx + 76} y2="86" opacity={seg(f1, 0.4, 0.5)} />
        <line x1={tx + 64} y1="190" x2={tx + 76} y2="190" opacity={seg(f1, 0.7, 0.8)} />
        <text transform={`translate(${tx + 86} 138) rotate(90)`} textAnchor="middle" opacity={seg(f1, 0.7, 1)}>
          5.0 m
        </text>
      </g>

      {/* other people's cars */}
      {TOP_CARS.map((i, k) => {
        const t = out(seg(f2, k * 0.05, 0.35 + k * 0.05))
        return (
          <g key={`t${i}`} opacity={t} transform={`translate(0 ${(1 - t) * 40})`}>
            <MiniCar x={X0 + i * PITCH + 28} y={140} fill={k % 2 ? '#f7f7f4' : 'var(--car-ink)'} glass={k % 2 ? '#2a2c31' : '#55585f'} stroke={k % 2 ? 'rgba(var(--ink-rgb),.35)' : undefined} />
          </g>
        )
      })}
      {BOT_CARS.map((i, k) => {
        const t = out(seg(f2, 0.1 + k * 0.05, 0.45 + k * 0.05))
        return (
          <g key={`b${i}`} opacity={t} transform={`translate(0 ${(t - 1) * 40})`}>
            <MiniCar x={X0 + i * PITCH + 28} y={316} rot={180} fill={k % 2 ? 'var(--car-ink)' : '#bebdb7'} glass={k % 2 ? '#55585f' : '#34363c'} />
          </g>
        )
      })}

      {/* time window */}
      <g opacity={seg(f2, 0, 0.25)}>
        <line x1={X0} y1="470" x2={X0 + (PITCH * 11) * out(seg(f2, 0, 0.4))} y2="470" stroke="var(--ink)" strokeWidth="1" />
        {Array.from({ length: 13 }, (_, i) => (
          <g key={i} opacity={seg(f2, 0.05 + i * 0.02, 0.2 + i * 0.02)}>
            <line x1={HX(8 + i)} y1="470" x2={HX(8 + i)} y2={i % 2 ? 476 : 480} stroke="var(--ink-3)" strokeWidth="1" />
            {i % 2 === 0 && (
              <text x={HX(8 + i)} y="496" textAnchor="middle" className="how-tick">
                {String(8 + i).padStart(2, '0')}:00
              </text>
            )}
          </g>
        ))}
        {[
          [9, 11.5],
          [16.5, 18],
        ].map(([a, b], i) => (
          <rect key={i} x={HX(a)} y="452" width={(HX(b) - HX(a)) * seg(f2, 0.3 + i * 0.1, 0.55 + i * 0.1)} height="12" rx="3" fill="var(--ink-5)" />
        ))}
        <rect x={HX(14)} y="450" width={(HX(16) - HX(14)) * out(seg(f2, 0.55, 0.95))} height="16" rx="4" fill="var(--sun)" stroke="var(--ink)" strokeWidth="1" opacity={seg(f2, 0.55, 0.6)} />
        <text x={HX(15)} y="440" textAnchor="middle" className="how-win" opacity={seg(f2, 0.8, 1)}>
          14:00 → 16:00
        </text>
      </g>

      {/* the note */}
      <g opacity={seg(f3, 0.3, 0.6)}>
        <text x="610" y="24" className="how-hand" transform="rotate(-4 610 24)">
          that one is yours
        </text>
        <path
          d={`M600 30 C 560 34, 528 46, ${tx + 60} 82`}
          fill="none"
          stroke="var(--sun-ink)"
          strokeWidth="1.8"
          strokeLinecap="round"
          pathLength="1"
          strokeDasharray="1 1"
          strokeDashoffset={1 - seg(f3, 0.4, 0.9)}
        />
        <path d={`M${tx + 58} 72 l2 10 9 -3`} fill="none" stroke="var(--sun-ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity={seg(f3, 0.85, 1)} />
      </g>

      {/* you */}
      <g opacity={seg(f4, 0, 0.05)}>
        <MiniCar x={carX} y={carY} rot={carR} fill="var(--car-ink)" glass="#55585f" roof="var(--sun)" />
      </g>
      <g opacity={seg(f4, 0.92, 1)}>
        <rect x={tx - 26} y="20" width="108" height="22" rx="11" fill="var(--ink)" />
        <text x={tx + 28} y="35" textAnchor="middle" className="how-arrived">
          parked · 13:58
        </text>
      </g>
    </svg>
  )
}

export default function HowItWorks() {
  const ref = useRef(null)
  const [p, setP] = useState(0)

  useEffect(() => {
    let raf = 0
    const on = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el = ref.current
        if (!el) return
        const r = el.getBoundingClientRect()
        const total = el.offsetHeight - window.innerHeight
        setP(clamp(-r.top / total))
      })
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => {
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
      cancelAnimationFrame(raf)
    }
  }, [])

  const P = clamp(p / 0.88) * N
  const c = Math.min(N - 1, Math.floor(P))

  return (
    <section className="how" id="how" ref={ref} data-chapter="How it works">
      <div className="how-sticky">
        <div className="wrap how-wrap">
          <div className="how-top">
            <div className="sec-kicker">
              <span className="num">01</span>
              <span className="bar" />
              <span className="mono">How a booking works</span>
            </div>
            <div className="how-progress">
              <span className="mono">Booking progress</span>
              <span className="how-pct">
                {pad3((P / N) * 100)}
                <small>%</small>
              </span>
            </div>
          </div>

          <div className="how-stage">
            <Drawing P={P} />
          </div>

          <div className="how-bottom">
            <div className="how-text">
              <div className="how-count mono">
                <span className="num">{String(c + 1).padStart(2, '0')}</span>
                <span className="how-count-bar">
                  <motion.i animate={{ scaleX: (c + 1) / N }} transition={{ duration: 0.6, ease: EASE }} />
                </span>
                <span>{String(N).padStart(2, '0')}</span>
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={c}
                  initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -12, filter: 'blur(6px)' }}
                  transition={{ duration: 0.45, ease: EASE }}
                >
                  <h3 className="how-title">{CHAPTERS[c][0]}</h3>
                  <p className="lede how-p">{CHAPTERS[c][1]}</p>
                </motion.div>
              </AnimatePresence>
            </div>
            <button className="how-skip mono" onClick={() => scrollTo('#live')}>
              Skip the walkthrough
              <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
                <path d="M6 1v10M2 7l4 4 4-4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
