# The Equis demo film

A 2m51s film for the OKX Dev Day submission: Remotion for the motion graphics, Playwright for the
screen footage, ElevenLabs for the narration. It renders end to end **before** any footage or voiceover
exists - missing clips become labelled placeholders and missing narration falls back to an estimated
length - so you can watch the cut, then fill the holes.

```bash
npm install
npm run studio          # preview at localhost:3000
```

## Making the real thing

**1. Narration.** Needs an ElevenLabs key, read from an env file *outside* this repo so no secret is
ever written here:

```bash
ELEVEN_ENV=/path/to/your/.env npm run vo
```

That writes `public/vo/v00.mp3` … `v09.mp3` and measures them into `public/vo/durations.json`, which is
what drives every scene's length. The script in `vo-gen.js` is the single source of truth for what is
said; edit it there and re-run.

**2. Footage that can be automated.** Five beats film themselves against the live deployment:

```bash
npm run capture         # all of them
node scripts/capture.mjs explorer   # re-shoot one
```

`landing`, `surfaces`, `markets` and `agent` come from tryequis.vercel.app; `explorer` is the OKX page
for the real borrow transaction. The explorer is a third-party page, so that one is allowed to fail
without killing the run.

**3. Footage that cannot.** Four beats need a human:

| Clip | Why |
| --- | --- |
| `dashboard.mp4` | `/app` needs a connected wallet holding the position. Playwright cannot sign. |
| `earn.mp4` | `/app/earn` likewise, to show the pool at 33% utilisation. |
| `mcp.mp4` | A terminal running the MCP server and returning `equis_build_transaction`. |
| `tests.mp4` | A terminal running `forge test`: 35 passing. |

Record each at 1600x900, save to `public/clips/<name>.mp4`, then `npm run clips` to measure them.
**Connect the wallet before you hit record** - a fresh browser shows "No wallet detected" and zeroes.

**4. Render.**

```bash
npm run render          # 1080p to out/equis-demo.mp4
npm run render:4k       # the same cut at 2x
npm run thumb           # a poster frame
```

## Rules the film follows

Every number on screen comes from one `facts` block at the top of `src/Equis.tsx`, and every one was
read off the chain: the transaction, the block, the calldata size, the fee, the position, the pool.
Nothing is illustrative.

The voice never reads a long number. A block height or a hash spoken aloud is dead air, so those live
in the graphics while the narration carries the argument.

Scene lengths follow the narration, not the other way round. `cue()` scales every in-scene cue by how
long the recorded audio actually came back, so a section that reads 8% quicker does not leave forty
animations trailing behind it.
