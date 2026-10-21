// Captures real Arrivo UI states for the brag video, plus the coordinates the
// composition needs (cursor targets, the lens dock, the field to type into ...).
// Usage: node capture.mjs <outDir> [baseUrl]
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const OUT = process.argv[2]
const BASE = process.argv[3] || 'http://localhost:8787'
const CHROME = path.join(
  os.homedir(),
  '.cache/hyperframes/chrome/chrome-headless-shell/win64-152.0.7977.30/chrome-headless-shell-win64/chrome-headless-shell.exe',
)
const W = 1920
const H = 1080
const DPR = 2
const PLATE = 'UP14 DX 4821'
const FIXED_NOW = (() => { const d = new Date(); d.setHours(16, 40, 0, 0); return d.getTime() })()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
fs.mkdirSync(OUT, { recursive: true })

const coords = { viewport: { w: W, h: H, dpr: DPR }, plate: PLATE }

/* ---------- the lot's seeded day (the app's original generator), served to the page ---------- */
const MIN = 60000, DAY = 86400000
const ROWS = [['A', 33], ['B', 10], ['C', 24], ['D', 6], ['E', 23]]
const SLOT_IDS = ROWS.flatMap(([r, n]) => Array.from({ length: n }, (_, i) => `${r}-${String(i + 1).padStart(2, '0')}`))
const DEMAND = [0.12, 0.1, 0.1, 0.1, 0.1, 0.12, 0.22, 0.46, 0.78, 0.88, 0.9, 0.9, 0.86, 0.88, 0.9, 0.86, 0.74, 0.58, 0.46, 0.38, 0.32, 0.26, 0.2, 0.15]
const PREFIX = ['UP14', 'UP14', 'UP14', 'UP16', 'UP80', 'DL3C', 'DL8C', 'HR26', 'UP15']
const LETTERS = 'ABCDEFGHJKLMNPRSTUVWXZ'
const VIA = ['app', 'app', 'app', 'app', 'pass', 'gate']
const fnv = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
const mulberry = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const dayStartOf = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }
const mask = (p) => { const x = p.split(' '); return `${x[0]} •• ${x[x.length - 1]}` }
function seededDay(now) {
  const start = dayStartOf(now)
  const seedBase = new Date(start).toDateString()
  const out = []
  let id = 1
  for (const sid of SLOT_IDS) {
    const r = mulberry(fnv(seedBase + sid))
    let t = start + Math.floor(r() * 18) * 5 * MIN
    while (t < start + DAY) {
      const h = new Date(t).getHours()
      if (r() < DEMAND[h] * 0.7) {
        const peak = h >= 8 && h <= 15
        const dur = (3 + Math.floor(r() * (peak ? 22 : 9))) * 15 * MIN
        const end = Math.min(t + dur, start + DAY)
        const plate = `${PREFIX[Math.floor(r() * PREFIX.length)]} ${LETTERS[Math.floor(r() * LETTERS.length)]}${LETTERS[Math.floor(r() * LETTERS.length)]} ${1000 + Math.floor(r() * 9000)}`
        const via = VIA[Math.floor(r() * VIA.length)]
        const tone = Math.floor(r() * 100)
        out.push({ id: String(id++), bayId: sid, start: t, end, status: 'confirmed', plate: mask(plate), via, tone, mine: false })
        t = end + (1 + Math.floor(r() * 7)) * 5 * MIN
      } else {
        t += (2 + Math.floor(r() * 7)) * 15 * MIN
      }
    }
  }
  const events = []
  for (const b of out) {
    if (b.start <= now && b.start > now - 45 * MIN) events.push({ id: 'ev' + b.id + 'a', t: b.start, bayId: b.bayId, kind: 'arrive', start: b.start, end: b.end, mine: false })
    if (b.end <= now && b.end > now - 45 * MIN) events.push({ id: 'ev' + b.id + 'l', t: b.end, bayId: b.bayId, kind: 'leave', start: b.start, end: b.end, mine: false })
  }
  events.sort((a, b) => b.t - a.t)
  return { start, bookings: out, events: events.slice(0, 12) }
}


const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none'],
})
const page = await browser.newPage()
await page.setViewport({ width: W, height: H, deviceScaleFactor: DPR })
await page.emulateMediaFeatures([
  { name: 'prefers-reduced-motion', value: 'reduce' },
  { name: 'prefers-color-scheme', value: 'light' },
])

await page.setRequestInterception(true)
page.on('request', async (req) => {
  const url = req.url()
  try {
    if (/\/api\/lots\/[^/]+\/snapshot/.test(url)) {
      const now = FIXED_NOW
      const day = seededDay(now)
      return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ lotId: 'kiet-main', now, from: day.start, to: day.start + DAY, bookings: day.bookings, events: day.events }) })
    }
    if (/\/api\/lots\/[^/]+\/stream/.test(url)) {
      return req.respond({ status: 200, contentType: 'text/event-stream', headers: { 'Cache-Control': 'no-cache' }, body: 'retry: 600000\nevent: hello\ndata: {}\n\n' })
    }
    if (/\/api\/bookings$/.test(url) && req.method() === 'POST') {
      const b = JSON.parse(req.postData() || '{}')
      const now = FIXED_NOW
      const booking = { id: 'cap-1', bayId: b.bayId, start: b.start, end: b.end, status: 'confirmed', plate: b.plate, via: 'app', tone: 42, mine: true, code: 'PS-7F3K2', madeAt: now }
      return req.respond({ status: 201, contentType: 'application/json', body: JSON.stringify({ booking }) })
    }
    if (/\/api\//.test(url) && req.method() !== 'GET') {
      return req.respond({ status: 200, contentType: 'application/json', body: '{}' })
    }
    return req.continue()
  } catch (e) {
    try { req.continue() } catch {}
  }
})

await page.evaluateOnNewDocument((fixed) => {
  const RealDate = Date
  class FrozenDate extends RealDate {
    constructor(...a) {
      if (a.length === 0) super(fixed)
      else super(...a)
    }
    static now() {
      return fixed
    }
  }
  window.Date = FrozenDate
}, FIXED_NOW)
await page.evaluateOnNewDocument(() => {
  try {
    localStorage.setItem('arrivo.theme', 'light')
  } catch {}
})

const api = (method, url, body) =>
  page.evaluate(
    async (m, u, b) => {
      const r = await fetch(u, {
        method: m,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: b ? JSON.stringify(b) : undefined,
      })
      return { status: r.status, body: await r.json().catch(() => null) }
    },
    method,
    url,
    body,
  )

const rect = (sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }
  }, sel)

const shot = async (name, clip) => {
  const file = path.join(OUT, name)
  const opts = { path: file, type: 'jpeg', quality: 92 }
  if (clip) {
    opts.clip = clip
    opts.captureBeyondViewport = true
  }
  await page.screenshot(opts)
  console.log('shot', name)
}

// Instant scroll (Lenis is off under reduced motion, so native scroll is exact).
const scrollToY = async (y) => {
  await page.evaluate((v) => window.scrollTo(0, v), y)
  await sleep(400)
}
const absTop = (sel) =>
  page.evaluate((s) => document.querySelector(s).getBoundingClientRect().top + window.scrollY, sel)

const clickSel = async (sel) => {
  const r = await rect(sel)
  if (!r) throw new Error('no element ' + sel)
  await page.mouse.click(r.cx, r.cy)
  return r
}

const clickByText = async (scope, text) => {
  const r = await page.evaluate(
    (sc, t) => {
      const el = [...document.querySelectorAll(sc)].find((b) => b.textContent.trim() === t)
      if (!el) return null
      const q = el.getBoundingClientRect()
      return { x: q.left, y: q.top, w: q.width, h: q.height, cx: q.left + q.width / 2, cy: q.top + q.height / 2 }
    },
    scope,
    text,
  )
  if (!r) throw new Error(`no "${text}" in ${scope}`)
  await page.mouse.click(r.cx, r.cy)
  return r
}

try {
  await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 60000 })
  await page.evaluate(() => document.fonts.ready)
  await sleep(3500)

  /* ---------------- hero ---------------- */
  await scrollToY(0)
  await sleep(600)
  await shot('hero_light.jpg')
  coords.hero = {
    toggle: await rect('.theme-btn'),
    logo: await rect('.nav-logo .logo'),
    title: await rect('.hero-title'),
    seatmap: await rect('.seatmap'),
    road: await rect('.sm-road'),
  }
  // a free seat in row A, near the middle of the strip
  coords.hero.seat = await page.evaluate(() => {
    const seats = [...document.querySelectorAll('.sm-rows .sm-bays')[0].querySelectorAll('.seat')]
    const order = [7, 8, 6, 9, 5, 10, 4, 11, 3, 12]
    for (const i of order) {
      const s = seats[i]
      if (s && s.classList.contains('is-free')) {
        const r = s.getBoundingClientRect()
        return { i, x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }
      }
    }
    return null
  })

  await clickSel('.theme-btn')
  await sleep(900)
  await page.mouse.move(5, 5)
  await sleep(300)
  await shot('hero_dark.jpg')

  /* ---------------- lot, dark ---------------- */
  const mapY = Math.round((await absTop('#lot-map')) - 92)
  coords.mapScrollY = mapY
  await scrollToY(mapY)
  await sleep(2600) // map reveal
  await page.mouse.move(5, 5)
  await sleep(200)
  await shot('map_dark.jpg')
  const btn3d = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.map-bar .seg button')].find((x) => x.textContent.trim() === '3D')
    const r = b.getBoundingClientRect()
    return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }
  })
  coords.map = {
    toggle: await rect('.theme-btn'),
    btn3d,
    stage: await rect('.map-stage'),
    card: await rect('.map-card'),
    panel: await rect('.panel'),
  }
  await clickByText('.map-bar .seg button', '3D')
  await sleep(2400)
  await page.mouse.move(5, 5)
  await sleep(200)
  await shot('map_dark_3d.jpg')

  /* ---------------- lot, light + lens ---------------- */
  await clickByText('.map-bar .seg button', 'Plan')
  await sleep(1800)
  await clickSel('.theme-btn')
  await sleep(900)
  await page.mouse.move(5, 5)
  await sleep(400)
  await shot('map_light.jpg')
  await page.evaluate(() => {
    for (const q of ['.lens', '.lens-hint']) document.querySelector(q).style.visibility = 'hidden'
  })
  await sleep(200)
  await shot('map_light_nolens.jpg')
  await page.evaluate(() => {
    for (const q of ['.lens', '.lens-hint']) document.querySelector(q).style.visibility = ''
  })
  await sleep(200)

  const lens = await page.evaluate(() => {
    const g = document.querySelector('.lens-glass').getBoundingClientRect()
    const l = document.querySelector('.lens').getBoundingClientRect()
    return {
      glass: { x: g.left, y: g.top, w: g.width, h: g.height, cx: g.left + g.width / 2, cy: g.top + g.height / 2 },
      box: { x: l.left, y: l.top, w: l.width, h: l.height },
    }
  })
  coords.lens = lens
  // target: a free bay in row C (top band in landscape), as central as possible
  // bays in row C that are free now and stay free for at least 3.5 h (room for a 3 h booking)
  const nowMs = FIXED_NOW
  const day = seededDay(nowMs)
  const roomy = SLOT_IDS.filter((sid) => {
    if (!sid.startsWith('C-')) return false
    const list = day.bookings.filter((b) => b.bayId === sid)
    if (list.some((b) => b.start <= nowMs && nowMs < b.end)) return false
    const next = list.filter((b) => b.start > nowMs).sort((a, b) => a.start - b.start)[0]
    return !next || next.start - nowMs >= 210 * 60000
  })
  console.log('roomy C bays', roomy.join(' '))
  const stateOf = (sid) => {
    const list = day.bookings.filter((b) => b.bayId === sid)
    const cur = list.find((b) => b.start <= nowMs && nowMs < b.end)
    const next = list.filter((b) => b.start > nowMs).sort((a, b) => a.start - b.start)[0]
    const status = cur ? (cur.end - nowMs <= 20 * 60000 ? 'ending' : 'taken') : next && next.start - nowMs <= 30 * 60000 ? 'held' : 'free'
    return { status, freeUntil: cur ? null : next ? next.start : day.start + DAY, end: cur ? cur.end : null }
  }
  coords.bays = await page.evaluate(() =>
    [...document.querySelectorAll('.plan-base .bay')].map((b) => {
      const r = b.getBoundingClientRect()
      return { id: b.dataset.id, status: b.dataset.status, cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height }
    }),
  )
  const hhmm = (t) => new Date(t).toTimeString().slice(0, 5)
  coords.states = Object.fromEntries(SLOT_IDS.map((sid) => { const x = stateOf(sid); return [sid, { ...x, freeUntilHHMM: x.freeUntil ? hhmm(x.freeUntil) : null, endHHMM: x.end ? hhmm(x.end) : null }] }))
  coords.captureNow = nowMs
  coords.target = await page.evaluate((ok) => {
    const stage = document.querySelector('.map-stage').getBoundingClientRect()
    const mid = stage.left + stage.width * 0.55
    const free = [...document.querySelectorAll('.plan-base .bay.is-free')].filter((b) => ok.includes(b.dataset.id))
    let best = null
    for (const b of free) {
      const r = b.getBoundingClientRect()
      const d = Math.abs(r.left + r.width / 2 - mid)
      if (!best || d < best.d) best = { d, b, r }
    }
    if (!best) return null
    const r = best.r
    return { id: best.b.dataset.id, x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }
  }, roomy)
  // a couple of waypoints for the drag: other bays on rows A and C
  coords.waypoints = await page.evaluate((tid) => {
    const pick = (id) => {
      const el = document.querySelector(`.plan-base [data-id="${id}"]`)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { id, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }
    }
    return { a10: pick('A-10'), a20: pick('A-20'), c18: pick('C-18'), c12: pick('C-12'), e12: pick('E-12') }
  }, coords.target.id)
  console.log('target bay', coords.target.id)

  // real lens drag: grab the glass at its centre, carry it over the target bay
  await page.mouse.move(lens.glass.cx, lens.glass.cy)
  await page.mouse.down()
  const steps = 24
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    await page.mouse.move(
      lens.glass.cx + (coords.target.cx - lens.glass.cx) * t,
      lens.glass.cy + (coords.target.cy - lens.glass.cy) * t,
    )
    await sleep(25)
  }
  await sleep(700)
  coords.readout = await page.evaluate(() => {
    const el = document.querySelector('.lens-read')
    const r = el.getBoundingClientRect()
    return {
      text: el.innerText,
      top: el.querySelector('.lr-top')?.innerText,
      sub: el.querySelector('.lr-sub')?.innerText,
      counts: [...el.querySelectorAll('.lr-counts > span')].map((s) => s.innerText.trim()),
      hint: el.querySelector('.lr-hint')?.innerText,
      x: r.left,
      y: r.top,
      w: r.width,
      h: r.height,
    }
  })
    await page.mouse.up()
  await sleep(2000)
  await page.mouse.move(5, 5)
  await sleep(300)
  await shot('map_light_selected.jpg')
  await page.evaluate(() => {
    for (const q of ['.lens', '.lens-hint']) document.querySelector(q).style.visibility = 'hidden'
  })
  await sleep(200)
  await shot('map_light_selected_nolens.jpg')
  await page.evaluate(() => {
    for (const q of ['.lens', '.lens-hint']) document.querySelector(q).style.visibility = ''
  })
  await sleep(200)

  /* ---------------- booking ---------------- */
  coords.panel = { rect: await rect('.panel') }
  coords.panel.chips = await page.evaluate(() =>
    [...document.querySelectorAll('.panel .bk fieldset')].map((f) =>
      [...f.querySelectorAll('button.chip')].map((b) => {
        const r = b.getBoundingClientRect()
        return { t: b.textContent.trim(), off: b.classList.contains('is-off'), on: b.classList.contains('is-on'), cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height }
      }),
    ),
  )
  const stays = coords.panel.chips[1] || []
  const want = ['3 h', '2 h', '4 h', '1 h'].find((t) => stays.some((c) => c.t === t && !c.off))
  coords.panel.stay = want
  if (want && !stays.find((c) => c.t === want).on) {
    await clickByText('.panel .bk fieldset:nth-of-type(2) button.chip', want)
    await sleep(900)
  }
  await page.mouse.move(5, 5)
  await sleep(300)
  await shot('panel_stay.jpg')
  coords.panel.field = await page.evaluate(() => {
    const f = document.querySelector('.panel .field')
    const r = f.getBoundingClientRect()
    const cs = getComputedStyle(f)
    return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2, pl: parseFloat(cs.paddingLeft), font: cs.font, ls: cs.letterSpacing, color: cs.color, bg: cs.backgroundColor }
  })
  coords.panel.hold = await page.evaluate(() => {
    const b = document.querySelector('.panel .bk-go .btn')
    const r = b.getBoundingClientRect()
    return { text: b.innerText.trim(), x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }
  })
  coords.panel.summary = await page.evaluate(() => document.querySelector('.panel .sum')?.innerText)

  await clickSel('.panel .field')
  await page.mouse.move(5, 5)
  await sleep(350)
  await shot('panel_focus.jpg')
  await page.keyboard.type(PLATE, { delay: 40 })
  await sleep(400)
  await shot('panel_typed.jpg')

  await clickSel('.panel .bk-go .btn')
  await page.mouse.move(5, 5)
  await sleep(250)
  await shot('panel_holding.jpg')
  await sleep(2600)
  await shot('ticket_light.jpg')
  coords.ticket = {
    card: await rect('.panel .ticket'),
    head: await rect('.panel .done-head'),
    text: await page.evaluate(() => document.querySelector('.panel .ticket')?.innerText),
  }
  await page.evaluate(() => (document.querySelector('.panel .ticket').style.visibility = 'hidden'))
  await sleep(200)
  await shot('ticket_nocard.jpg')
  await page.evaluate(() => (document.querySelector('.panel .ticket').style.visibility = ''))

  // nothing to undo: the booking went to the intercepted API, not the server

  /* ---------------- list, both themes ---------------- */
  await page.addStyleTag({ content: '.lt-body{max-height:none!important;overflow:visible!important}' })
  const listTop = Math.round(await absTop('#all-bays'))
  await scrollToY(listTop - 60)
  await sleep(800)
  const listH = 2160
  const clip = { x: 0, y: listTop - 60, width: W, height: listH }
  coords.list = { clipY: clip.y, h: listH }
  await page.mouse.move(5, 5)
  await shot('list_light.jpg', clip)
  await clickSel('.theme-btn')
  await sleep(900)
  await page.mouse.move(5, 5)
  await sleep(300)
  await shot('list_dark.jpg', clip)
  await clickSel('.theme-btn')
  await sleep(900)

  /* ---------------- x-ray of the whole plan (light), at 4x ---------------- */
  // a fresh page, so the x-ray shows the lot before our test booking (C-10 free, not "yours")
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 4 })
  await page.reload({ waitUntil: 'networkidle2' })
  await page.evaluate(() => document.fonts.ready)
  await sleep(2500)
  await scrollToY(mapY)
  await sleep(1500)
  const stage = await page.evaluate(() => {
    const st = document.querySelector('.map-stage')
    const r = st.getBoundingClientRect()
    // a static copy of the lens's x-ray clone, laid flat over the stage at 1:1
    const copy = document.querySelector('.lens .lens-inner').cloneNode(true)
    copy.style.cssText = `position:absolute;left:0;top:0;z-index:60;transform:none;border-radius:14px;overflow:hidden;width:${r.width}px;height:${r.height}px`
    const sc = copy.querySelector('.lens-scale')
    sc.style.cssText = 'position:absolute;inset:0;transform:none;transform-origin:0 0'
    st.appendChild(copy)
    for (const s of ['.lens', '.lens-hint', '.map-tip', '.lens-read', '.map-hud-n']) {
      const el = document.querySelector(s)
      if (el) el.style.visibility = 'hidden'
    }
    return { x: r.left, y: r.top, w: r.width, h: r.height, sy: window.scrollY }
  })
  await sleep(600)
  coords.xray = stage
  await shot('xray_light.jpg', {
    x: stage.x,
    y: stage.y + stage.sy,
    width: stage.w,
    height: stage.h,
  })
} finally {
  fs.writeFileSync(path.join(OUT, 'coords.json'), JSON.stringify(coords, null, 2))
  await browser.close()
}
