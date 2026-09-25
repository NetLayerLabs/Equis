import React from 'react'
import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion'
import durations from '../public/vo/durations.json'
import {
  ALARM,
  ALARM_WASH,
  BRASS,
  BRASS_BRIGHT,
  BRASS_WASH,
  Backdrop,
  Body,
  BrowserFrame,
  Caption,
  Chip,
  Eyebrow,
  FAINT,
  Focus,
  Guilloche,
  Hairline,
  HeadLine,
  Headline,
  INK,
  INK_DEEP,
  LINE,
  LINE_STRONG,
  LedgerRule,
  Lockup,
  MONO,
  MUTED,
  Metric,
  Mono,
  PANEL,
  PANEL_SOFT,
  Reveal,
  Rise,
  SANS,
  SERIF,
  SIGNAL,
  SIGNAL_WASH,
  SITE,
  SRC_H,
  SRC_W,
  Shot,
  SponsorLabel,
  StepNumber,
  TABULAR,
  TEXT,
  easeInOut,
  easeOut,
  hasClip,
} from './ui'

/* ------------------------------------------------------------------- timing */

export const FPS = 30
const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

/** Frames of picture before the voice starts in every scene. */
const LEAD = 8
/** Seconds of air after the voice ends, per scene. */
const TAIL: Record<string, number> = { v00: 1.3, v09: 2.6 }
const TAIL_DEFAULT = 0.7
/**
 * ElevenLabs masters this voice about 7dB below where it wants to be, and YouTube
 * only ever turns content down, never up - so a quiet film stays quiet next to
 * everything else a judge watches. This uses the headroom that was going spare;
 * scripts/finish.mjs then lands the master exactly on -14 LUFS. Baking the bulk of
 * it in here means a re-render keeps it.
 */
const VO_GAIN = 2

/** Cross-fade length at each end of a scene. */
const FADE = 12
/**
 * Where two scenes both carry a window of dense footage, a long dissolve lays one
 * page over another at slightly different positions and the text doubles - two
 * address pills, two tables, unreadable for a third of a second. Those joins get a
 * short fade: long enough that the ledger grid and the rail do not snap, short
 * enough that the doubling does not read.
 */
const FADE_OVER_WINDOW = 5

/*
 * Film order, not recording order. v10 was written last and opens the film: a judge who has not been
 * told what Equis is has no reason to care that a transaction carried 1,700 bytes, so the problem comes
 * first, the answer second, and the proof third. The ids stay as recorded rather than being renumbered.
 */
const IDS = ['v10', 'v02', 'v00', 'v01', 'v03', 'v04', 'v05', 'v06', 'v07', 'v08', 'v09'] as const
type Id = (typeof IDS)[number]

/**
 * The narration, exactly as vo-gen.js sends it to ElevenLabs. It is here for two
 * reasons: every cue below is written in narration seconds and wants the words
 * beside it, and the word count is what paces the film before a single take of
 * voice exists.
 */
const SCRIPT: Record<Id, string> = {
  v00: 'This borrow happened on X Layer mainnet. The stock price it was lent against was verified inside the same transaction that released the money.',
  v01: 'Seventeen hundred bytes of calldata, and none of it is padding. That is a RedStone price package, signed by three of five oracles, carrying the NVIDIA feed. Borrow verifies it onchain before it touches the lending pool. Most pull-oracle lenders need two transactions, or a wallet that batches. This is one send, and it cost a sixth of a cent.',
  v02: 'Equis is margin credit against tokenized stocks. You hold tokenized NVIDIA, you want dollars, and you do not want to sell. Deposit the shares, draw tether against them, and keep the upside.',
  v03: 'This is the position that transaction opened, read live from chain one nine six. Wrapped NVIDIA as collateral, four dollars of debt, and a health factor of one point eight one.',
  v04: 'Collateral is the non-rebasing wrapper, not the rebasing token, because that is where the liquidity a liquidator has to sell into actually sits. A wrapper is worth the share price times its onchain multiplier, read live from the wrapper. That multiplier is the part most tokenized equity lenders get wrong.',
  v05: 'Equis also speaks the Model Context Protocol, so Claude Code, Cursor, or Codex can drive it directly. Ask it to build a borrow and it returns unsigned calldata with a freshly signed price already inside. Same selector, same seventeen hundred bytes as the transaction that landed. The server holds no private key and signs nothing. It hands back bytes; a person or a wallet signs them.',
  v06: 'Under E I P seventy seven oh two, your own account runs the delegate, and grants a key scoped to named functions, capped in what it may spend, and expiring on its own. It can repay and top up collateral. It structurally cannot withdraw or borrow: no vault action takes a recipient, so there is nowhere to redirect funds to.',
  v07: 'A Telegram bot reads the same contracts the dashboard does. Ask it for markets, the pool, or any position. Put an address on watch, and it messages you when that position\'s health factor slips below one point one five, and again once it recovers above one point two five.',
  v08: 'Five contracts on mainnet, verified on Sourcify with an exact match. Thirty-five tests against forked mainnet state. And the README says what is not built, too: no yield router, and no S and P or Nasdaq collateral, because no public price feed exists for them.',
  v09: 'Equis. Credit against tokenized equities on X Layer, priced by a signature the chain checks itself, and reachable by a person or an agent.',
  v10: 'Tokenized stocks put real shares onchain. NVIDIA, Apple, Tesla, held in a wallet. But the moment you need dollars, the chain offers exactly one option: sell. You give up the position, and the upside you were holding it for.',
}

/** This voice reads narration prose at about this rate. */
const WPS = 2.6
/** What the section would run to if it has not been recorded yet. */
const EST = (id: Id) => SCRIPT[id].trim().split(/\s+/).length / WPS

/**
 * durations.json is written by the voice pass. Before that pass it exists with
 * every section at zero, so a zero means "not recorded", not "instant": fall back
 * to the estimate and keep rendering. The whole film has to cut together from the
 * first day, with holes in it, or nothing can be judged until everything is done.
 */
const measured = durations as Partial<Record<Id, number>>
const recorded = (id: Id) => {
  const d = measured[id]
  return typeof d === 'number' && d > 0.05 ? d : null
}
const VO = (id: Id) => recorded(id) ?? EST(id)
const HAS_VO = (id: Id) => recorded(id) !== null

const SCENES = IDS.map((id) => ({
  id,
  dur: LEAD + Math.round((VO(id) + (TAIL[id] ?? TAIL_DEFAULT)) * FPS),
}))
const STARTS = SCENES.reduce<number[]>((a, _, i) => [...a, i === 0 ? 0 : a[i - 1] + SCENES[i - 1].dur], [])
export const EQUIS_DURATION = SCENES.reduce((n, sc) => n + sc.dur, 0)
const durOf = (id: Id) => SCENES[IDS.indexOf(id)].dur

/**
 * Every cue in this file is written in narration seconds, counted from the first
 * word of that section - which is how you write them while reading the script, and
 * the only way to place them at all before the voice exists. `cue` turns those into
 * scene frames, and stretches them by however much the recording differs from the
 * estimate, so a section that comes back eight percent quicker than guessed does
 * not leave forty cues trailing behind it.
 */
const cue = (id: Id) => {
  const k = VO(id) / EST(id)
  return (s: number) => LEAD + Math.round(s * k * FPS)
}
/** The same, in scene seconds, for BrowserFrame shots and focus. */
const scn = (id: Id) => {
  const k = VO(id) / EST(id)
  return (s: number) => s * k + LEAD / FPS
}

/**
 * A focus rectangle written the way a camera is actually aimed: put this point of
 * the page in the middle of the window, at this zoom. The frame fits a rectangle
 * with 8% of air around it, so these come back as exactly `z`.
 *
 * NOTE: none of the clips exist yet, so every rectangle below is aimed at where the
 * page puts that element in the browser, not at measured footage. They are all kept
 * gentle (z <= 1.5) so that a rectangle which turns out to be off by a hundred
 * pixels is a slightly loose frame rather than a beheaded table. Re-aim them once
 * `npm run capture` has run.
 */
const box = (cx: number, cy: number, z: number): [number, number, number, number] => {
  const w = (SRC_W * 0.92) / z
  const h = (SRC_H * 0.92) / z
  return [cx - w / 2, cy - h / 2, w, h]
}

/* -------------------------------------------------------------------- facts */
/*
 * Everything the film puts on screen as a number lives here, once. If it is not in
 * this block it does not go on screen. Each line is checked against the chain, the
 * repo or the explorer - nothing here is illustrative.
 */

const TX = '0xb896faa0e4965cb5bf4d970b5f7ced9f5eccc6a5ad9083b31bc7c7d662c0b5ee'
const TX_SHORT = '0xb896faa0…662c0b5ee'
const BLOCK = '71,513,642'
const SELECTOR = '0x63b527f0'
const SIGNATURE = 'borrow(uint256, bytes[])'
const CALLDATA_BYTES = 1700
const GAS = '474,984'
const FEE_OKB = '0.0000136 OKB'
const FEE_USD = 'about $0.0016'

const VAULT = '0x6577BFc845B9Bf56DAF38b0ff0b2dD248Ad4885F'
const VAULT_SHORT = '0x6577BFc8…4885F'
const CONTRACTS: [string, string][] = [
  ['Vault', VAULT],
  ['Pool', '0xC6e2EFc3f92B9eE88ae66000cB1c66ee20F1fF8e'],
  ['Oracle', '0x478A62bDD88A26d10c854F4E382fDE0573d16b4d'],
  ['Session delegate', '0x946A509bC424367c7F6C3d0e534e037026c917eD'],
  ['Rate model', '0xf0d09B9e5444F24A33cEAe5Fe8DAa40411496Ed0'],
]
const DELEGATE_SHORT = '0x946A509b…c917eD'

/**
 * The RedStone feed id carried in that calldata, byte by byte. NVDA---24_7 is
 * eleven ASCII characters, and these are their hex: a viewer can read the hex off
 * the screen, decode it by hand, and get the ticker back. That is the whole point
 * of the shot, so it is drawn from the bytes rather than typeset as a label.
 */
const FEED_BYTES: [string, string][] = [
  ['4e', 'N'],
  ['56', 'V'],
  ['44', 'D'],
  ['41', 'A'],
  ['2d', '-'],
  ['2d', '-'],
  ['2d', '-'],
  ['32', '2'],
  ['34', '4'],
  ['5f', '_'],
  ['37', '7'],
]

const MARKETS: [string, string, string][] = [
  ['wNVDAx', '50%', '60%'],
  ['wAAPLx', '50%', '60%'],
  ['wTSLAx', '40%', '50%'],
]

const TOOLS: [string, 'read' | 'tx'][] = [
  ['equis_overview', 'read'],
  ['equis_markets', 'read'],
  ['equis_pool', 'read'],
  ['equis_position', 'read'],
  ['equis_quote_borrow', 'read'],
  ['equis_build_transaction', 'tx'],
]

const MAY: string[] = ['repay', 'depositCollateral']
const MAY_NOT: string[] = ['withdrawCollateral', 'borrow', 'send OKB']

/* ------------------------------------------------------------- small pieces */

const cardStyle: React.CSSProperties = {
  background: PANEL,
  border: `1.5px solid ${LINE}`,
  borderRadius: 18,
  boxShadow: '0 1px 0 rgba(255,255,255,.03) inset, 0 2px 6px rgba(0,0,0,.5), 0 28px 60px -24px rgba(0,0,0,.9)',
}

/**
 * A block of a scene that arrives, holds, and is taken away again, so one scene can
 * carry two arguments without cutting. Used where the voice moves on but the
 * picture should not: the calldata anatomy leaving for the comparison, the mandate
 * table taking the whole frame from the window.
 */
const Phase: React.FC<{
  from?: number
  to?: number
  children: React.ReactNode
  style?: React.CSSProperties
}> = ({ from = 0, to, children, style }) => {
  const f = useCurrentFrame()
  const pin = easeOut(interpolate(f, [from, from + 18], [0, 1], CLAMP))
  const pout = to === undefined ? 0 : easeInOut(interpolate(f, [to, to + 16], [0, 1], CLAMP))
  if (f < from - 1 || pout >= 1) return null
  return (
    <div
      style={{
        ...style,
        opacity: pin * (1 - pout),
        transform: `translateY(${(1 - pin) * 18 - pout * 14}px)`,
      }}
    >
      {children}
    </div>
  )
}

/** A number that counts itself up, in tabular figures so nothing shifts. */
const Counter: React.FC<{ to: number; delay: number; dur?: number; style?: React.CSSProperties }> = ({
  to,
  delay,
  dur = 54,
  style,
}) => {
  const f = useCurrentFrame()
  // Ease the 0..1 progress, then scale - easing the interpolated value instead runs the cubic on the
  // count itself, and easeOut(1700) is 4,904,335,100 rather than 1,700.
  const n = Math.round(easeOut(interpolate(f, [delay, delay + dur], [0, 1], CLAMP)) * to)
  return <span style={{ ...TABULAR, ...style }}>{n.toLocaleString('en-US')}</span>
}

/** A labelled hole where footage will go, for the terminal takes. */
const Missing: React.FC<{ name: string }> = ({ name }) => (
  <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', background: INK_DEEP }}>
    <div style={{ position: 'absolute', right: -200, bottom: -260, opacity: 0.09 }}>
      <Guilloche size={720} color={BRASS} />
    </div>
    <div style={{ position: 'relative', textAlign: 'center' }}>
      <Eyebrow delay={0}>Not captured</Eyebrow>
      <div style={{ height: 14 }} />
      <div style={{ fontFamily: MONO, fontSize: 40, color: TEXT }}>clips/{name}.mp4</div>
      <div style={{ height: 12 }} />
      <div style={{ fontFamily: SANS, fontSize: 21, color: MUTED }}>
        record the terminal, then run <span style={{ color: BRASS, fontWeight: 600 }}>npm run clips</span>
      </div>
    </div>
  </AbsoluteFill>
)

/**
 * The same window as BrowserFrame, but with a terminal's title bar instead of an
 * address pill: the MCP server and the test run are not web pages, and a browser
 * chrome around a shell would be a small lie about what is being shown.
 */
const TerminalFrame: React.FC<{
  clip: string
  title: string
  width: number
  delay?: number
  startFrom?: number
  rate?: number
  dur?: number
}> = ({ clip, title, width, delay = 0, startFrom = 0, rate = 1, dur = 360 }) => {
  const f = useCurrentFrame()
  const enter = easeOut(interpolate(f, [delay, delay + 26], [0, 1], CLAMP))
  const push = interpolate(f, [0, dur], [1, 1.03], CLAMP)
  const BAR = 46
  const vh = (width * SRC_H) / SRC_W
  return (
    <div
      style={{
        width,
        opacity: enter,
        transform: `translateY(${(1 - enter) * 28}px) scale(${push})`,
        transformOrigin: 'center center',
        borderRadius: 18,
        overflow: 'hidden',
        ...cardStyle,
      }}
    >
      <div
        style={{
          height: BAR,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '0 18px',
          background: PANEL_SOFT,
          borderBottom: `1.5px solid ${LINE}`,
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 11, height: 11, borderRadius: 99, background: LINE_STRONG }} />
          ))}
        </div>
        <span style={{ fontFamily: MONO, fontSize: 19, color: FAINT, letterSpacing: '-0.01em' }}>{title}</span>
      </div>
      <div style={{ width, height: vh, position: 'relative', overflow: 'hidden', background: INK_DEEP }}>
        {hasClip(clip) ? (
          <OffthreadVideo
            src={staticFile(`clips/${clip}.mp4`)}
            startFrom={Math.round(startFrom * FPS)}
            playbackRate={rate}
            muted
            style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }}
          />
        ) : (
          <Missing name={clip} />
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ layouts */

/**
 * Footage beside type. A text column on the left, the window on the right. The
 * heading sits high, anything the scene wants to say goes under it, and a foot
 * slot sits on the baseline.
 */
const SIDE_FRAME_W = 1120
const Side: React.FC<{
  step?: number
  /** Anything above the step number: the lockup, the first time it appears. */
  head?: React.ReactNode
  eyebrow: string
  lines: HeadLine[]
  size?: number
  children?: React.ReactNode
  foot?: React.ReactNode
  frame: React.ReactNode
  out?: number
  frameW?: number
  colW?: number
}> = ({ step, head, eyebrow, lines, size = 54, children, foot, frame, out, frameW = SIDE_FRAME_W, colW = 560 }) => (
  <AbsoluteFill>
    <div style={{ position: 'absolute', left: 96, top: 104, width: colW }}>
      {head}
      {step !== undefined && (
        <>
          <StepNumber n={step} delay={2} size={96} out={out} />
          <div style={{ height: 20 }} />
        </>
      )}
      <Eyebrow delay={6} out={out}>
        {eyebrow}
      </Eyebrow>
      <div style={{ height: 18 }} />
      <Headline lines={lines} delay={10} size={size} out={out} />
      <div style={{ height: 38 }} />
      {children}
    </div>
    <div style={{ position: 'absolute', left: 96, bottom: 92, width: colW }}>{foot}</div>
    <div
      style={{
        position: 'absolute',
        right: 72,
        top: 0,
        bottom: 0,
        width: frameW,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {frame}
    </div>
  </AbsoluteFill>
)

/**
 * Footage first. The window takes the width; beneath it one strip carries the step,
 * its title, and on the right whatever the scene is proving.
 */
const WIDE_FRAME_W = 1440
const Wide: React.FC<{
  step: number
  eyebrow: string
  title: string
  note?: React.ReactNode
  right?: React.ReactNode
  frame: React.ReactNode
}> = ({ step, eyebrow, title, note, right, frame }) => (
  <AbsoluteFill>
    <div style={{ position: 'absolute', left: (1920 - WIDE_FRAME_W) / 2, top: 26 }}>{frame}</div>
    <div
      style={{
        position: 'absolute',
        left: (1920 - WIDE_FRAME_W) / 2,
        right: (1920 - WIDE_FRAME_W) / 2,
        top: 896,
        height: 168,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
        <StepNumber n={step} delay={4} size={104} />
        <div>
          <Eyebrow delay={8}>{eyebrow}</Eyebrow>
          <div style={{ height: 10 }} />
          <Reveal delay={12}>
            <div
              style={{
                fontFamily: SERIF,
                fontSize: 40,
                fontWeight: 500,
                letterSpacing: '-0.015em',
                color: TEXT,
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </div>
          </Reveal>
          <div style={{ height: 10 }} />
          <div style={{ height: 32 }}>{note}</div>
        </div>
      </div>
      <div style={{ width: 580, flexShrink: 0 }}>{right}</div>
    </div>
  </AbsoluteFill>
)

/* =================================================================== S00 == */
/*
 * Cold open. No title card and no wordmark: the first thing in the film is the
 * artifact, on a block explorer that is not ours, with the hash spelled out in full
 * so it can be pasted into any explorer and checked.
 */

const at00 = cue('v00')
const sc00 = scn('v00')

const S00_SHOTS: Shot[] = [
  { clip: 'explorer', startFrom: 1.0, path: '/web3/explorer/xlayer/tx/0xb896…' },
]
const S00_FOCUS: Focus[] = [
  { rect: box(800, 420, 1.12), from: 0, to: sc00(4.4), move: 1.4 }, // the transaction, whole
  { rect: box(800, 600, 1.35), from: sc00(4.8), to: 99, move: 1.2 }, // down toward the input data
]

const S00: React.FC = () => (
  <>
    <Backdrop rosette="left" />
    {/*
      Laid out by hand rather than through Side: the hash has to sit under the
      eyebrow and above a headline that does not arrive until six seconds in, and
      Side puts its children below the headline.
    */}
    <div style={{ position: 'absolute', left: 96, top: 132, width: 604 }}>
      <Eyebrow delay={4}>X Layer mainnet</Eyebrow>
      <div style={{ height: 26 }} />
      <Rise delay={at00(0.4)} distance={14}>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 26,
            lineHeight: 1.5,
            color: TEXT,
            wordBreak: 'break-all',
            ...TABULAR,
          }}
        >
          <span style={{ color: FAINT }}>0x</span>
          {TX.slice(2)}
        </div>
      </Rise>
      <div style={{ height: 28 }} />
      <div style={{ display: 'flex', gap: 12 }}>
        <Chip tone="neutral" delay={at00(2.5)} size={22}>
          Block {BLOCK}
        </Chip>
        <Chip tone="brass" delay={at00(2.9)} size={22}>
          Chain 196
        </Chip>
      </div>
      <div style={{ height: 54 }} />
      <Hairline delay={at00(5.2)} color={LINE} width={520} />
      <div style={{ height: 36 }} />
      <Headline lines={['The stock price was', { em: 'checked in the same send.' }]} delay={at00(5.6)} size={50} />
    </div>
    <div style={{ position: 'absolute', left: 96, bottom: 100, width: 604 }}>
      <Caption from={at00(7.6)} width={560} size={28}>
        One transaction released the money.
      </Caption>
    </div>
    <div
      style={{
        position: 'absolute',
        right: 72,
        top: 0,
        bottom: 0,
        width: 1080,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <BrowserFrame
        shots={S00_SHOTS}
        focus={S00_FOCUS}
        host="www.okx.com"
        width={1080}
        dur={durOf('v00')}
        delay={0}
      />
    </div>
  </>
)

/* =================================================================== S01 == */
/*
 * The hero beat: what is actually inside those 1,700 bytes, and why one send
 * rather than two. The left column is the artifact - a byte for every byte, which
 * is the only honest way to draw "none of it is padding". The right column is the
 * reading of it, and it changes its mind halfway through the scene.
 *
 * Only two spans of the calldata are drawn as bytes anyone can check: the four-byte
 * selector at the head, and the eleven ASCII bytes of the feed id. The rest is
 * counted, not transcribed - the film does not know where the signatures sit inside
 * the package, so it does not pretend to.
 */

const at01 = cue('v01')
const S01_SWAP = at01(10.7)
const S01_CARDS = at01(2.6)
const S01_PIPS = at01(4.4)
const S01_FEED = at01(6.2)
const S01_SELECTOR = at01(7.5)
const S01_FLOW = at01(11.1)
const S01_FEE = at01(17.0)

const TICKS_PER_ROW = 60
const TICK_W = 11
const TICK_GAP = 2

/** One mark for each byte of the calldata, filling as the counter runs. */
const ByteField: React.FC<{ delay: number; dur: number }> = ({ delay, dur }) => {
  const f = useCurrentFrame()
  const shown = easeOut(interpolate(f, [delay, delay + dur], [0, 1], CLAMP)) * CALLDATA_BYTES
  const rows = Math.ceil(CALLDATA_BYTES / TICKS_PER_ROW)
  return (
    <div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} style={{ display: 'flex', gap: TICK_GAP, marginBottom: TICK_GAP + 3 }}>
          {Array.from({ length: Math.min(TICKS_PER_ROW, CALLDATA_BYTES - r * TICKS_PER_ROW) }, (_, c) => {
            const i = r * TICKS_PER_ROW + c
            const on = i < shown
            // The first four bytes are the selector, and stay brass all scene.
            const head = i < 4
            // A brighter leading edge, so the fill reads as a fill and not a wipe.
            const edge = on && i > shown - 40
            return (
              <span
                key={c}
                style={{
                  width: TICK_W,
                  height: 7,
                  borderRadius: 1,
                  background: head ? BRASS : edge ? BRASS_BRIGHT : on ? 'rgba(154,163,178,.5)' : 'rgba(255,255,255,.05)',
                }}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** Three of five signers, as filled and empty seals. */
const Pips: React.FC<{ delay: number }> = ({ delay }) => {
  const f = useCurrentFrame()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      {Array.from({ length: 5 }, (_, i) => {
        const signed = i < 3
        const p = easeOut(interpolate(f, [delay + i * 5, delay + i * 5 + 14], [0, 1], CLAMP))
        return (
          <span
            key={i}
            style={{
              width: 26,
              height: 26,
              borderRadius: 99,
              border: `2px solid ${signed ? BRASS : LINE_STRONG}`,
              background: signed ? BRASS : 'transparent',
              opacity: signed ? p : 0.5 + 0.5 * p,
              transform: `scale(${0.7 + 0.3 * p})`,
            }}
          />
        )
      })}
      <div style={{ width: 8 }} />
      <Rise delay={delay + 18} distance={10}>
        <span style={{ fontFamily: SANS, fontSize: 25, color: MUTED }}>
          signed by <span style={{ color: TEXT, fontWeight: 600 }}>3 of 5</span> RedStone signers
        </span>
      </Rise>
    </div>
  )
}

/** One step of a transaction flow, as a box on a rule. */
const FlowBox: React.FC<{
  kicker: string
  label: string
  delay: number
  width: number | string
  tone?: 'muted' | 'brass'
}> = ({ kicker, label, delay, width, tone = 'muted' }) => {
  const brass = tone === 'brass'
  return (
    <Rise
      delay={delay}
      distance={14}
      style={{
        width,
        boxSizing: 'border-box',
        padding: '20px 24px',
        borderRadius: 14,
        background: brass ? BRASS_WASH : 'rgba(255,255,255,.03)',
        border: `1.5px solid ${brass ? 'rgba(201,162,39,.45)' : LINE}`,
      }}
    >
      <div
        style={{
          fontFamily: SANS,
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: brass ? BRASS : FAINT,
        }}
      >
        {kicker}
      </div>
      <div style={{ height: 10 }} />
      <div style={{ fontFamily: MONO, fontSize: 25, color: brass ? TEXT : MUTED, letterSpacing: '-0.01em' }}>
        {label}
      </div>
    </Rise>
  )
}

const S01: React.FC = () => (
  <>
    <Backdrop rosette="right" />

    {/* The strip that holds all scene: which transaction this is. */}
    <div
      style={{
        position: 'absolute',
        left: 96,
        right: 96,
        top: 88,
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
      }}
    >
      <Eyebrow delay={2}>Inside one transaction</Eyebrow>
      <Rise delay={6} distance={10}>
        <Mono size={22} color={FAINT}>
          {TX_SHORT} · block {BLOCK}
        </Mono>
      </Rise>
    </div>

    {/* Left: the artifact. */}
    <div style={{ position: 'absolute', left: 96, top: 158, width: 800 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 22 }}>
        <div style={{ fontFamily: SERIF, fontSize: 132, fontWeight: 500, letterSpacing: '-0.03em', color: TEXT, lineHeight: 1 }}>
          <Counter to={CALLDATA_BYTES} delay={at01(0.2)} dur={62} />
        </div>
        <div style={{ fontFamily: SANS, fontSize: 28, color: MUTED, paddingBottom: 12 }}>
          bytes of
          <br />
          calldata
        </div>
      </div>
      <div style={{ height: 22 }} />
      <Body delay={at01(1.9)} size={27} width={760}>
        None of it is padding.
      </Body>
      <div style={{ height: 30 }} />
      <ByteField delay={at01(0.2)} dur={62} />
      <div style={{ height: 34 }} />
      <Pips delay={S01_PIPS} />
    </div>

    {/* Right, first half: what the bytes say. */}
    <Phase from={S01_CARDS} to={S01_SWAP} style={{ position: 'absolute', left: 960, top: 170, width: 864 }}>
      <div style={{ ...cardStyle, padding: 30 }}>
        <Eyebrow delay={S01_CARDS + 8}>Selector</Eyebrow>
        <div style={{ height: 18 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <Rise
            delay={S01_SELECTOR}
            distance={10}
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              background: BRASS_WASH,
              border: '1.5px solid rgba(201,162,39,.45)',
            }}
          >
            <Mono size={34} color={BRASS}>
              {SELECTOR}
            </Mono>
          </Rise>
          <Rise delay={S01_SELECTOR + 10} distance={10}>
            <span style={{ fontFamily: SANS, fontSize: 28, color: FAINT }}>→</span>
          </Rise>
          <Rise delay={S01_SELECTOR + 14} distance={10}>
            <Mono size={30} color={TEXT}>
              {SIGNATURE}
            </Mono>
          </Rise>
        </div>
      </div>

      <div style={{ height: 26 }} />

      <div style={{ ...cardStyle, padding: 30 }}>
        <Eyebrow delay={S01_CARDS + 14}>The feed inside the package</Eyebrow>
        <div style={{ height: 20 }} />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <Mono size={28} color={FAINT} style={{ paddingBottom: 30 }}>
            …
          </Mono>
          {FEED_BYTES.map(([hex, ch], i) => {
            const d = S01_FEED + i * 3
            return (
              <Rise key={i} delay={d} distance={10} style={{ textAlign: 'center', width: 50 }}>
                <Mono size={27} color={BRASS}>
                  {hex}
                </Mono>
                <div style={{ height: 8 }} />
                <div style={{ height: 1.5, background: 'rgba(201,162,39,.35)' }} />
                <div style={{ height: 8 }} />
                <Mono size={25} color={TEXT}>
                  {ch}
                </Mono>
              </Rise>
            )
          })}
          <Mono size={28} color={FAINT} style={{ paddingBottom: 30 }}>
            …
          </Mono>
        </div>
        <div style={{ height: 18 }} />
        <Body delay={S01_FEED + 34} size={23} width={780}>
          The RedStone feed id, as ASCII bytes.
        </Body>
      </div>

      <div style={{ height: 34 }} />
      <SponsorLabel
        name="RedStone"
        role="signs the price package the transaction carries"
        kicker="Price"
        from={S01_CARDS + 18}
        to={S01_SWAP}
        width={620}
      />
    </Phase>

    {/* Right, second half: one send instead of two. */}
    <Phase from={S01_FLOW} style={{ position: 'absolute', left: 960, top: 190, width: 864 }}>
      <div style={{ fontFamily: SANS, fontSize: 24, color: FAINT, letterSpacing: '0.04em' }}>
        <Rise delay={S01_FLOW} distance={10}>
          Most pull-oracle lenders
        </Rise>
      </div>
      <div style={{ height: 18 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <FlowBox kicker="Transaction 1" label="update the price" delay={S01_FLOW + 8} width={404} />
        <Rise delay={S01_FLOW + 26} distance={8}>
          <span style={{ fontFamily: SANS, fontSize: 26, color: FAINT }}>→</span>
        </Rise>
        <FlowBox kicker="Transaction 2" label="borrow" delay={at01(12.8)} width={404} />
      </div>
      <div style={{ height: 16 }} />
      <Rise delay={at01(14.0)} distance={10}>
        <span style={{ fontFamily: SANS, fontSize: 23, color: FAINT }}>- or a wallet that batches them for you</span>
      </Rise>

      <div style={{ height: 40 }} />
      <Hairline delay={at01(15.2)} color={LINE} />
      <div style={{ height: 30 }} />

      <div style={{ fontFamily: SANS, fontSize: 24, color: BRASS, letterSpacing: '0.04em' }}>
        <Rise delay={at01(15.4)} distance={10}>
          Equis
        </Rise>
      </div>
      <div style={{ height: 18 }} />
      <FlowBox kicker="One send" label="verify the price, then borrow" delay={at01(15.7)} width="100%" tone="brass" />

      <div style={{ height: 42 }} />
      <div style={{ display: 'flex', gap: 48 }}>
        <Metric label="Gas used" value={GAS} delay={S01_FEE} size={36} />
        <Metric label="Fee" value={FEE_OKB} hint={FEE_USD} delay={S01_FEE + 8} size={36} tone="brass" />
      </div>
    </Phase>
  </>
)

/* =================================================================== S02 == */
/* What Equis is, and the first time the wordmark appears. */

const at02 = cue('v02')
const sc02 = scn('v02')

const S02_SHOTS: Shot[] = [
  { clip: 'landing', startFrom: 0.6, path: '/' },
  { clip: 'surfaces', at: sc02(7.2), startFrom: 1.2, path: '/', dissolve: 8 },
]
const S02_FOCUS: Focus[] = [
  { rect: box(800, 430, 1.1), from: 0, to: sc02(6.6), move: 1.6 }, // the hero, and the promise under it
  { rect: box(800, 470, 1.25), from: sc02(7.6), to: 99, move: 1.2 }, // the three ways in
]
const S02_STEPS: [string, string, number][] = [
  ['Deposit', 'the tokenized shares', 8.4],
  ['Draw', 'USD.T0 against them', 9.7],
  ['Keep', 'the upside', 11.0],
]

const S02: React.FC = () => (
  <>
    <Backdrop rosette="left" />
    <Side
      step={1}
      head={
        <>
          <Lockup height={74} delay={2} />
          <div style={{ height: 34 }} />
        </>
      }
      eyebrow="What it is"
      lines={['Margin credit against', { em: 'tokenized stocks.' }]}
      size={52}
      colW={600}
      frameW={1060}
      frame={<BrowserFrame shots={S02_SHOTS} focus={S02_FOCUS} width={1060} dur={durOf('v02')} delay={4} />}
    >
      <Body delay={at02(3.0)} size={27} width={560}>
        You hold tokenized NVIDIA. You want dollars. You do not want to sell.
      </Body>
      <div style={{ height: 34 }} />
      <Hairline delay={at02(8.0)} color={LINE} />
      {S02_STEPS.map(([verb, rest, t]) => (
        <Rise key={verb} delay={at02(t)} distance={14}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, padding: '15px 0' }}>
            <span style={{ fontFamily: SERIF, fontSize: 32, fontStyle: 'italic', color: BRASS }}>{verb}</span>
            <span style={{ fontFamily: SANS, fontSize: 26, color: MUTED }}>{rest}</span>
          </div>
          <div style={{ height: 1.5, background: LINE }} />
        </Rise>
      ))}
    </Side>
  </>
)

/* =================================================================== S03 == */
/* The position that transaction opened, read back off the chain. */

const at03 = cue('v03')
const sc03 = scn('v03')

const S03_SHOTS: Shot[] = [
  { clip: 'dashboard', startFrom: 0.8, path: '/app' },
  { clip: 'earn', at: sc03(10.0), startFrom: 0.8, path: '/app/earn', dissolve: 8 },
]
const S03_FOCUS: Focus[] = [
  { rect: box(800, 420, 1.14), from: 0, to: sc03(5.6), move: 1.5 }, // the position card
  { rect: box(800, 520, 1.4), from: sc03(6.0), to: sc03(9.6), move: 1.2 }, // collateral, debt, health
  { rect: box(800, 450, 1.15), from: sc03(10.2), to: 99, move: 1.2 }, // the pool
]

const S03: React.FC = () => (
  <>
    <Backdrop rosette="right" />
    <Side
      step={2}
      eyebrow="The position"
      lines={['Read live from', { em: 'chain 196.' }]}
      size={52}
      colW={620}
      frameW={1040}
      frame={<BrowserFrame shots={S03_SHOTS} focus={S03_FOCUS} width={1040} dur={durOf('v03')} delay={4} />}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
        <Metric label="Collateral" value="0.053946" hint="wNVDAx, wrapped NVIDIA" delay={at03(6.3)} size={44} />
        <Metric label="Debt" value="4.00" hint="USD.T0" delay={at03(8.0)} size={44} />
        <Metric
          label="Health factor"
          value="1.814"
          hint="60% liquidation threshold"
          delay={at03(9.5)}
          size={44}
          tone="good"
        />
      </div>
      <div style={{ height: 40 }} />
      <Rise delay={at03(10.6)} distance={12}>
        <div style={{ ...cardStyle, padding: '20px 24px', width: 620, boxSizing: 'border-box' }}>
          <Eyebrow delay={at03(10.7)}>The pool it drew from</Eyebrow>
          <div style={{ height: 14 }} />
          <Mono size={23} color={MUTED}>
            12.00 supplied · 4.00 borrowed · 33% utilisation · cap 250,000
          </Mono>
        </div>
      </Rise>
    </Side>
  </>
)

/* =================================================================== S04 == */
/*
 * Why the collateral is the wrapper. The diagram is the argument: a wrapper is
 * worth the share price times a multiplier the contract reads onchain, and the
 * multiplier is the box the scene ends on.
 */

const at04 = cue('v04')
const sc04 = scn('v04')

const S04_SHOTS: Shot[] = [{ clip: 'markets', startFrom: 1.0, path: '/app/markets' }]
const S04_FOCUS: Focus[] = [
  { rect: box(800, 450, 1.1), from: 0, to: sc04(12.0), move: 1.6 }, // the three wrappers
  { rect: box(800, 470, 1.4), from: sc04(12.6), to: 99, move: 1.3 }, // a price, and its multiplier
]

const DiagramBox: React.FC<{
  kicker: string
  label: string
  delay: number
  width: number
  tone?: 'muted' | 'brass'
  ring?: number
}> = ({ kicker, label, delay, width, tone = 'muted', ring }) => {
  const f = useCurrentFrame()
  const lit = ring === undefined ? 0 : easeOut(interpolate(f, [ring, ring + 20], [0, 1], CLAMP))
  const brass = tone === 'brass'
  return (
    <Rise
      delay={delay}
      distance={14}
      style={{
        width,
        boxSizing: 'border-box',
        padding: '24px 22px',
        borderRadius: 14,
        textAlign: 'center',
        background: brass ? BRASS_WASH : 'rgba(255,255,255,.03)',
        border: `1.5px solid ${brass ? 'rgba(201,162,39,.45)' : LINE}`,
        boxShadow: lit > 0 ? `0 0 0 ${(2 * lit).toFixed(2)}px rgba(201,162,39,${(0.45 * lit).toFixed(2)})` : undefined,
      }}
    >
      <div
        style={{
          fontFamily: SANS,
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: brass ? BRASS : FAINT,
        }}
      >
        {kicker}
      </div>
      <div style={{ height: 12 }} />
      <div style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 500, color: TEXT, lineHeight: 1.2 }}>{label}</div>
    </Rise>
  )
}

const S04: React.FC = () => (
  <>
    <Backdrop rosette="left" />

    <div style={{ position: 'absolute', left: 96, top: 104, width: 600 }}>
      <StepNumber n={3} delay={2} size={96} />
      <div style={{ height: 20 }} />
      <Eyebrow delay={6}>Collateral</Eyebrow>
      <div style={{ height: 18 }} />
      <Headline lines={['Priced by the wrapper,', { em: 'not the token.' }]} delay={10} size={52} />
      <div style={{ height: 34 }} />
      <Body delay={at04(4.6)} size={27} width={580}>
        The wrapper is where the liquidity a liquidator has to sell into actually sits.
      </Body>
      <div style={{ height: 44 }} />
      <Hairline delay={at04(6.0)} color={LINE} />
      <div style={{ display: 'flex', padding: '14px 0 10px', fontFamily: SANS, fontSize: 17, fontWeight: 600, letterSpacing: '0.24em', textTransform: 'uppercase', color: FAINT }}>
        <span style={{ width: 240 }}>Collateral</span>
        <span style={{ width: 150, textAlign: 'right' }}>LTV</span>
        <span style={{ width: 190, textAlign: 'right' }}>Liquidation</span>
      </div>
      <Hairline delay={at04(6.2)} color={LINE} />
      {MARKETS.map(([sym, ltv, liq], i) => (
        <Rise key={sym} delay={at04(6.4 + i * 0.35)} distance={12}>
          <div style={{ display: 'flex', alignItems: 'baseline', padding: '16px 0' }}>
            <span style={{ width: 240, fontFamily: MONO, fontSize: 27, color: TEXT, ...TABULAR }}>{sym}</span>
            <span style={{ width: 150, textAlign: 'right', fontFamily: MONO, fontSize: 27, color: MUTED, ...TABULAR }}>
              {ltv}
            </span>
            <span style={{ width: 190, textAlign: 'right', fontFamily: MONO, fontSize: 27, color: MUTED, ...TABULAR }}>
              {liq}
            </span>
          </div>
          <div style={{ height: 1.5, background: LINE }} />
        </Rise>
      ))}
    </div>

    {/* The diagram, and the page it is read off. */}
    <div style={{ position: 'absolute', left: 740, top: 150, width: 1084 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <DiagramBox kicker="From the feed" label="share price" delay={at04(9.0)} width={290} />
        <Rise delay={at04(10.2)} distance={8}>
          <span style={{ fontFamily: SERIF, fontSize: 40, color: FAINT }}>×</span>
        </Rise>
        <DiagramBox
          kicker="Read onchain"
          label="wrapper multiplier"
          delay={at04(10.6)}
          width={320}
          ring={at04(15.2)}
        />
        <Rise delay={at04(12.0)} distance={8}>
          <span style={{ fontFamily: SERIF, fontSize: 40, color: FAINT }}>=</span>
        </Rise>
        <DiagramBox kicker="What it is worth" label="wrapper value" delay={at04(12.4)} width={320} tone="brass" />
      </div>
      <div style={{ height: 26 }} />
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Chip tone="neutral" delay={at04(13.5)} size={21}>
          the multiplier is read live from the wrapper, every block
        </Chip>
      </div>
      <div style={{ height: 30 }} />
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <BrowserFrame
          shots={S04_SHOTS}
          focus={S04_FOCUS}
          width={880}
          dur={durOf('v04')}
          delay={at04(1.2)}
          pushIn={[1, 1.025]}
        />
      </div>
    </div>

    <div style={{ position: 'absolute', left: 740, bottom: 76, width: 1084 }}>
      <Caption from={at04(15.2)} width={1084} size={30}>
        That multiplier is the part most tokenized equity lenders get wrong.
      </Caption>
    </div>
  </>
)

/* =================================================================== S05 == */
/*
 * The agent surface. Five tools read; one returns a transaction that has not been
 * signed and cannot be - the server has no key. The strongest thing this scene can
 * say is that what the tool hands back is byte-for-byte the thing that landed in
 * scene one, so the JSON card quotes the same selector and the same byte count.
 */

const at05 = cue('v05')

const S05_JSON: [string, string, string][] = [
  ['"to"', `"${VAULT_SHORT}"`, 'the vault'],
  ['"data"', `"${SELECTOR}…"`, `${CALLDATA_BYTES.toLocaleString('en-US')} bytes`],
  ['"value"', '"0x0"', 'nothing attached'],
]

const S05: React.FC = () => (
  <>
    <Backdrop rosette="right" />

    <div style={{ position: 'absolute', left: 96, top: 104, width: 680 }}>
      <StepNumber n={4} delay={2} size={96} />
      <div style={{ height: 20 }} />
      <Eyebrow delay={6}>Agent interface</Eyebrow>
      <div style={{ height: 18 }} />
      <Headline lines={['Drive it from', { em: 'your editor.' }]} delay={10} size={52} />
      <div style={{ height: 26 }} />
      <Body delay={at05(1.0)} size={25} width={660}>
        Model Context Protocol. Claude Code, Cursor or Codex.
      </Body>
      <div style={{ height: 30 }} />
      <Hairline delay={at05(1.9)} color={LINE} />
      {TOOLS.map(([name, kind], i) => (
        <Rise key={name} delay={at05(2.2 + i * 0.42)} distance={12}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 54,
            }}
          >
            <Mono size={25} color={kind === 'tx' ? TEXT : MUTED}>
              {name}
            </Mono>
            <Chip
              tone={kind === 'tx' ? 'brass' : 'neutral'}
              delay={at05(kind === 'tx' ? 7.5 : 2.4 + i * 0.42)}
              size={18}
            >
              {kind === 'tx' ? 'unsigned tx' : 'read'}
            </Chip>
          </div>
          <div style={{ height: 1.5, background: LINE }} />
        </Rise>
      ))}
      <div style={{ height: 40 }} />
      <Rise delay={at05(18.4)} distance={14}>
        <div style={{ ...cardStyle, padding: '24px 26px', width: 680, boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <svg width="26" height="30" viewBox="0 0 13 15" fill="none">
              <rect x="1" y="6.4" width="11" height="7.6" rx="2" fill={BRASS} />
              <path d="M3.6 6.4V4.3a2.9 2.9 0 015.8 0v2.1" stroke={BRASS} strokeWidth="1.6" />
            </svg>
            <div style={{ fontFamily: SERIF, fontSize: 31, fontWeight: 500, color: TEXT }}>
              The server holds no private key.
            </div>
          </div>
          <div style={{ height: 12 }} />
          <Body delay={at05(21.7)} size={24} width={600}>
            It hands back bytes. A person or a wallet signs them.
          </Body>
        </div>
      </Rise>
    </div>

    <div style={{ position: 'absolute', left: 856, top: 130, width: 968 }}>
      <TerminalFrame
        clip="mcp"
        title="equis-mcp  ·  equis_build_transaction"
        width={968}
        delay={at05(0.6)}
        startFrom={0.5}
        dur={durOf('v05')}
      />
      <div style={{ height: 30 }} />
      <Rise delay={at05(11.0)} distance={16}>
        <div style={{ ...cardStyle, padding: '26px 30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Eyebrow delay={at05(11.1)}>What comes back</Eyebrow>
            <Chip tone="brass" delay={at05(14.4)} size={19}>
              the same selector, the same {CALLDATA_BYTES.toLocaleString('en-US')} bytes
            </Chip>
          </div>
          <div style={{ height: 20 }} />
          <div style={{ fontFamily: MONO, fontSize: 25, lineHeight: 1.75, color: MUTED, ...TABULAR }}>
            <div>{'{'}</div>
            {S05_JSON.map(([k, v, note], i) => (
              <Rise key={k} delay={at05(11.4 + i * 0.5)} distance={8}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ paddingLeft: 34 }}>
                    <span style={{ color: FAINT }}>{k}</span>
                    <span style={{ color: FAINT }}>: </span>
                    <span style={{ color: i === 1 ? BRASS : TEXT }}>{v}</span>
                    {i < S05_JSON.length - 1 ? <span style={{ color: FAINT }}>,</span> : null}
                  </span>
                  <span style={{ fontFamily: SANS, fontSize: 21, color: FAINT }}>{note}</span>
                </div>
              </Rise>
            ))}
            <div>{'}'}</div>
          </div>
        </div>
      </Rise>
    </div>
  </>
)

/* =================================================================== S06 == */
/*
 * The mandate. The window shows the page that grants the key; then the page steps
 * aside and the table takes the frame, because "may" and "may not" is the whole
 * claim and it should be readable from across a room.
 */

const at06 = cue('v06')
const sc06 = scn('v06')

const S06_SWAP = at06(12.4)
const S06_TABLE = at06(12.6)

const S06_SHOTS: Shot[] = [{ clip: 'agent', startFrom: 1.0, path: '/app/agent' }]
const S06_FOCUS: Focus[] = [
  { rect: box(800, 420, 1.1), from: 0, to: sc06(5.0), move: 1.6 }, // the delegate, and the account running it
  { rect: box(800, 500, 1.35), from: sc06(5.4), to: 99, move: 1.3 }, // the mandate table on the page
]
const S06_PROPS: [string, number][] = [
  ['Scoped to named functions', 5.2],
  ['Capped in what it may spend', 8.3],
  ['Expires on its own', 10.6],
]

const Tick: React.FC<{ good: boolean }> = ({ good }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    {good ? (
      <path d="M5 12.5l4.5 4.5L19 7" stroke={SIGNAL} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    ) : (
      <>
        <path d="M6 6l12 12" stroke={ALARM} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M18 6L6 18" stroke={ALARM} strokeWidth="2.4" strokeLinecap="round" />
      </>
    )}
  </svg>
)

const MandateColumn: React.FC<{
  title: string
  rows: string[]
  good: boolean
  delay: number
  foot?: React.ReactNode
}> = ({ title, rows, good, delay, foot }) => (
  <Rise
    delay={delay}
    distance={18}
    style={{
      flex: 1,
      boxSizing: 'border-box',
      padding: '30px 34px',
      borderRadius: 18,
      background: good ? SIGNAL_WASH : ALARM_WASH,
      border: `1.5px solid ${good ? 'rgba(63,182,139,.32)' : 'rgba(229,87,74,.32)'}`,
    }}
  >
    <div
      style={{
        fontFamily: SANS,
        fontSize: 19,
        fontWeight: 600,
        letterSpacing: '0.28em',
        textTransform: 'uppercase',
        color: good ? SIGNAL : ALARM,
      }}
    >
      {title}
    </div>
    <div style={{ height: 22 }} />
    {rows.map((r, i) => (
      <Rise key={r} delay={delay + 12 + i * 6} distance={10}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '11px 0' }}>
          <Tick good={good} />
          <Mono size={29} color={TEXT}>
            {r}
          </Mono>
        </div>
      </Rise>
    ))}
    {foot !== undefined && (
      <>
        <div style={{ height: 20 }} />
        {foot}
      </>
    )}
  </Rise>
)

const S06: React.FC = () => (
  <>
    <Backdrop rosette="left" />
    <Phase to={S06_SWAP} style={{ position: 'absolute', inset: 0 }}>
      <Wide
        step={5}
        eyebrow="EIP-7702"
        title="Your own account runs the delegate"
        note={
          <Rise delay={at06(2.6)} distance={10}>
            <Mono size={22} color={FAINT}>
              delegate {DELEGATE_SHORT}
            </Mono>
          </Rise>
        }
        right={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            {S06_PROPS.map(([label, t]) => (
              <Rise key={label} delay={at06(t)} distance={10}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontFamily: SANS, fontSize: 25, color: MUTED }}>{label}</span>
                  <span style={{ width: 7, height: 7, borderRadius: 99, background: BRASS }} />
                </div>
              </Rise>
            ))}
          </div>
        }
        frame={
          <BrowserFrame
            shots={S06_SHOTS}
            focus={S06_FOCUS}
            width={WIDE_FRAME_W}
            dur={durOf('v06')}
            delay={2}
            origin="center top"
            pushIn={[1, 1.02]}
          />
        }
      />
    </Phase>

    <Phase from={S06_TABLE} style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: 96, top: 118, width: 1200 }}>
        <Eyebrow delay={S06_TABLE + 4}>The mandate</Eyebrow>
        <div style={{ height: 20 }} />
        <Headline lines={['What the key may do,', { em: 'and what it cannot.' }]} delay={S06_TABLE + 8} size={64} />
      </div>
      <div style={{ position: 'absolute', right: 96, top: 132, width: 460, textAlign: 'right' }}>
        <Rise delay={S06_TABLE + 14} distance={12}>
          <Mono size={22} color={FAINT}>
            session delegate
          </Mono>
          <div style={{ height: 10 }} />
          <Mono size={24} color={MUTED}>
            {DELEGATE_SHORT}
          </Mono>
        </Rise>
      </div>
      <div style={{ position: 'absolute', left: 96, right: 96, top: 430, display: 'flex', gap: 44 }}>
        <MandateColumn title="May" rows={MAY} good delay={at06(12.9)} />
        <MandateColumn
          title="May not"
          rows={MAY_NOT}
          good={false}
          delay={at06(15.6)}
          foot={
            <Rise delay={at06(19.0)} distance={10}>
              <div style={{ fontFamily: SANS, fontSize: 24, lineHeight: 1.4, color: MUTED }}>
                No vault action takes a recipient, so there is nowhere to redirect funds to.
              </div>
            </Rise>
          }
        />
      </div>
    </Phase>
  </>
)

/* =================================================================== S07 == */
/* The alert. Short, and light on its feet. */

const at07 = cue('v07')

const Bubble: React.FC<{ delay: number; tone: 'bad' | 'good'; title: string; body: string }> = ({
  delay,
  tone,
  title,
  body,
}) => {
  const bad = tone === 'bad'
  return (
    <Rise
      delay={delay}
      distance={18}
      style={{
        ...cardStyle,
        padding: '24px 28px',
        borderRadius: 18,
        borderTopLeftRadius: 6,
        background: PANEL_SOFT,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ width: 10, height: 10, borderRadius: 99, background: bad ? ALARM : SIGNAL }} />
        <span
          style={{
            fontFamily: SANS,
            fontSize: 19,
            fontWeight: 600,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            color: bad ? ALARM : SIGNAL,
          }}
        >
          {title}
        </span>
      </div>
      <div style={{ height: 14 }} />
      <div style={{ fontFamily: SANS, fontSize: 29, lineHeight: 1.35, color: TEXT }}>{body}</div>
    </Rise>
  )
}

const S07: React.FC = () => (
  <>
    <Backdrop rosette="right" />
    <div style={{ position: 'absolute', left: 96, top: 200, width: 700 }}>
      <StepNumber n={6} delay={2} size={96} />
      <div style={{ height: 20 }} />
      <Eyebrow delay={6}>Alerts</Eyebrow>
      <div style={{ height: 18 }} />
      <Headline lines={['A bot that watches', { em: 'the health factor.' }]} delay={10} size={54} />
      <div style={{ height: 34 }} />
      <Body delay={at07(1.4)} size={27} width={640}>
        It reads the same contracts the app does.
      </Body>
      <div style={{ height: 30 }} />
      <Chip tone="neutral" delay={at07(2.2)} size={24}>
        @EquisAppBot
      </Chip>
    </div>
    <div style={{ position: 'absolute', left: 980, top: 250, width: 720 }}>
      {/*
        * A recording of the bot being used beats a drawing of it, so real footage wins when it exists.
        * The drawn bubbles stay as the fallback - they carry the same two thresholds, so the scene reads
        * either way and nothing has to be re-cut if the take never happens.
        */}
      {hasClip('telegram') ? (
        <TerminalFrame clip="telegram" title="Telegram  ·  @EquisAppBot" width={720} delay={at07(2.4)} dur={durOf('v07')} />
      ) : (
        <>
          <Rise delay={at07(2.8)} distance={14}>
            <LedgerRule delay={at07(2.8)} width={720} />
          </Rise>
          <div style={{ height: 34 }} />
          <Bubble delay={at07(3.4)} tone="bad" title="Alert" body="Health factor below 1.15 - repay, or top up collateral." />
          <div style={{ height: 26 }} />
          <Bubble delay={at07(5.6)} tone="good" title="Recovered" body="Back above 1.25." />
        </>
      )}
    </div>
  </>
)

/* =================================================================== S08 == */
/*
 * Receipts, and the one card that costs something to put on screen: what is not
 * built. A judge can check every line of this scene without asking us anything.
 */

const at08 = cue('v08')

const S08: React.FC = () => (
  <>
    <Backdrop rosette="left" />

    <div style={{ position: 'absolute', left: 96, top: 104, width: 900 }}>
      <StepNumber n={7} delay={2} size={96} />
      <div style={{ height: 20 }} />
      <Eyebrow delay={6}>Receipts</Eyebrow>
      <div style={{ height: 18 }} />
      <Headline lines={['Five contracts,', { em: 'an exact match.' }]} delay={10} size={54} />
      <div style={{ height: 36 }} />
      <Hairline delay={at08(0.8)} color={LINE} />
      {CONTRACTS.map(([label, addr], i) => (
        <Rise key={label} delay={at08(1.0 + i * 0.28)} distance={12}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '15px 0' }}>
            <span style={{ fontFamily: SANS, fontSize: 22, color: FAINT, letterSpacing: '0.04em' }}>{label}</span>
            <Mono size={23} color={TEXT}>
              {addr}
            </Mono>
          </div>
          <div style={{ height: 1.5, background: LINE }} />
        </Rise>
      ))}
      <div style={{ height: 30 }} />
      <div style={{ display: 'flex', gap: 14 }}>
        <Chip tone="good" delay={at08(3.0)} size={22} dot>
          Sourcify · exact match
        </Chip>
        <Chip tone="neutral" delay={at08(3.4)} size={22}>
          X Layer · chain 196
        </Chip>
      </div>
    </div>

    <div style={{ position: 'absolute', left: 1052, top: 128, width: 772 }}>
      <TerminalFrame clip="tests" title="forge test  ·  --fork-url xlayer" width={772} delay={at08(4.0)} dur={durOf('v08')} />
      <div style={{ height: 24 }} />
      <Chip tone="good" delay={at08(5.2)} size={22} dot>
        35 passing against forked mainnet state
      </Chip>
      <div style={{ height: 40 }} />
      <Rise delay={at08(7.2)} distance={16}>
        <div style={{ ...cardStyle, padding: '28px 30px' }}>
          <Eyebrow delay={at08(7.3)} color={MUTED}>
            What is not built
          </Eyebrow>
          <div style={{ height: 22 }} />
          <Rise delay={at08(9.8)} distance={10}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Tick good={false} />
              <span style={{ fontFamily: SANS, fontSize: 27, color: TEXT }}>No yield router</span>
            </div>
          </Rise>
          <div style={{ height: 16 }} />
          <Rise delay={at08(11.4)} distance={10}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Tick good={false} />
              <span style={{ fontFamily: SANS, fontSize: 27, color: TEXT }}>No S&amp;P or Nasdaq collateral</span>
            </div>
          </Rise>
          <div style={{ height: 20 }} />
          <Body delay={at08(14.2)} size={23} width={700}>
            No public price feed exists for them. The README says so too.
          </Body>
        </div>
      </Rise>
    </div>
  </>
)

/* =================================================================== S09 == */
/* The close. The wordmark, one sentence, and where to go. */

const at09 = cue('v09')

const S09_LINES: [string, number][] = [
  ['Credit against tokenized equities on X Layer,', 1.6],
  ['priced by a signature the chain checks itself,', 5.0],
  ['and reachable by a person or an agent.', 8.0],
]

const S09: React.FC = () => (
  <>
    <Backdrop tone="panel" rosette="right" />
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: -30 }}>
        <Lockup height={188} delay={4} />
        <div style={{ height: 46 }} />
        <Hairline delay={at09(1.1)} width={160} color="rgba(201,162,39,.55)" />
        <div style={{ height: 40 }} />
        <div
          style={{
            fontFamily: SERIF,
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 44,
            lineHeight: 1.42,
            color: TEXT,
            textAlign: 'center',
            letterSpacing: '-0.01em',
          }}
        >
          {S09_LINES.map(([line, t], i) => (
            <Reveal key={i} delay={at09(t)}>
              <span style={{ color: i === 1 ? BRASS : TEXT }}>{line}</span>
            </Reveal>
          ))}
        </div>
        <div style={{ height: 56 }} />
        <Rise delay={at09(6.6)} distance={14}>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 34,
              fontWeight: 500,
              color: TEXT,
              border: '1.5px solid rgba(201,162,39,.5)',
              borderRadius: 999,
              padding: '17px 44px',
            }}
          >
            {SITE}
          </div>
        </Rise>
      </div>
    </AbsoluteFill>
  </>
)

/* =================================================================== S10 == */
/*
 * The problem, and the first thing anyone sees.
 *
 * Deliberately no wordmark, no product and no contract address: three holdings, the thing you need,
 * and the single move the chain actually offers you. The film earns the right to talk about calldata
 * only after someone has been told why a loan against these shares would matter.
 */

const at10 = cue('v10')

const HOLDINGS: ReadonlyArray<{ sym: string; name: string }> = [
  { sym: 'NVDAx', name: 'NVIDIA' },
  { sym: 'AAPLx', name: 'Apple' },
  { sym: 'TSLAx', name: 'Tesla' },
]

/** A holding, drawn as a certificate: the ticker large, the company under it. */
const Holding: React.FC<{ sym: string; name: string; delay: number; struck: number }> = ({
  sym,
  name,
  delay,
  struck,
}) => (
  <Rise delay={delay} distance={20} style={{ ...cardStyle, padding: '26px 30px', position: 'relative' }}>
    <div style={{ fontFamily: MONO, fontSize: 34, color: TEXT, letterSpacing: '-0.01em' }}>{sym}</div>
    <div style={{ height: 8 }} />
    <div style={{ fontFamily: SANS, fontSize: 21, color: FAINT }}>{name}</div>
    {/* The line that takes the position away, drawn rather than said. */}
    <div
      style={{
        position: 'absolute',
        left: 30,
        right: 30,
        top: '52%',
        height: 2,
        background: ALARM,
        transformOrigin: 'left center',
        transform: `scaleX(${struck})`,
        opacity: 0.85,
      }}
    />
  </Rise>
)

const S10: React.FC = () => {
  const f = useCurrentFrame()
  const struck = easeInOut(interpolate(f, [at10(7.0), at10(8.6)], [0, 1], CLAMP))
  return (
    <>
      <Backdrop rosette="right" />

      <div style={{ position: 'absolute', left: 96, top: 230, width: 820 }}>
        <Eyebrow delay={4}>Tokenized equities</Eyebrow>
        <div style={{ height: 22 }} />
        <Headline lines={['Your shares are onchain.', { em: 'There is one way out.' }]} delay={10} size={72} />
        <div style={{ height: 36 }} />
        <Body delay={at10(3.4)} size={29} width={760}>
          Real equity, held in a wallet. But the moment you need dollars, the chain offers exactly one
          move.
        </Body>
      </div>

      <div style={{ position: 'absolute', left: 1080, top: 214, width: 730 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {HOLDINGS.map((h, i) => (
            <Holding key={h.sym} sym={h.sym} name={h.name} delay={at10(0.8) + i * 9} struck={struck} />
          ))}
        </div>

        <div style={{ height: 34 }} />
        <Rise delay={at10(7.4)} distance={14}>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: ALARM,
            }}
          >
            Sell
          </div>
          <div style={{ height: 14 }} />
          <div style={{ fontFamily: SANS, fontSize: 25, lineHeight: 1.45, color: MUTED }}>
            The position is gone, and so is the upside you were holding it for.
          </div>
        </Rise>
      </div>
    </>
  )
}

/* ============================================================== composition */

const BODIES: React.FC[] = [S10, S02, S00, S01, S03, S04, S05, S06, S07, S08, S09]

/**
 * Which scenes carry a window of dense footage at the join. Two of those in a row
 * get the short dissolve; everything else gets the long one.
 */
//                 v10    v02   v00   v01    v03   v04   v05   v06   v07   v08   v09
const WINDOWED = [false, true, true, false, true, true, true, true, true, true, false]
const fadeInto = (i: number) => (i > 0 && WINDOWED[i] && WINDOWED[i - 1] ? FADE_OVER_WINDOW : FADE)

/** Fade every scene in over the one before, so cuts never snap. */
const Scene: React.FC<{ first: boolean; fade: number; children: React.ReactNode }> = ({ first, fade, children }) => {
  const f = useCurrentFrame()
  const o = first ? 1 : easeInOut(interpolate(f, [0, fade], [0, 1], CLAMP))
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>
}

export const Equis: React.FC = () => (
  <AbsoluteFill style={{ background: INK }}>
    {SCENES.map((sc, i) => {
      const Body_ = BODIES[i]
      return (
        <Sequence
          key={sc.id}
          from={STARTS[i]}
          // Hold this scene under the next one for exactly as long as that one takes
          // to come up, so the join never shows the page through the gap.
          durationInFrames={sc.dur + (i === SCENES.length - 1 ? 0 : fadeInto(i + 1))}
          name={sc.id}
        >
          <Scene first={i === 0} fade={fadeInto(i)}>
            <Body_ />
          </Scene>
          {/* A section with no recording yet is simply silent; the picture still cuts. */}
          {HAS_VO(sc.id) && (
            <Sequence from={LEAD} layout="none">
              <Audio src={staticFile(`vo/${sc.id}.mp3`)} volume={VO_GAIN} />
            </Sequence>
          )}
        </Sequence>
      )
    })}
  </AbsoluteFill>
)
