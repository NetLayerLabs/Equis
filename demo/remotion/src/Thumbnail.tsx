import React from 'react'
import { AbsoluteFill } from 'remotion'
import {
  BRASS,
  FAINT,
  Guilloche,
  INK,
  LINE,
  LINE_STRONG,
  MONO,
  MUTED,
  PANEL,
  SANS,
  SERIF,
  SIGNAL,
  TABULAR,
  TEXT,
} from './ui'

/**
 * The poster frame, built rather than grabbed.
 *
 * A still lifted out of the film carries the film's own text sizes, which are set to be read at full
 * width with a voice explaining them. On a thumbnail - a few hundred pixels wide in a list, next to
 * other submissions - that reads as grey noise. So this states one claim in type large enough to survive
 * the shrink, and backs it with the two things a judge cannot get from a slide: a mainnet chain id and a
 * live health factor.
 *
 * Rendered at 1920x1080 and downscaled to YouTube's 1280x720, so the type stays sharp.
 */
export const Thumbnail: React.FC = () => (
  <AbsoluteFill style={{ background: INK, overflow: 'hidden' }}>
    {/* The ledger plate, same as the film's backdrop but heavier - it has to survive a downscale. */}
    <AbsoluteFill
      style={{
        backgroundImage: `linear-gradient(${LINE}55 1px, transparent 1px), linear-gradient(90deg, ${LINE}55 1px, transparent 1px)`,
        backgroundSize: '96px 96px',
        maskImage: 'radial-gradient(110% 90% at 30% 20%, black, transparent 78%)',
      }}
    />
    <div style={{ position: 'absolute', right: -280, top: -200, opacity: 0.16 }}>
      <Guilloche size={1280} color={BRASS} />
    </div>

    <div style={{ position: 'absolute', left: 104, top: 96, right: 104 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <span
          style={{
            fontFamily: SERIF,
            fontSize: 44,
            letterSpacing: '0.34em',
            color: TEXT,
            textTransform: 'uppercase',
          }}
        >
          Equis
        </span>
        <span style={{ width: 1, height: 34, background: LINE_STRONG }} />
        <span style={{ fontFamily: SANS, fontSize: 25, letterSpacing: '0.2em', color: BRASS, textTransform: 'uppercase' }}>
          X Layer
        </span>
      </div>

      <div style={{ height: 64 }} />

      {/* One claim, at a size that still reads at 320px wide. */}
      <div style={{ fontFamily: SERIF, fontSize: 132, lineHeight: 1.02, color: TEXT, letterSpacing: '-0.025em' }}>
        Borrow against
        <br />
        tokenized stocks.
        <br />
        <em style={{ fontStyle: 'italic', color: BRASS }}>Never sell them.</em>
      </div>
    </div>

    {/* The receipts strip. Numbers, not adjectives. */}
    <div
      style={{
        position: 'absolute',
        left: 104,
        right: 104,
        bottom: 88,
        display: 'flex',
        alignItems: 'stretch',
        gap: 18,
      }}
    >
      {[
        { label: 'Live on', value: 'X Layer · 196', tone: TEXT },
        { label: 'Health factor', value: '1.814', tone: SIGNAL },
        { label: 'Priced by', value: '3 of 5 signers', tone: TEXT },
        { label: 'Borrow', value: 'one transaction', tone: BRASS },
      ].map((m) => (
        <div
          key={m.label}
          style={{
            flex: 1,
            background: PANEL,
            border: `1px solid ${LINE}`,
            borderRadius: 14,
            padding: '22px 26px',
          }}
        >
          <div
            style={{
              fontFamily: SANS,
              fontSize: 19,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: FAINT,
            }}
          >
            {m.label}
          </div>
          <div style={{ height: 10 }} />
          <div style={{ ...TABULAR, fontFamily: MONO, fontSize: 34, color: m.tone }}>{m.value}</div>
        </div>
      ))}
    </div>

    <div
      style={{
        position: 'absolute',
        left: 104,
        bottom: 44,
        fontFamily: SANS,
        fontSize: 21,
        color: MUTED,
      }}
    >
      Margin credit against tokenized equities, with the price verified inside the borrow itself.
    </div>
  </AbsoluteFill>
)
