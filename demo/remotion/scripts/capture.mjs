// Real-product footage for the Equis demo film. Playwright drives Google Chrome through the live
// deployment, one CLIP at a time, and every clip becomes public/clips/<name>.mp4 plus an entry in
// public/clips/meta.json that tells the composition what is on screen and when.
//
//   node scripts/capture.mjs                     list the clips and where they will be written
//   node scripts/capture.mjs explorer            re-shoot one beat
//   node scripts/capture.mjs landing surfaces    several, in order
//   node scripts/capture.mjs all                 every beat Playwright can film
//   node scripts/capture.mjs recut markets       rebuild a clip from the frames already on disk
//
// Environment: SITE=<base url> | DPR=2 | CLIPS_OUT=<dir> | JPEG_QUALITY=92 | CRF=15
//
// This is the Nestor capture script's method, ported: frames come from the DevTools screencast as
// high-quality JPEGs carrying their own timestamps (not Playwright's 1 Mbit VP8 recorder, which
// smears type), a pointer and click ring are injected into every page because a headless recording
// has no cursor of its own, scrolling is an eased glide driven from inside the page, and every
// meaningful moment is logged as a mark that ends up in meta.json as a clip-relative time.
//
// What Playwright CANNOT film here, and why: /app and /app/earn only render a position and a pool
// once a wallet is connected, and connecting one needs an extension and a human signature. Those
// two are screen-recorded by hand. So are the two terminal beats. See HAND_RECORDED below.
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// The live deployment. Everything on camera is the real site; SITE=http://localhost:3000 rehearses.
const BASE = (process.env.SITE ?? 'https://tryequis.vercel.app').replace(/\/$/, '')
// The borrow the whole film is about: collateral deposited and 4 USD₮0 drawn in one send, with a
// RedStone package in the calldata that borrow() verified before the pool paid out.
const TX = '0xb896faa0e4965cb5bf4d970b5f7ced9f5eccc6a5ad9083b31bc7c7d662c0b5ee'
const EXPLORER_TX = `https://web3.okx.com/explorer/x-layer/evm/tx/${TX}`

const TMP = path.join(ROOT, 'clips/tmp')
const PUBLIC_CLIPS = path.join(ROOT, 'public/clips')
const OUT = process.env.CLIPS_OUT ? path.resolve(ROOT, process.env.CLIPS_OUT) : PUBLIC_CLIPS

const SIZE = { width: 1600, height: 900 }
// The page is always laid out as the same 1600x900 CSS viewport -- every coordinate, mark and glide
// below is in those units -- but at DPR 2 Chrome renders and screencasts it at device scale 2, so
// the clip is 3200x1800 and the film's push-ins have real pixels to enlarge instead of interpolated
// ones. Nestor learned this the hard way: setting the context's deviceScaleFactor alone makes Chrome
// render at 2x but the screencast still hands back a frame downscaled to the CSS viewport, throwing
// the detail away. --force-device-scale-factor at launch is what actually makes the frames 3200x1800.
const DPR = Number(process.env.DPR ?? 2) || 2
const FRAME = { width: Math.round(SIZE.width * DPR), height: Math.round(SIZE.height * DPR) }
const JPEG_QUALITY = Number(process.env.JPEG_QUALITY ?? 92) || 92
const CRF = process.env.CRF ?? '15'
for (const dir of [TMP, OUT, PUBLIC_CLIPS]) fs.mkdirSync(dir, { recursive: true })

const sessionDir = (beat) => path.join(TMP, 'sessions', `${DPR === 1 ? '' : `dpr${DPR}-`}${beat}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const readJson = (file, fallback) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback)
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 1))
const round = (n) => Math.round(n * 100) / 100

/**
 * The clips the composition looks for in public/clips. Anything marked `hand` cannot be driven by a
 * browser automation tool at all, and is listed here only so one place says what the film expects.
 * The composition's hasClip() renders a placeholder for whichever of these is missing, so a film can
 * always be cut before every clip exists.
 */
const HAND_RECORDED = {
  explorer: 'QuickTime screen recording of the OKX explorer page for the borrow transaction, scrolled to ' +
    'the input data. This one WAS automated until the explorer started redirecting the automated browser ' +
    'to web3.okx.com/account/login - the resulting clip was a 404 page. A normal signed-in browser serves ' +
    'it fine, so record it by hand. `node scripts/capture.mjs explorer` still exists if you want to retry.',
  dashboard: 'QuickTime screen recording of /app with a wallet connected, showing the open position ' +
    '(wNVDAx collateral, 4 USD₮0 of debt, health factor 1.81). Playwright cannot connect a wallet.',
  earn: 'QuickTime screen recording of /app/earn with a wallet connected, showing the pool at 33% utilisation.',
  mcp: 'Terminal recording: the MCP server running and equis_build_transaction returning unsigned calldata.',
  tests: 'Terminal recording: forge test, 35 passing.',
}

// ---------------------------------------------------------------------------------------------
// The pointer. Runs in every document before the page's own scripts.
// ---------------------------------------------------------------------------------------------
function pointerScript() {
  if (window.__equisPointer) return
  window.__equisPointer = true
  const KEY = '__equis_pointer_xy'
  let x = 800
  let y = 450
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) || 'null')
    if (saved) [x, y] = saved
  } catch {}
  const el = document.createElement('div')
  el.setAttribute('aria-hidden', 'true')
  el.style.cssText =
    'position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;pointer-events:none;' +
    'will-change:transform;filter:drop-shadow(0 2px 4px rgba(0,0,0,.55));'
  el.innerHTML =
    '<svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M4 2.5 L4 20.5 L8.9 16.2 L12.2 23.6 L15.4 22.2 L12.2 14.9 L18.8 14.6 Z" ' +
    'fill="#ECEEF2" stroke="#07080A" stroke-width="1.6" stroke-linejoin="round"/></svg>'
  const place = () => (el.style.transform = `translate(${x - 4}px, ${y - 2.5}px)`)
  place()
  const attach = () => {
    if (!document.documentElement) return false
    document.documentElement.appendChild(el)
    return true
  }
  if (!attach()) document.addEventListener('DOMContentLoaded', attach, { once: true })
  // Next's client navigation replaces the whole tree; keep the pointer attached across it.
  setInterval(() => !el.isConnected && attach(), 500)

  // Brass, because that is the colour the site uses for anything the chain vouches for.
  window.__equisRing = (rx = x, ry = y) => {
    const ring = document.createElement('div')
    ring.style.cssText =
      `position:fixed;left:${rx - 22}px;top:${ry - 22}px;width:44px;height:44px;border-radius:50%;` +
      'border:3px solid #C9A227;background:rgba(201,162,39,.18);z-index:2147483646;pointer-events:none;'
    document.documentElement.appendChild(ring)
    ring
      .animate(
        [
          { transform: 'scale(.25)', opacity: 0.95 },
          { transform: 'scale(1.25)', opacity: 0 },
        ],
        { duration: 520, easing: 'cubic-bezier(.2,.7,.2,1)' },
      )
      .finished.then(() => ring.remove(), () => ring.remove())
  }
  window.addEventListener(
    'mousemove',
    (e) => {
      x = e.clientX
      y = e.clientY
      place()
      try {
        sessionStorage.setItem(KEY, JSON.stringify([x, y]))
      } catch {}
    },
    true,
  )
  window.addEventListener('mousedown', (e) => window.__equisRing(e.clientX, e.clientY), true)

  // An anchor to #surfaces would jump; the camera glides instead.
  const nativeScrollIntoView = Element.prototype.scrollIntoView
  Element.prototype.scrollIntoView = function (...args) {
    if (window.__equisHoldScroll) return
    return nativeScrollIntoView.apply(this, args)
  }

  /** Eased scrolling from inside the page. `container` null means the window. */
  window.__equisGlide = (container, to, ms) =>
    new Promise((resolve) => {
      const isWin = !container
      const from = isWin ? window.scrollY : container.scrollTop
      const max = isWin
        ? document.documentElement.scrollHeight - window.innerHeight
        : container.scrollHeight - container.clientHeight
      const goal = Math.max(0, Math.min(max, to))
      if (Math.abs(goal - from) < 2) return resolve(goal)
      const t0 = performance.now()
      const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / ms)
        const v = from + (goal - from) * ease(p)
        if (isWin) window.scrollTo({ top: v, behavior: 'instant' })
        else container.scrollTop = v
        if (p < 1) requestAnimationFrame(tick)
        else resolve(goal)
      }
      requestAnimationFrame(tick)
    })
  window.__equisScroller = (el) => {
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node)
      if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 4) return node
    }
    return null
  }
}

// ---------------------------------------------------------------------------------------------
// A recording session: one browser, one page, a screencast, marks and regions.
// ---------------------------------------------------------------------------------------------
async function openSession(beat) {
  const dir = sessionDir(beat)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--lang=en-US', ...(DPR === 1 ? [] : [`--force-device-scale-factor=${DPR}`])],
  })
  const ctx = await browser.newContext({
    viewport: SIZE,
    deviceScaleFactor: DPR,
    locale: 'en-US',
    timezoneId: 'UTC', // block times and timestamps on screen read as UTC, as the explorer prints them
    colorScheme: 'dark',
  })
  await ctx.addInitScript(pointerScript)
  const page = await ctx.newPage()
  page.setDefaultTimeout(25_000)

  const cdp = await ctx.newCDPSession(page)
  const frames = []
  const writes = []
  cdp.on('Page.screencastFrame', (frame) => {
    const file = `f${String(frames.length).padStart(6, '0')}.jpg`
    frames.push({ file, t: frame.metadata.timestamp })
    writes.push(fs.promises.writeFile(path.join(dir, file), Buffer.from(frame.data, 'base64')))
    cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {})
  })
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: JPEG_QUALITY,
    // Device pixels, not CSS pixels: at DPR 2 the surface is 3200x1800 and a smaller cap here would
    // quietly hand back a downscaled frame, which is the very thing this is meant to avoid.
    maxWidth: FRAME.width,
    maxHeight: FRAME.height,
    everyNthFrame: 1,
  })

  const now = () => Date.now() / 1000
  const s = {
    beat,
    page,
    ctx,
    dir,
    marks: [],
    notes: [],
    regions: {},
    mouse: { x: 800, y: 450 },
    mark(name) {
      s.marks.push({ name, t: now() })
      console.log(`  [${beat}] ${name}`)
    },
    /**
     * Where something is on screen, so the film can punch in on it. Always CSS pixels in the
     * 1600x900 space, whatever DPR the clip was filmed at -- a 3200x1800 clip is the same picture,
     * just denser, so the composition's FOCUS rectangles never change.
     */
    async region(name, locator) {
      const box = await locator.first().boundingBox({ timeout: 2000 }).catch(() => null)
      if (box) {
        s.regions[name] = { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height), at: now() }
      }
    },
    note(text) {
      s.notes.push(text)
      console.log(`  [${beat}] note: ${text}`)
    },
    async finish({ shows } = {}) {
      // Nothing here may hang. Frames and marks go to disk first, so `recut` can always rebuild.
      const within = (label, promise, ms = 12_000) => {
        let timer
        const timeout = new Promise((resolve) => {
          timer = setTimeout(() => {
            console.log(`  [${beat}] finish: "${label}" timed out, moving on`)
            resolve(undefined)
          }, ms)
        })
        return Promise.race([promise, timeout])
          .catch((error) => console.log(`  [${beat}] finish: "${label}" failed: ${String(error?.message).split('\n')[0]}`))
          .finally(() => clearTimeout(timer))
      }
      const endWall = now()
      await within('stop screencast', cdp.send('Page.stopScreencast'), 5000)
      await Promise.all(writes)
      const session = { beat, base: BASE, shows, frames, marks: s.marks, notes: s.notes, regions: s.regions, endWall }
      writeJson(path.join(dir, 'session.json'), session)
      await within('close context', ctx.close(), 6000)
      await within('close browser', browser.close(), 4000)
      if (frames.length < 2) throw new Error('the screencast produced no frames')
      return cut(session, dir)
    },
    async abort(error) {
      console.log(`  [${beat}] FAILED: ${String(error?.message ?? error).split('\n')[0]}`)
      await page.screenshot({ path: path.join(TMP, `fail-${beat}.png`) }).catch(() => {})
      await cdp.send('Page.stopScreencast').catch(() => {})
      await Promise.all(writes).catch(() => {})
      await ctx.close().catch(() => {})
      await browser.close().catch(() => {})
    },
  }
  return s
}

/** Turn a session's frames into <beat>.mp4: cut to [start, end], 30 fps H.264, and log it in meta.json. */
function cut(session, dir) {
  const { beat, frames, marks } = session
  const startMark = marks.find((m) => m.name === 'start')
  const endMark = [...marks].reverse().find((m) => m.name === 'end')
  const T0 = startMark ? startMark.t : frames[0].t
  const T1 = endMark ? endMark.t : session.endWall
  const mapTime = (t) => Math.max(0, Math.min(T1, t) - T0)

  // The frame on screen at T0 is the last one at or before it.
  let first = 0
  for (let i = 0; i < frames.length; i++) if (frames[i].t <= T0) first = i
  const used = frames.slice(first).filter((f, i) => i === 0 || f.t < T1)
  const lines = []
  for (let i = 0; i < used.length; i++) {
    const at = mapTime(used[i].t)
    const next = i + 1 < used.length ? mapTime(used[i + 1].t) : mapTime(T1)
    lines.push(`file '${path.join(dir, used[i].file)}'`, `duration ${Math.max(0.001, next - at).toFixed(4)}`)
  }
  lines.push(`file '${path.join(dir, used[used.length - 1].file)}'`)
  const list = path.join(dir, 'concat.txt')
  fs.writeFileSync(list, lines.join('\n'))

  // What the screencast actually delivered. Scaling 1600x900 frames up to a 3200x1800 clip would
  // look like a win in ffprobe and like nothing at all on screen, so say so instead of faking it.
  const probed = execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height',
    '-of', 'csv=p=0', path.join(dir, used[0].file),
  ]).toString().trim()
  if (probed !== `${FRAME.width},${FRAME.height}`) {
    console.log(`  [${beat}] WARNING: frames are ${probed.replace(',', 'x')} but the clip is being written at ${FRAME.width}x${FRAME.height}.`)
    console.log(`  [${beat}]          Nothing is gained by enlarging them; check --force-device-scale-factor.`)
  }

  const target = path.join(OUT, `${beat}.mp4`)
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
    '-vf', `fps=30,scale=${FRAME.width}:${FRAME.height}:flags=lanczos:in_range=full:out_range=tv,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-movflags', '+faststart',
    '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-an', target,
  ])
  const duration = Number(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', target])
      .toString()
      .trim(),
  )

  const moments = {}
  for (const m of marks) {
    if (m.name === 'start' || m.name === 'end' || m.t < T0 || m.t > T1) continue
    moments[m.name] = round(mapTime(m.t))
  }
  const entry = {
    file: `clips/${beat}.mp4`,
    duration: round(duration),
    size: `${FRAME.width}x${FRAME.height}`,
    fps: 30,
    dpr: DPR,
    sourceSpace: `${SIZE.width}x${SIZE.height} CSS pixels (the composition's focus rectangles use these)`,
    recordedOn: session.base,
    shows: session.shows ?? '',
    moments,
    regions: Object.fromEntries(
      Object.entries(session.regions ?? {}).map(([name, r]) => [name, { x: r.x, y: r.y, w: r.w, h: r.h, validFrom: round(mapTime(r.at)) }]),
    ),
    notes: session.notes,
  }
  const metaFile = path.join(OUT, 'meta.json')
  const meta = readJson(metaFile, { about: 'Clips for the Equis demo film. Times are seconds within each clip.', clips: {} })
  meta.clips[beat] = entry
  writeJson(metaFile, meta)
  console.log(`${beat}: ${duration.toFixed(1)}s -> ${path.relative(ROOT, target)}  (${used.length} frames)`)
  return entry
}

// ---------------------------------------------------------------------------------------------
// Acting: pointer travel, glides, waits.
// ---------------------------------------------------------------------------------------------
async function moveTo(s, x, y, { ms } = {}) {
  const from = { ...s.mouse }
  const dist = Math.hypot(x - from.x, y - from.y)
  if (dist < 2) return
  const duration = ms ?? Math.min(950, Math.max(320, dist * 0.95))
  const steps = Math.max(12, Math.round(duration / 14))
  // A slight arc reads as a hand; a straight line reads as a script.
  const bow = Math.min(40, dist * 0.08) * (x > from.x ? -1 : 1)
  const t0 = Date.now()
  for (let i = 1; i <= steps; i++) {
    const p = i / steps
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
    const arc = Math.sin(Math.PI * e) * bow
    await s.page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e + arc)
    const wait = t0 + (duration * i) / steps - Date.now()
    if (wait > 0) await sleep(wait)
  }
  s.mouse = { x, y }
}

/** Glide so the element sits at `at` (0 top, 1 bottom) of its scroll container. */
async function bringIntoView(s, locator, { at = 0.5, ms = 1100, force = false } = {}) {
  await locator.first().waitFor({ state: 'visible' })
  await locator.first().evaluate(
    async (el, { at, ms, force }) => {
      const scroller = window.__equisScroller(el)
      const box = el.getBoundingClientRect()
      const view = scroller ? scroller.getBoundingClientRect() : { top: 0, height: window.innerHeight }
      const mid = box.top + box.height / 2 - view.top
      const comfortable = box.top - view.top > 90 && box.bottom - view.top < view.height - 110
      if (comfortable && !force) return
      const from = scroller ? scroller.scrollTop : window.scrollY
      await window.__equisGlide(scroller, from + (mid - view.height * at), ms)
    },
    { at, ms, force },
  )
  await sleep(250)
}

/**
 * Park the pointer in the blank space just past the END OF THE TEXT, never on top of it. A
 * paragraph's bounding box is as wide as its column, so "right edge + gap" lands off the card even
 * though the last line stops half way; the element's client rects give one rect per rendered line.
 */
async function parkBeside(s, locator, { gap = 40, dy = 0, maxX = 1566, ms = 900 } = {}) {
  const spot = await locator
    .first()
    .evaluate((el, g) => {
      const range = document.createRange()
      range.selectNodeContents(el)
      const lines = [...range.getClientRects()].filter((r) => r.width > 2 && r.height > 2)
      const last = lines[lines.length - 1] ?? el.getBoundingClientRect()
      return { x: last.right + g, y: last.top + last.height / 2 }
    }, gap)
    .catch(() => null)
  if (!spot) return false
  await moveTo(s, Math.min(maxX, spot.x), spot.y + dy, { ms })
  return true
}

const glideWindow = (s, to, ms) => s.page.evaluate(([to, ms]) => window.__equisGlide(null, to, ms), [to, ms])
const pageHeight = (page) => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)

async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.evaluate(() => document.fonts.ready).catch(() => {})
}

/**
 * Hold until the live figures have actually arrived. Every number on the landing hero and in the
 * markets table is fetched after hydration -- filming a row of em dashes would undercut the one
 * claim the film makes, which is that these are real. Times out quietly and says so in the notes.
 */
async function waitForFigures(s, locator, { pattern = /\d/, ms = 30_000, what = 'live figures' } = {}) {
  const ok = await locator
    .first()
    .waitFor({ state: 'visible', timeout: ms })
    .then(async () => {
      const deadline = Date.now() + ms
      while (Date.now() < deadline) {
        const text = await locator.first().innerText().catch(() => '')
        if (pattern.test(text)) return true
        await sleep(400)
      }
      return false
    })
    .catch(() => false)
  if (!ok) s.note(`${what} had not loaded when the camera rolled; the clip may show placeholders`)
  else await sleep(600) // let the numbers stop shifting
  return ok
}

async function openPage(s, route, { waitUntil = 'networkidle' } = {}) {
  await s.page.goto(`${BASE}${route}`, { waitUntil })
  await settle(s.page)
}

// ---------------------------------------------------------------------------------------------
// The beats. One per clip the composition looks for.
// ---------------------------------------------------------------------------------------------
const BEATS = {
  /** The landing page, from the hero: the live chain figures, then a slow glide down through it. */
  async landing() {
    const s = await openSession('landing')
    try {
      const { page } = s
      await openPage(s, '/')
      await page.getByRole('heading', { level: 1 }).first().waitFor()
      // The hero's stat strip: network, USD₮0/USD, OKB/USD, sequencer -- all read from mainnet.
      const stats = page.locator('dl').first()
      await waitForFigures(s, stats, { pattern: /\d[\d.,]/, what: 'the hero chain figures' })
      await s.region('hero chain figures', stats)
      await page.mouse.move(1180, 560)
      s.mouse = { x: 1180, y: 560 }
      await sleep(1500)
      s.mark('start')
      await moveTo(s, 900, 470, { ms: 900 })
      s.mark('hero: the headline and the live chain figures')
      await sleep(2600)
      const height = await pageHeight(page)
      // Stop at the top of each section, at least 480px apart, and finish just past the hero's end.
      const stops = await page.evaluate(() =>
        [...document.querySelectorAll('main section')]
          .map((el) => Math.round(el.getBoundingClientRect().top + window.scrollY - 72))
          .filter((y, i, all) => y > 200 && all.indexOf(y) === i)
          .sort((a, b) => a - b),
      )
      const hops = []
      for (const y of stops) if (y < height - 200 && (hops.length === 0 || y - hops[hops.length - 1] > 480)) hops.push(y)
      s.mark('slow scroll through the hero begins')
      let from = 0
      for (const y of hops.slice(0, 3)) {
        await glideWindow(s, y, Math.max(1400, (y - from) * 2.6))
        from = y
        await sleep(1500)
      }
      s.mark('the sections below the fold')
      await sleep(1200)
      s.mark('glide back to the hero')
      await glideWindow(s, 0, 2600)
      await sleep(900)
      const launch = page.getByRole('link', { name: /Open the app|Launch app|Open app/i }).first()
      if (await launch.count()) {
        await bringIntoView(s, launch, { at: 0.5, ms: 500 })
        const box = await launch.boundingBox().catch(() => null)
        if (box) await moveTo(s, box.x + box.width / 2, box.y + box.height / 2)
      }
      await sleep(1600)
      s.mark('end')
      await sleep(300)
      return await s.finish({
        shows: 'The Equis landing page from the hero: the headline, the chain figures read live from X Layer mainnet, a slow eased glide down through the first sections and back up to the hero.',
      })
    } catch (error) {
      await s.abort(error)
      throw error
    }
  },

  /** "Three ways in", held on Exhibit B: the real transaction, with its hash and its calldata note. */
  async surfaces() {
    const s = await openSession('surfaces')
    try {
      const { page } = s
      await openPage(s, '/')
      await page.getByRole('heading', { level: 1 }).first().waitFor()
      await sleep(600)
      const section = page.locator('#surfaces')
      await section.waitFor({ timeout: 25_000 })
      // Put the section heading just below the top of the frame without the anchor's jump.
      const top = await section.evaluate((el) => Math.round(el.getBoundingClientRect().top + window.scrollY - 64))
      await page.evaluate((y) => window.scrollTo({ top: y - 520, behavior: 'instant' }), top)
      await settle(page)
      await page.mouse.move(1240, 600)
      s.mouse = { x: 1240, y: 600 }
      await sleep(1200)
      s.mark('start')
      await sleep(500)
      await glideWindow(s, top, 1800)
      s.mark('Three ways in: dashboard, Telegram, MCP')
      await s.region('three ways in', section)
      await sleep(3200)
      // Exhibit B is the panel that carries the real borrow; its caption is the reliable anchor.
      const exhibitB = page.getByText('Exhibit B', { exact: false }).first()
      const panel = page.locator('figure').filter({ has: page.getByText('Exhibit B') }).first()
      const target = (await panel.count()) ? panel : exhibitB
      await bringIntoView(s, target, { at: 0.5, ms: 2000, force: true })
      s.mark('Exhibit B: the real borrow on X Layer mainnet')
      await s.region('exhibit b', target)
      // The proof list: hash, block, gas. Hold on it, pointer clear of the type.
      const hash = page.getByText(new RegExp(TX.slice(0, 10), 'i')).first()
      if (await hash.count()) {
        await s.region('transaction hash', hash)
        await parkBeside(s, hash, { gap: 44 })
        s.mark('the transaction hash, block and fee')
      } else {
        s.note('The transaction hash was not found by text; the pointer was parked by coordinate instead.')
        await moveTo(s, 1300, 520, { ms: 800 })
      }
      await sleep(5000)
      const calldata = page.getByText(/1,700 bytes|RedStone package|_updatePrices/).first()
      if (await calldata.count()) {
        await bringIntoView(s, calldata, { at: 0.45, ms: 1300, force: true })
        await s.region('what the calldata carried', calldata)
        await parkBeside(s, calldata, { gap: 40 })
        s.mark('what the calldata carried: a package signed by three of five')
        await sleep(4800)
      }
      s.mark('end')
      await sleep(300)
      return await s.finish({
        shows: 'The "Three ways in" section -- one set of deployed contracts behind the dashboard, the Telegram bot and the MCP server -- then a hold on Exhibit B: the real borrow on X Layer mainnet with its hash, block, fee, and the note that borrow() verified the RedStone package onchain before the pool paid out.',
      })
    } catch (error) {
      await s.abort(error)
      throw error
    }
  },

  /** /app/markets: the three wrappers with live share prices, multipliers and collateral prices. */
  async markets() {
    const s = await openSession('markets')
    try {
      const { page } = s
      await openPage(s, '/app/markets')
      await page.getByRole('heading', { name: /Collateral markets/i }).first().waitFor()
      const table = page.locator('table').first()
      await table.waitFor({ timeout: 25_000 })
      // A price, not a dash: these come from RedStone's signed feeds through the site's own route.
      await waitForFigures(s, table, { pattern: /\$\s?\d/, ms: 40_000, what: 'the live wrapper prices' })
      await settle(page)
      await page.mouse.move(1300, 700)
      s.mouse = { x: 1300, y: 700 }
      await sleep(1200)
      s.mark('start')
      await sleep(600)
      s.mark('the three wrappers with live prices')
      await s.region('markets table', table)
      for (const symbol of ['wNVDAx', 'wAAPLx', 'wTSLAx']) {
        const row = page.locator('tr').filter({ hasText: symbol }).first()
        if (!(await row.count())) {
          s.note(`${symbol} was not on the markets table`)
          continue
        }
        await bringIntoView(s, row, { at: 0.5, ms: 700 })
        const box = await row.boundingBox().catch(() => null)
        if (box) await moveTo(s, 220, box.y + box.height / 2, { ms: 700 })
        await s.region(`row ${symbol}`, row)
        s.mark(`${symbol} row`)
        await sleep(2200)
      }
      // The multiplier note is the point of the beat: a wrapper is the share price times an onchain
      // multiplier, and that is the part most tokenized-equity lenders get wrong.
      const multiplier = page.getByText(/multiplier/i).first()
      if (await multiplier.count()) {
        await bringIntoView(s, multiplier, { at: 0.45, ms: 1100 })
        await parkBeside(s, multiplier, { gap: 40 })
        s.mark('the onchain multiplier')
        await sleep(3600)
      }
      const height = await pageHeight(page)
      if (height > 80) {
        await glideWindow(s, height, 1800)
        s.mark('the bottom of the table')
        await sleep(2000)
      }
      s.mark('end')
      await sleep(300)
      return await s.finish({
        shows: 'The collateral markets page: wNVDAx, wAAPLx and wTSLAx with share prices from RedStone\'s signed feeds and multipliers and balances read straight from the chain.',
      })
    } catch (error) {
      await s.abort(error)
      throw error
    }
  },

  /** /app/agent: what a session key may do, once granted -- the mandate table, read slowly. */
  async agent() {
    const s = await openSession('agent')
    try {
      const { page } = s
      await openPage(s, '/app/agent')
      await page.getByRole('heading', { level: 1 }).first().waitFor()
      const mandate = page.getByText(/What a session key may do/i).first()
      await mandate.waitFor({ timeout: 25_000 })
      await settle(page)
      await page.mouse.move(1280, 640)
      s.mouse = { x: 1280, y: 640 }
      await sleep(1300)
      s.mark('start')
      await sleep(700)
      s.mark('the agent surface: EIP-7702 delegate, this account')
      await sleep(2400)
      await bringIntoView(s, mandate, { at: 0.18, ms: 1500, force: true })
      s.mark('what a session key may do, once granted')
      const panel = mandate.locator('xpath=ancestor::section[1]')
      await s.region('mandate table', (await panel.count()) ? panel : mandate)
      await parkBeside(s, mandate, { gap: 44 })
      await sleep(5200)
      // The claim worth holding on: repay and top up, never withdraw or borrow, because no vault
      // action takes a recipient -- there is nowhere to redirect funds to.
      const cannot = page.getByText(/cannot|never|no recipient|withdraw/i).first()
      if (await cannot.count()) {
        await bringIntoView(s, cannot, { at: 0.42, ms: 1300, force: true })
        await s.region('what it cannot do', cannot)
        await parkBeside(s, cannot, { gap: 40 })
        s.mark('what the key structurally cannot do')
        await sleep(4200)
      }
      const height = await pageHeight(page)
      if (height > 80) {
        await glideWindow(s, height, 1700)
        s.mark('the bottom of the agent page')
        await sleep(2200)
      }
      s.mark('end')
      await sleep(300)
      return await s.finish({
        shows: 'The agent page: the EIP-7702 delegate, and the table of what a session key may do once granted -- scoped to named functions, capped in what it may spend, expiring on its own, and unable to withdraw or borrow.',
      })
    } catch (error) {
      await s.abort(error)
      throw error
    }
  },

  /**
   * The OKX explorer, scrolled to the input data so the 1,700 bytes of hex sit on screen.
   *
   * This is the one beat filmed on somebody else's site. It renders slowly, it may lazily mount the
   * tab that holds the calldata, and its markup can change without notice -- so this beat is
   * OPTIONAL: `runBeat` logs a failure here and carries on rather than killing the run. If it does
   * fail, screen-record the page by hand and save it as public/clips/explorer.mp4.
   */
  async explorer() {
    const s = await openSession('explorer')
    try {
      const { page } = s
      page.setDefaultTimeout(45_000)
      await page.goto(EXPLORER_TX, { waitUntil: 'domcontentloaded' })
      // Third-party page: never wait on networkidle, its telemetry sockets stay open forever.
      await page.waitForLoadState('load').catch(() => {})
      await page.evaluate(() => document.fonts.ready).catch(() => {})
      const shortHash = TX.slice(0, 12)
      const confirmed = await page
        .getByText(new RegExp(shortHash, 'i'))
        .first()
        .waitFor({ timeout: 45_000 })
        .then(() => true)
        .catch(() => false)
      if (!confirmed) s.note('The explorer never printed the hash where this script could find it; the clip may open mid-load.')
      await sleep(3500) // the tables fill in well after load
      await page.mouse.move(1280, 620)
      s.mouse = { x: 1280, y: 620 }
      await sleep(1200)
      s.mark('start')
      await sleep(900)
      s.mark('the transaction on the OKX explorer')
      await sleep(3000)
      // The input-data panel is sometimes behind a tab and sometimes just further down the page.
      const tab = page.getByRole('tab', { name: /input data|overview/i }).first()
      const inputLabel = page.getByText(/input data/i).first()
      let found = false
      if (await inputLabel.count()) {
        await bringIntoView(s, inputLabel, { at: 0.24, ms: 1900, force: true }).catch(() => {})
        found = true
      } else if (await tab.count()) {
        await tab.click({ timeout: 8000 }).catch(() => {})
        await sleep(1800)
        found = (await inputLabel.count()) > 0
        if (found) await bringIntoView(s, inputLabel, { at: 0.24, ms: 1600, force: true }).catch(() => {})
      }
      if (!found) {
        // Fall back to the geometry: find the tallest run of hex on the page and go to it.
        const y = await page.evaluate(() => {
          let best = null
          for (const el of document.querySelectorAll('div,pre,span,textarea,td')) {
            const text = (el.textContent ?? '').trim()
            if (!/^0x[0-9a-fA-F]{400,}$/.test(text)) continue
            const box = el.getBoundingClientRect()
            if (!best || box.height > best.h) best = { y: Math.round(box.top + window.scrollY - 160), h: box.height }
          }
          return best?.y ?? null
        })
        if (y !== null) {
          await glideWindow(s, y, 2000)
          found = true
        } else {
          s.note('No input-data panel was found; the clip is a scroll through the transaction page instead.')
          await glideWindow(s, Math.round((await pageHeight(page)) * 0.55), 2600)
        }
      }
      s.mark('the input data: 1,700 bytes of calldata')
      const hex = page.locator('text=/0x[0-9a-fA-F]{200,}/').first()
      if (await hex.count()) await s.region('calldata', hex)
      await moveTo(s, 1420, 780, { ms: 900 }) // out of the way of the hex itself
      await sleep(7000) // let it sit there; the narration is talking over this
      await glideWindow(s, (await page.evaluate(() => window.scrollY)) + 340, 2200)
      s.mark('further down the calldata')
      await sleep(3500)
      s.mark('end')
      await sleep(300)
      return await s.finish({
        shows: `The OKX explorer page for ${TX.slice(0, 10)}..., scrolled to the input data, holding on the 1,700 bytes of calldata that carried the signed RedStone package.`,
      })
    } catch (error) {
      await s.abort(error)
      throw error
    }
  },
}

/** Which beats are allowed to fail without failing the run. */
/*
 * Beats that may fail without failing the run. `explorer` is no longer in ALL - see HAND_RECORDED -
 * but it stays here so an explicit `capture.mjs explorer` retry degrades politely rather than throwing.
 */
const OPTIONAL = new Set(['explorer'])

// ---------------------------------------------------------------------------------------------
function handRecordedNotice() {
  console.log('')
  console.log('These clips are NOT captured here, and have to be screen-recorded by hand:')
  for (const [name, why] of Object.entries(HAND_RECORDED)) {
    const file = path.relative(ROOT, path.join(PUBLIC_CLIPS, `${name}.mp4`))
    const have = fs.existsSync(path.join(PUBLIC_CLIPS, `${name}.mp4`)) ? 'present' : 'MISSING'
    console.log(`  ${name.padEnd(10)} ${why}`)
    console.log(`  ${''.padEnd(10)} save as ${file}   [${have}]`)
  }
  console.log('')
  console.log('  Record them at 1600x900 or larger (2560x1440 is ideal - the film pushes in), then')
  console.log('  re-run `npm run clips` so the manifest picks up their real lengths. A clip that is')
  console.log('  still missing renders as a placeholder, so the film cuts either way.')
}

const args = process.argv.slice(2)
if (args.length === 0 || args[0] === 'list') {
  console.log(`beats: ${Object.keys(BEATS).join(', ')}  (or "all")`)
  console.log(`site:  ${BASE}`)
  console.log(`clips: ${path.relative(ROOT, OUT)}`)
  console.log(`DPR=${DPR} -> ${FRAME.width}x${FRAME.height} frames from a ${SIZE.width}x${SIZE.height} page (jpeg q${JPEG_QUALITY}, crf ${CRF})`)
  handRecordedNotice()
} else if (args[0] === 'recut') {
  for (const beat of args.slice(1)) {
    const dir = sessionDir(beat)
    const session = readJson(path.join(dir, 'session.json'), null)
    if (!session) throw new Error(`No frames on disk for "${beat}": record it first.`)
    cut(session, dir)
  }
} else {
  // `all` skips anything listed as hand-recorded, so it cannot re-shoot the explorer's login redirect.
  const wanted = args[0] === 'all' ? Object.keys(BEATS).filter((b) => !(b in HAND_RECORDED)) : args
  for (const beat of wanted) {
    if (!BEATS[beat]) {
      if (HAND_RECORDED[beat]) throw new Error(`"${beat}" is hand-recorded, not captured: ${HAND_RECORDED[beat]}`)
      throw new Error(`Unknown beat "${beat}". Try: ${Object.keys(BEATS).join(', ')}`)
    }
  }
  console.log(`site: ${BASE}`)
  const failed = []
  for (const beat of wanted) {
    try {
      await BEATS[beat]()
    } catch (error) {
      failed.push(beat)
      const line = String(error?.message ?? error).split('\n')[0]
      if (OPTIONAL.has(beat)) {
        console.log(`\n  ${beat} did not record (${line}).`)
        console.log(`  It is a third-party page and it is allowed to fail: the rest of the run continues.`)
        console.log(`  Re-shoot it with \`node scripts/capture.mjs ${beat}\`, or screen-record it by hand as`)
        console.log(`  ${path.relative(ROOT, path.join(PUBLIC_CLIPS, `${beat}.mp4`))}. A missing clip renders as a placeholder.\n`)
      } else {
        console.log(`\n  ${beat} FAILED: ${line}`)
        console.log(`  A screenshot of the moment it broke is in ${path.relative(ROOT, TMP)}/fail-${beat}.png\n`)
      }
    }
  }
  handRecordedNotice()
  const hard = failed.filter((b) => !OPTIONAL.has(b))
  if (hard.length) {
    console.log(`Beats that failed: ${hard.join(', ')}`)
    process.exit(1)
  }
  // Chrome sometimes never answers the final close; nothing is left to do, so do not wait for it.
  process.exit(0)
}
