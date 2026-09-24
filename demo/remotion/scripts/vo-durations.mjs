// Measures the narration into public/vo/durations.json, which is how the composition knows how long
// each scene has to last. The Remotion bundle runs in a browser and cannot ffprobe anything, so the
// lengths have to be written down before the film is rendered.
//
//   node scripts/vo-durations.mjs
//
// Runs automatically after `npm run vo` and before `npm run studio` / `npm run render`.
//
// It always writes a complete, valid file. Every section vo-gen.js knows about gets an entry, and a
// section whose mp3 has not been generated yet gets 0 -- so the film still renders (with silent,
// zero-length narration slots) before a single word has been spoken, instead of crashing on a
// missing key. Re-run it after generating the voiceover and the real numbers land.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'public', 'vo')
const out = join(dir, 'durations.json')

/** The sections vo-gen.js will produce, read from the script itself so the two cannot drift. */
function expectedIds() {
  const file = join(root, 'vo-gen.js')
  if (existsSync(file)) {
    const ids = [...readFileSync(file, 'utf8').matchAll(/\[\s*'(\d{2})'\s*,/g)].map((m) => `v${m[1]}`)
    if (ids.length) return ids
  }
  // vo-gen.js is missing or written differently: assume the ten sections the film is cut for.
  return Array.from({ length: 10 }, (_, i) => `v${String(i).padStart(2, '0')}`)
}

/** Seconds, to 2dp, or null if ffprobe cannot read the file. */
const probe = (file) => {
  try {
    const seconds = Number.parseFloat(
      execFileSync(
        'ffprobe',
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file],
        { encoding: 'utf8' },
      ).trim(),
    )
    return Number.isFinite(seconds) ? Math.round(seconds * 100) / 100 : null
  } catch {
    return null
  }
}

mkdirSync(dir, { recursive: true })
const found = existsSync(dir)
  ? readdirSync(dir)
      .filter((f) => /^v\d+\.mp3$/.test(f))
      .sort()
  : []

// Expected first so the keys come out in narration order, then anything extra that is on disk.
const ids = [...new Set([...expectedIds(), ...found.map((f) => f.replace(/\.mp3$/, ''))])]
const durations = {}
const missing = []
const unreadable = []
for (const id of ids) {
  const file = join(dir, `${id}.mp3`)
  if (!existsSync(file)) {
    durations[id] = 0
    missing.push(id)
    continue
  }
  const seconds = probe(file)
  if (seconds === null) {
    durations[id] = 0
    unreadable.push(id)
  } else {
    durations[id] = seconds
  }
}

writeFileSync(out, JSON.stringify(durations, null, 1) + '\n')

const total = Object.values(durations).reduce((a, b) => a + b, 0)
const mmss = `${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, '0')}`
console.log(
  `durations.json: ${ids.length - missing.length}/${ids.length} section(s) measured, ${total.toFixed(2)}s of narration (${mmss})`,
)
if (missing.length) console.log(`  not generated yet (recorded as 0): ${missing.join(', ')} - run \`npm run vo\``)
if (unreadable.length) console.log(`  ffprobe could not read (recorded as 0): ${unreadable.join(', ')}`)
