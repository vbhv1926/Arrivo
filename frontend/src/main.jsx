import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { createPortal } from 'react-dom'
import './styles/islands.css'
import { LotProvider, ROWS, SLOTS, useLot } from './lot'
import HowItWorks from './HowItWorks'
import LiveLot, { HeroSeats } from './LiveLot'

// The page itself is plain HTML (index.html). React only draws the parts that run on live
// lot data, each into its own empty <div> on that page, all sharing one LotProvider.
const MOUNTS = [
  ['seatmap-root', <HeroSeats key="seats" />],
  ['how-root', <HowItWorks key="how" />],
  ['live-root', <LiveLot key="live" />],
]

// Hands the plain page (script.js) the numbers it shows in the nav, menu and footer.
function Bridge() {
  const { counts, states } = useLot()
  useEffect(() => {
    const rows = ROWS.map((r) => {
      const bays = SLOTS.filter((s) => s.row === r.id)
      return bays.filter((s) => states[s.id].status === 'free').length / bays.length
    })
    const lot = {
      free: counts.free,
      total: counts.total,
      booked: counts.booked,
      reserved: counts.held + counts.mine,
      rows,
    }
    window.lot = lot
    window.dispatchEvent(new CustomEvent('lot:update', { detail: lot }))
  }, [counts, states])
  return null
}

function App() {
  return (
    <LotProvider>
      <Bridge />
      {MOUNTS.map(([id, el]) => {
        const node = document.getElementById(id)
        return node ? createPortal(el, node, id) : null
      })}
    </LotProvider>
  )
}

createRoot(document.getElementById('react-root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
