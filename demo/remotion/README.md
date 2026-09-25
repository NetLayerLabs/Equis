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

**2. Footage that can be automated.** Four beats film themselves against the live deployment:

```bash
npm run capture         # all of them
node scripts/capture.mjs markets    # re-shoot one
```

`landing`, `surfaces`, `markets` and `agent` come from tryequis.vercel.app, at 1600x900 with a device
scale factor of 2, so the frames are 3200x1800 and the film can push in without upscaling.

**3. Footage that cannot.** Four beats need a human:

| Clip | Record | Why it cannot be automated |
| --- | --- | --- |
| `explorer.mp4` | 20s | The OKX explorer redirects an automated browser to `web3.okx.com/account/login`, so the automated take came back a 404 page. A signed-in browser serves it fine. |
| `dashboard.mp4` | 20s | `/app` needs a connected wallet holding the position. Playwright cannot sign. |
| `earn.mp4` | 5s | `/app/earn` likewise. Only ~3s is used - it is a cut at the end of the scene. |
| `mcp.mp4` | 40s | A terminal. Run `node scripts/demo-mcp.mjs`, which drives the real server and paces its output for a camera. |
| `tests.mp4` | 25s | A terminal running `forge test`: 35 passing. |
| `telegram.mp4` | 20s | Telegram, showing `/start`, `/markets`, `/position`. Optional - without it the scene draws the two alert bubbles instead. |

Over-length costs nothing - the tail is ignored. Under-length freezes on the last frame rather than
breaking, so err long.

For `explorer.mp4`, open
[the borrow transaction](https://web3.okx.com/explorer/x-layer/evm/tx/0xb896faa0e4965cb5bf4d970b5f7ced9f5eccc6a5ad9083b31bc7c7d662c0b5ee)
and scroll to the input data, so the 1,700 bytes of calldata sit on screen. It carries the cold open and
the hero beat, so it is the one worth shooting carefully.

Record each at 1600x900 or larger, save to `public/clips/<name>.mp4`, then `npm run clips` to measure them.
**Connect the wallet before you hit record** - a fresh browser shows "No wallet detected" and zeroes.

**4. Render.**

```bash
npm run render          # 1080p to out/equis-demo.mp4
npm run render:4k       # the same cut at 2x
npm run thumb           # the poster frame, 1080p png and a 1280x720 jpg for YouTube
```

The thumbnail is its own composition (`src/Thumbnail.tsx`), not a frame lifted out of the film. A still
from the film carries the film's type sizes, which are set to be read at full width with a voice
explaining them; shrunk into a list of other submissions that reads as grey noise. The poster states one
claim large enough to survive the shrink and backs it with a chain id and a live health factor.

## Rules the film follows

Every number on screen comes from one `facts` block at the top of `src/Equis.tsx`, and every one was
read off the chain: the transaction, the block, the calldata size, the fee, the position, the pool.
Nothing is illustrative.

The voice never reads a long number. A block height or a hash spoken aloud is dead air, so those live
in the graphics while the narration carries the argument.

Scene lengths follow the narration, not the other way round. `cue()` scales every in-scene cue by how
long the recorded audio actually came back, so a section that reads 8% quicker does not leave forty
animations trailing behind it.
