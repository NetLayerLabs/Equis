// Narration for the Equis demo, generated with ElevenLabs.
//   node vo-gen.js              all sections
//   VO_ONLY=v03 node vo-gen.js  one section
// The key and voice are read from an env file OUTSIDE this repo (ELEVEN_ENV, or the
// defaults below), so no secret is ever written here. A local .env also works.
const fs = require('fs')
const ENV_FILES = [process.env.ELEVEN_ENV, '.env', '/Users/mrnetwork/Syntura/video/.env'].filter(Boolean)
for (const file of ENV_FILES) {
  if (!fs.existsSync(file)) continue
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=\s*(.*?)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const key = process.env.ELEVENLABS_API_KEY
if (!key) { console.error('No ELEVENLABS_API_KEY found. Set ELEVEN_ENV to an env file that has it.'); process.exit(1) }
const VOICE = process.env.ELEVENLABS_VOICE || 'CwhRBWXzGAHq8TQ4Fs17'
const MODEL = 'eleven_multilingual_v2'

/*
 * Ten sections, about 160 seconds of speech, which leaves the film around 2:50 once each scene gets
 * its lead-in and its tail - inside the 2-to-4 minute window the brief asks for, with room to breathe.
 *
 * Two rules held throughout. Every sentence is something the footage shows or the chain records: the
 * transaction, the position, the tool output, the test run. And long numbers are never spoken - a block
 * height or a hash read aloud is dead air, so those live in the motion graphics while the voice carries
 * the argument. USD.T0 is spelled phonetically because the ticker defeats text-to-speech.
 */
const SECTIONS = [
  ['00', "This borrow happened on X Layer mainnet. The stock price it was lent against was verified inside the same transaction that released the money."],
  ['01', "Seventeen hundred bytes of calldata, and none of it is padding. That is a RedStone price package, signed by three of five oracles, carrying the NVIDIA feed. Borrow verifies it onchain before it touches the lending pool. Most pull-oracle lenders need two transactions, or a wallet that batches. This is one send, and it cost a sixth of a cent."],
  ['02', "Equis is margin credit against tokenized stocks. You hold tokenized NVIDIA, you want dollars, and you do not want to sell. Deposit the shares, draw tether against them, and keep the upside."],
  ['03', "This is the position that transaction opened, read live from chain one nine six. Wrapped NVIDIA as collateral, four dollars of debt, and a health factor of one point eight one."],
  ['04', "Collateral is the non-rebasing wrapper, not the rebasing token, because that is where the liquidity a liquidator has to sell into actually sits. A wrapper is worth the share price times its onchain multiplier, read live from the wrapper. That multiplier is the part most tokenized equity lenders get wrong."],
  ['05', "Equis also speaks the Model Context Protocol, so Claude Code, Cursor, or Codex can drive it directly. Ask it to build a borrow and it returns unsigned calldata with a freshly signed price already inside. Same selector, same seventeen hundred bytes as the transaction that landed. The server holds no private key and signs nothing. It hands back bytes; a person or a wallet signs them."],
  ['06', "Under E I P seventy seven oh two, your own account runs the delegate, and grants a key scoped to named functions, capped in what it may spend, and expiring on its own. It can repay and top up collateral. It structurally cannot withdraw or borrow: no vault action takes a recipient, so there is nowhere to redirect funds to."],
  ['07', "A Telegram bot reads the same contracts, and messages you when a health factor slips below one point one five."],
  ['08', "Five contracts on mainnet, verified on Sourcify with an exact match. Thirty-five tests against forked mainnet state. And the README says what is not built, too: no yield router, and no S and P or Nasdaq collateral, because no public price feed exists for them."],
  ['09', "Equis. Credit against tokenized equities on X Layer, priced by a signature the chain checks itself, and reachable by a person or an agent."],
]

const only = process.env.VO_ONLY ? process.env.VO_ONLY.replace(/^v/, '') : null
const todo = SECTIONS.filter(([id]) => !only || id === only)
console.log('characters:', todo.reduce((n, s) => n + s[1].length, 0), 'in', todo.length, 'sections')
fs.mkdirSync('public/vo', { recursive: true })

;(async () => {
  for (const [id, text] of todo) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({
        text, model_id: MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.0, use_speaker_boost: true },
      }),
    })
    if (!res.ok) { console.error(`v${id}: ${res.status} ${(await res.text()).slice(0, 200)}`); continue }
    const buf = Buffer.from(await res.arrayBuffer())
    fs.writeFileSync(`public/vo/v${id}.mp3`, buf)
    console.log(`v${id}: ${(buf.length / 1024).toFixed(0)}kb`)
  }
})()
