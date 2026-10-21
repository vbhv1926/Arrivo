/* Arrivo pitch deck engine.
   A fixed 1920 × 1080 stage, scaled to the window. Each slide declares how it leaves
   (data-trans) and how its pieces arrive (data-a). Scenes run the live bits. */
;(() => {
  const W = 1920
  const H = 1080
  const html = document.documentElement
  const PRINT = html.classList.contains('print')
  const DECK = window.DECK || {}

  gsap.registerPlugin(SplitText, DrawSVGPlugin, CustomEase, ScrambleTextPlugin, MotionPathPlugin)
  CustomEase.create('arr', '0.22,1,0.36,1')
  CustomEase.create('swift', '0.65,0,0.35,1')

  const $ = (s, r = document) => r.querySelector(s)
  const $$ = (s, r = document) => [...r.querySelectorAll(s)]
  const stage = $('#stage')
  const fx = $('#fx')
  const chrome = $('#chrome')
  const slides = $$('.slide')
  const N = slides.length

  /* ------------------------------------------------------------ fit */

  let scale = 1
  function fit() {
    if (PRINT) return
    scale = Math.min(innerWidth / W, innerHeight / H)
    stage.style.transform = `translate(-50%, -50%) scale(${scale})`
  }
  addEventListener('resize', fit)
  fit()

  /* ------------------------------------------------------------ static setup */

  // team
  $$('[data-team]').forEach((el) => (el.textContent = DECK.team || 'Team Arrivo'))
  $$('[data-names]').forEach((el) => (el.textContent = (DECK.members || []).map((m) => m.name).join(' · ')))
  const grid = $('[data-team-grid]')
  if (grid) {
    grid.innerHTML = (DECK.members || [])
      .map((m) => {
        const ini = m.name
          .split(/\s+/)
          .map((p) => p[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()
        return `<div class="member card"><span class="av">${ini}</span><h3>${m.name}</h3><span class="mono role">${m.role}</span><p class="ex"><span class="mono-s sun">explains</span>${m.explains}</p></div>`
      })
      .join('')
  }
  $$('aside.notes').forEach((n) => (n.innerHTML = n.innerHTML.replace('&lt;team&gt;', DECK.team || 'Team Arrivo')))

  // rulers
  const rl = $('[data-ruler]')
  if (rl) for (let v = 64; v < H; v += 64) rl.insertAdjacentHTML('beforeend', `<span style="top:${v}px">${v}</span>`)
  const br = $('[data-bottom-ruler]')
  for (let v = 240; v < W; v += 240) br.insertAdjacentHTML('afterbegin', `<span style="left:${v}px">${v}</span>`)

  // screenshot crops: data-crop="x,y,w,h" of a 1920 × 1080 capture, scaled to cover the box
  $$('[data-shot]').forEach((fig) => {
    const [x, y, w, h] = fig.dataset.crop.split(',').map(Number)
    const bw = fig.offsetWidth || parseFloat(getComputedStyle(fig).width)
    const bh = fig.offsetHeight || parseFloat(getComputedStyle(fig).height)
    const k = Math.max(bw / w, bh / h)
    const crop = document.createElement('div')
    crop.className = 'crop'
    crop.style.backgroundImage = `url(${fig.dataset.shot})`
    crop.style.backgroundSize = `${1920 * k}px auto`
    crop.style.backgroundPosition = `${-x * k}px ${-y * k}px`
    fig.prepend(crop)
  })

  /* ------------------------------------------------------------ scenes */

  const rnd = (a, b) => a + Math.random() * (b - a)
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
  const SVGNS = 'http://www.w3.org/2000/svg'
  const svgEl = (tag, attrs = {}, parent) => {
    const el = document.createElementNS(SVGNS, tag)
    for (const k in attrs) el.setAttribute(k, attrs[k])
    if (parent) parent.appendChild(el)
    return el
  }

  const scenes = {}

  // 01 — live-looking seat map of rows A and C
  scenes.seatmap = {
    init(root) {
      const states = () => pick(['taken', 'taken', 'taken', 'taken', 'ending', 'held', 'free', 'free'])
      $$('[data-row]', root).forEach((row) => {
        for (let i = 0; i < 16; i++) {
          const s = document.createElement('i')
          s.className = `seat is-${states()}`
          row.appendChild(s)
        }
      })
      this.seats = $$('.seat', root)
      this.free = $('[data-free]', root)
    },
    count() {
      const f = this.seats.filter((s) => s.classList.contains('is-free')).length
      this.free.textContent = Math.round((f / 32) * 96)
    },
    enter(root, tl) {
      this.count()
      tl.from(this.seats, { scale: 0.4, autoAlpha: 0, duration: 0.6, ease: 'back.out(2)', stagger: { each: 0.018, from: 'end' } }, 0.9)
      this.iv = setInterval(() => {
        const s = pick(this.seats)
        const order = ['free', 'held', 'taken', 'ending', 'free']
        const cur = order.find((c) => s.classList.contains(`is-${c}`)) || 'free'
        s.className = `seat is-${order[order.indexOf(cur) + 1]}`
        this.count()
      }, 900)
    },
    leave() {
      clearInterval(this.iv)
    },
  }

  // 02 — a full lot and one yellow car going round and round
  scenes.circling = {
    init(root) {
      const svg = $('svg', root)
      const g = svgEl('g', {}, svg)
      svgEl('path', { d: 'M30 300V64a34 34 0 0 1 34-34h632a34 34 0 0 1 34 34v472a34 34 0 0 1-34 34H64a34 34 0 0 1-34-34V380', fill: 'none', stroke: 'var(--line-2)', 'stroke-width': 3 }, g)
      svgEl('text', { x: 46, y: 346, 'font-family': 'IBM Plex Mono', 'font-size': 16, fill: 'var(--ink-4)' }, g).textContent = 'GATE'
      const bays = []
      const bay = (x, y, w, h) => {
        const b = svgEl('g', {}, g)
        svgEl('rect', { x, y, width: w, height: h, rx: 6, fill: 'var(--paper-3)', stroke: 'var(--line)', 'stroke-width': 1.5 }, b)
        const car = svgEl('rect', { x: x + 6, y: y + 9, width: w - 12, height: h - 18, rx: 9, fill: 'var(--car)', opacity: 0.88 }, b)
        bays.push(b)
        return car
      }
      for (let i = 0; i < 15; i++) bay(68 + i * 42, 52, 34, 84)
      for (let i = 0; i < 15; i++) bay(68 + i * 42, 464, 34, 84)
      for (let i = 0; i < 11; i++) bay(152 + i * 42, 230, 34, 70)
      for (let i = 0; i < 11; i++) bay(152 + i * 42, 300, 34, 70)
      const loop = 'M145 185H615a50 50 0 0 1 50 50V365a50 50 0 0 1-50 50H145a50 50 0 0 1-50-50V235a50 50 0 0 1 50-50Z'
      svgEl('path', { d: loop, fill: 'none', stroke: 'var(--sun)', 'stroke-width': 2, 'stroke-dasharray': '6 10', opacity: 0.5, id: 'circ-loop' }, g)
      const car = svgEl('g', {}, g)
      svgEl('rect', { x: -30, y: -15, width: 60, height: 30, rx: 11, fill: '#ffd75a', stroke: '#121214', 'stroke-width': 2 }, car)
      svgEl('rect', { x: 8, y: -11, width: 10, height: 22, rx: 3, fill: '#121214', opacity: 0.75 }, car)
      svgEl('rect', { x: -22, y: -10, width: 7, height: 20, rx: 2, fill: '#121214', opacity: 0.55 }, car)
      const full = svgEl('g', {}, g)
      svgEl('rect', { x: 560, y: 4, width: 180, height: 36, rx: 18, fill: 'var(--sun)' }, full)
      svgEl('text', { x: 650, y: 28, 'text-anchor': 'middle', 'font-family': 'IBM Plex Mono', 'font-size': 16, fill: '#121214' }, full).textContent = 'LOT FULL · 96/96'
      Object.assign(this, { bays, car, loop: $('#circ-loop', root), full, lap: $('[data-lap]', root) })
    },
    enter(root, tl) {
      tl.from(this.bays, { autoAlpha: 0, scale: 0.6, transformOrigin: 'center', duration: 0.5, ease: 'back.out(2)', stagger: { each: 0.012, from: 'random' } }, 0.2)
      tl.from(this.full, { autoAlpha: 0, y: -14, duration: 0.6, ease: 'arr' }, 1.2)
      let laps = 1
      this.lap.textContent = 'lap 01'
      this.loopTl = gsap.to(this.car, {
        motionPath: { path: this.loop, align: this.loop, alignOrigin: [0.5, 0.5], autoRotate: true },
        duration: 6.5,
        ease: 'none',
        repeat: -1,
        delay: 0.6,
        onRepeat: () => (this.lap.textContent = `lap ${String(++laps).padStart(2, '0')}`),
      })
    },
    leave() {
      this.loopTl && this.loopTl.kill()
    },
    print() {
      gsap
        .to(this.car, { motionPath: { path: this.loop, align: this.loop, alignOrigin: [0.5, 0.5], autoRotate: true }, duration: 1 })
        .progress(0.36)
        .kill()
      this.lap.textContent = 'lap 03'
    },
  }

  // 04 — a cinema hall turns into a parking lot, and back
  scenes.morph = {
    init(root) {
      const box = $('.morph', root)
      const n = 50
      const seats = []
      const booked = new Set([1, 2, 5, 9, 11, 13, 14, 18, 20, 22, 23, 27, 31, 33, 36, 38, 41, 44, 46, 47])
      const SEL = 16
      for (let i = 0; i < n; i++) {
        const el = document.createElement('i')
        el.className = 'pc' + (i === SEL ? ' y' : booked.has(i) ? ' b' : '')
        box.appendChild(el)
        seats.push(el)
      }
      const screen = document.createElement('div')
      screen.className = 'screen'
      screen.style.top = '548px'
      screen.innerHTML = '<svg viewBox="0 0 800 60" preserveAspectRatio="none"><path d="M10 50 Q400 0 790 50" fill="none" stroke="var(--ink)" stroke-width="5" stroke-linecap="round"/></svg>'
      const road = document.createElement('div')
      road.className = 'road'
      road.innerHTML = '<span class="mono-s caps">Service road · all bumpers this way</span>'
      const cap = document.createElement('div')
      cap.className = 'cap mono'
      cap.style.top = '650px'
      cap.innerHTML = '<span class="ca">a cinema hall · 50 seats · <b class="sun">1 is yours</b></span>'
      const cap2 = document.createElement('div')
      cap2.className = 'cap mono'
      cap2.style.top = '650px'
      cap2.style.opacity = 0
      cap2.innerHTML = 'a parking lot · 24 bays · <b class="sun">1 is yours</b>'
      const scr = document.createElement('div')
      scr.className = 'cap mono-s caps'
      scr.style.top = '612px'
      scr.textContent = 'screen'
      box.append(road, screen, scr, cap, cap2)

      // layout A: 5 rows × 10, aisle after the 5th seat
      const A = seats.map((_, i) => {
        const r = Math.floor(i / 10)
        const c = i % 10
        return { left: 54 + c * 80 + (c >= 5 ? 30 : 0) - 8, top: 90 + r * 84, width: 62, height: 56, borderRadius: '16px 16px 8px 8px', opacity: 1, scale: 1 }
      })
      // layout B: two rows of 12 bays across a road; the rest step out
      const B = seats.map((_, i) => {
        if (i >= 24) return { ...A[i], opacity: 0, scale: 0.3 }
        const r = Math.floor(i / 12)
        const c = i % 12
        return { left: 58 + c * 68, top: r === 0 ? 182 : 470, width: 56, height: 140, borderRadius: '8px', opacity: 1, scale: 1 }
      })
      seats.forEach((s, i) => gsap.set(s, A[i]))
      Object.assign(this, { box, seats, A, B, screen, road, cap, cap2, scr })
    },
    enter(root, tl) {
      const { seats, A, B, box } = this
      tl.from(seats, { autoAlpha: 0, y: 30, duration: 0.6, ease: 'arr', stagger: { each: 0.01, from: 'start' } }, 0.3)
      tl.from([this.screen, this.scr, this.cap], { autoAlpha: 0, y: 14, duration: 0.6, ease: 'arr', stagger: 0.08 }, 0.6)
      const loop = gsap.timeline({ repeat: -1, repeatDelay: 1.6, paused: true })
      loop.add(() => box.classList.add('lot'), 0.55)
      seats.forEach((s, i) => loop.to(s, { ...B[i], duration: 1.3, ease: 'swift' }, i * 0.012))
      loop.to([this.screen, this.scr, this.cap], { autoAlpha: 0, duration: 0.5 }, 0)
      loop.to([this.road, this.cap2], { autoAlpha: 1, duration: 0.6 }, 0.6)
      loop.to({}, { duration: 2.6 })
      const back = loop.duration()
      loop.add(() => box.classList.remove('lot'), back + 0.4)
      seats.forEach((s, i) => loop.to(s, { ...A[i], duration: 1.2, ease: 'swift' }, back + i * 0.01))
      loop.to([this.road, this.cap2], { autoAlpha: 0, duration: 0.4 }, back)
      loop.to([this.screen, this.scr, this.cap], { autoAlpha: 1, duration: 0.6 }, back + 0.6)
      this.loop = loop
      // start once the slide has finished arriving, so the two never fight over the same props
      tl.add(() => loop.play(0), 2)
    },
    leave() {
      this.loop && this.loop.kill()
      this.box.classList.remove('lot')
      this.seats.forEach((s, i) => gsap.set(s, this.A[i]))
      gsap.set([this.screen, this.scr, this.cap], { autoAlpha: 1 })
      gsap.set([this.road, this.cap2], { autoAlpha: 0 })
    },
    print() {
      this.box.classList.add('lot')
      this.seats.forEach((s, i) => gsap.set(s, this.B[i]))
      gsap.set([this.screen, this.scr, this.cap], { autoAlpha: 0 })
      gsap.set([this.road, this.cap2], { autoAlpha: 1 })
    },
  }

  // 07 — bays placed on the satellite photo's own pixels
  const ROWS = [
    { id: 'A', axis: 'v', line: 547, from: 270, to: 910, count: 33, depth: 38, dir: -1 },
    { id: 'B', axis: 'v', line: 574, from: 300, to: 490, count: 10, depth: 32, dir: 1 },
    { id: 'C', axis: 'v', line: 578, from: 548, to: 1010, count: 24, depth: 38, dir: 1 },
    { id: 'D', axis: 'v', line: 631, from: 962, to: 1088, count: 6, depth: 36, dir: 1 },
    { id: 'E', axis: 'h', line: 1085, from: 80, to: 532, count: 23, depth: 38, dir: -1 },
  ]
  const MARKED = [
    [556, 272, 542, 915],
    [576, 305, 579, 495],
    [578, 550, 576, 1015],
    [633, 960, 628, 1090],
    [77, 1080, 530, 1096],
  ]
  scenes.lot = {
    init(root) {
      const svg = $('svg', root)
      const defs = svgEl('defs', {}, svg)
      const lg = svgEl('linearGradient', { id: 'scan-g', x1: 0, y1: 0, x2: 0, y2: 1 }, defs)
      svgEl('stop', { offset: '0', 'stop-color': '#ffd75a', 'stop-opacity': 0 }, lg)
      svgEl('stop', { offset: '0.85', 'stop-color': '#ffd75a', 'stop-opacity': 0.55 }, lg)
      svgEl('stop', { offset: '1', 'stop-color': '#ffd75a', 'stop-opacity': 0.95 }, lg)
      const cp = svgEl('clipPath', { id: 'lot-clip' }, defs)
      svgEl('rect', { x: 30, y: 226, width: 680, height: 930, rx: 18 }, cp)
      const g = svgEl('g', { 'clip-path': 'url(#lot-clip)' }, svg)
      const img = svgEl('image', { href: 'assets/img/kiet-lot.jpg', x: 0, y: 0, width: 784, height: 1601, transform: 'rotate(-1 400 700)', preserveAspectRatio: 'none' }, g)
      const ctx = svgEl('g', {}, g)
      svgEl('rect', { x: 36, y: 232, width: 466, height: 652, rx: 10, class: 'ctx' }, ctx)
      svgEl('path', { d: 'M548 226H577V1094H710V1138H30V1094H548Z', class: 'ctx' }, ctx)
      svgEl('rect', { x: 36, y: 898, width: 500, height: 84, rx: 4, class: 'ctx' }, ctx)
      const lines = MARKED.map(([x1, y1, x2, y2]) => svgEl('line', { x1, y1, x2, y2, class: 'yl' }, g))
      const bays = []
      for (const r of ROWS) {
        const pitch = (r.to - r.from) / r.count
        for (let i = 0; i < r.count; i++) {
          let x, y, w, h
          if (r.axis === 'v') {
            y = r.from + i * pitch + 1.3
            h = pitch - 2.6
            w = r.depth
            x = r.dir < 0 ? r.line - r.depth : r.line
          } else {
            x = r.from + i * pitch + 1.3
            w = pitch - 2.6
            h = r.depth
            y = r.dir < 0 ? r.line - r.depth : r.line
          }
          const b = svgEl('rect', { x, y, width: w, height: h, rx: 2.5, class: 'bay' }, g)
          b._cy = y + h / 2
          bays.push(b)
        }
      }
      const badges = ROWS.map((r) => {
        const x = r.axis === 'v' ? r.line + (r.dir * r.depth) / 2 : r.from - 16
        const y = r.axis === 'v' ? r.from - 15 : r.line - r.depth / 2
        const b = svgEl('g', { class: 'badge' }, g)
        svgEl('circle', { cx: x, cy: y, r: 10 }, b)
        svgEl('text', { x, y: y + 4, 'text-anchor': 'middle' }, b).textContent = r.id
        return b
      })
      const scan = svgEl('rect', { x: 30, y: 106, width: 680, height: 120, class: 'scan' }, g)
      svgEl('rect', { x: 30, y: 226, width: 680, height: 930, rx: 18, class: 'frame' }, svg)
      Object.assign(this, { img, ctx, lines, bays, badges, scan })
    },
    enter(root, tl) {
      const { img, ctx, lines, bays, badges, scan } = this
      tl.fromTo(img, { opacity: 0, scale: 1.06, transformOrigin: '400px 700px' }, { opacity: 1, scale: 1, duration: 1.1, ease: 'arr' }, 0.1)
      tl.from(lines, { drawSVG: '0%', duration: 0.9, ease: 'swift', stagger: 0.1 }, 0.6)
      tl.fromTo(scan, { attr: { y: 106 } }, { attr: { y: 1156 }, duration: 1.8, ease: 'none' }, 1.2)
      bays.forEach((b) => {
        tl.from(b, { opacity: 0, scale: 0, transformOrigin: 'center', transformBox: 'fill-box', duration: 0.45, ease: 'back.out(2.2)' }, 1.2 + 1.8 * ((b._cy - 226) / 930))
      })
      tl.set(scan, { opacity: 0 }, 3.05)
      tl.to(img, { opacity: 0.4, duration: 1, ease: 'arr' }, 3.1)
      tl.to(lines, { opacity: 0.35, duration: 1 }, 3.1)
      tl.from($$('rect, path', ctx), { drawSVG: '0%', duration: 1.2, ease: 'swift', stagger: 0.12 }, 3.1)
      tl.from(badges, { scale: 0, transformOrigin: 'center', transformBox: 'fill-box', duration: 0.5, ease: 'back.out(2.5)', stagger: 0.08 }, 3.3)
    },
  }

  // 08 — three screens fan in, then drift
  scenes.fan = {
    init(root) {
      this.shots = $$('.shot', root)
    },
    enter(root, tl) {
      const [a, b, c] = this.shots
      tl.from(a, { rotateY: 24, rotateX: 6, x: -160, z: -300, autoAlpha: 0, duration: 1.3, ease: 'arr' }, 0.3)
      tl.from(b, { rotateY: -28, x: 200, z: -300, autoAlpha: 0, duration: 1.3, ease: 'arr' }, 0.45)
      tl.from(c, { rotateY: -28, x: 200, z: -300, autoAlpha: 0, duration: 1.3, ease: 'arr' }, 0.6)
      tl.from($$('figcaption', root), { autoAlpha: 0, y: 12, duration: 0.6, ease: 'arr', stagger: 0.1 }, 1.3)
      this.float = gsap.to(this.shots, { y: '+=12', duration: 3.2, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: 0.7, delay: 1.8 })
      this.pan = gsap.to($$('.crop', root), { scale: 1.06, duration: 9, ease: 'sine.inOut', yoyo: true, repeat: -1 })
    },
    leave() {
      this.float && this.float.kill()
      this.pan && this.pan.kill()
      gsap.set(this.shots, { y: 0 })
    },
  }

  // 09 — the bay pass prints in
  scenes.pass = {
    init(root) {
      this.el = root
    },
    enter(root, tl) {
      tl.fromTo(root, { clipPath: 'inset(0% 0% 100% 0% round 20px)', y: -40 }, { clipPath: 'inset(0% 0% 0% 0% round 20px)', y: 0, duration: 1.5, ease: 'power3.out' }, 1.1)
    },
  }

  // 10 — screens cycle, and the deck checks whether the live server is up
  scenes.demo = {
    init(root) {
      this.imgs = $$('.scr img', root)
      this.status = $('[data-live-status]')
    },
    enter() {
      let i = 0
      this.iv = setInterval(() => {
        this.imgs[i].classList.remove('on')
        i = (i + 1) % this.imgs.length
        this.imgs[i].classList.add('on')
      }, 2600)
      this.imgs.forEach((im) => (im.style.transition = 'opacity .9s'))
      if (PRINT) {
        this.status.innerHTML = '<span class="live-dot on"></span>live demo on the KIET lot, during the talk'
        return
      }
      checkLive().then((up) => {
        this.status.innerHTML = up
          ? '<span class="live-dot on"></span>server is up · press L to open it here'
          : '<span class="live-dot"></span>server is off · run <b>python server.py</b> in backend/'
      })
    },
    leave() {
      clearInterval(this.iv)
    },
  }

  // 12 — packets travel the wires
  scenes.arch = {
    init(root) {
      const svg = $('svg', root)
      this.wires = $$('.wire', svg)
      this.labels = $$('.wl', svg)
      const pk = (cls) => svgEl('circle', { r: 9, class: `pk ${cls}`, opacity: 0 }, svg)
      Object.assign(this, { svg, p1: pk(''), p2: pk(''), p3: pk('y'), p4: pk('y') })
    },
    enter(root, tl) {
      tl.from(this.wires, { drawSVG: '0%', duration: 1.1, ease: 'swift', stagger: 0.12 }, 0.6)
      tl.from(this.labels, { autoAlpha: 0, duration: 0.6, stagger: 0.1 }, 1.2)
      const mp = (el, id, dur, start, extra = {}) => ({ motionPath: { path: `#${id}`, align: `#${id}`, alignOrigin: [0.5, 0.5], ...extra }, duration: dur, ease: 'power1.inOut' })
      const loop = gsap.timeline({ repeat: -1, repeatDelay: 1.2, delay: 2 })
      loop.set(this.p1, { opacity: 1 })
      loop.to(this.p1, mp(this.p1, 'w-req', 0.9))
      loop.set(this.p1, { opacity: 0 })
      loop.set(this.p2, { opacity: 1 })
      loop.to(this.p2, mp(this.p2, 'w-db', 0.7))
      loop.to(this.p2, { ...mp(this.p2, 'w-db', 0.7, 0, { start: 1, end: 0 }) })
      loop.set(this.p2, { opacity: 0 })
      loop.set([this.p3, this.p4], { opacity: 1 })
      loop.to(this.p3, mp(this.p3, 'w-sse1', 1), '<')
      loop.to(this.p4, mp(this.p4, 'w-sse2', 1), '<')
      loop.set([this.p3, this.p4], { opacity: 0 })
      this.loop = loop
    },
    leave() {
      this.loop && this.loop.kill()
      gsap.set([this.p1, this.p2, this.p3, this.p4], { opacity: 0 })
    },
  }

  // init scenes once
  $$('[data-scene]').forEach((el) => {
    const s = scenes[el.dataset.scene]
    if (s && s.init) s.init(el)
  })

  /* ------------------------------------------------------------ build-ins */

  const fmtNum = (v, el) => {
    const dec = +(el.dataset.dec || 0)
    let t = v.toFixed(dec)
    if (el.dataset.sep) t = Number(t).toLocaleString('en-IN')
    return t
  }

  function prepSplits() {
    $$('[data-a="words"]').forEach((el) => {
      el._split = SplitText.create(el, { type: 'words,lines', mask: 'lines', linesClass: 'split-line' })
    })
    $$('[data-a="chars"]').forEach((el) => {
      el._split = SplitText.create(el, { type: 'chars,lines', mask: 'lines', linesClass: 'split-line' })
    })
    $$('[data-a="scramble"]').forEach((el) => {
      $$('span', el).forEach((sp) => {
        if (!sp.children.length && sp.textContent.trim()) sp._text = sp.textContent
      })
      if (!el.children.length) el._text = el.textContent
    })
  }

  function build(slide, delay = 0) {
    const tl = gsap.timeline({ delay, paused: false })
    $$('[data-a]', slide).forEach((el) => {
      const a = el.dataset.a
      const d = +(el.dataset.d || 0)
      if (a === 'words' && el._split) tl.from(el._split.words, { yPercent: 118, rotate: 4, duration: 1.15, ease: 'arr', stagger: 0.045 }, d)
      else if (a === 'chars' && el._split) tl.from(el._split.chars, { yPercent: 125, duration: 1.1, ease: 'arr', stagger: 0.03 }, d)
      else if (a === 'rise') tl.from(el, { y: 44, autoAlpha: 0, duration: 1.05, ease: 'arr' }, d)
      else if (a === 'fade') tl.from(el, { autoAlpha: 0, duration: 0.9 }, d)
      else if (a === 'pop') tl.from(el, { scale: 0.5, autoAlpha: 0, duration: 0.8, ease: 'back.out(1.8)' }, d)
      else if (a === 'line') tl.from(el, { scaleX: 0, transformOrigin: 'left center', duration: 1.3, ease: 'swift' }, d)
      else if (a === 'stagger') tl.from(el.children, { y: 40, autoAlpha: 0, duration: 0.95, ease: 'arr', stagger: +(el.dataset.s || 0.08) }, d)
      else if (a === 'draw') {
        const parts = el.matches('svg') ? $$('path, line, rect, circle, polyline', el) : [el]
        tl.from(parts, { drawSVG: '0%', duration: 1.2, ease: 'swift', stagger: 0.05 }, d)
        const txt = $$('text', el)
        if (txt.length) tl.from(txt, { autoAlpha: 0, duration: 0.5, stagger: 0.05 }, d + 0.6)
      } else if (a === 'clip') {
        tl.fromTo(el, { clipPath: 'inset(100% 0% 0% 0% round 20px)' }, { clipPath: 'inset(0% 0% 0% 0% round 20px)', duration: 1.3, ease: 'swift' }, d)
        const c = $('.crop', el)
        if (c) tl.from(c, { scale: 1.15, duration: 1.6, ease: 'arr' }, d)
      } else if (a === 'count') {
        const o = { v: 0 }
        const to = parseFloat(el.dataset.to)
        el.textContent = fmtNum(0, el)
        tl.to(o, { v: to, duration: 1.7, ease: 'power3.out', onUpdate: () => (el.textContent = fmtNum(o.v, el)) }, d)
      } else if (a === 'scramble') {
        const parts = $$('span', el).filter((sp) => sp._text)
        const list = parts.length ? parts : el._text ? [el] : []
        tl.from(el, { autoAlpha: 0, duration: 0.3 }, d)
        list.forEach((sp, i) =>
          tl.to(sp, { duration: 1, scrambleText: { text: sp._text, chars: 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789·', speed: 0.7 } }, d + i * 0.08),
        )
      }
    })
    $$('[data-vline]', slide).forEach((el) => tl.from(el, { scaleY: 0, transformOrigin: 'top', duration: 1.3, ease: 'swift' }, +(el.dataset.d || 0)))
    const dot = $('[data-dot]', slide)
    if (dot) tl.from(dot, { y: -420, duration: 1.2, ease: 'bounce.out' }, 1.1)
    $$('[data-scene]', slide).forEach((el) => {
      const s = scenes[el.dataset.scene]
      if (s && s.enter) s.enter(el, tl)
    })
    if (slide.dataset.scene && scenes[slide.dataset.scene]) scenes[slide.dataset.scene].enter(slide, tl)
    return tl
  }

  function leave(slide, tl) {
    if (tl) tl.progress(1).kill()
    $$('[data-scene]', slide).forEach((el) => {
      const s = scenes[el.dataset.scene]
      if (s && s.leave) s.leave(el)
    })
  }

  /* ------------------------------------------------------------ transitions */

  const show = (el, z) => {
    el.classList.add('is-on')
    el.style.zIndex = z
  }
  const div = (cls, html = '') => {
    const d = document.createElement('div')
    d.className = cls
    d.innerHTML = html
    fx.appendChild(d)
    return d
  }
  function logoDot() {
    const d = $('[data-logo-dot]').getBoundingClientRect()
    const s = stage.getBoundingClientRect()
    return { x: (d.left + d.width / 2 - s.left) / scale, y: (d.top + d.height / 2 - s.top) / scale }
  }
  const far = (x, y) => Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) + 60

  const T = {}

  // ink (or paper) floods out of a point
  T.flood = (from, to, o) => {
    const { x, y } = o.index === 0 ? logoDot() : { x: +(from.dataset.fx || W / 2), y: +(from.dataset.fy || H / 2) }
    const R = far(x, y)
    show(to, 3)
    from.style.zIndex = 2
    const ring = document.createElementNS(SVGNS, 'svg')
    ring.setAttribute('class', 'fx-ring')
    ring.setAttribute('width', W)
    ring.setAttribute('height', H)
    const c = svgEl('circle', { cx: x, cy: y, r: 0, fill: 'none', stroke: '#ffd75a', 'stroke-width': 6 }, ring)
    fx.appendChild(ring)
    const tl = gsap.timeline()
    tl.fromTo(to, { clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${R}px at ${x}px ${y}px)`, duration: 1.35, ease: 'expo.inOut' }, 0)
    tl.to(c, { attr: { r: R }, duration: 1.35, ease: 'expo.inOut' }, 0)
    tl.to(ring, { opacity: 0, duration: 0.3 }, 1.1)
    tl.to(from, { scale: 0.9, duration: 1.35, ease: 'expo.inOut' }, 0)
    tl.add(() => ring.remove())
    return { tl, at: 0.7 }
  }

  // parking bays fill the screen from the gate corner, then clear
  const COLS = 16
  const ROWS_G = 9
  let gridFx = null
  function gridEl() {
    if (gridFx) return gridFx
    const el = div('fx-grid')
    const bs = []
    for (let r = 0; r < ROWS_G; r++)
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement('span')
        cell.className = 'cell'
        Object.assign(cell.style, { left: `${(c * W) / COLS}px`, top: `${(r * H) / ROWS_G}px`, width: `${W / COLS}px`, height: `${H / ROWS_G}px` })
        const b = document.createElement('b')
        cell.appendChild(b)
        el.appendChild(cell)
        bs.push(b)
      }
    gridFx = { el, bs }
    return gridFx
  }
  T.grid = (from, to, o) => {
    const g = gridEl()
    const dark = to.dataset.theme === 'dark'
    const bg = dark ? '#060608' : '#f4f4f1'
    g.bs.forEach((b) => {
      const r = Math.random()
      b.style.setProperty('--c', r < 0.11 ? '#ffd75a' : bg)
      b.style.setProperty('--o', dark ? 'rgba(237,237,233,.16)' : 'rgba(18,18,20,.16)')
      const car = r > 0.58 && r < 0.97
      b.style.setProperty('--car', car ? (dark ? '#c9c9d2' : '#1c1c1f') : 'transparent')
      b.style.setProperty('--glass', car ? (dark ? '#7a7a84' : '#55585f') : 'transparent')
    })
    from.style.zIndex = 2
    const origin = o.dir > 0 ? 'end' : 'start'
    const tl = gsap.timeline()
    tl.set(g.el, { visibility: 'visible' })
    tl.fromTo(g.bs, { scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, duration: 0.5, ease: 'power3.in', stagger: { grid: [ROWS_G, COLS], from: origin, amount: 0.6 } }, 0)
    tl.add(() => {
      from.classList.remove('is-on')
      show(to, 3)
    })
    tl.to(g.bs, { scaleY: 0, transformOrigin: '50% 0%', duration: 0.5, ease: 'power3.out', stagger: { grid: [ROWS_G, COLS], from: origin, amount: 0.6 } }, '+=0.1')
    tl.set(g.el, { visibility: 'hidden' })
    return { tl, at: 1.15 }
  }

  // the magnifier: peek at the next slide through the lens, then fall through it
  T.lens = (from, to) => {
    const x = +(from.dataset.lx || 1260)
    const y = +(from.dataset.ly || 560)
    const R = far(x, y) + 120
    show(to, 3)
    from.style.zIndex = 2
    const lens = div('fx-lens')
    lens.style.left = `${x}px`
    lens.style.top = `${y}px`
    const st = { r: 0 }
    const apply = () => {
      to.style.clipPath = `circle(${st.r}px at ${x}px ${y}px)`
      lens.style.transform = `scale(${Math.max(st.r, 0.001) / 120})`
    }
    apply()
    const tl = gsap.timeline({ onUpdate: apply })
    tl.to(st, { r: 120, duration: 0.6, ease: 'back.out(1.6)' })
    tl.to(st, { r: 128, duration: 0.4, ease: 'sine.inOut' })
    tl.to(st, { r: R, duration: 0.95, ease: 'expo.in' })
    tl.to(lens, { opacity: 0, duration: 0.35 }, '-=0.4')
    tl.to(from, { scale: 1.08, duration: 0.95, ease: 'expo.in' }, '<-0.6')
    tl.add(() => lens.remove())
    return { tl, at: 0.2 }
  }

  // a measuring guide sweeps across and draws the next slide behind it
  T.wipe = (from, to) => {
    show(to, 3)
    from.style.zIndex = 2
    const w = div('fx-wipe', '<span class="v"></span><span class="tag"></span>')
    const tag = $('.tag', w)
    const st = { x: 0 }
    const apply = () => {
      to.style.clipPath = `inset(0 ${W - st.x}px 0 0)`
      w.style.left = `${st.x}px`
      tag.textContent = `x ${String(Math.round(st.x)).padStart(4, '0')} / 1920`
    }
    apply()
    const tl = gsap.timeline({ onUpdate: apply })
    tl.to(st, { x: W, duration: 1.35, ease: 'expo.inOut' })
    tl.to(from, { x: -120, duration: 1.35, ease: 'expo.inOut' }, 0)
    tl.add(() => w.remove())
    return { tl, at: 0.7 }
  }

  // a car drives across and pulls the next slide in behind it
  T.drive = (from, to) => {
    show(to, 3)
    from.style.zIndex = 2
    const car = div('fx-car')
    car.innerHTML = `<svg viewBox="0 0 340 160" width="340" height="160">
      <g opacity=".5" stroke="#d9a91a" stroke-width="4" stroke-linecap="round">
        <path d="M0 50h70M10 80h90M0 110h60"/>
      </g>
      <rect x="90" y="22" width="240" height="116" rx="42" fill="#ffd75a" stroke="#121214" stroke-width="4"/>
      <rect x="236" y="34" width="40" height="92" rx="12" fill="#121214" opacity=".82"/>
      <rect x="118" y="38" width="30" height="84" rx="10" fill="#121214" opacity=".6"/>
      <rect x="170" y="44" width="56" height="72" rx="12" fill="#ffe48f"/>
    </svg>`
    car.style.top = '560px'
    const st = { x: -280 }
    const apply = () => {
      car.style.left = `${st.x}px`
      to.style.clipPath = `inset(0 ${Math.max(0, W - (st.x - 120))}px 0 0)`
    }
    apply()
    const tl = gsap.timeline({ onUpdate: apply })
    tl.to(st, { x: W + 300, duration: 1.6, ease: 'power2.inOut' })
    tl.to(car, { rotate: 2.5, duration: 0.25, yoyo: true, repeat: 5, ease: 'sine.inOut' }, 0)
    tl.to(from, { x: 80, duration: 1.6, ease: 'power2.inOut' }, 0)
    tl.add(() => car.remove())
    return { tl, at: 0.85 }
  }

  // the slide tears along a perforation, like a ticket stub
  T.tear = (from, to) => {
    show(to, 1)
    const teeth = []
    for (let x = 0; x <= W; x += 40) teeth.push([x, 540 + ((x / 40) % 2 ? 13 : -13)])
    const pts = (arr) => arr.map(([x, y]) => `${x}px ${y}px`).join(',')
    const a = from.cloneNode(true)
    const b = from.cloneNode(true)
    a.style.clipPath = `polygon(0 0, ${W}px 0, ${pts(teeth.slice().reverse())})`
    b.style.clipPath = `polygon(${pts(teeth)}, ${W}px ${H}px, 0 ${H}px)`
    for (const c of [a, b]) {
      c.classList.add('is-on')
      c.style.zIndex = 5
      stage.insertBefore(c, fx)
    }
    from.classList.remove('is-on')
    const line = div('fx-tear')
    const tl = gsap.timeline()
    tl.fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: 'power2.out' })
    tl.to(line, { opacity: 0, duration: 0.15 })
    tl.to(a, { y: -660, rotate: -5, duration: 0.95, ease: 'power3.in' }, 0.32)
    tl.to(b, { y: 660, rotate: 4, duration: 0.95, ease: 'power3.in' }, 0.38)
    tl.add(() => {
      a.remove()
      b.remove()
      line.remove()
    })
    return { tl, at: 0.55 }
  }

  // going back: a quick slide in from the left
  T.back = (from, to) => {
    show(to, 3)
    from.style.zIndex = 2
    const tl = gsap.timeline()
    tl.fromTo(to, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.9, ease: 'expo.inOut' })
    tl.to(from, { x: 140, duration: 0.9, ease: 'expo.inOut' }, 0)
    return { tl, at: 0.3 }
  }

  /* ------------------------------------------------------------ navigation */

  let index = 0
  let current = null
  let buildTl = null

  const tagPill = $('[data-tag-pill]')
  const countEl = $('[data-count]')
  const dotEl = $('.dot', chrome)
  const dotLabel = $('[data-dot-label]')
  const notesText = $('[data-notes-text]')

  function setChrome(i, animate) {
    const s = slides[i]
    const [group, sub] = (s.dataset.tag || '').split('|')
    tagPill.innerHTML = group ? `<i></i><b>${group}</b>${sub ? ` · ${sub}` : ''}` : ''
    countEl.innerHTML = `<b>${String(i + 1).padStart(2, '0')}</b> / ${String(N).padStart(2, '0')}`
    dotLabel.textContent = s.dataset.name || ''
    const x = 80 + (i / (N - 1)) * (W - 160)
    if (animate) gsap.to(dotEl, { left: x, duration: 1.2, ease: 'expo.inOut' })
    else gsap.set(dotEl, { left: x })
    if (animate && group) gsap.from(tagPill, { autoAlpha: 0, y: -10, duration: 0.6, ease: 'arr' })
    const n = $('aside.notes', s)
    notesText.innerHTML = n ? n.innerHTML : ''
  }
  function setDark(i) {
    chrome.classList.toggle('is-dark', slides[i].dataset.theme === 'dark')
    document.body.style.background = slides[i].dataset.theme === 'dark' ? '#000' : '#0b0b0d'
  }

  function go(to, dir) {
    if (to < 0 || to >= N || to === index) return
    if (current) current.tl.progress(1)
    const from = slides[index]
    const next = slides[to]
    const kind = dir > 0 ? from.dataset.trans || 'grid' : 'back'
    leave(from, buildTl)
    const o = { dir, index }
    index = to
    setChrome(to, true)
    const t = (T[kind] || T.grid)(from, next, o)
    current = t
    gsap.delayedCall(Math.max(0.15, t.at * 0.7), () => setDark(to))
    t.tl.eventCallback('onComplete', () => {
      from.classList.remove('is-on')
      gsap.set(from, { clearProps: 'transform,clipPath,zIndex,opacity,x,y,scale' })
      next.style.clipPath = ''
      next.style.zIndex = 3
      if (current === t) current = null
    })
    buildTl = build(next, t.at)
    history.replaceState(null, '', `#${to + 1}`)
    hideHelp()
  }
  const next = () => go(index + 1, 1)
  const prev = () => go(index - 1, -1)

  /* ------------------------------------------------------------ presenter bits */

  const notes = $('#notes')
  const help = $('#help')
  let helpTimer = setTimeout(hideHelp, 7000)
  function hideHelp() {
    clearTimeout(helpTimer)
    help.style.opacity = 0
  }

  const live = $('#live')
  const frame = $('[data-live-frame]')
  $('[data-live-url]').textContent = DECK.liveUrl
  function openLive() {
    if (!frame.src) frame.src = DECK.liveUrl
    live.classList.add('on')
  }
  function closeLive() {
    live.classList.remove('on')
    window.focus()
  }
  $('[data-close-live]').addEventListener('click', closeLive)
  $$('[data-open-live]').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.stopPropagation()
      openLive()
    }),
  )
  function checkLive() {
    return fetch(`${DECK.liveUrl}/api/health`, { mode: 'no-cors', cache: 'no-store' })
      .then(() => true)
      .catch(() => false)
  }

  addEventListener('keydown', (e) => {
    if (live.classList.contains('on')) {
      if (e.key === 'Escape') closeLive()
      return
    }
    const k = e.key
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(k)) {
      e.preventDefault()
      next()
    } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) {
      e.preventDefault()
      prev()
    } else if (k === 'Home') go(0, -1)
    else if (k === 'End') go(N - 1, 1)
    else if (k === 'f' || k === 'F') {
      if (document.fullscreenElement) document.exitFullscreen()
      else document.documentElement.requestFullscreen().catch(() => {})
    } else if (k === 'n' || k === 'N') notes.classList.toggle('on')
    else if (k === 'l' || k === 'L') openLive()
  })
  stage.addEventListener('click', (e) => {
    if (e.target.closest('button, a')) return
    next()
  })
  stage.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    prev()
  })
  let tx = null
  addEventListener('touchstart', (e) => (tx = e.touches[0].clientX), { passive: true })
  addEventListener('touchend', (e) => {
    if (tx === null) return
    const dx = e.changedTouches[0].clientX - tx
    if (Math.abs(dx) > 50) (dx < 0 ? next : prev)()
    tx = null
  })

  // preload screenshots so transitions never wait on an image
  $$('[data-shot]').forEach((f) => (new Image().src = f.dataset.shot))

  /* ------------------------------------------------------------ start */

  document.fonts.ready.then(() => {
    prepSplits()
    if (PRINT) return printAll()
    const start = Math.min(N - 1, Math.max(0, parseInt(location.hash.slice(1), 10) - 1 || 0))
    index = start
    slides.forEach((s, i) => s.classList.toggle('is-on', i === start))
    slides[start].style.zIndex = 3
    setChrome(start, false)
    setDark(start)
    buildTl = build(slides[start], 0.25)
  })

  // PDF export: every slide in its finished state, each with its own top bar
  function printAll() {
    slides.forEach((s, i) => {
      const tl = build(s, 0)
      tl.progress(1).kill()
      $$('[data-scene]', s).forEach((el) => {
        const sc = scenes[el.dataset.scene]
        if (sc && sc.leave) sc.leave(el)
        if (sc && sc.print) sc.print(el)
      })
      setChrome(i, false)
      const copy = chrome.cloneNode(true)
      copy.removeAttribute('id')
      copy.id = ''
      copy.className = 'chrome chrome-copy' + (s.dataset.theme === 'dark' ? ' is-dark' : '')
      s.appendChild(copy)
    })
    document.body.dataset.ready = '1'
  }
})()
