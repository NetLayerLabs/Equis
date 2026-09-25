#!/usr/bin/env node
/*
 * The MCP beat, as a terminal you can film.
 *
 *   cd demo/remotion && node scripts/demo-mcp.mjs
 *
 * It drives the real MCP server over stdio - the same server Claude Code and Cursor launch - and prints
 * what comes back, paced so a camera can read it. Nothing here is staged: every line is the server's own
 * answer, and the calldata at the end is built live against X Layer mainnet.
 *
 * Runs about 40 seconds. The scene needs 26, so there is room to start filming late or stop early.
 */
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const C = {
  dim: (t) => `\x1b[38;5;244m${t}\x1b[0m`,
  brass: (t) => `\x1b[38;5;179m${t}\x1b[0m`,
  text: (t) => `\x1b[38;5;253m${t}\x1b[0m`,
  good: (t) => `\x1b[38;5;78m${t}\x1b[0m`,
  bold: (t) => `\x1b[1m${t}\x1b[0m`,
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const write = (s) => process.stdout.write(s)

/** Types a line out, so the film has motion rather than a wall of text appearing at once. */
async function type(line, ms = 26) {
  for (const ch of line) {
    write(ch)
    await wait(ms)
  }
  write('\n')
}

async function prompt(cmd) {
  write(C.brass('equis') + C.dim(' ~ ') + C.dim('$ '))
  await type(C.text(cmd), 30)
  await wait(500)
}

// ---------------------------------------------------------------- the server

const server = spawn('node', ['scripts/mcp-server.ts'], { cwd: REPO, stdio: ['pipe', 'pipe', 'inherit'] })
let buf = ''
const pending = new Map()
server.stdout.on('data', (d) => {
  buf += d.toString()
  for (let i; (i = buf.indexOf('\n')) >= 0; ) {
    const line = buf.slice(0, i).trim()
    buf = buf.slice(i + 1)
    if (!line) continue
    try {
      const msg = JSON.parse(line)
      const resolve = pending.get(msg.id)
      if (resolve) {
        pending.delete(msg.id)
        resolve(msg.result)
      }
    } catch {}
  }
})

let id = 0
const call = (method, params) =>
  new Promise((resolve) => {
    const n = ++id
    pending.set(n, resolve)
    server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n')
  })
const tool = async (name, args = {}) =>
  JSON.parse((await call('tools/call', { name, arguments: args })).content[0].text)

// ------------------------------------------------------------------- the run

console.clear()
write('\n')

await prompt('npm run mcp        # the Equis MCP server, over stdio')
await call('initialize', {
  protocolVersion: '2024-11-05',
  capabilities: {},
  clientInfo: { name: 'demo', version: '1' },
})
server.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
write(C.dim('  connected. ') + C.text('Claude Code, Claude Desktop, Cursor and Codex speak this.') + '\n\n')
await wait(900)

await prompt('list tools')
const { tools } = await call('tools/list')
for (const t of tools) {
  const kind = t.name === 'equis_build_transaction' ? C.brass('unsigned tx') : C.dim('read')
  write('  ' + C.text(t.name.padEnd(26)) + kind + '\n')
  await wait(130)
}
write('\n')
await wait(700)

await prompt('equis_position 0xc742AdA2872a042dD36D2E706907b4036968960C')
const pos = await tool('equis_position', { address: '0xc742AdA2872a042dD36D2E706907b4036968960C' })
write('  ' + C.dim('collateral   ') + C.text(`$${pos.collateralUsd.toFixed(2)}`) + '\n')
write('  ' + C.dim('debt         ') + C.text(`$${pos.debtUsd.toFixed(2)}`) + '\n')
write('  ' + C.dim('health       ') + C.good(pos.healthFactor.toFixed(3)) + '\n\n')
await wait(1100)

await prompt('equis_build_transaction --action borrow --amount 1')
const tx = await tool('equis_build_transaction', { action: 'borrow', amount: 1 })
const bytes = (tx.data.length - 2) / 2
write('  ' + C.dim('to        ') + C.text(tx.to) + '\n')
write('  ' + C.dim('selector  ') + C.text(tx.data.slice(0, 10)) + C.dim('  borrow(uint256,bytes[])') + '\n')
write('  ' + C.dim('calldata  ') + C.text(`${bytes.toLocaleString('en-US')} bytes`) + C.dim('  a RedStone package, signed 3 of 5') + '\n')
write('  ' + C.dim('value     ') + C.text(tx.value) + '\n\n')
await wait(800)

write('  ' + C.bold(C.brass('The server holds no key and signs nothing.')) + '\n')
write('  ' + C.dim('It returns bytes. A person or a wallet signs them.') + '\n\n')
await wait(2600)

server.kill()
process.exit(0)
