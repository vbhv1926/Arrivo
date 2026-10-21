import Lenis from 'lenis'

const root = document.documentElement

// smooth scrolling
let lenis = null
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  lenis = new Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 4), touchMultiplier: 1.4 })
  function raf(time) {
    lenis.raf(time)
    requestAnimationFrame(raf)
  }
  requestAnimationFrame(raf)
}

function goTo(target, offset = -88) {
  const el = typeof target === 'string' ? document.querySelector(target) : target
  if (!el) return
  if (lenis) {
    lenis.scrollTo(el, { offset: offset, duration: 1.4 })
  } else {
    const y = el.getBoundingClientRect().top + window.scrollY + offset
    window.scrollTo({ top: y, behavior: 'smooth' })
  }
}
// the react parts (map, panel) scroll with this too
window.goTo = goTo

// any button with data-go="#something" scrolls there
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-go]')
  if (!btn) return
  e.preventDefault()
  const offset = btn.dataset.offset ? Number(btn.dataset.offset) : -88
  goTo(btn.dataset.go, offset)
})

// light / dark
const themeBtn = document.querySelector('.theme-btn')

function updateThemeBtn() {
  const dark = root.dataset.theme === 'dark'
  themeBtn.setAttribute('aria-checked', dark)
  themeBtn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme')
  themeBtn.title = dark ? 'Light' : 'Dark'
}

themeBtn.addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark'
  root.dataset.theme = next
  try {
    localStorage.setItem('arrivo.theme', next)
  } catch (e) {}
  updateThemeBtn()
})
updateThemeBtn()

// menu
const menu = document.querySelector('.menu')
const menuBtn = document.querySelector('.menu-btn')

function setMenu(open) {
  menu.classList.toggle('is-open', open)
  menuBtn.classList.toggle('is-open', open)
  menuBtn.setAttribute('aria-expanded', open)
  menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu')
  if (lenis) {
    if (open) lenis.stop()
    else lenis.start()
  }
}

menuBtn.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')))

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menu.classList.contains('is-open')) setMenu(false)
})

menu.querySelectorAll('[data-to]').forEach((btn) => {
  btn.addEventListener('click', () => {
    setMenu(false)
    setTimeout(() => goTo(btn.dataset.to), 450)
  })
})

// pixel marks on the left of the hero
const edge = document.querySelector('.ruler-l')
for (let v = 64; v < 1100; v += 64) {
  const mark = document.createElement('span')
  mark.style.top = v + 'px'
  mark.textContent = v
  edge.appendChild(mark)
}

// headings: wrap every word so it can slide up out of a mask
document.querySelectorAll('.split').forEach((el) => {
  const delay = Number(el.dataset.delay || 0)
  const stagger = Number(el.dataset.stagger || 0.045)
  const lines = el.innerHTML.split(/<br\s*\/?>/i).map((l) => l.trim())
  let n = 0
  let html = ''
  lines.forEach((line) => {
    const words = line.split(/\s+/)
    html += '<span class="line-mask" aria-hidden="true">'
    words.forEach((word, i) => {
      const d = (delay + n * stagger).toFixed(3)
      n++
      html += '<span class="w-mask"><span class="w" style="transition-delay:' + d + 's">' + word + '</span></span>'
      if (i < words.length - 1) html += ' '
    })
    html += '</span>'
  })
  el.setAttribute('aria-label', lines.join(' '))
  el.innerHTML = html
  el.classList.add('words')
})

// add .seen to things when they scroll into view (only once)
const watcher = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('seen')
        watcher.unobserve(entry.target)
      }
    })
  },
  { rootMargin: '0px 0px -10% 0px' },
)
document.querySelectorAll('.reveal, .words, .sec-rule, .note, .cards, .turn').forEach((el) => watcher.observe(el))

// who it is for: hover or tap a card to open it
const cards = document.querySelectorAll('.card')
cards.forEach((card) => {
  const open = () => cards.forEach((c) => c.classList.toggle('is-on', c === card))
  card.addEventListener('mouseenter', open)
  card.addEventListener('click', open)
})

// on scroll: nav background + the dot on the right edge
const nav = document.querySelector('.nav')
const dot = document.querySelector('.ruler-dot')
const label = document.querySelector('.ruler-label')
let dotY = 0
let dotTarget = 0
let dotMoving = false
let hideLabel

function moveDot() {
  dotY += (dotTarget - dotY) * 0.14
  if (Math.abs(dotTarget - dotY) < 0.2) dotY = dotTarget
  dot.style.transform = 'translateY(' + dotY + 'px)'
  if (dotY !== dotTarget) requestAnimationFrame(moveDot)
  else dotMoving = false
}

function onScroll() {
  nav.classList.toggle('is-scrolled', window.scrollY > 24)

  const max = root.scrollHeight - window.innerHeight
  const p = max > 0 ? window.scrollY / max : 0
  dotTarget = p * (window.innerHeight - 120)
  if (!dotMoving) {
    dotMoving = true
    requestAnimationFrame(moveDot)
  }

  // which section are we in
  let current = ''
  document.querySelectorAll('[data-chapter]').forEach((s) => {
    if (s.getBoundingClientRect().top < window.innerHeight * 0.5) current = s.dataset.chapter
  })
  label.textContent = current
  label.classList.toggle('is-on', current !== '')
  clearTimeout(hideLabel)
  hideLabel = setTimeout(() => label.classList.remove('is-on'), 1100)
}

window.addEventListener('scroll', onScroll, { passive: true })
onScroll()
label.classList.remove('is-on')

// live numbers. the react part sends them whenever the lot changes
function countTo(el, to) {
  const from = Number(el.dataset.n) || 0
  el.dataset.n = to
  const start = performance.now()
  cancelAnimationFrame(el.countRaf)
  function step(now) {
    let t = Math.min(1, (now - start) / 900)
    t = 1 - Math.pow(1 - t, 4)
    const v = Math.round(from + (to - from) * t)
    el.textContent = el.dataset.pad ? String(v).padStart(3, '0') : v
    if (t < 1) el.countRaf = requestAnimationFrame(step)
  }
  el.countRaf = requestAnimationFrame(step)
}

function showLot(lot) {
  document.querySelectorAll('[data-lot]').forEach((el) => {
    const v = lot[el.dataset.lot]
    if (v !== undefined && el.dataset.n !== String(v)) countTo(el, v)
  })
  document.querySelectorAll('.row-bars i').forEach((bar, i) => {
    bar.style.transform = 'scaleY(' + (0.25 + lot.rows[i] * 0.75) + ')'
  })
}

window.addEventListener('lot:update', (e) => showLot(e.detail))
if (window.lot) showLot(window.lot)
