import React from 'react'
import {
  AbsoluteFill,
  Freeze,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { loadFont as loadNewsreader } from '@remotion/google-fonts/Newsreader'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadJetBrains } from '@remotion/google-fonts/JetBrainsMono'
import clipManifest from './clips.json'

/**
 * Shared furniture for the Equis demo.
 *
 * Equis is a lending desk, so the film is set like the instrument it lends
 * against: vault ink, engraved hairlines, one brass accent used sparingly, and
 * numbers in tabular figures. A serif speaks, a sans labels, a mono carries
 * anything the chain actually wrote down. Motion is unhurried: things rise a
 * short way and settle, or are uncovered along a rule. Nothing bounces, and the
 * only thing that spins is a guilloche rosette so slowly you have to look.
 */

/* ------------------------------------------------------------------ palette */
/* One source of truth with tailwind.config.ts. Don't invent colours here. */

export const INK = '#07080A'
export const INK_DEEP = '#040507'
export const PANEL = '#0F1216'
export const PANEL_SOFT = '#151A21'
export const LINE = '#1F2631'
export const LINE_STRONG = '#303A49'
export const TEXT = '#ECEEF2'
export const MUTED = '#9AA3B2'
export const FAINT = '#6A7382'
export const BRASS = '#C9A227'
export const BRASS_BRIGHT = '#E3BE4A'
export const SIGNAL = '#3FB68B'
export const ALARM = '#E5574A'

/**
 * On a dark page a "tint" is a wash, not a pastel: the same hue at low alpha
 * over the panel. These are the chip and callout backgrounds.
 */
export const BRASS_WASH = 'rgba(201,162,39,.12)'
export const SIGNAL_WASH = 'rgba(63,182,139,.12)'
export const ALARM_WASH = 'rgba(229,87,74,.12)'
export const NEUTRAL_WASH = 'rgba(255,255,255,.05)'

/* -------------------------------------------------------------------- fonts */

const newsreader = loadNewsreader('normal', { weights: ['400', '500', '600'], subsets: ['latin'] })
loadNewsreader('italic', { weights: ['400', '500'], subsets: ['latin'] })
const inter = loadInter('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] })
const jetbrains = loadJetBrains('normal', { weights: ['400', '500'], subsets: ['latin'] })

export const SERIF = `${newsreader.fontFamily}, "Iowan Old Style", Georgia, serif`
export const SANS = `${inter.fontFamily}, ui-sans-serif, system-ui, sans-serif`
export const MONO = `${jetbrains.fontFamily}, ui-monospace, SFMono-Regular, monospace`

export const SITE = 'tryequis.vercel.app'

/** Figures line up in columns everywhere a number appears. */
export const TABULAR: React.CSSProperties = { fontVariantNumeric: 'tabular-nums lining-nums' }

/* ------------------------------------------------------------------- motion */

const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

export const easeOut = (p: number) => 1 - Math.pow(1 - p, 3)
export const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)

/** 0 to 1 over `dur` frames starting at `delay`, eased out. The one curve used everywhere. */
export const useProgress = (delay = 0, dur = 22) => {
  const f = useCurrentFrame()
  return easeOut(interpolate(f, [delay, delay + dur], [0, 1], CLAMP))
}

/** Rise-and-settle entrance. With `out`, the same move in reverse at that frame. */
export const useRise = (delay = 0, distance = 22, out?: number) => {
  const f = useCurrentFrame()
  const pin = easeOut(interpolate(f, [delay, delay + 22], [0, 1], CLAMP))
  const pout = out === undefined ? 0 : easeInOut(interpolate(f, [out, out + 14], [0, 1], CLAMP))
  return {
    opacity: pin * (1 - pout),
    transform: `translateY(${(1 - pin) * distance - pout * 12}px)`,
  }
}

export const Rise: React.FC<{
  children: React.ReactNode
  delay?: number
  distance?: number
  out?: number
  style?: React.CSSProperties
}> = ({ children, delay = 0, distance = 22, out, style }) => (
  <div style={{ ...useRise(delay, distance, out), ...style }}>{children}</div>
)

/** A rule that draws itself from one end. Engraved, so it draws rather than fades. */
export const Hairline: React.FC<{
  delay?: number
  width?: number | string
  color?: string
  weight?: number
  out?: number
  origin?: 'left' | 'right'
}> = ({ delay = 0, width = '100%', color = LINE_STRONG, weight = 1.5, out, origin = 'left' }) => {
  const f = useCurrentFrame()
  const p = easeInOut(interpolate(f, [delay, delay + 26], [0, 1], CLAMP))
  const o = out === undefined ? 1 : 1 - interpolate(f, [out, out + 14], [0, 1], CLAMP)
  return (
    <div
      style={{
        width,
        height: weight,
        background: color,
        opacity: o,
        transform: `scaleX(${p})`,
        transformOrigin: `${origin} center`,
      }}
    />
  )
}

/**
 * Uncovers its children from behind an edge, as if sliding out from under a rule.
 * `from="below"` rises out of its own baseline; `from="above"` drops from a rule on top.
 */
export const Reveal: React.FC<{
  children: React.ReactNode
  delay?: number
  dur?: number
  from?: 'below' | 'above'
  out?: number
  style?: React.CSSProperties
}> = ({ children, delay = 0, dur = 24, from = 'below', out, style }) => {
  const f = useCurrentFrame()
  const pin = easeOut(interpolate(f, [delay, delay + dur], [0, 1], CLAMP))
  const pout = out === undefined ? 0 : easeInOut(interpolate(f, [out, out + 16], [0, 1], CLAMP))
  const sign = from === 'below' ? 1 : -1
  const shift = (1 - pin) * 104 * sign + pout * 104 * sign
  return (
    <div style={{ overflow: 'hidden', paddingBottom: 4, marginBottom: -4, ...style }}>
      <div style={{ transform: `translateY(${shift}%)`, opacity: Math.min(1, pin * 3) }}>{children}</div>
    </div>
  )
}

/* ------------------------------------------------------------------- motifs */

/**
 * The interference rosette engraved on share certificates, drawn from
 * overlapping ellipses. Straight port of src/components/brand/Motif.tsx so the
 * film and the product are the same drawing: one <svg>, no filters.
 */
export const Guilloche: React.FC<{ size: number; color?: string; opacity?: number; rotate?: number }> = ({
  size,
  color = BRASS,
  opacity = 1,
  rotate = 0,
}) => (
  <svg
    viewBox="0 0 400 400"
    width={size}
    height={size}
    fill="none"
    style={{ color, opacity, transform: `rotate(${rotate}deg)` }}
  >
    {Array.from({ length: 18 }, (_, i) => (
      <ellipse
        key={i}
        cx="200"
        cy="200"
        rx={60 + i * 7}
        ry={150 - i * 5}
        stroke="currentColor"
        strokeWidth="0.6"
        transform={`rotate(${i * 10} 200 200)`}
      />
    ))}
  </svg>
)

/** A hairline that thickens into a brass seam and ends in the seal. Decorative. */
export const LedgerRule: React.FC<{ delay?: number; width?: number | string; out?: number }> = ({
  delay = 0,
  width = '100%',
  out,
}) => {
  const f = useCurrentFrame()
  const p = easeInOut(interpolate(f, [delay, delay + 28], [0, 1], CLAMP))
  const o = out === undefined ? 1 : 1 - interpolate(f, [out, out + 14], [0, 1], CLAMP)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, width, opacity: o * Math.min(1, p * 2) }}>
      <div style={{ flex: 1, height: 1.5, background: LINE_STRONG, transform: `scaleX(${p})`, transformOrigin: 'right center' }} />
      <div style={{ width: 56 * p, height: 1.5, background: 'rgba(201,162,39,.7)' }} />
      <svg viewBox="0 0 24 24" width={22} height={22} fill="none" style={{ flexShrink: 0, opacity: p }}>
        <rect x="1" y="1" width="22" height="22" rx="5" stroke={BRASS} strokeWidth="1.5" />
        <path d="M7 12h10" stroke={BRASS} strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div style={{ flex: 1, height: 1.5, background: LINE_STRONG, transform: `scaleX(${p})`, transformOrigin: 'left center' }} />
    </div>
  )
}

/* ----------------------------------------------------------------- backdrop */

/**
 * Vault ink under a ledger grid, with a guilloche rosette turning off one edge
 * at the speed of a minute hand. `tone="panel"` lifts the whole thing one step
 * for the title and the close, the way the product's cards sit above the page.
 */
export const Backdrop: React.FC<{ tone?: 'ink' | 'panel'; rosette?: 'left' | 'right' | 'none' }> = ({
  tone = 'ink',
  rosette = 'none',
}) => {
  const f = useCurrentFrame()
  const raised = tone === 'panel'
  // The product's .spin-slow is 45s a turn; at 30fps that is 0.267 degrees a frame.
  const turn = f * 0.2667
  const drift = Math.sin(f / 170) * 6
  return (
    <AbsoluteFill style={{ background: raised ? INK_DEEP : INK }}>
      {/* A single soft bloom so the frame is lit from somewhere rather than flat. */}
      <AbsoluteFill
        style={{
          background: raised
            ? 'radial-gradient(120% 90% at 50% 26%, rgba(201,162,39,.10) 0%, rgba(4,5,7,0) 62%)'
            : 'radial-gradient(110% 90% at 68% 24%, rgba(48,58,73,.42) 0%, rgba(7,8,10,0) 60%)',
        }}
      />
      {/* The ledger grid from globals.css, at film scale, drifting a few pixels. */}
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.035) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          backgroundPosition: `${drift}px ${drift * 0.6}px`,
        }}
      />
      {rosette !== 'none' && (
        <div
          style={{
            position: 'absolute',
            [rosette]: -420,
            top: '50%',
            marginTop: -640,
            opacity: raised ? 0.16 : 0.1,
          }}
        >
          <Guilloche size={1280} color={BRASS} rotate={turn} />
        </div>
      )}
      {/* Vignette: the corners of an engraved plate are always darker. */}
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 52%, rgba(0,0,0,.62) 100%)',
        }}
      />
    </AbsoluteFill>
  )
}

/* --------------------------------------------------------------------- type */

export const Eyebrow: React.FC<{
  children: React.ReactNode
  delay?: number
  color?: string
  size?: number
  out?: number
}> = ({ children, delay = 0, color = BRASS, size = 22, out }) => (
  <div
    style={{
      ...useRise(delay, 12, out),
      fontFamily: SANS,
      fontSize: size,
      fontWeight: 600,
      // 0.28em, as on every eyebrow in the product.
      letterSpacing: '0.28em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      color,
    }}
  >
    {children}
  </div>
)

/**
 * Serif headline. Pass `lines`; a line given as `{ em: '...' }` is set in brass
 * italic, the way the site emphasises inside a headline ("not a demo"). Each
 * line is uncovered from its own baseline, a few frames apart.
 */
export type HeadLine = string | { em: string }
export const Headline: React.FC<{
  lines: HeadLine[]
  delay?: number
  size?: number
  color?: string
  emColor?: string
  stagger?: number
  out?: number
  align?: 'left' | 'center'
}> = ({ lines, delay = 0, size = 76, color = TEXT, emColor = BRASS, stagger = 6, out, align = 'left' }) => (
  <div
    style={{
      fontFamily: SERIF,
      fontSize: size,
      lineHeight: 1.1,
      letterSpacing: '-0.015em',
      fontWeight: 500,
      color,
      textAlign: align,
    }}
  >
    {lines.map((l, i) => (
      <Reveal
        key={i}
        delay={delay + i * stagger}
        out={out}
        style={{ paddingBottom: size * 0.16, marginBottom: -size * 0.16 }}
      >
        {typeof l === 'string' ? (
          <span>{l}</span>
        ) : (
          <span style={{ fontStyle: 'italic', fontWeight: 400, color: emColor }}>{l.em}</span>
        )}
      </Reveal>
    ))}
  </div>
)

export const Body: React.FC<{
  children: React.ReactNode
  delay?: number
  size?: number
  color?: string
  width?: number
  out?: number
}> = ({ children, delay = 0, size = 30, color = MUTED, width = 560, out }) => (
  <div
    style={{
      ...useRise(delay, 18, out),
      fontFamily: SANS,
      fontSize: size,
      lineHeight: 1.45,
      color,
      maxWidth: width,
    }}
  >
    {children}
  </div>
)

/** Inline monospace: a hash, an address, a figure the chain wrote down. */
export const Mono: React.FC<{
  children: React.ReactNode
  size?: number
  color?: string
  weight?: number
  style?: React.CSSProperties
}> = ({ children, size, color = TEXT, weight = 400, style }) => (
  <span
    style={{
      fontFamily: MONO,
      fontSize: size,
      fontWeight: weight,
      color,
      letterSpacing: '-0.01em',
      ...TABULAR,
      ...style,
    }}
  >
    {children}
  </span>
)

/** Large serif numeral for a step, in brass. Lining figures, as on a certificate. */
export const StepNumber: React.FC<{ n: number | string; delay?: number; size?: number; out?: number }> = ({
  n,
  delay = 0,
  size = 120,
  out,
}) => (
  <Reveal delay={delay} out={out}>
    <div
      style={{
        fontFamily: SERIF,
        fontSize: size,
        lineHeight: 0.95,
        fontWeight: 400,
        letterSpacing: '-0.03em',
        color: BRASS,
        ...TABULAR,
      }}
    >
      {typeof n === 'number' ? String(n).padStart(2, '0') : n}
    </div>
  </Reveal>
)

/* -------------------------------------------------------------- small parts */

export const Card: React.FC<{
  children: React.ReactNode
  delay?: number
  pad?: number
  width?: number | string
  out?: number
  style?: React.CSSProperties
}> = ({ children, delay = 0, pad = 32, width, out, style }) => (
  <div
    style={{
      ...useRise(delay, 22, out),
      width,
      background: PANEL,
      border: `1.5px solid ${LINE}`,
      // rounded-card is 0.875rem in the app; 18 is the same corner at film scale.
      borderRadius: 18,
      padding: pad,
      boxShadow: '0 1px 0 rgba(255,255,255,.03) inset, 0 2px 6px rgba(0,0,0,.5), 0 28px 60px -24px rgba(0,0,0,.9)',
      ...style,
    }}
  >
    {children}
  </div>
)

/**
 * A label/value pair with the value in tabular figures: the product's basic
 * unit of data, and the film's. The app sets the label at 11px over a 20px
 * value; these are the same proportions at film scale, driven by `size`.
 */
export const Metric: React.FC<{
  label: React.ReactNode
  value: React.ReactNode
  hint?: React.ReactNode
  delay?: number
  tone?: 'default' | 'good' | 'bad' | 'danger' | 'brass'
  size?: number
  out?: number
  style?: React.CSSProperties
}> = ({ label, value, hint, delay = 0, tone = 'default', size = 40, out, style }) => {
  const color =
    tone === 'bad' || tone === 'danger' ? ALARM : tone === 'good' ? SIGNAL : tone === 'brass' ? BRASS : TEXT
  return (
    <div style={{ ...useRise(delay, 14, out), ...style }}>
      <div
        style={{
          fontFamily: SANS,
          fontSize: size * 0.55,
          fontWeight: 500,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: FAINT,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>
      <div style={{ height: size * 0.14 }} />
      <div style={{ fontFamily: MONO, fontSize: size, fontWeight: 400, lineHeight: 1.1, color, ...TABULAR }}>
        {value}
      </div>
      {hint !== undefined && (
        <div style={{ marginTop: size * 0.1, fontFamily: SANS, fontSize: size * 0.55, color: FAINT }}>{hint}</div>
      )}
    </div>
  )
}

const CHIP_TONES = {
  neutral: { bg: NEUTRAL_WASH, fg: MUTED, bd: 'rgba(255,255,255,.08)' },
  good: { bg: SIGNAL_WASH, fg: SIGNAL, bd: 'rgba(63,182,139,.28)' },
  bad: { bg: ALARM_WASH, fg: ALARM, bd: 'rgba(229,87,74,.28)' },
  brass: { bg: BRASS_WASH, fg: BRASS, bd: 'rgba(201,162,39,.30)' },
} as const

/** The product's own pill: a small radius, not a lozenge, and a hairline round it. */
export const Chip: React.FC<{
  children: React.ReactNode
  tone?: keyof typeof CHIP_TONES
  delay?: number
  size?: number
  dot?: boolean
  out?: number
}> = ({ children, tone = 'brass', delay = 0, size = 22, dot, out }) => {
  const t = CHIP_TONES[tone]
  return (
    <span
      style={{
        ...useRise(delay, 10, out),
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.42,
        fontFamily: SANS,
        fontSize: size,
        fontWeight: 500,
        lineHeight: 1,
        color: t.fg,
        background: t.bg,
        border: `1px solid ${t.bd}`,
        borderRadius: 7,
        padding: `${size * 0.4}px ${size * 0.66}px`,
        whiteSpace: 'nowrap',
      }}
    >
      {dot && <span style={{ width: size * 0.34, height: size * 0.34, borderRadius: 99, background: t.fg }} />}
      {children}
    </span>
  )
}

/** A short on-screen phrase that echoes the narration, set against a brass rule. */
export const Caption: React.FC<{
  children: React.ReactNode
  from?: number
  to?: number
  size?: number
  width?: number
  rule?: string
}> = ({ children, from = 0, to, size = 31, width = 470, rule = BRASS }) => {
  const f = useCurrentFrame()
  const line = easeInOut(interpolate(f, [from, from + 22], [0, 1], CLAMP))
  const out = to === undefined ? 1 : 1 - interpolate(f, [to, to + 14], [0, 1], CLAMP)
  return (
    <div style={{ display: 'flex', gap: 22, width, opacity: out }}>
      <div style={{ width: 2.5, background: rule, transform: `scaleY(${line})`, transformOrigin: 'top', flexShrink: 0 }} />
      <div
        style={{
          ...useRise(from + 6, 14),
          fontFamily: SERIF,
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: size,
          lineHeight: 1.32,
          color: TEXT,
          padding: '2px 0 4px',
        }}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * Lower third naming who is doing the work. A rule draws, the name rises out
 * from behind it and the role drops from under it. Text only: no logos.
 */
export const SponsorLabel: React.FC<{
  name: string
  role: string
  from?: number
  to?: number
  width?: number
  kicker?: string
}> = ({ name, role, from = 0, to, width = 520, kicker = 'Doing the work' }) => {
  const f = useCurrentFrame()
  if (f < from - 1 || (to !== undefined && f > to + 20)) return null
  return (
    <div style={{ width }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Reveal delay={from + 8} out={to}>
          <div style={{ fontFamily: SERIF, fontSize: 46, fontWeight: 500, letterSpacing: '-0.015em', color: TEXT, lineHeight: 1.12 }}>
            {name}
          </div>
        </Reveal>
        <Reveal delay={from + 14} out={to}>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color: BRASS,
            }}
          >
            {kicker}
          </div>
        </Reveal>
      </div>
      <div style={{ height: 10 }} />
      <Hairline delay={from} color={BRASS} weight={1.5} out={to} />
      <div style={{ height: 12 }} />
      <Reveal delay={from + 14} from="above" out={to}>
        <div style={{ fontFamily: SANS, fontSize: 24, lineHeight: 1.3, color: MUTED, whiteSpace: 'nowrap' }}>{role}</div>
      </Reveal>
    </div>
  )
}

/** A very thin brass line along the bottom edge: where we are in the film. */
export const ProgressRail: React.FC<{ total: number; color?: string }> = ({ total, color = BRASS }) => {
  const f = useCurrentFrame()
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, background: 'rgba(201,162,39,.12)' }} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          height: 4,
          width: `${(f / Math.max(1, total - 1)) * 100}%`,
          background: color,
        }}
      />
    </AbsoluteFill>
  )
}

/* -------------------------------------------------------------------- brand */

/** public/equis-header.png: the engraved seal, EQUIS, and the line under it. */
const LOCKUP_W = 900
const LOCKUP_H = 252
/** Where the seal ends and the word begins, as a fraction of the artwork's width. */
const SEAL_SPLIT = 0.3

const hexToHsl = (hex: string) => {
  const h = hex.replace('#', '')
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const r = parseInt(n.slice(0, 2), 16) / 255
  const g = parseInt(n.slice(2, 4), 16) / 255
  const b = parseInt(n.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l }
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const hue =
    max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: hue * 60, s, l }
}

/**
 * The artwork is brass on black with its own glow, and the glow is most of why
 * it looks engraved rather than printed - so it is tinted with a filter rather
 * than re-inked through a mask. A filter is also the only tint that survives
 * whatever stacking context a scene happens to wrap the lockup in.
 * Brass (#C9A227) sits at h 46, s .68, l .47; the filter walks the artwork from
 * there to wherever `color` is.
 */
const tintFilter = (color?: string) => {
  if (!color || !color.startsWith('#')) return undefined
  const { h, s, l } = hexToHsl(color)
  const sat = s < 0.08 ? 0 : Math.min(2, s / 0.68)
  const bright = Math.max(0.4, Math.min(2.2, l / 0.47))
  return `hue-rotate(${Math.round(h - 46)}deg) saturate(${sat.toFixed(2)}) brightness(${bright.toFixed(2)})`
}

/**
 * The artwork's black ground is within a couple of values of INK, and `screen`
 * removes what is left of it wherever the scene has not isolated blending. The
 * feathered edge mask covers the case where it has: a near-black rectangle with
 * no edge, on a near-black page.
 */
const LOCKUP_FEATHER =
  'radial-gradient(115% 130% at 50% 50%, #000 62%, rgba(0,0,0,.65) 84%, rgba(0,0,0,0) 100%)'

const LockupArt: React.FC<{ width: number; height: number; left: number; filter?: string }> = ({
  width,
  height,
  left,
  filter,
}) => (
  <Img
    src={staticFile('equis-header.png')}
    style={{
      position: 'absolute',
      left,
      bottom: 0,
      width,
      height,
      display: 'block',
      mixBlendMode: 'screen',
      filter,
      WebkitMaskImage: LOCKUP_FEATHER,
      maskImage: LOCKUP_FEATHER,
      WebkitMaskSize: '100% 100%',
      maskSize: '100% 100%',
      WebkitMaskRepeat: 'no-repeat',
      maskRepeat: 'no-repeat',
    }}
  />
)

/**
 * Seal and word together with a quiet entrance: the seal is uncovered from its
 * base upwards, then the word is wiped out from behind it, left to right, the
 * way a plate inks. Both halves are windows onto one image - no transforms and
 * no opacity on the way down, so the artwork keeps blending with the page.
 */
export const Lockup: React.FC<{ height?: number; delay?: number; color?: string }> = ({
  height = 150,
  delay = 0,
  color,
}) => {
  const f = useCurrentFrame()
  const seal = easeInOut(interpolate(f, [delay, delay + 26], [0, 1], CLAMP))
  const word = easeOut(interpolate(f, [delay + 14, delay + 46], [0, 1], CLAMP))
  const w = (height * LOCKUP_W) / LOCKUP_H
  const sealW = w * SEAL_SPLIT
  const filter = tintFilter(color)
  return (
    <div style={{ position: 'relative', width: w, height }}>
      <div style={{ position: 'absolute', left: 0, bottom: 0, width: sealW, height, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, bottom: 0, width: sealW, height: height * seal, overflow: 'hidden' }}>
          <LockupArt width={w} height={height} left={0} filter={filter} />
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: sealW,
          bottom: 0,
          width: (w - sealW) * word,
          height,
          overflow: 'hidden',
        }}
      >
        <LockupArt width={w} height={height} left={-sealW} filter={filter} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ browser frame */

/**
 * The page is 1600x900 CSS pixels. FOCUS rectangles are always given in those
 * pixels, whatever the clip's own pixel size: the beats re-filmed at device
 * scale 2 are 3200x1800 files of the same 1600x900 page, and BrowserFrame lays
 * every clip out at the same CSS size. The extra pixels buy depth, not width.
 */
export const SRC_W = 1600
export const SRC_H = 900

export type Focus = {
  /** Target in CSS pixels of the 1600x900 page: [x, y, width, height]. */
  rect: [number, number, number, number]
  /** Scene seconds at which the camera starts moving in, and starts leaving. */
  from: number
  to: number
  /** Seconds the move takes. */
  move?: number
  /** Upper bound on the camera's zoom. */
  maxZoom?: number
  /**
   * Largest enlargement of the page on the canvas for this move, overriding the
   * frame's. 1.4 is all a 1600px take will carry; a 3200px take holds 2 cleanly.
   */
  maxMag?: number
}

export type Shot = {
  /** File name in public/clips without the extension. */
  clip: string
  /** Scene seconds at which this shot cuts in (the first is normally 0). */
  at?: number
  /** Seconds into the clip to start from. */
  startFrom?: number
  playbackRate?: number
  /** Holds the frame at `startFrom` instead of playing: a beat on one section. */
  freeze?: boolean
  /** Path shown after the host in the address pill. */
  path?: string
  /** Marks the shot as faster than real time: a quiet "Sped up" note shows in the title bar. */
  fast?: boolean
  /**
   * Frames of cross-fade into this shot. 0 is a straight cut, which is what two
   * views of the same page want: dissolving near-identical frames doubles the text.
   */
  dissolve?: number
}

type Cam = { cx: number; cy: number; z: number }
const FULL: Cam = { cx: SRC_W / 2, cy: SRC_H / 2, z: 1 }

/**
 * `zCap` is how far the camera may push before the picture on the canvas is
 * larger than the frame's `maxMag`; a focus may raise it for its own move.
 */
const camFor = (fo: Focus, zCap: number, capFor: (m: number) => number): Cam => {
  const [x, y, w, h] = fo.rect
  const cap = fo.maxMag === undefined ? zCap : capFor(fo.maxMag)
  const z = Math.max(1, Math.min(fo.maxZoom ?? 4, cap, Math.min(SRC_W / w, SRC_H / h) * 0.92))
  const half = { w: SRC_W / 2 / z, h: SRC_H / 2 / z }
  return {
    z,
    cx: Math.min(SRC_W - half.w, Math.max(half.w, x + w / 2)),
    cy: Math.min(SRC_H - half.h, Math.max(half.h, y + h / 2)),
  }
}

const cameraAt = (t: number, focus: Focus[], zCap: number, capFor: (m: number) => number): Cam => {
  const sorted = [...focus].sort((a, b) => a.from - b.from)
  // A focus that starts at or before zero opens the scene already pushed in.
  const open = sorted[0] && sorted[0].from <= 0 ? camFor(sorted[0], zCap, capFor) : FULL
  const keys: { t: number; c: Cam }[] = [{ t: 0, c: open }]
  sorted.forEach((fo, i) => {
    const move = fo.move ?? 1.2
    const last = keys[keys.length - 1]
    keys.push({ t: Math.max(fo.from, last.t), c: last.c })
    keys.push({ t: Math.max(fo.from, last.t) + move, c: camFor(fo, zCap, capFor) })
    keys.push({ t: Math.max(fo.to, fo.from + move), c: camFor(fo, zCap, capFor) })
    const next = sorted[i + 1]
    if (!next || next.from > fo.to + move) keys.push({ t: fo.to + move, c: FULL })
  })
  for (let i = keys.length - 1; i >= 0; i--) {
    if (t >= keys[i].t) {
      const a = keys[i]
      const b = keys[i + 1]
      if (!b || b.t === a.t) return a.c
      const p = easeInOut(Math.min(1, (t - a.t) / (b.t - a.t)))
      return {
        cx: a.c.cx + (b.c.cx - a.c.cx) * p,
        cy: a.c.cy + (b.c.cy - a.c.cy) * p,
        z: a.c.z + (b.c.z - a.c.z) * p,
      }
    }
  }
  return FULL
}

const manifest = clipManifest as Record<string, { duration?: number | null; width?: number | null }>
export const hasClip = (name: string) => Object.prototype.hasOwnProperty.call(manifest, name)

/** Source pixels per CSS pixel: 2 for the takes filmed at device scale 2. */
export const dprOf = (name: string) => (manifest[name]?.width ?? SRC_W) / SRC_W

/** Plays one clip and holds its last frame if the scene outlasts it. */
const ShotVideo: React.FC<{ shot: Shot }> = ({ shot }) => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const rate = shot.playbackRate ?? 1
  const start = shot.startFrom ?? 0
  const length = manifest[shot.clip]?.duration ?? null
  const lastFrame = length === null ? Infinity : Math.max(0, Math.floor(((length - start) / rate - 0.2) * fps))
  return (
    <Freeze frame={shot.freeze ? 0 : Math.min(f, lastFrame)}>
      <OffthreadVideo
        src={staticFile(`clips/${shot.clip}.mp4`)}
        startFrom={Math.round(start * fps)}
        playbackRate={rate}
        muted
        style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }}
      />
    </Freeze>
  )
}

/**
 * Stands in for footage that has not been recorded yet, so the whole film
 * renders end to end before a single take exists: the skeleton pass is a real
 * edit with labelled holes in it, not a crash.
 */
const MissingClip: React.FC<{ name: string }> = ({ name }) => (
  <AbsoluteFill
    style={{
      background: PANEL,
      backgroundImage:
        'linear-gradient(to right, rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.035) 1px, transparent 1px)',
      backgroundSize: '56px 56px',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <div style={{ position: 'absolute', right: -180, top: -120, opacity: 0.1 }}>
      <Guilloche size={760} color={BRASS} />
    </div>
    <div style={{ position: 'relative', textAlign: 'center' }}>
      <div
        style={{
          fontFamily: SANS,
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          color: BRASS,
        }}
      >
        Not captured
      </div>
      <div style={{ height: 16 }} />
      <div style={{ fontFamily: MONO, fontSize: 46, fontWeight: 500, color: TEXT, letterSpacing: '-0.01em' }}>
        clips/{name}.mp4
      </div>
      <div style={{ height: 16 }} />
      <div style={{ fontFamily: SANS, fontSize: 22, color: MUTED }}>
        1600 x 900, then run <span style={{ color: BRASS, fontWeight: 600 }}>npm run clips</span>
      </div>
    </div>
  </AbsoluteFill>
)

/**
 * A restrained browser window around captured footage.
 *
 * `shots` are cut inside one window, each cross-dissolving into the next; a
 * single take can be passed as `clip` instead. `focus` moves a virtual camera
 * over the 1600x900 footage: it eases toward a rectangle, holds, and eases back
 * (or on to the next rectangle). `pushIn` is the slow scale of the whole window
 * across the scene.
 */
export const BrowserFrame: React.FC<{
  shots?: Shot[]
  /** Shorthand for a scene that holds on one take: same as shots={[{ clip }]}. */
  clip?: string
  width?: number
  delay?: number
  /** Scene length in frames, used to pace the push-in. */
  dur?: number
  pushIn?: [number, number]
  focus?: Focus[]
  origin?: string
  /** Largest enlargement of the 1600px footage on the canvas. */
  maxMag?: number
  /** Host in the address pill, and a path when the shots do not carry their own. */
  host?: string
  path?: string
}> = ({
  shots,
  clip,
  width = 1260,
  delay = 0,
  dur = 360,
  pushIn = [1, 1.035],
  focus = [],
  origin = 'center center',
  maxMag,
  host = SITE,
  path,
}) => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const list: Shot[] = shots && shots.length > 0 ? shots : [{ clip: clip ?? 'untitled' }]
  const enter = easeOut(interpolate(f, [delay, delay + 26], [0, 1], CLAMP))
  const push = interpolate(f, [0, dur], pushIn, CLAMP)

  const BAR = 50
  const vw = width
  const vh = (width * SRC_H) / SRC_W
  const k = vw / SRC_W
  // Without a figure given, every clip in the scene is held to what the softest
  // of them will carry: 1.4x for a 1600px take, 2x for one filmed at scale 2.
  const auto = Math.min(...list.map((sh) => (dprOf(sh.clip) >= 2 ? 2 : 1.4)))
  const capFor = (m: number) => m / (k * pushIn[1])
  const cam = cameraAt(f / fps, focus, capFor(maxMag ?? auto), capFor)
  const tx = vw / 2 - cam.cx * k * cam.z
  const ty = vh / 2 - cam.cy * k * cam.z

  const cuts = list.map((sh) => Math.round((sh.at ?? 0) * fps))
  let active = 0
  cuts.forEach((c, i) => {
    if (f >= c) active = i
  })
  const fadeOf = (i: number) => (i === 0 ? 0 : Math.round(list[i].dissolve ?? 8))

  return (
    <div
      style={{
        width,
        opacity: enter,
        transform: `translateY(${(1 - enter) * 30}px) scale(${push})`,
        transformOrigin: origin,
        borderRadius: 14,
        overflow: 'hidden',
        background: PANEL,
        border: `1.5px solid ${LINE_STRONG}`,
        boxShadow: '0 70px 120px -60px rgba(0,0,0,.95), 0 24px 44px -28px rgba(0,0,0,.8), 0 2px 6px rgba(0,0,0,.5)',
      }}
    >
      <div
        style={{
          height: BAR,
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          background: PANEL_SOFT,
          borderBottom: `1.5px solid ${LINE}`,
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', gap: 9 }}>
          {['rgba(229,87,74,.5)', 'rgba(201,162,39,.5)', 'rgba(63,182,139,.5)'].map((c) => (
            <span key={c} style={{ width: 12, height: 12, borderRadius: 99, background: c }} />
          ))}
        </div>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            height: 34,
            minWidth: 520,
            padding: '0 22px',
            borderRadius: 8,
            background: INK,
            border: `1.5px solid ${LINE}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            fontFamily: SANS,
            fontSize: 21,
            fontWeight: 500,
            color: MUTED,
          }}
        >
          <svg width="13" height="15" viewBox="0 0 13 15" fill="none">
            <rect x="1" y="6.4" width="11" height="7.6" rx="2" fill={BRASS} />
            <path d="M3.6 6.4V4.3a2.9 2.9 0 015.8 0v2.1" stroke={BRASS} strokeWidth="1.6" />
          </svg>
          <span>
            {host}
            <span style={{ color: FAINT }}>{list[active]?.path ?? path ?? ''}</span>
          </span>
        </div>
        {/* One note per run of fast shots, so it does not blink at a cut inside the run. */}
        {list.map((sh, i) => {
          if (!sh.fast || (i > 0 && list[i - 1].fast)) return null
          let end = i
          while (end + 1 < list.length && list[end + 1].fast) end += 1
          const a = cuts[i]
          const b = end + 1 < list.length ? cuts[end + 1] : Infinity
          const o = Math.min(
            interpolate(f, [a, a + 8], [0, 1], CLAMP),
            b === Infinity ? 1 : interpolate(f, [b - 2, b + 8], [1, 0], CLAMP),
          )
          if (o <= 0) return null
          return (
            <div
              key={`fast-${i}`}
              style={{
                position: 'absolute',
                right: 20,
                top: 7,
                height: 36,
                padding: '0 18px',
                borderRadius: 7,
                border: `1.5px solid ${LINE}`,
                background: INK,
                display: 'flex',
                alignItems: 'center',
                fontFamily: SANS,
                fontSize: 22,
                fontWeight: 500,
                color: FAINT,
                opacity: o,
              }}
            >
              Sped up
            </div>
          )
        })}
      </div>

      <div style={{ width: vw, height: vh, position: 'relative', overflow: 'hidden', background: INK }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: vw,
            height: vh,
            transform: `translate(${tx}px, ${ty}px) scale(${cam.z})`,
            transformOrigin: '0 0',
          }}
        >
          {list.map((sh, i) => {
            const fade = fadeOf(i)
            const from = cuts[i]
            const until = i + 1 < list.length ? cuts[i + 1] + fadeOf(i + 1) : Infinity
            if (f < from || f > until) return null
            const o = fade <= 0 ? 1 : interpolate(f, [from, from + fade], [0, 1], CLAMP)
            return (
              <AbsoluteFill key={`${sh.clip}-${i}`} style={{ opacity: o }}>
                {hasClip(sh.clip) ? (
                  <Sequence from={from} layout="none">
                    <ShotVideo shot={sh} />
                  </Sequence>
                ) : (
                  <MissingClip name={sh.clip} />
                )}
              </AbsoluteFill>
            )
          })}
        </div>
      </div>
    </div>
  )
}
