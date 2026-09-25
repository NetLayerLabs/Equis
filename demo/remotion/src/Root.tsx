import React from 'react'
import { Composition } from 'remotion'
import { EQUIS_DURATION, Equis, FPS } from './Equis'
import { Thumbnail } from './Thumbnail'

/**
 * One composition, 1920x1080 at 30fps. Its length comes from the narration:
 * src/Equis.tsx adds up every section's recorded duration (or, before the voice
 * pass has run, its estimate) plus each scene's lead-in and tail.
 */
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Equis"
      component={Equis}
      durationInFrames={EQUIS_DURATION}
      fps={FPS}
      width={1920}
      height={1080}
    />
    {/* The poster frame. Built rather than grabbed - see src/Thumbnail.tsx. */}
    <Composition id="Thumbnail" component={Thumbnail} durationInFrames={1} fps={FPS} width={1920} height={1080} />
  </>
)
